import { create } from "zustand";

export interface DashboardMetrics {
  agents: { total: number; active: number };
  github: {
    openPRs: number;
    mergedPRs24h: number;
    openIssues: number;
    closedIssues24h: number;
    commits24h: number;
  };
  sessions: { active: number };
  timestamp: string;
}

interface MetricsStoreState {
  metrics: DashboardMetrics | null;
  setMetrics: (m: DashboardMetrics) => void;
}

export const useMetricsStore = create<MetricsStoreState>((set) => ({
  metrics: null,
  setMetrics: (m) => set({ metrics: m }),
}));
