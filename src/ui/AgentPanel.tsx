/**
 * HD Slide-in agent detail panel.
 * Replaces old Sidebar with modern, smooth design.
 */
import { useActivityStore } from "@/data/ActivityStore";
import type { AgentState } from "@/data/types";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ожидает", working: "Работает", talking: "Общается", thinking: "Думает",
  sleeping: "Спит", celebrating: "Празднует", reviewing: "Ревьюит",
  deploying: "Деплоит", testing: "Тестирует", waiting: "Ожидает ответа",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "#8e8ea0", working: "#34c759", talking: "#af52de", thinking: "#ff9f0a",
  sleeping: "#636366", celebrating: "#ff2d55", reviewing: "#5ac8fa",
  deploying: "#ff9f0a", testing: "#5ac8fa", waiting: "#8e8ea0",
};

const ROLE_AVATARS: Record<string, string> = {
  pm: "👨‍💼", dev: "👨‍💻", analyst: "👩‍🔬", devops: "🛡️", qa: "🧪", techlead: "🏗️",
};

interface AgentPanelProps {
  agent: AgentState;
  onClose: () => void;
  compact?: boolean;
}

export function AgentPanel({ agent, onClose, compact }: AgentPanelProps) {
  const allEvents = useActivityStore((s) => s.events);
  const agentEvents = allEvents.filter((e) => e.agentId === agent.id).slice(-5).reverse();
  const color = STATUS_COLORS[agent.status] || "#8e8ea0";

  // Mock KPIs (will be real when BFF provides them)
  const kpis = [
    { label: "Задачи", value: Math.floor(Math.random() * 12 + 3), icon: "📋" },
    { label: "Сообщения", value: Math.floor(Math.random() * 40 + 10), icon: "💬" },
    { label: "PR", value: Math.floor(Math.random() * 6 + 1), icon: "🔀" },
    { label: "Uptime", value: `${Math.floor(Math.random() * 8 + 2)}ч`, icon: "⏱️" },
  ];

  // Activity timeline (24h, 6 segments of 4h)
  const timeSegments = Array.from({ length: 6 }, (_, i) => {
    const count = agentEvents.filter((e) => {
      const h = new Date(e.timestamp).getHours();
      return h >= i * 4 && h < (i + 1) * 4;
    }).length;
    return Math.min(1, count / 3); // normalize
  });

  return (
    <div style={{
      ...panelStyle,
      ...(compact ? mobilePanelStyle : {}),
    }}>
      {/* Drag handle (mobile) */}
      {compact && (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 0" }}>
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "#d1d1d6" }} />
        </div>
      )}

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Avatar with status ring */}
          <div style={{ position: "relative" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "26px",
              border: `3px solid ${color}`,
              boxShadow: `0 0 12px ${color}33`,
            }}>
              {ROLE_AVATARS[agent.id] || "🤖"}
            </div>
            <div style={{
              position: "absolute", bottom: -1, right: -1,
              width: "14px", height: "14px", borderRadius: "50%",
              background: color, border: "2.5px solid #fff",
            }} />
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1d1d1f" }}>
              {agent.name}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6e6e73" }}>
              {agent.role}
            </p>
          </div>
        </div>

        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* Current action */}
      <div style={sectionStyle}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "10px 14px", borderRadius: "12px",
          background: `${color}0d`, border: `1px solid ${color}22`,
        }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: color, boxShadow: `0 0 6px ${color}`,
            animation: agent.status !== "sleeping" && agent.status !== "idle" ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#1d1d1f" }}>
            {STATUS_LABELS[agent.status] || agent.status}
          </span>
        </div>

        {agent.currentTask && (
          <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#3a3a3c", lineHeight: 1.5 }}>
            📌 {agent.currentTask}
          </p>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={kpiCardStyle}>
            <span style={{ fontSize: "14px" }}>{kpi.icon}</span>
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#1d1d1f" }}>{kpi.value}</span>
            <span style={{ fontSize: "10px", color: "#8e8ea0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {kpi.label}
            </span>
          </div>
        ))}
      </div>

      {/* Activity timeline bar */}
      <div style={sectionStyle}>
        <div style={{ fontSize: "11px", color: "#8e8ea0", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Активность за день
        </div>
        <div style={{ display: "flex", gap: "3px", height: "28px", alignItems: "flex-end" }}>
          {timeSegments.map((val, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: "4px",
              height: `${Math.max(4, val * 100)}%`,
              background: val > 0 ? `${color}${Math.round(val * 200 + 55).toString(16)}` : "#f2f2f7",
              transition: "height 0.3s ease",
            }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          {["0:00", "4:00", "8:00", "12:00", "16:00", "20:00"].map((t) => (
            <span key={t} style={{ fontSize: "8px", color: "#aeaeb2" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={sectionStyle}>
        <div style={{ fontSize: "11px", color: "#8e8ea0", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Последние действия
        </div>
        {agentEvents.length === 0 && (
          <p style={{ fontSize: "12px", color: "#aeaeb2" }}>Нет недавних действий</p>
        )}
        {agentEvents.map((ev) => {
          const age = Math.round((Date.now() - new Date(ev.timestamp).getTime()) / 1000);
          const ageStr = age < 60 ? `${age}с` : age < 3600 ? `${Math.floor(age / 60)}м` : `${Math.floor(age / 3600)}ч`;
          return (
            <div key={ev.id} style={activityItemStyle}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "12px", color: "#1d1d1f" }}>{ev.text}</span>
              </div>
              <span style={{ fontSize: "10px", color: "#aeaeb2", flexShrink: 0 }}>{ageStr}</span>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div style={{ ...sectionStyle, display: "flex", gap: "8px" }}>
        <ActionBtn icon="💬" label="Написать" />
        <ActionBtn icon="📋" label="Задачи" href={`https://github.com/RachoYA/openclaw-dashboard/issues?q=assignee:${agent.id}`} />
        <ActionBtn icon="📊" label="Статус" />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, href }: { icon: string; label: string; href?: string }) {
  const Tag = href ? "a" : "button";
  return (
    <Tag
      {...(href ? { href, target: "_blank", rel: "noopener" } : {})}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
        padding: "10px 6px", borderRadius: "12px", border: "1px solid #e5e5ea",
        background: "#fff", fontSize: "12px", color: "#1d1d1f", cursor: "pointer",
        textDecoration: "none", fontWeight: 500,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <span>{label}</span>
    </Tag>
  );
}

// --- Styles ---
const panelStyle: React.CSSProperties = {
  width: "320px",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e5e5ea",
  overflowY: "auto",
  overflowX: "hidden",
  boxShadow: "-4px 0 20px rgba(0,0,0,0.06)",
};

const mobilePanelStyle: React.CSSProperties = {
  width: "100%",
  height: "auto",
  maxHeight: "60vh",
  borderLeft: "none",
  borderTop: "1px solid #e5e5ea",
  borderTopLeftRadius: "16px",
  borderTopRightRadius: "16px",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "20px 20px 12px",
  borderBottom: "1px solid #f2f2f7",
};

const closeBtnStyle: React.CSSProperties = {
  background: "#f2f2f7",
  border: "none",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  fontSize: "14px",
  color: "#8e8ea0",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sectionStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid #f2f2f7",
};

const kpiCardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "2px",
  padding: "10px 8px",
  borderRadius: "12px",
  background: "#f9f9fb",
  border: "1px solid #f2f2f7",
};

const activityItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "7px 0",
  borderBottom: "1px solid #f9f9fb",
  gap: "8px",
};
