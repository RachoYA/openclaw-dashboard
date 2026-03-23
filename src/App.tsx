import { useEffect, useState, useRef } from "react";
import { Scene, type SceneHandle } from "./engine/TopDownScene";
import { AgentPanel } from "./ui/AgentPanel";
import { ActivityFeed } from "./ui/ActivityFeed";
import { Timeline } from "./ui/Timeline";
import { Metrics } from "./ui/Metrics";
import { Heatmap } from "./ui/Heatmap";
import { TaskButton } from "./ui/TaskButton";
import { ZoomControls } from "./ui/ZoomControls";
import { ConnectionBadge } from "./ui/ConnectionBadge";
import { BottomSheet } from "./ui/BottomSheet";
import { useIsMobile } from "./hooks/useIsMobile";
import { useThemeSync } from "./hooks/useTheme";
import { useAgentStore } from "./data/AgentStore";
import { startWSClient, stopWSClient } from "./data/ws-client";

/** Duration (ms) of the panel slide-out animation — must match the CSS transition. */
const CLOSE_ANIMATION_MS = 300;

export function App() {
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const isMobile = useIsMobile();
  const sceneRef = useRef<SceneHandle | null>(null);

  // Sync theme with OS prefers-color-scheme — sets data-theme on <html>
  useThemeSync();

  useEffect(() => {
    startWSClient();
    return () => stopWSClient();
  }, []);

  const handleAgentClick = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  const handleClose = () => {
    setPanelOpen(false);
    setTimeout(() => setSelectedId(null), CLOSE_ANIMATION_MS); // wait for slide-out animation
  };

  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative", background: "var(--bg1)" }}>
      {/* Fullscreen canvas */}
      <Scene
        agents={agents}
        onAgentClick={handleAgentClick}
        selectedZone={selectedZone}
        onZoneClick={setSelectedZone}
        sceneRef={sceneRef}
      />

      {/* Overlay UI */}
      <ConnectionBadge />
      <Metrics />
      {!isMobile && <Timeline />}
      {!isMobile && <Heatmap />}
      <TaskButton />
      <ZoomControls
        onZoomIn={() => sceneRef.current?.zoomIn()}
        onZoomOut={() => sceneRef.current?.zoomOut()}
        onReset={() => sceneRef.current?.zoomReset()}
      />
      <ActivityFeed />

      {/* Agent detail panel */}
      {isMobile ? (
        /* Mobile: BottomSheet with drag-to-dismiss */
        <BottomSheet
          open={panelOpen && selectedAgent !== null}
          onClose={handleClose}
          label={selectedAgent ? `${selectedAgent.name}` : undefined}
        >
          {selectedAgent && (
            <AgentPanel agent={selectedAgent} onClose={handleClose} compact />
          )}
        </BottomSheet>
      ) : (
        /* Desktop: slide-in from right */
        selectedAgent && (
          <>
            <div
              onClick={handleClose}
              style={{
                position: "absolute", inset: 0, zIndex: 19,
                background: panelOpen ? "rgba(0,0,0,0.2)" : "transparent",
                pointerEvents: panelOpen ? "auto" : "none",
                transition: "background 0.3s ease",
              }}
            />
            <div style={{
              ...desktopPanelStyle,
              transform: panelOpen ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <AgentPanel agent={selectedAgent} onClose={handleClose} compact={false} />
            </div>
          </>
        )
      )}
    </div>
  );
}

const desktopPanelStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
};
