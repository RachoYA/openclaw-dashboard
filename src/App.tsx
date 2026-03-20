import { useEffect, useState, useRef } from "react";
import { Scene, type SceneHandle } from "./engine/Scene";
import { Sidebar } from "./ui/Sidebar";
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
  const isMobile = useIsMobile();
  const sceneRef = useRef<SceneHandle | null>(null);

  useEffect(() => {
    startWSClient();
    return () => stopWSClient();
  }, []);

  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden", position: "relative" }}>
      {/* Fullscreen canvas */}
      <Scene
        agents={agents}
        onAgentClick={setSelectedId}
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

      {/* Slide-in agent detail panel */}
      <AgentPanel
        agent={selectedAgent}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

const desktopSidebarStyle: React.CSSProperties = {
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
  maxHeight: "55vh",
  zIndex: 20,
  borderTopLeftRadius: "16px",
  borderTopRightRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
};
