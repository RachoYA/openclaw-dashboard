import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  /** Toggle is kept for manual overrides (e.g. ThemeToggle button, if present). */
  toggle: () => void;
  setTheme: (t: Theme) => void;
  /** Internal: initialise from OS preference and subscribe to changes. */
  _syncWithOS: () => () => void;
}

/** Detect the OS-preferred theme (prefers-color-scheme media query). */
function getOSTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply the theme token to the root element so CSS variables resolve. */
function applyTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
}

export const useTheme = create<ThemeState>((set) => ({
  // Seed from OS preference (SSR-safe fallback: "light")
  theme: typeof window !== "undefined" ? getOSTheme() : "light",

  toggle: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      applyTheme(next);
      return { theme: next };
    }),

  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },

  _syncWithOS: () => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "dark" : "light";
      applyTheme(next);
      set({ theme: next });
    };
    mq.addEventListener("change", handler);
    // Apply immediately on mount
    applyTheme(mq.matches ? "dark" : "light");
    return () => mq.removeEventListener("change", handler);
  },
}));

/** Color palette per theme (kept for Canvas/engine use that can't use CSS vars). */
export const PALETTES = {
  light: {
    bg1: "#f5f5f7",
    bg2: "#e8e8ed",
    surface: "rgba(255, 255, 255, 0.92)",
    surfaceBorder: "#d1d1d6",
    text: "#1d1d1f",
    textSecondary: "#6e6e73",
    textMuted: "#aeaeb2",
    accent: "#7f5af0",
    floorLight: "#e8e5f0",
    floorDark: "#ddd9e8",
    floorZoneHighlight1: "#d0c8f0",
    floorZoneHighlight2: "#c4bae8",
    gridLine: "#d1d1d6",
    gridLineActive: "#7f5af0",
    shadow: "rgba(0,0,0,0.08)",
    nightOverlay: "rgba(200, 200, 220, 0.1)",
    zones: {
      "pm-board": { floor: "#e8e0f5", alt: "#e2d8f0" },
      "dev-corner": { floor: "#d8f0e0", alt: "#d0ebd8" },
      "analyst-desk": { floor: "#f0d8e8", alt: "#ebd0e2" },
      "common-area": { floor: "#e8e8f0", alt: "#e2e2eb" },
      "qa-lab": { floor: "#d8e8f5", alt: "#d0e2f0" },
      "devops-room": { floor: "#f0e8d8", alt: "#ebe2d0" },
    },
  },
  dark: {
    bg1: "#0f0e17",
    bg2: "#1a1a2e",
    surface: "rgba(15, 14, 23, 0.92)",
    surfaceBorder: "#2a2a4a",
    text: "#fffffe",
    textSecondary: "#a7a9be",
    textMuted: "#525272",
    accent: "#7f5af0",
    floorLight: "#1a1a2e",
    floorDark: "#16213e",
    floorZoneHighlight1: "#2a1f5a",
    floorZoneHighlight2: "#332466",
    gridLine: "#2a2a4a",
    gridLineActive: "#7f5af0",
    shadow: "rgba(0,0,0,0.25)",
    nightOverlay: "rgba(0, 0, 20, 0.3)",
    zones: {
      "pm-board": { floor: "#1e1545", alt: "#231a4f" },
      "dev-corner": { floor: "#0d2818", alt: "#103320" },
      "analyst-desk": { floor: "#2d1525", alt: "#361a2e" },
      "common-area": { floor: "#1a1a2e", alt: "#1e1e35" },
      "qa-lab": { floor: "#0d1f33", alt: "#102640" },
      "devops-room": { floor: "#2d1f0d", alt: "#362510" },
    },
  },
} as const;

/**
 * Hook that bootstraps OS-preference sync once at the app root.
 * Call it once in App.tsx (or main.tsx).
 */
export function useThemeSync(): void {
  const syncWithOS = useTheme((s) => s._syncWithOS);
  useEffect(() => syncWithOS(), [syncWithOS]);
}
