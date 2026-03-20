import { useEffect, useState } from "react";
import { Scene } from "./engine/Scene";
import { Sidebar } from "./ui/Sidebar";
import { ActivityFeed } from "./ui/ActivityFeed";
import { Timeline } from "./ui/Timeline";
import { Metrics } from "./ui/Metrics";
import { Heatmap } from "./ui/Heatmap";
import { TaskButton } from "./ui/TaskButton";
import { useIsMobile } from "./hooks/useIsMobile";
import { useAgentStore } from "./data/AgentStore";
import { startWSClient, stopWSClient } from "./data/ws-client";

export function App() {
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    startWSClient();
    return () => stopWSClient();
  }, []);

  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* Fullscreen canvas */}
      <Scene
        agents={agents}
        onAgentClick={setSelectedId}
        selectedZone={selectedZone}
        onZoneClick={setSelectedZone}
      />

      {/* Overlay UI — hide some on mobile for more canvas space */}
      {!isMobile && <Metrics />}
      <Timeline />
      {!isMobile && <Heatmap />}
      <TaskButton />
      <ActivityFeed compact={isMobile} />

      {/* Sidebar: overlay on desktop, bottom sheet on mobile */}
      {selectedAgent && (
        <div style={isMobile ? mobileSheetStyle : desktopSidebarStyle}>
          <Sidebar
            agent={selectedAgent}
            onClose={() => setSelectedId(null)}
            compact={isMobile}
          />
        </div>
      )}
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
  maxHeight: "60vh",
  zIndex: 20,
  borderTopLeftRadius: "16px",
  borderTopRightRadius: "16px",
  overflow: "hidden",
};
