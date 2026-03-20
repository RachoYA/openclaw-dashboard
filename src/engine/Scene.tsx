import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT } from "./isometric";
import { getSprite, SPRITE_SIZE } from "./SpriteGenerator";
import { ANIMATIONS } from "./Animations";
import { type MessageParticle, createParticle, updateParticle, drawParticle } from "./MessageParticle";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_COLS = 10;
const GRID_ROWS = 8;

const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be",
  working: "#2cb67d",
  talking: "#7f5af0",
  thinking: "#ff8906",
  sleeping: "#525272",
  celebrating: "#e53170",
  reviewing: "#3da9fc",
  deploying: "#ff8906",
  testing: "#3da9fc",
  waiting: "#a7a9be",
};

// Furniture items on the grid (decorative)
const FURNITURE: { col: number; row: number; emoji: string }[] = [
  { col: 1, row: 1, emoji: "🪴" },
  { col: 8, row: 1, emoji: "🪴" },
  { col: 1, row: 6, emoji: "🪴" },
  { col: 8, row: 6, emoji: "🪴" },
  { col: 4, row: 0, emoji: "📺" },
  { col: 0, row: 3, emoji: "☕" },
  { col: 9, row: 4, emoji: "🖨️" },
  { col: 5, row: 7, emoji: "📦" },
];

// Desk positions (drawn as flat rectangles)
const DESKS: { col: number; row: number }[] = [
  { col: 3, row: 2 },
  { col: 5, row: 3 },
  { col: 2, row: 4 },
  { col: 6, row: 2 },
  { col: 4, row: 5 },
  { col: 4, row: 1 },
];

interface SceneProps {
  agents: AgentState[];
  onAgentClick: (id: string) => void;
}

export function Scene({ agents, onAgentClick }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<MessageParticle[]>([]);
  const lastParticleTime = useRef(0);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + "px";
    canvas.style.height = container.clientHeight + "px";
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const t = performance.now();

    const offsetX = W / 2;
    const offsetY = 100;

    ctx.clearRect(0, 0, W, H);

    // --- Background gradient ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0f0e17");
    grad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // --- Floor tiles ---
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const { x, y } = tileToScreen(col, row);
        const sx = x + offsetX;
        const sy = y + offsetY;
        const hw = TILE_WIDTH / 2;
        const hh = TILE_HEIGHT / 2;

        ctx.beginPath();
        ctx.moveTo(sx, sy - hh);
        ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh);
        ctx.lineTo(sx - hw, sy);
        ctx.closePath();

        const isLight = (col + row) % 2 === 0;
        ctx.fillStyle = isLight ? "#1a1a2e" : "#16213e";
        ctx.fill();
        ctx.strokeStyle = "#2a2a4a";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // --- Desks ---
    for (const desk of DESKS) {
      const { x, y } = tileToScreen(desk.col, desk.row);
      const sx = x + offsetX;
      const sy = y + offsetY;

      // Desk top (isometric rectangle)
      ctx.fillStyle = "#3d2b1f";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 16, sy + 4);
      ctx.lineTo(sx, sy + 12);
      ctx.lineTo(sx - 16, sy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#5c4033";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Monitor
      ctx.fillStyle = "#0f0e17";
      ctx.fillRect(sx - 5, sy - 12, 10, 8);
      ctx.fillStyle = "#2cb67d";
      ctx.fillRect(sx - 4, sy - 11, 8, 6);
    }

    // --- Furniture ---
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of FURNITURE) {
      const { x, y } = tileToScreen(item.col, item.row);
      ctx.font = "18px serif";
      ctx.fillText(item.emoji, x + offsetX, y + offsetY);
    }

    // --- Agents (sorted by row for depth) ---
    const sortedAgents = [...agents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);

    for (const agent of sortedAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      // Breathing / bobbing
      const breathe = Math.sin(t * 0.002 + agent.tileX * 1.5 + agent.tileY) * 2;
      const isActive = agent.status !== "idle" && agent.status !== "sleeping";
      const bobSpeed = isActive ? 0.004 : 0.002;
      const bobAmp = isActive ? 3 : 1.5;
      const bob = Math.sin(t * bobSpeed + agent.tileX * 2) * bobAmp;

      const agentY = sy - SPRITE_SIZE - 4 + bob + breathe;

      // Shadow
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

      // Draw pixel-art sprite
      const sprite = getSprite(agent.role);
      ctx.imageSmoothingEnabled = false; // crisp pixels
      ctx.drawImage(sprite, sx - SPRITE_SIZE / 2, agentY, SPRITE_SIZE, SPRITE_SIZE);
      ctx.imageSmoothingEnabled = true;

      // Status indicator dot
      const color = STATUS_COLORS[agent.status] || "#a7a9be";
      ctx.beginPath();
      ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#0f0e17";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Status pulse ring
      if (isActive) {
        const pulse = Math.sin(t * 0.005) * 0.3 + 0.5;
        ctx.beginPath();
        ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 7, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Run status-specific animation
      const anim = ANIMATIONS[agent.status];
      if (anim) {
        anim(ctx, sx, agentY, t);
      }

      // Name label
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fffffe";
      ctx.fillText(agent.name, sx, sy + 16);

      // Role label
      ctx.font = "9px -apple-system, sans-serif";
      ctx.fillStyle = "#525272";
      ctx.fillText(agent.role, sx, sy + 27);

      // Task bubble
      if (agent.currentTask && isActive) {
        const bubbleY = agentY - 16;
        const text = agent.currentTask.length > 22 ? agent.currentTask.slice(0, 20) + "…" : agent.currentTask;
        const tw = ctx.measureText(text).width;
        const pad = 8;

        // Bubble background
        ctx.fillStyle = "rgba(15, 14, 23, 0.92)";
        ctx.beginPath();
        ctx.roundRect(sx - tw / 2 - pad, bubbleY - 9, tw + pad * 2, 18, 8);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bubble text
        ctx.font = "10px -apple-system, sans-serif";
        ctx.fillStyle = "#fffffe";
        ctx.fillText(text, sx, bubbleY);

        // Tail
        ctx.fillStyle = "rgba(15, 14, 23, 0.92)";
        ctx.beginPath();
        ctx.moveTo(sx - 4, bubbleY + 9);
        ctx.lineTo(sx + 4, bubbleY + 9);
        ctx.lineTo(sx, bubbleY + 14);
        ctx.closePath();
        ctx.fill();
      }
    }

    // --- Connection lines between talking agents ---
    const talkingAgents = agents.filter((a) => a.status === "talking");
    if (talkingAgents.length >= 2) {
      for (let i = 0; i < talkingAgents.length - 1; i++) {
        const a1 = talkingAgents[i];
        const a2 = talkingAgents[i + 1];
        const p1 = tileToScreen(a1.tileX, a1.tileY);
        const p2 = tileToScreen(a2.tileX, a2.tileY);

        ctx.beginPath();
        ctx.moveTo(p1.x + offsetX, p1.y + offsetY - 20);
        ctx.lineTo(p2.x + offsetX, p2.y + offsetY - 20);
        ctx.strokeStyle = "#7f5af0";
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.003) * 0.2;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // --- Message particles ---
    // Spawn new particles periodically between random agents
    if (t - lastParticleTime.current > 3000 + Math.random() * 4000 && agents.length >= 2) {
      lastParticleTime.current = t;
      const fromIdx = Math.floor(Math.random() * agents.length);
      let toIdx = Math.floor(Math.random() * agents.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % agents.length;
      const from = agents[fromIdx];
      const to = agents[toIdx];
      particlesRef.current.push(createParticle(from.tileX, from.tileY, to.tileX, to.tileY, offsetX, offsetY));
    }

    // Update & draw particles
    particlesRef.current = particlesRef.current.filter((p) => updateParticle(p, t));
    for (const p of particlesRef.current) {
      drawParticle(ctx, p);
    }

    // --- Header ---
    ctx.textAlign = "left";
    ctx.font = "bold 20px -apple-system, sans-serif";
    ctx.fillStyle = "#fffffe";
    ctx.fillText("🐾 OpenClaw Office", 20, 32);

    const activeCount = agents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillStyle = "#a7a9be";
    ctx.fillText(`${agents.length} agents · ${activeCount} active`, 20, 52);

    // --- Clock ---
    ctx.textAlign = "right";
    ctx.font = "12px -apple-system, monospace";
    ctx.fillStyle = "#525272";
    ctx.fillText(new Date().toLocaleTimeString("ru"), W - 20, 32);

    frameRef.current = requestAnimationFrame(render);
  }, [agents]);

  // Click detection
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = canvas.width / dpr;
      const offsetX = W / 2;
      const offsetY = 100;

      for (const agent of agents) {
        const { x, y } = tileToScreen(agent.tileX, agent.tileY);
        const sx = x + offsetX;
        const sy = y + offsetY - SPRITE_SIZE / 2;
        if (Math.abs(mx - sx) < 20 && Math.abs(my - sy) < 24) {
          onAgentClick(agent.id);
          return;
        }
      }
    },
    [agents, onAgentClick],
  );

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    frameRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [resize, render]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{ display: "block", cursor: "pointer" }}
      />
    </div>
  );
}
