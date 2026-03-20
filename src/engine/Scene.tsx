import { useRef, useEffect, useCallback, useState } from "react";
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

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0, didDrag: false });

  // Day/night cycle
  const getDayPhase = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 9) return "dawn";
    if (hour >= 9 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
  }, []);

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
    const phase = getDayPhase();

    const baseOffsetX = W / 2 + panRef.current.x;
    const baseOffsetY = 100 + panRef.current.y;

    ctx.clearRect(0, 0, W, H);

    // Save and apply zoom
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    const offsetX = baseOffsetX;
    const offsetY = baseOffsetY;

    // Background gradient based on day phase
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

    // Night overlay
    if (phase === "night") {
      ctx.fillStyle = "rgba(0, 0, 20, 0.3)";
      ctx.fillRect(-W, -H, W * 3, H * 3);

      // Stars
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * W;
        const sy = (Math.cos(i * 311.7) * 0.5 + 0.5) * H * 0.3;
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.001 + i) * 0.3;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }

    // Dawn/dusk glow
    if (phase === "dawn" || phase === "dusk") {
      const glowColor = phase === "dawn" ? "rgba(255, 137, 6, 0.06)" : "rgba(229, 49, 112, 0.06)";
      ctx.fillStyle = glowColor;
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

    // --- Floor tiles with zone colors ---
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
          // Highlight selected zone
          if (selectedZone === zone.id) {
            ctx.fillStyle = isLight ? "#2a1f5a" : "#332466";
          }
        } else {
          ctx.fillStyle = isLight ? "#1a1a2e" : "#16213e";
        }
        ctx.fill();
        ctx.strokeStyle = selectedZone && zone?.id === selectedZone ? "#7f5af0" : "#2a2a4a";
        ctx.lineWidth = selectedZone && zone?.id === selectedZone ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // --- Zone labels ---
    for (const zone of OFFICE_ZONES) {
      drawZoneLabel(ctx, zone, offsetX, offsetY, selectedZone === zone.id);
    }

    // --- Zone furniture ---
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const zone of OFFICE_ZONES) {
      for (const item of zone.furniture) {
        const { x, y } = tileToScreen(item.col, item.row);
        ctx.font = "16px serif";
        ctx.globalAlpha = selectedZone && selectedZone !== zone.id ? 0.3 : 0.8;
        ctx.fillText(item.emoji, x + offsetX, y + offsetY - 8);
      }
    }
    ctx.globalAlpha = 1;

    // --- Desks at agent positions ---
    for (const agent of agents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      // Dim if zone filter active and agent not in selected zone
      if (selectedZone) {
        const agentZone = getZoneAt(agent.tileX, agent.tileY);
        if (agentZone?.id !== selectedZone) ctx.globalAlpha = 0.25;
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

    // --- Agents ---
    const sortedAgents = [...agents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);

    for (const agent of sortedAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      // Dim if filtered
      if (selectedZone) {
        const agentZone = getZoneAt(agent.tileX, agent.tileY);
        if (agentZone?.id !== selectedZone) {
          ctx.globalAlpha = 0.2;
        }
      }

      const isActive = agent.status !== "idle" && agent.status !== "sleeping";
      const bobSpeed = isActive ? 0.004 : 0.002;
      const bobAmp = isActive ? 3 : 1.5;
      const bob = Math.sin(t * bobSpeed + agent.tileX * 2) * bobAmp;
      const breathe = Math.sin(t * 0.002 + agent.tileX * 1.5 + agent.tileY) * 2;
      const agentY = sy - SPRITE_SIZE - 4 + bob + breathe;

      // Night: dim sleeping agents more
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
        ctx.globalAlpha = selectedZone ? (getZoneAt(agent.tileX, agent.tileY)?.id === selectedZone ? 1 : 0.2) : 1;
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

    // Zoom indicator
    if (zoom !== 1) {
      ctx.font = "11px -apple-system, sans-serif";
      ctx.fillStyle = "#525272";
      ctx.fillText(`${Math.round(zoom * 100)}%`, W - 20, 50);
    }

    frameRef.current = requestAnimationFrame(render);
  }, [agents, zoom, getDayPhase, selectedZone]);

  // --- Zoom via wheel ---
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(2.5, Math.max(0.5, z - e.deltaY * 0.001)));
  }, []);

  // --- Pan via drag (any mouse button) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      panStartX: panRef.current.x,
      panStartY: panRef.current.y,
      didDrag: false,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Only start dragging after 5px threshold (to allow clicks)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.didDrag = true;
      setIsDragging(true);
      panRef.current.x = dragRef.current.panStartX + dx / zoom;
      panRef.current.y = dragRef.current.panStartY + dy / zoom;
    }
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
    setIsDragging(false);
  }, []);

  // --- Touch support for mobile ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = {
        dragging: true,
        startX: t.clientX,
        startY: t.clientY,
        panStartX: panRef.current.x,
        panStartY: panRef.current.y,
        didDrag: false,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.startX;
    const dy = t.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragRef.current.didDrag = true;
      panRef.current.x = dragRef.current.panStartX + dx / zoom;
      panRef.current.y = dragRef.current.panStartY + dy / zoom;
    }
  }, [zoom]);

  const handleTouchEnd = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // --- Click → agent or zone ---
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragRef.current.didDrag) return; // was a drag, not a click
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const W = canvas.width / dpr;

      // Reverse zoom transform
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const mx = (rawX - W / 2) / zoom + W / 2;
      const my = (rawY - (canvas.height / dpr) / 2) / zoom + (canvas.height / dpr) / 2;

      const offsetX = W / 2 + panRef.current.x;
      const offsetY = 100 + panRef.current.y;

      // Check agents first
      for (const agent of agents) {
        const { x, y } = tileToScreen(agent.tileX, agent.tileY);
        const sx = x + offsetX;
        const sy = y + offsetY - SPRITE_SIZE / 2;
        if (Math.abs(mx - sx) < 20 && Math.abs(my - sy) < 24) {
          onAgentClick(agent.id);
          return;
        }
      }

      // Check zones
      if (onZoneClick) {
        for (const zone of OFFICE_ZONES) {
          const centerCol = (zone.col1 + zone.col2) / 2;
          const centerRow = (zone.row1 + zone.row2) / 2;
          const { x, y } = tileToScreen(centerCol, centerRow);
          const sx = x + offsetX;
          const sy = y + offsetY;
          const zoneW = (zone.col2 - zone.col1 + 1) * TILE_WIDTH / 2;
          const zoneH = (zone.row2 - zone.row1 + 1) * TILE_HEIGHT / 2;
          if (Math.abs(mx - sx) < zoneW && Math.abs(my - sy) < zoneH) {
            onZoneClick(selectedZone === zone.id ? null : zone.id);
            return;
          }
        }
        // Click on empty space — deselect
        onZoneClick(null);
      }
    },
    [agents, onAgentClick, onZoneClick, zoom, selectedZone],
  );

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
    <div ref={containerRef} style={{ width: "100%", height: "100%", touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ display: "block", cursor: isDragging ? "grabbing" : "grab" }}
      />
    </div>
  );
}
