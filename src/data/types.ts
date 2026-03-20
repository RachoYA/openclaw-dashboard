/** Agent activity state — drives animation */
export type AgentStatus = "idle" | "working" | "talking" | "thinking" | "sleeping" | "celebrating" | "reviewing" | "deploying" | "testing" | "waiting";

/** Direction an agent faces on the isometric grid */
export type Direction = "se" | "sw" | "ne" | "nw";

/** Agent state as consumed by the dashboard */
export interface AgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  lastMessage: string | null;
  lastActiveAt: string | null;
  /** Grid position (tile coordinates, not pixels) */
  tileX: number;
  tileY: number;
  direction: Direction;
  avatar: string | null;
}

/** Message flowing between agents */
export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  text: string;
  timestamp: string;
}
