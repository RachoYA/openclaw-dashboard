import { useState } from "react";
import { Scene } from "./engine/Scene";
import { Sidebar } from "./ui/Sidebar";
import { useAgentStore } from "./data/AgentStore";

export function App() {
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAgent = selectedId ? agents.find((a) => a.id === selectedId) ?? null : null;

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        <Scene agents={agents} onAgentClick={setSelectedId} />
      </div>

      {/* Sidebar */}
      <Sidebar agent={selectedAgent} onClose={() => setSelectedId(null)} />
    </div>
  );
}
