import { create } from "zustand";
import type { AgentState, AgentStatus } from "./types";

// ---------------------------------------------------------------------------
// Initial agent positions — overwritten by real BFF data on connect
// ---------------------------------------------------------------------------
const MOCK_AGENTS: AgentState[] = [
  { id: "pm", name: "Артём", role: "PM", status: "working", currentTask: "Координация спринта", lastMessage: "Коля, PR #77 готов к ревью", lastActiveAt: new Date().toISOString(), tileX: 3, tileY: 2, direction: "se", avatar: null },
  { id: "dev", name: "Коля", role: "Developer", status: "working", currentTask: "Phase 1 scaffold", lastMessage: "Принял, делаю", lastActiveAt: new Date().toISOString(), tileX: 5, tileY: 3, direction: "sw", avatar: null },
  { id: "analyst", name: "Лена", role: "Analyst", status: "thinking", currentTask: "Сценарии приёмки", lastMessage: null, lastActiveAt: new Date().toISOString(), tileX: 2, tileY: 4, direction: "se", avatar: null },
  { id: "devops", name: "Дима", role: "DevOps", status: "idle", currentTask: null, lastMessage: "Деплой готов", lastActiveAt: new Date().toISOString(), tileX: 6, tileY: 2, direction: "nw", avatar: null },
  { id: "qa", name: "Саша", role: "QA", status: "working", currentTask: "Тестирование #77", lastMessage: "3 бага найдено", lastActiveAt: new Date().toISOString(), tileX: 4, tileY: 5, direction: "se", avatar: null },
  { id: "techlead", name: "Макс", role: "Tech Lead", status: "thinking", currentTask: "Ревью архитектуры", lastMessage: null, lastActiveAt: new Date().toISOString(), tileX: 4, tileY: 1, direction: "sw", avatar: null },
];

interface AgentStoreState {
  agents: AgentState[];
  updateAgent: (id: string, update: Partial<AgentState>) => void;
  setStatus: (id: string, status: AgentStatus) => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: MOCK_AGENTS,

  updateAgent: (id, update) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...update } : a)),
    })),

  setStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
}));
