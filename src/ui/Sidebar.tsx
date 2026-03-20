import type { AgentState } from "@/data/types";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ожидает",
  working: "Работает",
  talking: "Общается",
  thinking: "Думает",
  sleeping: "Спит",
  celebrating: "Празднует",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be",
  working: "#2cb67d",
  talking: "#7f5af0",
  thinking: "#ff8906",
  sleeping: "#525272",
  celebrating: "#e53170",
};

interface SidebarProps {
  agent: AgentState | null;
  onClose: () => void;
}

export function Sidebar({ agent, onClose }: SidebarProps) {
  if (!agent) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: "24px", color: "#a7a9be", textAlign: "center" }}>
          <p style={{ fontSize: "2rem", marginBottom: "12px" }}>🐾</p>
          <p style={{ fontSize: "14px" }}>Кликни на агента, чтобы увидеть детали</p>
        </div>
      </div>
    );
  }

  const color = STATUS_COLORS[agent.status] || "#a7a9be";

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid #2a2a4a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#fffffe" }}>{agent.name}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#a7a9be",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#a7a9be" }}>{agent.role}</p>
      </div>

      {/* Status */}
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <span style={{ fontSize: "14px", color }}>{STATUS_LABELS[agent.status] || agent.status}</span>
        </div>

        {agent.currentTask && (
          <InfoRow label="Задача" value={agent.currentTask} />
        )}
        {agent.lastMessage && (
          <InfoRow label="Последнее сообщение" value={agent.lastMessage} />
        )}
        {agent.lastActiveAt && (
          <InfoRow label="Активен" value={new Date(agent.lastActiveAt).toLocaleTimeString("ru")} />
        )}
        <InfoRow label="Позиция" value={`(${agent.tileX}, ${agent.tileY})`} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "11px", color: "#525272", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: "#fffffe", lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "280px",
  height: "100%",
  background: "#0f0e17",
  borderLeft: "1px solid #2a2a4a",
  overflow: "auto",
  flexShrink: 0,
};
