import { useEffect, useState, useRef } from "react";
import { Scene, type SceneHandle } from "./engine/Scene";
import { AgentPanel } from "./ui/AgentPanel";
import { ActivityFeed } from "./ui/ActivityFeed";
import { Timeline } from "./ui/Timeline";
import { Metrics } from "./ui/Metrics";
import { Heatmap } from "./ui/Heatmap";
import { TaskButton } from "./ui/TaskButton";
import { ZoomControls } from "./ui/ZoomControls";
import { useIsMobile } from "./hooks/useIsMobile";
import { useAgentStore } from "./data/AgentStore";
import { startWSClient, stopWSClient } from "./data/ws-client";

export function App() {
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const isMobile = useIsMobile();
  const sceneRef = useRef<SceneHandle | null>(null);

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
    setTimeout(() => setSelectedId(null), 300); // wait for slide-out animation
  };

  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative", background: "#f5f5f7" }}>
      {/* Fullscreen canvas */}
      <Scene
        agents={agents}
        onAgentClick={handleAgentClick}
        selectedZone={selectedZone}
        onZoneClick={setSelectedZone}
        sceneRef={sceneRef}
      />

      {/* Overlay UI */}
      {!isMobile && <Metrics />}
      {!isMobile && <Timeline />}
      {!isMobile && <Heatmap />}
      <TaskButton />
      <ZoomControls
        onZoomIn={() => sceneRef.current?.zoomIn()}
        onZoomOut={() => sceneRef.current?.zoomOut()}
        onReset={() => sceneRef.current?.zoomReset()}
      />
      <ActivityFeed compact={isMobile} />

      {/* Agent detail panel — slide-in from right (desktop) / bottom (mobile) */}
      {selectedAgent && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleClose}
            style={{
              position: "absolute", inset: 0, zIndex: 19,
              background: panelOpen ? "rgba(0,0,0,0.2)" : "transparent",
              pointerEvents: panelOpen ? "auto" : "none",
              transition: "background 0.3s ease",
            }}
          />

          {/* Panel */}
          <div style={{
            ...(isMobile ? mobileSheetStyle : desktopPanelStyle),
            transform: panelOpen
              ? "translate(0, 0)"
              : isMobile ? "translateY(100%)" : "translateX(100%)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            <AgentPanel
              agent={selectedAgent}
              onClose={handleClose}
              compact={isMobile}
            />
          </div>
        </>
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

const mobileSheetStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 20,
  borderTopLeftRadius: "16px",
  borderTopRightRadius: "16px",
  overflow: "hidden",
};
