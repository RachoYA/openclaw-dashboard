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
 * Also attempts `openclaw sessions history` for recent messages.
 */
async function getSessionsList() {
  // Try JSON output first
  try {
    const { stdout } = await exec(
      OPENCLAW_BIN,
      ["sessions", "list", "--json", "--active-minutes=60"],
      { timeout: 15000, env: { ...process.env, NO_COLOR: "1" } }
    );
    const sessions = JSON.parse(stdout);
    return Array.isArray(sessions) ? sessions : sessions?.sessions || [];
  } catch {
    // noop
  }

  // Fallback: text parsing
  try {
    const { stdout } = await exec(
      OPENCLAW_BIN,
      ["sessions", "list"],
      { timeout: 15000, env: { ...process.env, NO_COLOR: "1" } }
    );
    return parseSessionsText(stdout);
  } catch {
    return [];
  }
}

/**
 * Parse text output of `openclaw sessions list` into structured data.
 * Handles various formats:
 *   "agent:pm:telegram:group:-5102635917  active 2m ago  model claude-opus-4-6"
 *   "agent:pm:... │ idle │ 2m ago │ claude-opus-4-6"
 */
function parseSessionsText(text) {
  if (!text) return [];
  const sessions = [];
  for (const line of text.split("\n")) {
    // Match agent:<id>: pattern in session key
    const match = line.match(/agent:(\w+):/);
    if (!match) continue;

    const agentId = match[1];
    const sessionKey = line.trim().split(/[\s│]+/)[0];

    // Parse age: "2m ago", "30s ago", "1h ago"
    const activeMatch = line.match(/(\d+)\s*([smh])\s*(?:ago)?/);
    let lastMessageAge = 9999;
    if (activeMatch) {
      const val = parseInt(activeMatch[1], 10);
      const unit = activeMatch[2];
      lastMessageAge = unit === "h" ? val * 3600 : unit === "m" ? val * 60 : val;
    }

    // Try to extract status hint from text
    let statusHint = null;
    if (/\b(active|running)\b/i.test(line)) statusHint = "active";
    if (/\b(idle)\b/i.test(line)) statusHint = "idle";

    // Try to extract last message snippet
    const msgMatch = line.match(/last:\s*"?(.+?)"?\s*$/);
    const lastMessage = msgMatch ? msgMatch[1].trim() : null;

    sessions.push({ key: sessionKey, agentId, lastMessageAge, statusHint, lastMessage });
  }
  return sessions;
}

/**
 * Fetch recent session history to extract currentTask.
 * Looks for task-related patterns in the last few messages.
 */
async function getAgentCurrentTask(agentId, sessions) {
  // Find session key for this agent
  const agentSession = sessions?.find((s) => s.key?.includes(agentId) || s.agentId === agentId);
  if (!agentSession?.key) return null;

  try {
    const { stdout } = await exec(
      OPENCLAW_BIN,
      ["sessions", "history", agentSession.key, "--limit=5", "--json"],
      { timeout: 10000, env: { ...process.env, NO_COLOR: "1" } }
    );
    const history = JSON.parse(stdout);
    const messages = Array.isArray(history) ? history : history?.messages || [];

    // Look for task patterns in recent messages
    for (const msg of messages) {
      const text = msg?.content || msg?.text || msg?.message || "";
      // Match common task patterns
      const taskPatterns = [
        /(?:✅\s*Принял?|задача|task|working on|делаю)[:：]?\s*(.{10,80})/i,
        /(?:Phase|Фаза)\s+\d+\s*[-—:]\s*(.{10,60})/i,
        /(?:PR|pull request)\s*#?\d+/i,
      ];
      for (const pat of taskPatterns) {
        const m = text.match(pat);
        if (m) return m[1]?.trim() || m[0]?.trim();
      }
    }
  } catch {
    // History not available
  }
  return null;
}

/**
 * Infer agent status from session data.
 * Maps real session activity to dashboard animation states.
 *
 * Status mapping:
 *   < 15s  → "talking"    (actively in conversation)
 *   < 60s  → "working"    (recently active)
 *   < 180s → "thinking"   (processing / waiting for response)
 *   < 600s → "idle"       (quiet but awake)
 *   < 1800s → "waiting"   (been a while)
 *   >= 1800s → "sleeping" (inactive 30+ minutes)
 *
 * Role-specific overrides:
 *   devops + recently active → "deploying"
 *   qa + recently active → "testing"
 *   techlead + recently active → "reviewing"
 */
function inferStatus(agentId, sessions, heartbeatActive) {
  if (!heartbeatActive) return "sleeping";

  const agentSessions = sessions?.filter(
    (s) => s.key?.includes(agentId) || s.agentId === agentId
  ) || [];
  if (agentSessions.length === 0) return "idle";

  const minAge = Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999));

  // Role-specific statuses for recently active agents
  if (minAge < 120) {
    const roleMap = { devops: "deploying", qa: "testing", techlead: "reviewing" };
    if (roleMap[agentId]) return roleMap[agentId];
  }

  if (minAge < 15) return "talking";
  if (minAge < 60) return "working";
  if (minAge < 180) return "thinking";
  if (minAge < 600) return "idle";
  if (minAge < 1800) return "waiting";
  return "sleeping";
}

/**
 * Extract last message text from session data for an agent.
 * Prefers explicit lastMessage field, falls back to statusHint.
 */
function getLastMessage(agentId, sessions) {
  const agentSessions = sessions?.filter(
    (s) => s.key?.includes(agentId) || s.agentId === agentId
  ) || [];
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

  // Fetch current tasks in parallel for all agents
  const taskPromises = Object.keys(AGENT_POSITIONS).map(async (id) => {
    try {
      return [id, await getAgentCurrentTask(id, sessions)];
    } catch {
      return [id, null];
    }
  });
  const taskResults = await Promise.all(taskPromises);
  const taskMap = Object.fromEntries(taskResults);

  for (const [id, pos] of Object.entries(AGENT_POSITIONS)) {
    const isActive = heartbeats[id] !== false;
    const status = inferStatus(id, sessions, isActive);
    const lastMessage = getLastMessage(id, sessions);

    // Determine lastActiveAt from sessions
    const agentSessions = sessions?.filter(
      (s) => s.key?.includes(id) || s.agentId === id
    ) || [];
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
      currentTask: taskMap[id] || null,
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
