/**
 * AgentRenderer — top-down agent visuals: circle body + emoji + label + status dot.
 * Extracted from Scene.tsx as part of Issue #71 decomposition.
 */

import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_SIZE } from "./orthographic";
import { ANIMATIONS } from "./Animations";
import {
  drawAgentSprite, drawActionIcon, drawSpeechBubble, drawStatusIcon,
  SPRITE_W, SPRITE_H,
} from "./SpriteLoader";
import { getZoneAt } from "./OfficeZones";

export const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be", working: "#2cb67d", talking: "#7f5af0", thinking: "#ff8906",
  sleeping: "#525272", celebrating: "#e53170", reviewing: "#3da9fc",
  deploying: "#ff8906", testing: "#3da9fc", waiting: "#a7a9be",
};

const AGENT_RADIUS = 18;

export function drawDesk(
  ctx: CanvasRenderingContext2D,
  agent: AgentState,
  offsetX: number,
  offsetY: number,
  selZone: string | null | undefined,
): void {
  const { x, y } = tileToScreen(agent.tileX, agent.tileY);
  const sx = x + offsetX;
  const sy = y + offsetY;
  if (selZone && getZoneAt(agent.tileX, agent.tileY)?.id !== selZone) ctx.globalAlpha = 0.25;

  // Desk surface
  ctx.fillStyle = "#3d2b1f";
  const dw = TILE_SIZE * 0.55;
  const dh = TILE_SIZE * 0.3;
  ctx.beginPath();
  ctx.roundRect(sx - dw / 2, sy - dh / 2 + 6, dw, dh, 3);
  ctx.fill();
  ctx.strokeStyle = "#5c4033"; ctx.lineWidth = 1; ctx.stroke();

  // Monitor
  ctx.fillStyle = "#0f0e17";
  ctx.fillRect(sx - 7, sy - dh / 2 - 6, 14, 10);
  ctx.fillStyle = "#2cb67d";
  ctx.fillRect(sx - 6, sy - dh / 2 - 5, 12, 8);

  ctx.globalAlpha = 1;
}

export function drawAgent(
  ctx: CanvasRenderingContext2D,
  agent: AgentState,
  offsetX: number,
  offsetY: number,
  t: number,
  selZone: string | null | undefined,
  phase: string,
): void {
  const { x, y } = tileToScreen(agent.tileX, agent.tileY);
  const sx = x + offsetX;
  const sy = y + offsetY;

  if (selZone && getZoneAt(agent.tileX, agent.tileY)?.id !== selZone) ctx.globalAlpha = 0.2;

  const isActive = agent.status !== "idle" && agent.status !== "sleeping";
  const bob = Math.sin(t * (isActive ? 0.004 : 0.002) + agent.tileX * 2) * (isActive ? 3 : 1.5);
  const agentY = sy - SPRITE_H - 4 + bob;

  if (phase === "night" && agent.status === "sleeping") ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4);

  // Shadow
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, AGENT_RADIUS, AGENT_RADIUS * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  // Try HD sprite, fallback to circle
  const drewPng = drawAgentSprite(ctx, agent.id, agent.status, sx, sy + 4, t, 1.0);
  if (!drewPng) {
    const color = STATUS_COLORS[agent.status] || "#a7a9be";
    ctx.beginPath();
    ctx.arc(sx, sy - AGENT_RADIUS * 0.5, AGENT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#0f0e17"; ctx.lineWidth = 2; ctx.stroke();

    // Emoji face on circle
    ctx.font = "14px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const face = agent.status === "sleeping" ? "😴"
      : agent.status === "thinking" ? "🤔"
      : agent.status === "celebrating" ? "🎉"
      : "😊";
    ctx.fillText(face, sx, sy - AGENT_RADIUS * 0.5);
  }

  // Status dot + pulse
  const color = STATUS_COLORS[agent.status] || "#a7a9be";
  const dotX = sx + SPRITE_W * 0.6 - 2;
  const dotY = agentY + 4;
  ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "#0f0e17"; ctx.lineWidth = 1.5; ctx.stroke();
  if (isActive) {
    ctx.beginPath(); ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.sin(t * 0.005) * 0.3 + 0.5;
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = selZone
      ? (getZoneAt(agent.tileX, agent.tileY)?.id === selZone ? 1 : 0.2)
      : 1;
  }

  // Action icon or animation overlay
  if (!drawActionIcon(ctx, agent.status, sx, agentY)) {
    const anim = ANIMATIONS[agent.status];
    if (anim) anim(ctx, sx, agentY, t);
  }
  drawStatusIcon(ctx, agent.status, sx + 30, sy + 10);

  // Name + role
  ctx.font = "bold 11px -apple-system, sans-serif";
  ctx.textAlign = "center"; ctx.fillStyle = "#fffffe";
  ctx.fillText(agent.name, sx, sy + 16);
  ctx.font = "9px -apple-system, sans-serif"; ctx.fillStyle = "#525272";
  ctx.fillText(agent.role, sx, sy + 27);

  // Task bubble
  if (agent.currentTask && isActive) {
    const bubbleY = agentY - 16;
    const text = agent.currentTask.length > 22
      ? agent.currentTask.slice(0, 20) + "…"
      : agent.currentTask;
    const tw = ctx.measureText(text).width;
    const pad = 8;
    const bubbleW = tw + pad * 2 + 10;
    if (!drawSpeechBubble(ctx, sx, bubbleY + 5, bubbleW, 24)) {
      ctx.fillStyle = "rgba(15,14,23,0.92)";
      ctx.beginPath();
      ctx.roundRect(sx - tw / 2 - pad, bubbleY - 9, tw + pad * 2, 18, 8);
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = "#fffffe";
    ctx.fillText(text, sx, bubbleY);
    ctx.fillStyle = "rgba(15,14,23,0.92)";
    ctx.beginPath();
    ctx.moveTo(sx - 4, bubbleY + 9);
    ctx.lineTo(sx + 4, bubbleY + 9);
    ctx.lineTo(sx, bubbleY + 14);
    ctx.closePath(); ctx.fill();
  }

  ctx.globalAlpha = 1;
}
