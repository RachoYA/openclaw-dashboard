/**
 * WebSocket client — connects to BFF and updates AgentStore in real time.
 * Includes exponential backoff reconnect to prevent OOM from rapid retries.
 */
import { useAgentStore } from "./AgentStore";
import { useActivityStore } from "./ActivityStore";
import { useMetricsStore } from "./MetricsStore";

/** Track previous statuses to detect changes → generate activity events */
const prevStatuses = new Map<string, string>();

const STATUS_EVENT_MAP: Record<string, { type: "message" | "task_started" | "task_completed" | "deploy" | "review"; text: string }> = {
  working: { type: "task_started", text: "начал работу" },
  talking: { type: "message", text: "общается" },
  thinking: { type: "message", text: "думает над задачей" },
  deploying: { type: "deploy", text: "деплоит" },
  reviewing: { type: "review", text: "ревьюит код" },
  testing: { type: "task_started", text: "тестирует" },
  sleeping: { type: "message", text: "ушёл спать" },
  celebrating: { type: "task_completed", text: "празднует завершение" },
};

function getWsUrl(): string {
  if (import.meta.env.VITE_BFF_WS_URL) return import.meta.env.VITE_BFF_WS_URL;
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/db/ws`;
}

const BFF_URL = getWsUrl();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30s max

/** Connection state — exposed for UI indicators */
export type WSStatus = "disconnected" | "connecting" | "connected" | "demo";
let currentStatus: WSStatus = "disconnected";
const statusListeners = new Set<(s: WSStatus) => void>();

export function getWSStatus(): WSStatus { return currentStatus; }
export function onWSStatusChange(cb: (s: WSStatus) => void): () => void {
  statusListeners.add(cb);
  return () => { statusListeners.delete(cb); };
}
function setStatus(s: WSStatus) {
  if (currentStatus === s) return; // skip duplicate
  currentStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

interface BFFMessage {
  type: "agents" | "metrics" | "events";
  data: any;
}

function scheduleReconnect() {
  if (reconnectTimer) return; // already scheduled
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  setStatus("connecting");
  console.log(`[WS] Connecting to ${BFF_URL}...`);

  try {
    ws = new WebSocket(BFF_URL);
  } catch (err) {
    console.warn("[WS] Failed to create WebSocket:", err);
    setStatus("demo");
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[WS] Connected to BFF");
    setStatus("connected");
    reconnectAttempts = 0; // reset backoff on success
  };

  ws.onmessage = (event) => {
    try {
      const msg: BFFMessage = JSON.parse(event.data as string);
      if (msg.type === "agents" && Array.isArray(msg.data)) {
        const store = useAgentStore.getState();
        if (store.setAgents) {
          store.setAgents(msg.data);
        } else {
          // Fallback: update individually
          for (const agent of msg.data) {
            store.updateAgent(agent.id, {
              status: agent.status,
              currentTask: agent.currentTask,
              lastMessage: agent.lastMessage,
              lastActiveAt: agent.lastActiveAt,
              tileX: agent.tileX,
              tileY: agent.tileY,
              direction: agent.direction,
            });
          }
        }

        // Generate activity events from status changes
        const actStore = useActivityStore.getState();
        for (const agent of msg.data) {
          const prev = prevStatuses.get(agent.id);
          if (prev && prev !== agent.status && agent.status !== "idle") {
            const ev = STATUS_EVENT_MAP[agent.status];
            if (ev) actStore.addEvent(agent.id, ev.type as any, ev.text);
          }
          prevStatuses.set(agent.id, agent.status);
        }
      } else if (msg.type === "metrics" && msg.data) {
        // Real metrics from BFF (GitHub + OpenClaw)
        useMetricsStore.getState().setMetrics(msg.data);
      } else if (msg.type === "events" && Array.isArray(msg.data)) {
        // Real events from BFF (status changes)
        const actStore = useActivityStore.getState();
        for (const ev of msg.data) {
          if (ev.agentId && ev.to) {
            const mapped = STATUS_EVENT_MAP[ev.to];
            if (mapped) actStore.addEvent(ev.agentId, mapped.type as any, `${ev.agentName}: ${mapped.text}`);
          }
        }
      }
    } catch (err) {
      console.warn("[WS] Parse error:", err);
    }
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected");
    ws = null;
    setStatus("demo");
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onerror always fires before onclose — just log, don't reconnect here
    console.warn("[WS] Connection error");
  };
}

export function startWSClient() {
  connect();
}

export function stopWSClient() {
  reconnectAttempts = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); ws = null; }
  setStatus("disconnected");
}
