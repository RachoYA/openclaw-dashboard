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

  if (isMobile) {
    // Horizontal scrollable pill strip on mobile
    return (
      <div style={mobileWrapperStyle}>
        <MetricCard emoji="👥" label="Active" value={active} total={agents.length} color="#34c759" compact />
        {sleeping > 0 && <MetricCard emoji="💤" label="Sleep" value={sleeping} color="#636366" compact />}
        <MetricCard emoji="🔀" label="PRs" value={gh?.openPRs ?? 0} color="#af52de" compact />
        <MetricCard emoji="🐛" label="Bugs" value={gh?.openIssues ?? 0} color="#ff3b30" compact />
        <MetricCard emoji="📝" label="Commits" value={gh?.commits24h ?? 0} color="#007aff" compact />
        <MetricCard emoji="✅" label="Merged" value={gh?.mergedPRs24h ?? 0} color="#5856d6" compact />
      </div>
    );
  }

  // Desktop: positioned overlay
  return (
    <div style={desktopStyle}>
      <MetricCard emoji="👥" label="Active" value={active} total={agents.length} color="#34c759" />
      {sleeping > 0 && <MetricCard emoji="💤" label="Sleep" value={sleeping} color="#636366" />}
      <MetricCard emoji="🔀" label="PRs" value={gh?.openPRs ?? 0} color="#af52de" />
      <MetricCard emoji="🐛" label="Bugs" value={gh?.openIssues ?? 0} color="#ff3b30" />
      <MetricCard emoji="📝" label="Commits" value={gh?.commits24h ?? 0} color="#007aff" />
      <MetricCard emoji="✅" label="Merged" value={gh?.mergedPRs24h ?? 0} color="#5856d6" />
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
      padding: compact ? "4px 8px" : "5px 10px",
      minWidth: compact ? "40px" : "48px",
      flexShrink: 0,
    }}>
      <span style={{ fontSize: compact ? "12px" : "14px" }}>{emoji}</span>
      <span style={{ fontSize: compact ? "13px" : "16px", fontWeight: 700, color }}>{value}</span>
      {total !== undefined && <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>/{total}</span>}
      <span style={{ fontSize: compact ? "8px" : "9px", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

const mobileWrapperStyle: React.CSSProperties = {
  position: "absolute",
  top: 48,
  left: 0,
  right: 0,
  zIndex: 10,
  display: "flex",
  flexDirection: "row",
  gap: "6px",
  padding: "4px 10px 4px 10px",
  overflowX: "auto",
  scrollbarWidth: "none", // Firefox
  // Webkit: hide scrollbar track but keep scrollability
  // (msOverflowStyle not needed — Edge uses scrollbarWidth)
  WebkitOverflowScrolling: "touch",
  background: "var(--metrics-strip)",
  // Fade-out hint on the right edge to signal scrollability
  WebkitMaskImage:
    "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)",
  maskImage:
    "linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%)",
};

const desktopStyle: React.CSSProperties = {
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
  background: "var(--metrics-card-bg)",
  border: "1px solid var(--metrics-card-border)",
  borderRadius: "10px",
  backdropFilter: "blur(10px)",
  boxShadow: "0 1px 4px var(--shadow-sm)",
};
