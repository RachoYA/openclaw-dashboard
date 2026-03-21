import { useAgentStore } from "@/data/AgentStore";
import { useActivityStore } from "@/data/ActivityStore";

export function Metrics() {
  const agents = useAgentStore((s) => s.agents);
  const events = useActivityStore((s) => s.events);

  const active = agents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
  const sleeping = agents.filter((a) => a.status === "sleeping").length;
  const tasksCompleted = events.filter((e) => e.type === "task_completed").length;
  const prsCreated = events.filter((e) => e.type === "pr_created").length;
  const prsMerged = events.filter((e) => e.type === "pr_merged").length;
  const errors = events.filter((e) => e.type === "error").length;
  const deploys = events.filter((e) => e.type === "deploy").length;

  return (
    <div style={containerStyle}>
      <MetricCard emoji="👥" label="Active" value={active} total={agents.length} color="#2cb67d" />
      <MetricCard emoji="💤" label="Sleeping" value={sleeping} color="#525272" />
      <MetricCard emoji="✅" label="Tasks" value={tasksCompleted} color="#2cb67d" />
      <MetricCard emoji="🔀" label="PRs" value={`${prsMerged}/${prsCreated}`} color="#7f5af0" />
      <MetricCard emoji="🚀" label="Deploys" value={deploys} color="#ff8906" />
      <MetricCard emoji="🐛" label="Bugs" value={errors} color="#e53170" />
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
      <span style={{ fontSize: "16px" }}>{emoji}</span>
      <span style={{ fontSize: "18px", fontWeight: 700, color }}>{value}</span>
      {total !== undefined && <span style={{ fontSize: "10px", color: "#525272" }}>/{total}</span>}
      <span style={{ fontSize: "9px", color: "#a7a9be" }}>{label}</span>
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
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1px",
  background: "rgba(255, 255, 255, 0.85)",
  border: "1px solid #e5e5ea",
  borderRadius: "8px",
  padding: "4px 8px",
  minWidth: "44px",
  backdropFilter: "blur(10px)",
  fontSize: "10px",
};
