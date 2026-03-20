/**
 * Animated message particles — envelopes/emoji flying between agents.
 */

import { tileToScreen } from "./isometric";

export interface MessageParticle {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0..1
  emoji: string;
  color: string;
  startTime: number;
  duration: number; // ms
}

const EMOJIS = ["✉️", "💬", "📩", "💌", "📋", "🔔"];

let particleId = 0;

/** Create a new message particle between two tile positions */
export function createParticle(
  fromTileX: number, fromTileY: number,
  toTileX: number, toTileY: number,
  offsetX: number, offsetY: number,
): MessageParticle {
  const from = tileToScreen(fromTileX, fromTileY);
  const to = tileToScreen(toTileX, toTileY);
  return {
    id: `p_${++particleId}`,
    fromX: from.x + offsetX,
    fromY: from.y + offsetY - 30,
    toX: to.x + offsetX,
    toY: to.y + offsetY - 30,
    progress: 0,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    color: "#7f5af0",
    startTime: performance.now(),
    duration: 1200 + Math.random() * 800,
  };
}

/** Update particle progress, return true if still alive */
export function updateParticle(p: MessageParticle, now: number): boolean {
  p.progress = Math.min(1, (now - p.startTime) / p.duration);
  return p.progress < 1;
}

/** Draw a particle with arc trajectory */
export function drawParticle(ctx: CanvasRenderingContext2D, p: MessageParticle) {
  const t = p.progress;
  // Ease in-out
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const x = p.fromX + (p.toX - p.fromX) * ease;
  // Arc: rise then fall
  const arcHeight = -60 * Math.sin(Math.PI * t);
  const y = p.fromY + (p.toY - p.fromY) * ease + arcHeight;

  // Trail
  ctx.globalAlpha = 0.2;
  for (let i = 1; i <= 3; i++) {
    const tt = Math.max(0, t - i * 0.05);
    const easeT = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
    const tx = p.fromX + (p.toX - p.fromX) * easeT;
    const ty = p.fromY + (p.toY - p.fromY) * easeT + (-60 * Math.sin(Math.PI * tt));
    ctx.font = `${12 - i * 2}px serif`;
    ctx.fillText("·", tx, ty);
  }
  ctx.globalAlpha = 1;

  // Shadow
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.ellipse(x, p.fromY + (p.toY - p.fromY) * ease + 20, 8, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.globalAlpha = 1;

  // Emoji
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.emoji, x, y);

  // Glow
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.globalAlpha = 1;
}
