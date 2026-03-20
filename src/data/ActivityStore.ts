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

// No seed events — only real data from BFF

export const useActivityStore = create<ActivityStoreState>((set) => ({
  events: [],

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

// Demo mode removed — only real data from BFF via WebSocket
