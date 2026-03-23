import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      style={{
        position: "absolute",
        top: 12,
        left: 220,
        background: "var(--metrics-card-bg)",
        border: "1px solid var(--surface-border)",
        borderRadius: "8px",
        padding: "4px 10px",
        fontSize: "16px",
        cursor: "pointer",
        zIndex: 15,
        transition: "all 0.3s ease",
      }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
