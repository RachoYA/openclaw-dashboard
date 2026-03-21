/**
 * WebSocket client — connects to BFF and updates AgentStore in real time.
 * OOM-safe: exponential backoff, dedup, CONNECTING guard.
 */
import { useAgentStore } from "./AgentStore";
import type { AgentState } from "./types";

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
const MAX_RECONNECT_DELAY = 30000;

export type WSStatus = "disconnected" | "connecting" | "connected" | "demo";
let currentStatus: WSStatus = "disconnected";
const statusListeners = new Set<(s: WSStatus) => void>();

export function getWSStatus(): WSStatus { return currentStatus; }
export function onWSStatusChange(cb: (s: WSStatus) => void) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}
function setStatus(s: WSStatus) {
  if (currentStatus === s) return;
  currentStatus = s;
  statusListeners.forEach((cb) => cb(s));
}

interface BFFMessage { type: "agents"; data: AgentState[] }

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
}

let lastUpdateTime = 0;
let lastPayloadHash = "";

function connect() {
  // Guard: don't create new WS if one is already open or connecting
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  setStatus("connecting");
  console.log(`[WS] Connecting to ${BFF_URL}...`);

  try {
    ws = new WebSocket(BFF_URL);
  } catch {
    setStatus("demo");
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[WS] Connected");
    setStatus("connected");
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const msg: BFFMessage = JSON.parse(event.data as string);
      if (msg.type === "agents" && Array.isArray(msg.data)) {
        const now = Date.now();
        const hash = msg.data.map((a) => `${a.id}:${a.status}`).join(",");
        if (hash === lastPayloadHash && now - lastUpdateTime < 5000) return;
        if (now - lastUpdateTime < 2000) return;
        lastUpdateTime = now;
        lastPayloadHash = hash;
        const store = useAgentStore.getState();
        if (store.setAgents) store.setAgents(msg.data);
      }
    } catch { /* silent */ }
  };

  ws.onclose = () => {
    ws = null;
    setStatus("demo");
    scheduleReconnect();
  };

  // onerror: do NOT call ws.close() — onclose will fire automatically
  ws.onerror = () => {};
}

export function startWSClient() { connect(); }

export function stopWSClient() {
  reconnectAttempts = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); ws = null; }
  setStatus("disconnected");
}
