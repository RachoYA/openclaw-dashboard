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

  // Connect to BFF WebSocket for real-time agent data
  useEffect(() => {
    startWSClient();
    return () => stopWSClient();
  }, []);

  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Scene
          agents={agents}
          onAgentClick={setSelectedId}
          selectedZone={selectedZone}
          onZoneClick={setSelectedZone}
        />
        <Metrics />
        <Timeline />
        <Heatmap />
        <ActivityFeed />
      </div>

      {/* Sidebar */}
      <Sidebar agent={selectedAgent} onClose={() => setSelectedId(null)} />
    </div>
  );
}
