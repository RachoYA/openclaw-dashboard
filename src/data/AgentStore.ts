import { create } from "zustand";
import type { AgentState, AgentStatus } from "./types";

// ---------------------------------------------------------------------------
// Initial agent layout — positions only. All other data comes from BFF.
// Names/roles here are fallback if BFF hasn't connected yet.
// ---------------------------------------------------------------------------
const INITIAL_AGENTS: AgentState[] = [
  { id: "pm", name: "PM", role: "PM", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 3, tileY: 2, direction: "se", avatar: null },
  { id: "dev", name: "Dev", role: "Developer", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 5, tileY: 3, direction: "sw", avatar: null },
  { id: "analyst", name: "Analyst", role: "Analyst", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 2, tileY: 4, direction: "se", avatar: null },
  { id: "devops", name: "DevOps", role: "DevOps", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 6, tileY: 2, direction: "nw", avatar: null },
  { id: "qa", name: "QA", role: "QA", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 4, tileY: 5, direction: "se", avatar: null },
  { id: "techlead", name: "Tech Lead", role: "Tech Lead", status: "idle", currentTask: null, lastMessage: null, lastActiveAt: null, tileX: 4, tileY: 1, direction: "sw", avatar: null },
];

interface AgentStoreState {
  agents: AgentState[];
  updateAgent: (id: string, update: Partial<AgentState>) => void;
  setStatus: (id: string, status: AgentStatus) => void;
  /** Replace all agents with data from BFF */
  setAgents: (agents: AgentState[]) => void;
}

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: INITIAL_AGENTS,

  updateAgent: (id, update) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...update } : a)),
    })),

  setStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  setAgents: (agents) => set({ agents }),
}));
