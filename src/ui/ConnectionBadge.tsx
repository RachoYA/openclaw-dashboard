import { useState, useEffect } from "react";
import { getWSStatus, onWSStatusChange, type WSStatus } from "@/data/ws-client";

const STATUS_CONFIG: Record<WSStatus, { label: string; color: string; bg: string }> = {
  connected: { label: "● LIVE", color: "#34c759", bg: "rgba(52,199,89,0.1)" },
  connecting: { label: "◌ Подключение...", color: "#ff9f0a", bg: "rgba(255,159,10,0.1)" },
  disconnected: { label: "○ Офлайн", color: "#ff3b30", bg: "rgba(255,59,48,0.1)" },
  demo: { label: "◐ DEMO", color: "#ff9f0a", bg: "rgba(255,159,10,0.1)" },
};

export function ConnectionBadge() {
  const [status, setStatus] = useState<WSStatus>(getWSStatus());

  useEffect(() => {
    return onWSStatusChange(setStatus);
  }, []);

  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{
      position: "absolute",
      top: 32,
      left: 200,
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "3px 10px",
      borderRadius: "12px",
      background: cfg.bg,
      border: `1px solid ${cfg.color}33`,
      zIndex: 15,
      fontSize: "11px",
      fontWeight: 600,
      color: cfg.color,
      letterSpacing: "0.5px",
    }}>
      {cfg.label}
      {status === "demo" && (
        <span style={{ fontSize: "9px", color: "#8e8ea0", fontWeight: 400 }}>
          (данные демо)
        </span>
      )}
    </div>
  );
}
