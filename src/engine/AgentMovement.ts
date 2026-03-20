/**
 * Agent movement manager — smooth tile-to-tile movement with pathfinding.
 * Agents wander when idle, move to specific zones when assigned tasks.
 */

import { findPath, randomNearbyTile } from "./Pathfinding";
import type { AgentState } from "@/data/types";

interface MovingAgent {
  agentId: string;
  path: Array<{ col: number; row: number }>;
  currentStep: number;
  progress: number; // 0..1 within current step
  speed: number; // steps per second
}

const movingAgents = new Map<string, MovingAgent>();
const MOVE_SPEED = 1.5; // tiles per second

/** Start an agent moving to a target tile */
export function moveAgentTo(agent: AgentState, targetCol: number, targetRow: number, agents: AgentState[]) {
  const occupied = new Set(agents.filter((a) => a.id !== agent.id).map((a) => `${a.tileX},${a.tileY}`));
  const path = findPath({ col: agent.tileX, row: agent.tileY }, { col: targetCol, row: targetRow }, occupied);

  if (path.length > 0) {
    movingAgents.set(agent.id, {
      agentId: agent.id,
      path,
      currentStep: 0,
      progress: 0,
      speed: MOVE_SPEED,
    });
  }
}

/** Trigger idle wandering for an agent */
export function wanderAgent(agent: AgentState, agents: AgentState[]) {
  if (movingAgents.has(agent.id)) return; // already moving
  if (agent.status !== "idle") return;
  if (Math.random() > 0.3) return; // 30% chance to wander

  const occupied = new Set(agents.filter((a) => a.id !== agent.id).map((a) => `${a.tileX},${a.tileY}`));
  const target = randomNearbyTile({ col: agent.tileX, row: agent.tileY }, occupied);
  moveAgentTo(agent, target.col, target.row, agents);
}

/**
 * Update all moving agents. Call every frame.
 * Returns map of agentId → interpolated (fractional) tile position.
 */
export function updateMovement(dt: number, updateAgentPos: (id: string, col: number, row: number) => void): Map<string, { tileX: number; tileY: number }> {
  const interpolated = new Map<string, { tileX: number; tileY: number }>();

  for (const [id, mov] of movingAgents) {
    mov.progress += dt * mov.speed;

    if (mov.progress >= 1) {
      // Arrived at next tile
      const tile = mov.path[mov.currentStep];
      mov.currentStep++;
      mov.progress = 0;

      if (mov.currentStep >= mov.path.length) {
        // Reached destination
        updateAgentPos(id, tile.col, tile.row);
        movingAgents.delete(id);
        continue;
      }
      updateAgentPos(id, tile.col, tile.row);
    }

    // Interpolate position
    if (mov.currentStep < mov.path.length) {
      const prevTile = mov.currentStep === 0
        ? mov.path[0] // start
        : mov.path[mov.currentStep - 1];
      const nextTile = mov.path[mov.currentStep];
      interpolated.set(id, {
        tileX: prevTile.col + (nextTile.col - prevTile.col) * mov.progress,
        tileY: prevTile.row + (nextTile.row - prevTile.row) * mov.progress,
      });
    }
  }

  return interpolated;
}

/** Check if an agent is currently moving */
export function isMoving(agentId: string): boolean {
  return movingAgents.has(agentId);
}
