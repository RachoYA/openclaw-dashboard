/**
 * BFF (Backend-for-Frontend) for OpenClaw Agent Dashboard.
 *
 * Polls `openclaw` CLI for agent/session status, caches in Redis,
 * publishes updates via Redis pub/sub, and serves WebSocket to dashboard.
 *
 * Env:
 *   PORT          — HTTP + WebSocket server port (default 3101)
 *   POLL_INTERVAL — ms between status polls (default 10000)
 *   OPENCLAW_BIN  — path to openclaw binary (default "openclaw")
 *   REDIS_URL     — Redis connection URL (default "redis://localhost:6379")
 */

import { WebSocketServer } from "ws";
import { createClient } from "redis";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";

const exec = promisify(execFile);

const PORT = parseInt(process.env.PORT || "3101", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "10000", 10);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Redis channels
const CHANNEL_AGENTS = "dashboard:agents";
const CACHE_KEY_AGENTS = "dashboard:agents:latest";
const CACHE_KEY_EVENTS = "dashboard:events";
const CACHE_TTL = 60; // seconds

// Agent tile positions (fixed layout matching the isometric office)
const AGENT_POSITIONS = {
  pm:       { tileX: 3, tileY: 2, direction: "se" },
  dev:      { tileX: 5, tileY: 3, direction: "sw" },
  analyst:  { tileX: 2, tileY: 4, direction: "se" },
  devops:   { tileX: 6, tileY: 2, direction: "nw" },
  qa:       { tileX: 4, tileY: 5, direction: "se" },
  techlead: { tileX: 4, tileY: 1, direction: "sw" },
};

const AGENT_NAMES = {
  pm: "Артём", dev: "Коля", analyst: "Лена",
  devops: "Дима", qa: "Саша", techlead: "Макс",
};

const AGENT_ROLES = {
  pm: "PM", dev: "Developer", analyst: "Analyst",
  devops: "DevOps", qa: "QA", techlead: "Tech Lead",
};

// ---------------------------------------------------------------------------
// Redis setup
// ---------------------------------------------------------------------------

let redisPublisher = null;
let redisSubscriber = null;
let redisCache = null;
let redisConnected = false;

async function setupRedis() {
  try {
    redisPublisher = createClient({ url: REDIS_URL });
    redisSubscriber = redisPublisher.duplicate();
    redisCache = redisPublisher.duplicate();

    redisPublisher.on("error", (err) => console.error("Redis pub error:", err.message));
    redisSubscriber.on("error", (err) => console.error("Redis sub error:", err.message));
    redisCache.on("error", (err) => console.error("Redis cache error:", err.message));

    await Promise.all([
      redisPublisher.connect(),
      redisSubscriber.connect(),
      redisCache.connect(),
    ]);

    redisConnected = true;
    console.log("✅ Redis connected:", REDIS_URL);

    // Subscribe to agent updates (for multi-instance scaling)
    await redisSubscriber.subscribe(CHANNEL_AGENTS, (message) => {
      broadcastWs(message);
    });
  } catch (err) {
    console.warn("⚠️  Redis unavailable, running without cache:", err.message);
    redisConnected = false;
  }
}

// ---------------------------------------------------------------------------
// OpenClaw polling
// ---------------------------------------------------------------------------

async function getOpenClawStatus() {
  try {
    const { stdout } = await exec(OPENCLAW_BIN, ["status"], {
      timeout: 15000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return stdout;
  } catch (err) {
    console.error("Failed to get openclaw status:", err.message);
    return null;
  }
}

/**
 * Get sessions via `openclaw sessions list`.
 * Tries --json first, falls back to text parsing.
 */
async function getSessionsList() {
  try {
    const { stdout } = await exec(
      OPENCLAW_BIN,
      ["sessions", "list", "--json", "--active-minutes=60"],
      { timeout: 15000, env: { ...process.env, NO_COLOR: "1" } }
    );
    return JSON.parse(stdout);
  } catch {
    // Fallback: try without --json
    try {
      const { stdout } = await exec(
        OPENCLAW_BIN,
        ["sessions", "list"],
        { timeout: 15000, env: { ...process.env, NO_COLOR: "1" } }
      );
      return parseSessionsText(stdout);
    } catch {
      return null;
    }
  }
}

/**
 * Parse text output of `openclaw sessions list` into structured data.
 * Lines like: "agent:pm:telegram:group:-5102635917  active 2m ago  model claude-opus-4-6"
 */
function parseSessionsText(text) {
  if (!text) return null;
  const sessions = [];
  for (const line of text.split("\n")) {
    const match = line.match(/agent:(\w+):/);
    if (match) {
      const agentId = match[1];
      const activeMatch = line.match(/active\s+(\d+)([smh])\s+ago/);
      let lastMessageAge = 9999;
      if (activeMatch) {
        const val = parseInt(activeMatch[1], 10);
        const unit = activeMatch[2];
        lastMessageAge = unit === "h" ? val * 3600 : unit === "m" ? val * 60 : val;
      }
      sessions.push({ key: line.trim().split(/\s+/)[0], agentId, lastMessageAge });
    }
  }
  return sessions;
}

/**
 * Infer agent status from session data.
 * Uses real lastMessageAge from sessions, not random values.
 */
function inferStatus(agentId, sessions, heartbeatActive) {
  if (!heartbeatActive) return "sleeping";

  // Find the most recent session for this agent
  const agentSessions = sessions?.filter((s) => s.key?.includes(agentId) || s.agentId === agentId) || [];
  if (agentSessions.length === 0) return "idle";

  const minAge = Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999));

  if (minAge < 30) return "talking";     // Active conversation in last 30s
  if (minAge < 120) return "working";    // Activity in last 2 min
  if (minAge < 300) return "thinking";   // Activity in last 5 min
  if (minAge < 1800) return "idle";      // Activity in last 30 min
  return "sleeping";
}

/**
 * Extract last message text from session data for an agent.
 */
function getLastMessage(agentId, sessions) {
  const agentSessions = sessions?.filter((s) => s.key?.includes(agentId) || s.agentId === agentId) || [];
  // If session has lastMessage field
  for (const s of agentSessions) {
    if (s.lastMessage) return s.lastMessage;
  }
  return null;
}

function parseHeartbeat(statusText) {
  const match = statusText?.match(/Heartbeat\s*│\s*(.+)/);
  if (!match) return {};
  const result = {};
  for (const part of match[1].split(",").map((s) => s.trim())) {
    const m = part.match(/(.+?)\s*\((\w+)\)/);
    if (m) result[m[2]] = m[1].trim() !== "disabled";
  }
  return result;
}

async function buildAgentStates() {
  const [statusText, sessions] = await Promise.all([
    getOpenClawStatus(),
    getSessionsList(),
  ]);

  const heartbeats = parseHeartbeat(statusText);
  const agents = [];

  for (const [id, pos] of Object.entries(AGENT_POSITIONS)) {
    const isActive = heartbeats[id] !== false;
    const status = inferStatus(id, sessions, isActive);
    const lastMessage = getLastMessage(id, sessions);

    // Determine lastActiveAt from sessions
    const agentSessions = sessions?.filter((s) => s.key?.includes(id) || s.agentId === id) || [];
    const minAge = agentSessions.length > 0
      ? Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999))
      : null;
    const lastActiveAt = minAge !== null && minAge < 3600
      ? new Date(Date.now() - minAge * 1000).toISOString()
      : null;

    agents.push({
      id,
      name: AGENT_NAMES[id] || id,
      role: AGENT_ROLES[id] || "Agent",
      status,
      currentTask: null, // TODO Phase 4: extract from session history context
      lastMessage,
      lastActiveAt,
      tileX: pos.tileX,
      tileY: pos.tileY,
      direction: pos.direction,
      avatar: null,
    });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// Event log (stored in Redis list, last 100 events)
// ---------------------------------------------------------------------------

async function logEvent(event) {
  if (!redisConnected) return;
  try {
    const entry = JSON.stringify({ ...event, timestamp: new Date().toISOString() });
    await redisCache.lPush(CACHE_KEY_EVENTS, entry);
    await redisCache.lTrim(CACHE_KEY_EVENTS, 0, 99);
  } catch (err) {
    console.error("Failed to log event:", err.message);
  }
}

async function getRecentEvents(count = 20) {
  if (!redisConnected) return [];
  try {
    const raw = await redisCache.lRange(CACHE_KEY_EVENTS, 0, count - 1);
    return raw.map((r) => JSON.parse(r));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// HTTP server (health endpoint) + WebSocket
// ---------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    const health = {
      status: "healthy",
      redis: redisConnected,
      agents: latestState.length,
      uptime: Math.floor(process.uptime()),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
    return;
  }

  // Recent events endpoint
  if (req.url === "/events") {
    getRecentEvents().then((events) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(events));
    });
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

const wss = new WebSocketServer({ server: httpServer });
let latestState = [];

wss.on("connection", async (ws) => {
  console.log("Client connected");

  // Try to serve from Redis cache first
  if (redisConnected) {
    try {
      const cached = await redisCache.get(CACHE_KEY_AGENTS);
      if (cached) {
        ws.send(cached);
        ws.on("close", () => console.log("Client disconnected"));
        return;
      }
    } catch {}
  }

  // Fallback to in-memory state
  if (latestState.length > 0) {
    ws.send(JSON.stringify({ type: "agents", data: latestState }));
  }

  ws.on("close", () => console.log("Client disconnected"));
});

function broadcastWs(message) {
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(typeof message === "string" ? message : JSON.stringify(message));
    }
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

let previousStatuses = {};

async function poll() {
  try {
    latestState = await buildAgentStates();
    const payload = { type: "agents", data: latestState };
    const payloadStr = JSON.stringify(payload);

    // Cache in Redis
    if (redisConnected) {
      await redisCache.set(CACHE_KEY_AGENTS, payloadStr, { EX: CACHE_TTL });
      await redisPublisher.publish(CHANNEL_AGENTS, payloadStr);
    } else {
      // No Redis — broadcast directly
      broadcastWs(payloadStr);
    }

    // Detect status changes and log events
    for (const agent of latestState) {
      const prev = previousStatuses[agent.id];
      if (prev && prev !== agent.status) {
        await logEvent({
          type: "status_change",
          agentId: agent.id,
          agentName: agent.name,
          from: prev,
          to: agent.status,
        });
      }
      previousStatuses[agent.id] = agent.status;
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log(`🎮 Dashboard BFF starting on http://localhost:${PORT}`);
console.log(`   Polling OpenClaw every ${POLL_INTERVAL / 1000}s`);
console.log(`   Redis: ${REDIS_URL}`);

await setupRedis();
await poll();
setInterval(poll, POLL_INTERVAL);

httpServer.listen(PORT, () => {
  console.log(`✅ BFF running. ${latestState.length} agents tracked.`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Events: http://localhost:${PORT}/events`);
  console.log(`   WS:     ws://localhost:${PORT}`);
});
