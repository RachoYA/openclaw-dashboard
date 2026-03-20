/**
 * Slide-in Agent Detail Panel.
 * Replaces static Sidebar with animated slide-in from right.
 * Shows: avatar, status, current task, recent messages, activity timeline.
 */
import { useEffect, useRef, useState } from "react";
import type { AgentState } from "@/data/types";
import { useActivityStore } from "@/data/ActivityStore";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  idle:        { label: "Ожидает",        color: "#a7a9be", emoji: "💤" },
  working:     { label: "Работает",       color: "#2cb67d", emoji: "⚡" },
  talking:     { label: "Общается",       color: "#7f5af0", emoji: "💬" },
  thinking:    { label: "Думает",         color: "#ff8906", emoji: "🧠" },
  sleeping:    { label: "Спит",           color: "#525272", emoji: "😴" },
  celebrating: { label: "Празднует",      color: "#e53170", emoji: "🎉" },
  reviewing:   { label: "Ревьюит",        color: "#3da9fc", emoji: "👀" },
  deploying:   { label: "Деплоит",        color: "#ff8906", emoji: "🚀" },
  testing:     { label: "Тестирует",       color: "#3da9fc", emoji: "🧪" },
  waiting:     { label: "Ожидает ответа", color: "#a7a9be", emoji: "⏳" },
};

const ROLE_ICONS: Record<string, string> = {
  PM: "📋", Developer: "💻", Analyst: "📊",
  DevOps: "🔧", QA: "🔍", "Tech Lead": "🏗️",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AgentPanelProps {
  agent: AgentState | null;
  onClose: () => void;
}

export function AgentPanel({ agent, onClose }: AgentPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayAgent, setDisplayAgent] = useState<AgentState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Animate in/out
  useEffect(() => {
    if (agent) {
      setDisplayAgent(agent);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setDisplayAgent(null), 300);
      return () => clearTimeout(timer);
    }
  }, [agent]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [isVisible, onClose]);

  if (!displayAgent) return null;

  const status = STATUS_CONFIG[displayAgent.status] || STATUS_CONFIG.idle;
  const roleIcon = ROLE_ICONS[displayAgent.role] || "🤖";
  const allEvents = useActivityStore.getState().events;
  const agentEvents = allEvents
    .filter((e) => e.agentId === displayAgent.id)
    .slice(-8)
    .reverse();

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          zIndex: 998,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "340px",
          maxWidth: "90vw",
          height: "100vh",
          background: "var(--panel-bg, #0f0e17)",
          borderLeft: "1px solid var(--border, #2a2a4a)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          transform: isVisible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header with avatar */}
        <div
          style={{
            padding: "24px 20px",
            background: `linear-gradient(135deg, ${status.color}22, transparent)`,
            borderBottom: "1px solid var(--border, #2a2a4a)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
              {/* Avatar circle */}
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${status.color}, ${status.color}88)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  boxShadow: `0 0 16px ${status.color}44`,
                  flexShrink: 0,
                }}
              >
                {roleIcon}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", color: "var(--text, #fffffe)", fontWeight: 600 }}>
                  {displayAgent.name}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-secondary, #a7a9be)" }}>
                  {displayAgent.role}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--button-bg, #1a1a2e)",
                border: "1px solid var(--border, #2a2a4a)",
                color: "var(--text-secondary, #a7a9be)",
                fontSize: "14px",
                cursor: "pointer",
                borderRadius: "8px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              borderRadius: "20px",
              background: `${status.color}18`,
              border: `1px solid ${status.color}33`,
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: status.color,
                boxShadow: `0 0 8px ${status.color}`,
                animation: displayAgent.status === "working" || displayAgent.status === "talking"
                  ? "pulse 2s infinite" : undefined,
              }}
            />
            <span style={{ fontSize: "13px", color: status.color, fontWeight: 500 }}>
              {status.emoji} {status.label}
            </span>
          </div>
        </div>

        {/* Info cards */}
        <div style={{ padding: "0 20px", flex: 1, overflow: "auto" }}>
          {displayAgent.currentTask && (
            <InfoCard icon="🎯" label="Текущая задача" value={displayAgent.currentTask} />
          )}
          {displayAgent.lastMessage && (
            <InfoCard icon="💬" label="Последнее сообщение" value={displayAgent.lastMessage} />
          )}
          {displayAgent.lastActiveAt && (
            <InfoCard
              icon="🕐"
              label="Последняя активность"
              value={formatTimeAgo(displayAgent.lastActiveAt)}
            />
          )}

          {/* Activity timeline */}
          {agentEvents.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-secondary, #525272)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "12px",
                  fontWeight: 600,
                }}
              >
                Активность
              </div>
              <div style={{ position: "relative", paddingLeft: "16px" }}>
                {/* Timeline line */}
                <div
                  style={{
                    position: "absolute",
                    left: "4px",
                    top: "4px",
                    bottom: "4px",
                    width: "2px",
                    background: "var(--border, #2a2a4a)",
                    borderRadius: "1px",
                  }}
                />
                {agentEvents.map((ev) => (
                  <div key={ev.id} style={{ marginBottom: "12px", position: "relative" }}>
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-14px",
                        top: "5px",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: status.color,
                      }}
                    />
                    <div style={{ fontSize: "12px", color: "var(--text, #fffffe)", lineHeight: 1.4 }}>
                      {ev.text}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary, #525272)", marginTop: "2px" }}>
                      {new Date(ev.timestamp).toLocaleTimeString("ru", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with position */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border, #2a2a4a)",
            fontSize: "11px",
            color: "var(--text-secondary, #525272)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>📍 Тайл ({displayAgent.tileX}, {displayAgent.tileY})</span>
          <span>ID: {displayAgent.id}</span>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--card-bg, #1a1a2e)",
        borderRadius: "10px",
        border: "1px solid var(--border, #2a2a4a)",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-secondary, #525272)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: "4px",
        }}
      >
        {icon} {label}
      </div>
      <div style={{ fontSize: "14px", color: "var(--text, #fffffe)", lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  return new Date(isoDate).toLocaleDateString("ru");
}
