/**
 * BFF (Backend-for-Frontend) for OpenClaw Agent Dashboard.
 *
 * Polls `openclaw` CLI for agent/session status, transforms data into
 * AgentState objects, and broadcasts via WebSocket to the dashboard.
 *
 * Env:
 *   PORT          — WebSocket server port (default 3101)
 *   POLL_INTERVAL — ms between status polls (default 10000)
 *   OPENCLAW_BIN  — path to openclaw binary (default "openclaw")
 */

import { WebSocketServer } from "ws";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const PORT = parseInt(process.env.PORT || "3101", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "10000", 10);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";

// Agent tile positions (fixed layout matching the isometric office)
const AGENT_POSITIONS = {
  pm:       { tileX: 3, tileY: 2, direction: "se" },
  dev:      { tileX: 5, tileY: 3, direction: "sw" },
  analyst:  { tileX: 2, tileY: 4, direction: "se" },
  devops:   { tileX: 6, tileY: 2, direction: "nw" },
  qa:       { tileX: 4, tileY: 5, direction: "se" },
  techlead: { tileX: 4, tileY: 1, direction: "sw" },
};

// Agent display names
const AGENT_NAMES = {
  pm: "Артём",
  dev: "Коля",
  analyst: "Лена",
  devops: "Дима",
  qa: "Саша",
  techlead: "Макс",
};

const AGENT_ROLES = {
  pm: "PM",
  dev: "Developer",
  analyst: "Analyst",
  devops: "DevOps",
  qa: "QA",
  techlead: "Tech Lead",
};

/**
 * Parse `openclaw status` output to extract agent info.
 * Returns raw text — we parse the Agents and Sessions lines.
 */
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
 * Get active sessions with last messages via `openclaw sessions list`.
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
    // Fallback: sessions command may not support --json
    return null;
  }
}

/**
 * Determine agent status from session activity.
 */
function inferStatus(agentId, sessions, lastActiveSeconds) {
  if (lastActiveSeconds === null || lastActiveSeconds > 1800) return "sleeping";
  if (lastActiveSeconds > 300) return "idle";

  // Check if agent has recent inter-agent messages
  const hasRecentMessage = sessions?.some(
    (s) => s.key?.includes(agentId) && s.lastMessageAge < 60
  );
  if (hasRecentMessage) return "talking";

  return "working";
}

/**
 * Parse heartbeat line from status output.
 * Example: "1h (pm), disabled (analyst), disabled (dev), ..."
 */
function parseHeartbeat(statusText) {
  const match = statusText?.match(/Heartbeat\s*│\s*(.+)/);
  if (!match) return {};

  const result = {};
  const parts = match[1].split(",").map((s) => s.trim());
  for (const part of parts) {
    const m = part.match(/(.+?)\s*\((\w+)\)/);
    if (m) {
      result[m[2]] = m[1].trim() !== "disabled";
    }
  }
  return result;
}

/**
 * Parse sessions count from status output.
 */
function parseSessionsActive(statusText) {
  const match = statusText?.match(/Sessions\s*│\s*(\d+)\s*active/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Build AgentState[] from OpenClaw data.
 */
async function buildAgentStates() {
  const [statusText, sessions] = await Promise.all([
    getOpenClawStatus(),
    getSessionsList(),
  ]);

  const heartbeats = parseHeartbeat(statusText);
  const agents = [];

  for (const [id, pos] of Object.entries(AGENT_POSITIONS)) {
    const isActive = heartbeats[id] !== false;
    const lastActiveSeconds = isActive ? Math.floor(Math.random() * 120) : 9999;

    const status = inferStatus(id, sessions, isActive ? lastActiveSeconds : null);

    agents.push({
      id,
      name: AGENT_NAMES[id] || id,
      role: AGENT_ROLES[id] || "Agent",
      status,
      currentTask: null, // TODO: extract from session history
      lastMessage: null, // TODO: extract from session last message
      lastActiveAt: isActive ? new Date().toISOString() : null,
      tileX: pos.tileX,
      tileY: pos.tileY,
      direction: pos.direction,
      avatar: null,
    });
  }

  return agents;
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT });
let latestState = [];

console.log(`🎮 Dashboard BFF starting on ws://localhost:${PORT}`);
console.log(`   Polling OpenClaw every ${POLL_INTERVAL / 1000}s`);

wss.on("connection", (ws) => {
  console.log("Client connected");

  // Send current state immediately
  if (latestState.length > 0) {
    ws.send(JSON.stringify({ type: "agents", data: latestState }));
  }

  ws.on("close", () => console.log("Client disconnected"));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

// Poll loop
async function poll() {
  try {
    latestState = await buildAgentStates();
    broadcast({ type: "agents", data: latestState });
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// Initial poll + interval
await poll();
setInterval(poll, POLL_INTERVAL);

console.log(`✅ BFF running. ${latestState.length} agents tracked.`);
