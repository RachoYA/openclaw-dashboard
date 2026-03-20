import { useEffect, useState } from "react";
import { Scene } from "./engine/Scene";
import { Sidebar } from "./ui/Sidebar";
import { ActivityFeed } from "./ui/ActivityFeed";
import { Timeline } from "./ui/Timeline";
import { Metrics } from "./ui/Metrics";
import { Heatmap } from "./ui/Heatmap";
import { useAgentStore } from "./data/AgentStore";
import { startWSClient, stopWSClient } from "./data/ws-client";

export function App() {
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

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

      {/* Overlay UI */}
      <Metrics />
      <Timeline />
      <Heatmap />
      <ActivityFeed />

      {/* Sidebar overlay (slides in from right) */}
      {selectedAgent && (
        <div style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
        }}>
          <Sidebar agent={selectedAgent} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}
