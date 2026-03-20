import { useState } from "react";
import { useActivityStore } from "@/data/ActivityStore";

type TimeRange = "1h" | "4h" | "24h";

export function Timeline() {
  const events = useActivityStore((s) => s.events);
  const [range, setRange] = useState<TimeRange>("1h");
  const [isOpen, setIsOpen] = useState(false);

  const rangeMs: Record<TimeRange, number> = { "1h": 3600000, "4h": 14400000, "24h": 86400000 };
  const cutoff = Date.now() - rangeMs[range];
  const filtered = events.filter((e) => new Date(e.timestamp).getTime() > cutoff);

  // Group by 10-minute buckets for sparkline
  const bucketSize = rangeMs[range] / 20;
  const buckets = Array.from({ length: 20 }, (_, i) => {
    const start = cutoff + i * bucketSize;
    const end = start + bucketSize;
    return filtered.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t < end;
    }).length;
  });
  const maxBucket = Math.max(1, ...buckets);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15,14,23,0.85)",
          border: "1px solid #2a2a4a",
          borderRadius: "8px",
          padding: "4px 16px",
          color: "#a7a9be",
          fontSize: "11px",
          cursor: "pointer",
        }}
      >
        📈 Timeline ({filtered.length} events)
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#fffffe" }}>📈 Timeline</span>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {(["1h", "4h", "24h"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "2px 8px",
                fontSize: "10px",
                borderRadius: "4px",
                border: "none",
                background: range === r ? "#7f5af0" : "#2a2a4a",
                color: range === r ? "#fff" : "#a7a9be",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
          <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#525272", cursor: "pointer", fontSize: "14px", marginLeft: "8px" }}>✕</button>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "40px", marginBottom: "8px" }}>
        {buckets.map((count, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${(count / maxBucket) * 100}%`,
              minHeight: count > 0 ? "2px" : "1px",
              background: count > 0 ? "#7f5af0" : "#2a2a4a",
              borderRadius: "1px",
              opacity: count > 0 ? 0.8 : 0.3,
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: "10px", color: "#525272", display: "flex", justifyContent: "space-between" }}>
        <span>{filtered.length} events in {range}</span>
        <span>{new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(15, 14, 23, 0.95)",
  border: "1px solid #2a2a4a",
  borderRadius: "12px",
  padding: "12px 16px",
  width: "340px",
  backdropFilter: "blur(10px)",
};
