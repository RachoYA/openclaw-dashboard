/**
 * WebSocket client — connects to BFF and updates AgentStore in real time.
 */
import { useAgentStore } from "./AgentStore";
import type { AgentState } from "./types";

/**
 * Determine WebSocket URL:
 * 1. Explicit VITE_BFF_WS_URL env var
 * 2. Relative to current host: wss://host/db/ws (or ws:// for localhost)
 */
function getWsUrl(): string {
  if (import.meta.env.VITE_BFF_WS_URL) return import.meta.env.VITE_BFF_WS_URL;

  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/db/ws`;
}

const BFF_URL = getWsUrl();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/** Connection state — exposed for UI indicators */
export type WSStatus = "disconnected" | "connecting" | "connected" | "demo";
let currentStatus: WSStatus = "disconnected";
const statusListeners = new Set<(s: WSStatus) => void>();

export function getWSStatus(): WSStatus { return currentStatus; }
export function onWSStatusChange(cb: (s: WSStatus) => void) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}
function setStatus(s: WSStatus) {
  currentStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

interface BFFMessage {
  type: "agents";
  data: AgentState[];
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;

  setStatus("connecting");
  console.log(`[WS] Connecting to ${BFF_URL}...`);
  ws = new WebSocket(BFF_URL);

  ws.onopen = () => {
    console.log("[WS] Connected to BFF");
    setStatus("connected");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg: BFFMessage = JSON.parse(event.data as string);
      if (msg.type === "agents" && Array.isArray(msg.data)) {
        const store = useAgentStore.getState();
        for (const agent of msg.data) {
          // Sync all fields from BFF — real OpenClaw data overrides mock
          store.updateAgent(agent.id, {
            status: agent.status,
            currentTask: agent.currentTask,
            lastMessage: agent.lastMessage,
            lastActiveAt: agent.lastActiveAt,
            // Sync positions from BFF (they reflect office zone layout)
            tileX: agent.tileX,
            tileY: agent.tileY,
            direction: agent.direction,
          });
        }
        console.log(`[WS] Synced ${msg.data.length} agents (real data)`);
      }
    } catch (err) {
      console.warn("[WS] Failed to parse message:", err);
    }
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected. Reconnecting in 5s...");
    ws = null;
    setStatus("demo");
    reconnectTimer = setTimeout(connect, 5000);
  };

  ws.onerror = (err) => {
    console.warn("[WS] Error:", err);
    setStatus("demo");
    ws?.close();
  };
}

export function startWSClient() {
  connect();
}

export function stopWSClient() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}
