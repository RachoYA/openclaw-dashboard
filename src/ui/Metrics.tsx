import { useAgentStore } from "@/data/AgentStore";
import { useMetricsStore } from "@/data/MetricsStore";

export function Metrics() {
  const agents = useAgentStore((s) => s.agents);
  const metrics = useMetricsStore((s) => s.metrics);

  const active = agents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
  const gh = metrics?.github;

  return (
    <div style={containerStyle}>
      <MetricCard emoji="👥" label="Active" value={active} total={agents.length} color="#34c759" />
      <MetricCard emoji="🔀" label="PRs" value={gh ? gh.openPRs : "—"} color="#af52de" />
      <MetricCard emoji="🐛" label="Bugs" value={gh ? gh.openIssues : "—"} color="#ff3b30" />
      <MetricCard emoji="✅" label="Closed" value={gh ? gh.closedIssues24h : "—"} color="#34c759" />
      <MetricCard emoji="📝" label="Commits" value={gh ? gh.commits24h : "—"} color="#007aff" />
      <MetricCard emoji="🔀" label="Merged" value={gh ? gh.mergedPRs24h : "—"} color="#5856d6" />
    </div>
  );
}

function MetricCard({ emoji, label, value, total, color }: {
  emoji: string;
  label: string;
  value: number | string;
  total?: number;
  color: string;
}) {
  return (
    <div style={cardStyle}>
      <span style={{ fontSize: "14px" }}>{emoji}</span>
      <span style={{ fontSize: "16px", fontWeight: 700, color }}>{value}</span>
      {total !== undefined && <span style={{ fontSize: "9px", color: "#8e8ea0" }}>/{total}</span>}
      <span style={{ fontSize: "9px", color: "#8e8ea0" }}>{label}</span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  top: 60,
  left: 12,
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  gap: "4px",
  maxWidth: "calc(100vw - 24px)",
  zIndex: 10,
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1px",
  background: "rgba(255, 255, 255, 0.9)",
  border: "1px solid #e5e5ea",
  borderRadius: "10px",
  padding: "5px 10px",
  minWidth: "48px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};
