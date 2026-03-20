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
        background: theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${theme === "light" ? "#d1d1d6" : "#2a2a4a"}`,
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
