/**
 * WebSocket client — connects to BFF and updates AgentStore in real time.
 */
import { useAgentStore } from "./AgentStore";
import type { AgentState } from "./types";

const BFF_URL = import.meta.env.VITE_BFF_WS_URL || "ws://localhost:3101";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

interface BFFMessage {
  type: "agents";
  data: AgentState[];
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;

  console.log(`[WS] Connecting to ${BFF_URL}...`);
  ws = new WebSocket(BFF_URL);

  ws.onopen = () => {
    console.log("[WS] Connected to BFF");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg: BFFMessage = JSON.parse(event.data as string);
      if (msg.type === "agents" && Array.isArray(msg.data)) {
        // Merge BFF data with store (preserve tile positions from mock if BFF doesn't provide)
        const store = useAgentStore.getState();
        for (const agent of msg.data) {
          store.updateAgent(agent.id, {
            status: agent.status,
            currentTask: agent.currentTask,
            lastMessage: agent.lastMessage,
            lastActiveAt: agent.lastActiveAt,
          });
        }
      }
    } catch (err) {
      console.warn("[WS] Failed to parse message:", err);
    }
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected. Reconnecting in 5s...");
    ws = null;
    reconnectTimer = setTimeout(connect, 5000);
  };

  ws.onerror = (err) => {
    console.warn("[WS] Error:", err);
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
