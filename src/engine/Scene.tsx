import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT } from "./isometric";
import { getSprite, SPRITE_SIZE } from "./SpriteGenerator";
import { ANIMATIONS } from "./Animations";
import { type MessageParticle, createParticle, updateParticle, drawParticle } from "./MessageParticle";
import { OFFICE_ZONES, getZoneAt, drawZoneLabel } from "./OfficeZones";

const GRID_COLS = 10;
const GRID_ROWS = 8;

const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be", working: "#2cb67d", talking: "#7f5af0", thinking: "#ff8906",
  sleeping: "#525272", celebrating: "#e53170", reviewing: "#3da9fc",
  deploying: "#ff8906", testing: "#3da9fc", waiting: "#a7a9be",
};

interface SceneProps {
  agents: AgentState[];
  onAgentClick: (id: string) => void;
  selectedZone?: string | null;
  onZoneClick?: (zoneId: string | null) => void;
}

export function Scene({ agents, onAgentClick, selectedZone, onZoneClick }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<MessageParticle[]>([]);
  const lastParticleTime = useRef(0);

  // All mutable state as refs to avoid stale closures in render loop
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    didMove: false,
    startX: 0, startY: 0,
    panStartX: 0, panStartY: 0,
  });

  // Keep props in refs for render loop
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;

  const getDayPhase = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 9) return "dawn";
    if (hour >= 9 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
  };

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

  // --- Render loop (uses refs, no stale closures) ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const t = performance.now();
    const phase = getDayPhase();
    const zoom = zoomRef.current;
    const agents = agentsRef.current;
    const selZone = selectedZoneRef.current;

    const baseOffsetX = W / 2 + panRef.current.x;
    const baseOffsetY = H / 2 - 50 + panRef.current.y;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset
    ctx.clearRect(0, 0, W, H);

    // Apply zoom centered on screen
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    const offsetX = baseOffsetX;
    const offsetY = baseOffsetY;

    // --- Background ---
    const gradColors: Record<string, [string, string]> = {
      dawn: ["#1a0a2e", "#2d1545"],
      day: ["#0f0e17", "#1a1a2e"],
      dusk: ["#1a1020", "#2d1a25"],
      night: ["#050510", "#0a0a18"],
    };
    const [g1, g2] = gradColors[phase] || gradColors.day;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, g1);
    grad.addColorStop(1, g2);
    ctx.fillStyle = grad;
    ctx.fillRect(-W, -H, W * 3, H * 3);

    if (phase === "night") {
      ctx.fillStyle = "rgba(0, 0, 20, 0.3)";
      ctx.fillRect(-W, -H, W * 3, H * 3);
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * W;
        const sy = (Math.cos(i * 311.7) * 0.5 + 0.5) * H * 0.3;
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.001 + i) * 0.3;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }

    if (phase === "dawn" || phase === "dusk") {
      ctx.fillStyle = phase === "dawn" ? "rgba(255, 137, 6, 0.06)" : "rgba(229, 49, 112, 0.06)";
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

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

        const zone = getZoneAt(col, row);
        const isLight = (col + row) % 2 === 0;

        if (zone) {
          ctx.fillStyle = isLight ? zone.floorColor : zone.floorColorAlt;
          if (selZone === zone.id) {
            ctx.fillStyle = isLight ? "#2a1f5a" : "#332466";
          }
        } else {
          ctx.fillStyle = isLight ? "#1a1a2e" : "#16213e";
        }
        ctx.fill();
        ctx.strokeStyle = selZone && zone?.id === selZone ? "#7f5af0" : "#2a2a4a";
        ctx.lineWidth = selZone && zone?.id === selZone ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // --- Zone labels ---
    for (const zone of OFFICE_ZONES) {
      drawZoneLabel(ctx, zone, offsetX, offsetY, selZone === zone.id);
    }

    // --- Zone furniture ---
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OFFICE_ZONES) {
      for (const item of zone.furniture) {
        const { x, y } = tileToScreen(item.col, item.row);
        ctx.font = "16px serif";
        ctx.globalAlpha = selZone && selZone !== zone.id ? 0.3 : 0.8;
        ctx.fillText(item.emoji, x + offsetX, y + offsetY - 8);
      }
    }
    ctx.globalAlpha = 1;

    // --- Desks ---
    for (const agent of agents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      if (selZone) {
        const agentZone = getZoneAt(agent.tileX, agent.tileY);
        if (agentZone?.id !== selZone) ctx.globalAlpha = 0.25;
      }

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

      ctx.fillStyle = "#0f0e17";
      ctx.fillRect(sx - 5, sy - 12, 10, 8);
      ctx.fillStyle = "#2cb67d";
      ctx.fillRect(sx - 4, sy - 11, 8, 6);
      ctx.globalAlpha = 1;
    }

    // --- Agents (sorted by depth) ---
    const sortedAgents = [...agents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);

    for (const agent of sortedAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      if (selZone) {
        const agentZone = getZoneAt(agent.tileX, agent.tileY);
        if (agentZone?.id !== selZone) ctx.globalAlpha = 0.2;
      }

      const isActive = agent.status !== "idle" && agent.status !== "sleeping";
      const bobSpeed = isActive ? 0.004 : 0.002;
      const bobAmp = isActive ? 3 : 1.5;
      const bob = Math.sin(t * bobSpeed + agent.tileX * 2) * bobAmp;
      const breathe = Math.sin(t * 0.002 + agent.tileX * 1.5 + agent.tileY) * 2;
      const agentY = sy - SPRITE_SIZE - 4 + bob + breathe;

      if (phase === "night" && agent.status === "sleeping") {
        ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4);
      }

      // Shadow
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

      // Sprite
      const sprite = getSprite(agent.role);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx - SPRITE_SIZE / 2, agentY, SPRITE_SIZE, SPRITE_SIZE);
      ctx.imageSmoothingEnabled = true;

      // Status dot
      const color = STATUS_COLORS[agent.status] || "#a7a9be";
      ctx.beginPath();
      ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#0f0e17";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pulse
      if (isActive) {
        const pulse = Math.sin(t * 0.005) * 0.3 + 0.5;
        ctx.beginPath();
        ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 7, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(ctx.globalAlpha, pulse);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = selZone ? (getZoneAt(agent.tileX, agent.tileY)?.id === selZone ? 1 : 0.2) : 1;
      }

      // Animation
      const anim = ANIMATIONS[agent.status];
      if (anim) anim(ctx, sx, agentY, t);

      // Name
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fffffe";
      ctx.fillText(agent.name, sx, sy + 16);

      ctx.font = "9px -apple-system, sans-serif";
      ctx.fillStyle = "#525272";
      ctx.fillText(agent.role, sx, sy + 27);

      // Task bubble
      if (agent.currentTask && isActive) {
        const bubbleY = agentY - 16;
        const text = agent.currentTask.length > 22 ? agent.currentTask.slice(0, 20) + "…" : agent.currentTask;
        const tw = ctx.measureText(text).width;
        const pad = 8;

        ctx.fillStyle = "rgba(15, 14, 23, 0.92)";
        ctx.beginPath();
        ctx.roundRect(sx - tw / 2 - pad, bubbleY - 9, tw + pad * 2, 18, 8);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "10px -apple-system, sans-serif";
        ctx.fillStyle = "#fffffe";
        ctx.fillText(text, sx, bubbleY);

        ctx.fillStyle = "rgba(15, 14, 23, 0.92)";
        ctx.beginPath();
        ctx.moveTo(sx - 4, bubbleY + 9);
        ctx.lineTo(sx + 4, bubbleY + 9);
        ctx.lineTo(sx, bubbleY + 14);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    // --- Connection lines ---
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

    // --- Particles ---
    if (t - lastParticleTime.current > 3000 + Math.random() * 4000 && agents.length >= 2) {
      lastParticleTime.current = t;
      const fromIdx = Math.floor(Math.random() * agents.length);
      let toIdx = Math.floor(Math.random() * agents.length);
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % agents.length;
      particlesRef.current.push(createParticle(
        agents[fromIdx].tileX, agents[fromIdx].tileY,
        agents[toIdx].tileX, agents[toIdx].tileY,
        offsetX, offsetY,
      ));
    }
    particlesRef.current = particlesRef.current.filter((p) => updateParticle(p, t));
    for (const p of particlesRef.current) drawParticle(ctx, p);

    ctx.restore(); // undo zoom

    // --- HUD (not zoomed) ---
    const phaseIcons: Record<string, string> = { dawn: "🌅", day: "☀️", dusk: "🌇", night: "🌙" };
    ctx.textAlign = "left";
    ctx.font = "bold 20px -apple-system, sans-serif";
    ctx.fillStyle = "#fffffe";
    ctx.fillText("🐾 OpenClaw Office", 20, 32);

    const activeCount = agents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillStyle = "#a7a9be";
    ctx.fillText(`${agents.length} agents · ${activeCount} active  ${phaseIcons[phase] || ""}`, 20, 52);

    ctx.textAlign = "right";
    ctx.font = "12px -apple-system, monospace";
    ctx.fillStyle = "#525272";
    ctx.fillText(new Date().toLocaleTimeString("ru"), W - 20, 32);

    if (zoom !== 1) {
      ctx.font = "11px -apple-system, sans-serif";
      ctx.fillStyle = "#525272";
      ctx.fillText(`${Math.round(zoom * 100)}%`, W - 20, 50);
    }

    ctx.restore(); // undo setTransform

    frameRef.current = requestAnimationFrame(render);
  }, []); // no deps — uses refs

  // --- Zoom via wheel ---
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.min(2.5, Math.max(0.4, zoomRef.current - e.deltaY * 0.001));
  }, []);

  // --- Pan via drag (LEFT BUTTON, no modifier needed) ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      didMove: false,
      startX: e.clientX,
      startY: e.clientY,
      panStartX: panRef.current.x,
      panStartY: panRef.current.y,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      d.didMove = true;
      panRef.current.x = d.panStartX + dx / zoomRef.current;
      panRef.current.y = d.panStartY + dy / zoomRef.current;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    d.active = false;

    // If it was a click (not drag), detect agent/zone
    if (!d.didMove) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const zoom = zoomRef.current;

      // Reverse zoom+pan transform
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const mx = (rawX - W / 2) / zoom + W / 2;
      const my = (rawY - H / 2) / zoom + H / 2;

      const offsetX = W / 2 + panRef.current.x;
      const offsetY = H / 2 - 50 + panRef.current.y;

      // Check agents
      const currentAgents = agentsRef.current;
      for (const agent of currentAgents) {
        const { x, y } = tileToScreen(agent.tileX, agent.tileY);
        const sx = x + offsetX;
        const sy = y + offsetY - SPRITE_SIZE / 2;
        if (Math.abs(mx - sx) < 24 && Math.abs(my - sy) < 28) {
          onAgentClick(agent.id);
          return;
        }
      }

      // Check zones
      if (onZoneClick) {
        const curZone = selectedZoneRef.current;
        for (const zone of OFFICE_ZONES) {
          const centerCol = (zone.col1 + zone.col2) / 2;
          const centerRow = (zone.row1 + zone.row2) / 2;
          const { x, y } = tileToScreen(centerCol, centerRow);
          const sx = x + offsetX;
          const sy = y + offsetY;
          const zoneW = (zone.col2 - zone.col1 + 1) * TILE_WIDTH / 2;
          const zoneH = (zone.row2 - zone.row1 + 1) * TILE_HEIGHT / 2;
          if (Math.abs(mx - sx) < zoneW && Math.abs(my - sy) < zoneH) {
            onZoneClick(curZone === zone.id ? null : zone.id);
            return;
          }
        }
        onZoneClick(null);
      }
    }
  }, [onAgentClick, onZoneClick]);

  useEffect(() => {
    resize();
    const canvas = canvasRef.current;
    window.addEventListener("resize", resize);
    canvas?.addEventListener("wheel", handleWheel, { passive: false });
    frameRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      canvas?.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(frameRef.current);
    };
  }, [resize, render, handleWheel]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
      />
    </div>
  );
}
