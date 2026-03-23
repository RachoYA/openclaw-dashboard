import { useState } from "react";
import { useAgentStore } from "@/data/AgentStore";
import { useActivityStore } from "@/data/ActivityStore";

/**
 * Agent activity heatmap — shows which agents are most active
 * as a horizontal bar chart overlay.
 */
export function Heatmap() {
  const [isOpen, setIsOpen] = useState(false);
  const agents = useAgentStore((s) => s.agents);
  const events = useActivityStore((s) => s.events);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "absolute",
          top: 12,
          right: 300,
          background: "var(--surface-frosted)",
          border: "1px solid var(--surface-border)",
          borderRadius: "8px",
          padding: "4px 12px",
          color: "var(--text-secondary)",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        🔥 Heatmap
      </button>
    );
  }

  // Count events per agent
  const counts = new Map<string, number>();
  for (const ev of events) {
    counts.set(ev.agentId, (counts.get(ev.agentId) || 0) + 1);
  }

  const maxCount = Math.max(1, ...counts.values());

  const agentColors: Record<string, string> = {
    pm: "#7f5af0", dev: "#2cb67d", analyst: "#e53170",
    devops: "#ff8906", qa: "#3da9fc", techlead: "#fffffe",
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>🔥 Agent Activity</span>
        <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px" }}>✕</button>
      </div>

      {agents.map((agent) => {
        const count = counts.get(agent.id) || 0;
        const pct = (count / maxCount) * 100;
        const color = agentColors[agent.id] || "var(--text-secondary)";

        return (
          <div key={agent.id} style={{ marginBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
              <span style={{ color: "var(--text-secondary)" }}>{agent.name}</span>
              <span style={{ color: "var(--text-muted)" }}>{count}</span>
            </div>
            <div style={{ height: "6px", background: "var(--activity-bar-bg)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                borderRadius: "3px",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 300,
  background: "var(--surface)",
  border: "1px solid var(--surface-border)",
  borderRadius: "12px",
  padding: "12px 16px",
  width: "220px",
  backdropFilter: "blur(10px)",
};
