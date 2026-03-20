import { useActivityStore, type ActivityEvent } from "@/data/ActivityStore";

const EVENT_ICONS: Record<string, string> = {
  message: "💬",
  task_assigned: "📋",
  task_started: "▶️",
  task_completed: "✅",
  pr_created: "🔀",
  pr_merged: "🟢",
  deploy: "🚀",
  error: "🔴",
  review: "🔍",
};

export function ActivityFeed() {
  const events = useActivityStore((s) => s.events);
  const recent = events.slice(-8).reverse();

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span>📡 Activity Feed</span>
        <span style={{ fontSize: "10px", color: "#525272" }}>{events.length} events</span>
      </div>
      <div style={listStyle}>
        {recent.length === 0 && (
          <div style={{ color: "#525272", fontSize: "11px", padding: "8px" }}>
            Ожидание событий...
          </div>
        )}
        {recent.map((ev) => (
          <FeedItem key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  );
}

function FeedItem({ event }: { event: ActivityEvent }) {
  const icon = EVENT_ICONS[event.type] || "•";
  const time = new Date(event.timestamp).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  const age = Math.round((Date.now() - new Date(event.timestamp).getTime()) / 1000);
  const ageStr = age < 60 ? `${age}с` : age < 3600 ? `${Math.floor(age / 60)}м` : `${Math.floor(age / 3600)}ч`;

  return (
    <div style={itemStyle}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "11px", color: "#fffffe", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <strong style={{ color: event.agentColor || "#a7a9be" }}>{event.agentName}</strong>{" "}
          {event.text}
        </div>
      </div>
      <span style={{ fontSize: "9px", color: "#525272", flexShrink: 0 }}>{ageStr}</span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 280, // sidebar width
  background: "rgba(15, 14, 23, 0.95)",
  borderTop: "1px solid #2a2a4a",
  maxHeight: "180px",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#a7a9be",
  borderBottom: "1px solid #2a2a4a",
};

const listStyle: React.CSSProperties = {
  overflowY: "auto",
  maxHeight: "140px",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "5px 12px",
  borderBottom: "1px solid rgba(42, 42, 74, 0.5)",
};
