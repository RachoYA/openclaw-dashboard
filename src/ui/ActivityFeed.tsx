import { useState } from "react";
import { useActivityStore, type ActivityEvent } from "@/data/ActivityStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { BottomSheet } from "./BottomSheet";

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
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const recent = events.slice(-8).reverse();
  const preview = events.slice(-1).reverse(); // latest event for preview pill

  if (isMobile) {
    return (
      <>
        {/* Floating pill on mobile — tap to open bottom sheet */}
        <div
          onClick={() => setSheetOpen(true)}
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 15,
            background: "var(--surface-frosted)",
            border: "1px solid var(--surface-border)",
            borderRadius: 24,
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            minWidth: 160,
            boxShadow: "0 4px 16px var(--shadow)",
          }}
        >
          <span style={{ fontSize: 14 }}>📡</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
            {events.length > 0 ? `${events.length} событий` : "Activity Feed"}
          </span>
          {preview.length > 0 && (
            <span style={{
              fontSize: 9, color: "var(--text-muted)",
              maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {preview[0].text}
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>↑</span>
        </div>

        {/* Bottom sheet */}
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="📡 Activity Feed">
          <FeedList events={events.slice(-20).reverse()} />
        </BottomSheet>
      </>
    );
  }

  // Desktop: fixed bottom bar
  return (
    <div style={desktopContainerStyle}>
      <div style={headerStyle}>
        <span>📡 Activity Feed</span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{events.length} events</span>
      </div>
      <div style={listStyle} className="hide-scrollbar">
        {recent.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "11px", padding: "8px" }}>
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

function FeedList({ events }: { events: ActivityEvent[] }) {
  return (
    <div style={{ padding: "0 0 16px" }}>
      {events.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "24px 16px", textAlign: "center" }}>
          Ожидание событий...
        </div>
      )}
      {events.map((ev) => (
        <FeedItem key={ev.id} event={ev} />
      ))}
    </div>
  );
}

function FeedItem({ event }: { event: ActivityEvent }) {
  const icon = EVENT_ICONS[event.type] || "•";
  const age = Math.round((Date.now() - new Date(event.timestamp).getTime()) / 1000);
  const ageStr = age < 60 ? `${age}с` : age < 3600 ? `${Math.floor(age / 60)}м` : `${Math.floor(age / 3600)}ч`;

  return (
    <div style={itemStyle}>
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <strong style={{ color: event.agentColor || "var(--text-secondary)" }}>{event.agentName}</strong>{" "}
          {event.text}
        </div>
      </div>
      <span style={{ fontSize: "9px", color: "var(--text-muted)", flexShrink: 0 }}>{ageStr}</span>
    </div>
  );
}

const desktopContainerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  background: "var(--surface)",
  borderTop: "1px solid var(--surface-border)",
  maxHeight: "140px",
  overflow: "hidden",
  zIndex: 5,
  fontSize: "clamp(10px, 2.5vw, 13px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--surface-border)",
};

const listStyle: React.CSSProperties = {
  overflowY: "auto",
  maxHeight: "100px",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 12px",
  borderBottom: "1px solid var(--divider)",
};
