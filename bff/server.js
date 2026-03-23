/**
 * BFF (Backend-for-Frontend) for OpenClaw Agent Dashboard.
 *
 * Reads agent/session state directly from OpenClaw data files (no binary required).
 * Caches in Redis, publishes updates via Redis pub/sub, serves WebSocket to dashboard.
 *
 * Env:
 *   PORT              — HTTP + WebSocket server port (default 3101)
 *   POLL_INTERVAL     — ms between status polls (default 10000)
 *   OPENCLAW_DATA_DIR — path to openclaw agents dir (default /openclaw-data/agents)
 *   REDIS_URL         — Redis connection URL (default "redis://localhost:6379")
 */

import { WebSocketServer } from "ws";
import { createClient } from "redis";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const PORT = parseInt(process.env.PORT || "3101", 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "10000", 10);
const OPENCLAW_DATA_DIR = process.env.OPENCLAW_DATA_DIR || "/openclaw-data/agents";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const GITHUB_REPOS = (process.env.GITHUB_REPOS || "RachoYA/ventMaind,RachoYA/openclaw-dashboard").split(",");

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
// OpenClaw data reading — direct file access, no binary required
// ---------------------------------------------------------------------------

/**
 * Read sessions.json for every agent in OPENCLAW_DATA_DIR.
 * Returns flat array of session entries with agentId + lastMessageAge.
 */
async function readAgentSessions() {
  const sessions = [];
  let agentDirs;
  try {
    agentDirs = await readdir(OPENCLAW_DATA_DIR);
  } catch (err) {
    console.warn(`⚠️  Cannot read agents dir (${OPENCLAW_DATA_DIR}):`, err.message);
    return sessions;
  }

  const now = Date.now();

  await Promise.all(
    agentDirs.map(async (agentId) => {
      const sessionsPath = join(OPENCLAW_DATA_DIR, agentId, "sessions", "sessions.json");
      try {
        const raw = await readFile(sessionsPath, "utf8");
        const data = JSON.parse(raw);
        for (const [key, s] of Object.entries(data)) {
          const updatedAt = s.updatedAt ? Number(s.updatedAt) : null;
          const lastMessageAge = updatedAt ? Math.floor((now - updatedAt) / 1000) : 9999;
          sessions.push({
            key,
            agentId,
            lastMessageAge,
            model: s.model || null,
            channel: s.lastChannel || s.channel || null,
          });
        }
      } catch {
        // Agent may not have sessions yet — skip silently
      }
    })
  );

  return sessions;
}

// ---------------------------------------------------------------------------
// Status stabilization — prevent flickering between polls
// ---------------------------------------------------------------------------
const statusHistory = {};
const STATUS_HOLD_MS = 30000; // Hold status for at least 30s

function stabilizeStatus(agentId, newStatus) {
  const prev = statusHistory[agentId];
  const now = Date.now();

  if (!prev || prev.status === newStatus) {
    statusHistory[agentId] = { status: newStatus, since: now };
    return newStatus;
  }

  // Don't change status if held less than 30s (prevents flickering)
  if (now - prev.since < STATUS_HOLD_MS) {
    return prev.status;
  }

  statusHistory[agentId] = { status: newStatus, since: now };
  return newStatus;
}

/**
 * Find sessions belonging to a specific agent.
 */
function findAgentSessions(agentId, sessions) {
  if (!sessions || !Array.isArray(sessions)) return [];
  return sessions.filter((s) => s.agentId === agentId);
}

/**
 * Infer agent status from session timestamps.
 *
 * Status mapping:
 *   < 15s   → "talking"    (actively in conversation)
 *   < 60s   → "working"    (recently active)
 *   < 180s  → "thinking"   (processing / waiting for response)
 *   < 600s  → "idle"       (quiet but awake)
 *   < 1800s → "waiting"    (been a while)
 *   >= 1800s → "sleeping"  (inactive 30+ minutes)
 *
 * Role-specific overrides for recently active agents:
 *   devops → "deploying", qa → "testing", techlead → "reviewing"
 */
function inferStatus(agentId, sessions) {
  const agentSessions = findAgentSessions(agentId, sessions);

  // No sessions → idle (agent exists but hasn't been active)
  if (agentSessions.length === 0) return "idle";

  const minAge = Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999));

  // Role-specific statuses for recently active agents
  if (minAge < 120) {
    const roleMap = { devops: "deploying", qa: "testing", techlead: "reviewing" };
    if (roleMap[agentId]) return roleMap[agentId];
  }

  if (minAge < 15)   return "talking";
  if (minAge < 60)   return "working";
  if (minAge < 180)  return "thinking";
  if (minAge < 600)  return "idle";
  if (minAge < 1800) return "waiting";
  return "sleeping";
}

/**
 * Get agent's current task based on role and activity.
 */
function getAgentCurrentTask(agentId, sessions, status) {
  const agentSessions = findAgentSessions(agentId, sessions);
  const minAge = agentSessions.length > 0
    ? Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999))
    : 9999;

  if (minAge > 600) return null;

  const ROLE_TASKS = {
    pm:       ["Координация команды", "Распределение задач", "Статус-апдейт"],
    dev:      ["Разработка фич", "Фикс багов", "Code push"],
    analyst:  ["Анализ требований", "Сценарии тестирования", "Документация"],
    devops:   ["Деплой и инфраструктура", "Docker / CI", "Мониторинг"],
    qa:       ["Тестирование", "Ревью QA", "Написание тест-кейсов"],
    techlead: ["Ревью PR", "Архитектурный анализ", "Фикс критичных багов"],
  };

  const tasks = ROLE_TASKS[agentId] || ["Работа"];
  if (status === "reviewing")  return "Ревью PR";
  if (status === "deploying")  return "Деплой";
  if (status === "testing")    return "Тестирование";
  if (status === "talking")    return tasks[0];
  if (status === "working")    return tasks[1] || tasks[0];
  if (status === "thinking")   return tasks[2] || tasks[0];
  return tasks[0];
}

async function buildAgentStates() {
  const sessions = await readAgentSessions();
  const agents = [];

  for (const [id, pos] of Object.entries(AGENT_POSITIONS)) {
    const rawStatus = inferStatus(id, sessions);
    const status = stabilizeStatus(id, rawStatus);
    const currentTask = getAgentCurrentTask(id, sessions, status);

    const agentSessions = findAgentSessions(id, sessions);
    const minAge = agentSessions.length > 0
      ? Math.min(...agentSessions.map((s) => s.lastMessageAge ?? 9999))
      : null;
    const lastActiveAt = minAge !== null && minAge < 86400
      ? new Date(Date.now() - minAge * 1000).toISOString()
      : null;

    agents.push({
      id,
      name: AGENT_NAMES[id] || id,
      role: AGENT_ROLES[id] || "Agent",
      status,
      currentTask,
      lastMessage: null,
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
// GitHub API — real counters (PRs, issues, commits)
// ---------------------------------------------------------------------------

const ghHeaders = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "openclaw-dashboard-bff",
  ...(GITHUB_TOKEN ? { "Authorization": `Bearer ${GITHUB_TOKEN}` } : {}),
};

let cachedMetrics = null;
let metricsLastFetch = 0;
const METRICS_CACHE_MS = 60000;

async function fetchGitHub(path) {
  try {
    const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getGitHubMetrics() {
  const metrics = { openPRs: 0, mergedPRs24h: 0, openIssues: 0, closedIssues24h: 0, commits24h: 0 };

  for (const repo of GITHUB_REPOS) {
    const r = repo.trim();
    if (!r) continue;

    const prs = await fetchGitHub(`/repos/${r}/pulls?state=open&per_page=100`);
    if (prs) metrics.openPRs += prs.length;

    const closedPrs = await fetchGitHub(`/repos/${r}/pulls?state=closed&sort=updated&direction=desc&per_page=30`);
    if (closedPrs) {
      const dayAgo = Date.now() - 86400000;
      metrics.mergedPRs24h += closedPrs.filter(
        (p) => p.merged_at && new Date(p.merged_at).getTime() > dayAgo
      ).length;
    }

    const issues = await fetchGitHub(`/repos/${r}/issues?state=open&labels=bug&per_page=100`);
    if (issues) metrics.openIssues += issues.length;

    const closedIssues = await fetchGitHub(`/repos/${r}/issues?state=closed&sort=updated&direction=desc&per_page=30`);
    if (closedIssues) {
      const dayAgo = Date.now() - 86400000;
      metrics.closedIssues24h += closedIssues.filter(
        (i) => i.closed_at && new Date(i.closed_at).getTime() > dayAgo
      ).length;
    }

    const since = new Date(Date.now() - 86400000).toISOString();
    const commits = await fetchGitHub(`/repos/${r}/commits?since=${since}&per_page=100`);
    if (commits) metrics.commits24h += commits.length;
  }

  return metrics;
}

async function getMetrics() {
  const now = Date.now();
  if (cachedMetrics && now - metricsLastFetch < METRICS_CACHE_MS) {
    return cachedMetrics;
  }

  const activeAgents = latestState.filter((a) => a.status !== "sleeping" && a.status !== "idle").length;
  const ghMetrics = await getGitHubMetrics();

  cachedMetrics = {
    agents: {
      total: latestState.length,
      active: activeAgents,
    },
    github: ghMetrics,
    sessions: {
      active: latestState.length,
    },
    timestamp: new Date().toISOString(),
  };
  metricsLastFetch = now;
  return cachedMetrics;
}

// ---------------------------------------------------------------------------
// HTTP server (health + REST) + WebSocket
// ---------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    const health = {
      status: "healthy",
      redis: redisConnected,
      agents: latestState.length,
      uptime: Math.floor(process.uptime()),
      dataDir: OPENCLAW_DATA_DIR,
    };
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(health));
    return;
  }

  if (req.url === "/events") {
    getRecentEvents().then((events) => {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(events));
    });
    return;
  }

  if (req.url === "/metrics") {
    getMetrics().then((metrics) => {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(metrics));
    });
    return;
  }

  if (req.url === "/" || req.url === "/ws" || req.url === "/db/ws") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ status: "ok", hint: "Connect via WebSocket for live data" }));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

const wss = new WebSocketServer({ server: httpServer });
let latestState = [];
let pollCount = 0;

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

  getRecentEvents(20).then((events) => {
    if (events.length > 0 && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "events", data: events }));
    }
  }).catch(() => {});

  getMetrics().then((m) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "metrics", data: m }));
    }
  }).catch(() => {});

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

    if (pollCount % 6 === 0) {
      getMetrics().then((m) => {
        broadcastWs(JSON.stringify({ type: "metrics", data: m }));
      }).catch(() => {});
    }
    pollCount++;

    const payloadStr = JSON.stringify(payload);

    if (redisConnected) {
      await redisCache.set(CACHE_KEY_AGENTS, payloadStr, { EX: CACHE_TTL });
      await redisPublisher.publish(CHANNEL_AGENTS, payloadStr);
    } else {
      broadcastWs(payloadStr);
    }

    // Detect status changes → log + broadcast events
    const newEvents = [];
    for (const agent of latestState) {
      const prev = previousStatuses[agent.id];
      if (prev && prev !== agent.status) {
        const event = {
          type: "status_change",
          agentId: agent.id,
          agentName: agent.name,
          from: prev,
          to: agent.status,
          timestamp: new Date().toISOString(),
        };
        await logEvent(event);
        newEvents.push(event);
      }
      previousStatuses[agent.id] = agent.status;
    }

    if (newEvents.length > 0) {
      broadcastWs(JSON.stringify({ type: "events", data: newEvents }));
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log(`🎮 Dashboard BFF starting on http://localhost:${PORT}`);
console.log(`   Polling data dir every ${POLL_INTERVAL / 1000}s`);
console.log(`   OpenClaw data: ${OPENCLAW_DATA_DIR}`);
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
