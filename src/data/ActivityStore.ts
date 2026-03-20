import { create } from "zustand";

export type ActivityType =
  | "message" | "task_assigned" | "task_started" | "task_completed"
  | "pr_created" | "pr_merged" | "deploy" | "error" | "review";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  agentId: string;
  agentName: string;
  agentColor: string;
  text: string;
  timestamp: string;
}

let eventCounter = 0;

// Agent colors for feed
const AGENT_COLORS: Record<string, string> = {
  pm: "#7f5af0",
  dev: "#2cb67d",
  analyst: "#e53170",
  devops: "#ff8906",
  qa: "#3da9fc",
  techlead: "#fffffe",
};

const AGENT_NAMES: Record<string, string> = {
  pm: "Артём",
  dev: "Коля",
  analyst: "Лена",
  devops: "Дима",
  qa: "Саша",
  techlead: "Макс",
};

interface ActivityStoreState {
  events: ActivityEvent[];
  addEvent: (agentId: string, type: ActivityType, text: string) => void;
}

// Seed with mock events
const SEED_EVENTS: ActivityEvent[] = [
  { id: "s1", type: "task_assigned", agentId: "pm", agentName: "Артём", agentColor: "#7f5af0", text: "назначил задачу #7 → Коля", timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: "s2", type: "task_started", agentId: "dev", agentName: "Коля", agentColor: "#2cb67d", text: "начал Phase 1 scaffold", timestamp: new Date(Date.now() - 90000).toISOString() },
  { id: "s3", type: "review", agentId: "techlead", agentName: "Макс", agentColor: "#fffffe", text: "ревьюит ARCHITECTURE.md", timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: "s4", type: "pr_created", agentId: "dev", agentName: "Коля", agentColor: "#2cb67d", text: "создал PR #8", timestamp: new Date(Date.now() - 45000).toISOString() },
  { id: "s5", type: "message", agentId: "analyst", agentName: "Лена", agentColor: "#e53170", text: "написала сценарии приёмки", timestamp: new Date(Date.now() - 30000).toISOString() },
  { id: "s6", type: "deploy", agentId: "devops", agentName: "Дима", agentColor: "#ff8906", text: "задеплоил staging", timestamp: new Date(Date.now() - 15000).toISOString() },
];

export const useActivityStore = create<ActivityStoreState>((set) => ({
  events: SEED_EVENTS,

  addEvent: (agentId, type, text) =>
    set((state) => ({
      events: [
        ...state.events,
        {
          id: `e_${++eventCounter}`,
          type,
          agentId,
          agentName: AGENT_NAMES[agentId] || agentId,
          agentColor: AGENT_COLORS[agentId] || "#a7a9be",
          text,
          timestamp: new Date().toISOString(),
        },
      ].slice(-50), // keep last 50
    })),
}));

// --- Auto-generate events every 8-15 seconds (demo mode) ---
const DEMO_EVENTS: Array<{ agentId: string; type: ActivityType; text: string }> = [
  { agentId: "pm", type: "message", text: "обновил статус спринта" },
  { agentId: "dev", type: "task_completed", text: "закрыл #74 Graph UX" },
  { agentId: "qa", type: "error", text: "нашёл баг: toast не показывается" },
  { agentId: "techlead", type: "pr_merged", text: "замёржил PR #77" },
  { agentId: "devops", type: "deploy", text: "обновил production" },
  { agentId: "analyst", type: "task_started", text: "пишет отчёт тестирования" },
  { agentId: "dev", type: "pr_created", text: "создал PR #78" },
  { agentId: "pm", type: "task_assigned", text: "назначил #67 → Коля" },
  { agentId: "qa", type: "task_completed", text: "прошёл регрессию Dashboard" },
  { agentId: "devops", type: "message", text: "настроил health checks" },
];

let demoIdx = 0;
setInterval(() => {
  const ev = DEMO_EVENTS[demoIdx % DEMO_EVENTS.length];
  useActivityStore.getState().addEvent(ev.agentId, ev.type, ev.text);
  demoIdx++;
}, 8000 + Math.random() * 7000);
