import { useAgentStore } from "@/data/AgentStore";
import { useMetricsStore } from "@/data/MetricsStore";
import { useIsMobile } from "@/hooks/useIsMobile";

export function Metrics() {
  const agents = useAgentStore((s) => s.agents);
  const metrics = useMetricsStore((s) => s.metrics);
  const isMobile = useIsMobile();

  const active = agents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
  const sleeping = agents.filter((a) => a.status === "sleeping").length;
  const gh = metrics?.github;

  return (
    <div style={{
      ...containerStyle,
      top: isMobile ? 50 : 60,
      left: isMobile ? 8 : 12,
      gap: isMobile ? "3px" : "4px",
    }}>
      <MetricCard emoji="👥" label="Active" value={active} total={agents.length} color="#34c759" compact={isMobile} />
      {sleeping > 0 && <MetricCard emoji="💤" label="Sleep" value={sleeping} color="#636366" compact={isMobile} />}
      <MetricCard emoji="🔀" label="PRs" value={gh?.openPRs ?? 0} color="#af52de" compact={isMobile} />
      <MetricCard emoji="🐛" label="Bugs" value={gh?.openIssues ?? 0} color="#ff3b30" compact={isMobile} />
      <MetricCard emoji="📝" label="Commits" value={gh?.commits24h ?? 0} color="#007aff" compact={isMobile} />
      {!isMobile && <MetricCard emoji="🔀" label="Merged" value={gh?.mergedPRs24h ?? 0} color="#5856d6" />}
    </div>
  );
}

function MetricCard({ emoji, label, value, total, color, compact }: {
  emoji: string;
  label: string;
  value: number | string;
  total?: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <div style={{
      ...cardStyle,
      padding: compact ? "3px 6px" : "5px 10px",
      minWidth: compact ? "38px" : "48px",
    }}>
      <span style={{ fontSize: compact ? "12px" : "14px" }}>{emoji}</span>
      <span style={{ fontSize: compact ? "13px" : "16px", fontWeight: 700, color }}>{value}</span>
      {total !== undefined && <span style={{ fontSize: "9px", color: "#8e8ea0" }}>/{total}</span>}
      <span style={{ fontSize: compact ? "8px" : "9px", color: "#8e8ea0" }}>{label}</span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
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
  backdropFilter: "blur(10px)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};
