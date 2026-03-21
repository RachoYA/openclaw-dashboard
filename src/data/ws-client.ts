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

  // Throttle: skip updates if last update was <2s ago (prevents OOM from rapid re-renders)
  let lastUpdateTime = 0;
  let lastPayloadHash = "";

  ws.onmessage = (event) => {
    try {
      const raw = event.data as string;
      const msg: BFFMessage = JSON.parse(raw);
      if (msg.type === "agents" && Array.isArray(msg.data)) {
        const now = Date.now();

        // Skip if same data (dedup by simple hash)
        const hash = msg.data.map((a) => `${a.id}:${a.status}`).join(",");
        if (hash === lastPayloadHash && now - lastUpdateTime < 5000) return;

        // Throttle: min 2s between updates
        if (now - lastUpdateTime < 2000) return;

        lastUpdateTime = now;
        lastPayloadHash = hash;
        useAgentStore.getState().setAgents(msg.data);
      }
    } catch {
      // Silently ignore parse errors — no console.log to avoid memory pressure
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
