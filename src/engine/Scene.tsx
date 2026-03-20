import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { type Theme, PALETTES } from "@/hooks/useTheme";
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
  theme?: Theme;
}

export function Scene({ agents, onAgentClick, selectedZone, onZoneClick, theme = "light" }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<MessageParticle[]>([]);
  const lastParticleTime = useRef(0);

  // All mutable state in refs (no stale closures)
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, didMove: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });

  // Pinch-to-zoom state
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

  // Props in refs for render loop
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const getDayPhase = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 9) return "dawn";
    if (h >= 9 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
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

  // ---------- Render loop ----------
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
    const currentAgents = agentsRef.current;
    const selZone = selectedZoneRef.current;

    const offsetX = W / 2 + panRef.current.x;
    const offsetY = H / 2 - 50 + panRef.current.y;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Apply zoom
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    // --- Background (theme-aware) ---
    const pal = PALETTES[themeRef.current];
    const isDark = themeRef.current === "dark";

    if (isDark) {
      const gradColors: Record<string, [string, string]> = {
        dawn: ["#1a0a2e", "#2d1545"], day: [pal.bg1, pal.bg2],
        dusk: ["#1a1020", "#2d1a25"], night: ["#050510", "#0a0a18"],
      };
      const [g1, g2] = gradColors[phase] || gradColors.day;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, g1); grad.addColorStop(1, g2);
      ctx.fillStyle = grad;
    } else {
      const gradColors: Record<string, [string, string]> = {
        dawn: ["#fff5e6", "#ffecd2"], day: [pal.bg1, pal.bg2],
        dusk: ["#f5e6f0", "#edd8e8"], night: ["#e8e8f0", "#dddde8"],
      };
      const [g1, g2] = gradColors[phase] || gradColors.day;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, g1); grad.addColorStop(1, g2);
      ctx.fillStyle = grad;
    }
    ctx.fillRect(-W, -H, W * 3, H * 3);

    if (phase === "night" && isDark) {
      ctx.fillStyle = pal.nightOverlay; ctx.fillRect(-W, -H, W * 3, H * 3);
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * W;
        const sy = (Math.cos(i * 311.7) * 0.5 + 0.5) * H * 0.3;
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.001 + i) * 0.3;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    if ((phase === "dawn" || phase === "dusk") && isDark) {
      ctx.fillStyle = phase === "dawn" ? "rgba(255,137,6,0.06)" : "rgba(229,49,112,0.06)";
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

    // --- Floor tiles ---
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const { x, y } = tileToScreen(col, row);
        const sx = x + offsetX, sy = y + offsetY;
        const hw = TILE_WIDTH / 2, hh = TILE_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy - hh); ctx.lineTo(sx + hw, sy);
        ctx.lineTo(sx, sy + hh); ctx.lineTo(sx - hw, sy);
        ctx.closePath();
        const zone = getZoneAt(col, row);
        const isLt = (col + row) % 2 === 0;
        if (zone) {
          const zoneColors = pal.zones[zone.id as keyof typeof pal.zones];
          if (zoneColors) {
            ctx.fillStyle = isLt ? zoneColors.floor : zoneColors.alt;
          } else {
            ctx.fillStyle = isDark
              ? (isLt ? zone.floorColor : zone.floorColorAlt)
              : (isLt ? pal.floorLight : pal.floorDark);
          }
          if (selZone === zone.id) ctx.fillStyle = isLt ? pal.floorZoneHighlight1 : pal.floorZoneHighlight2;
        } else {
          ctx.fillStyle = isLt ? pal.floorLight : pal.floorDark;
        }
        ctx.fill();
        ctx.strokeStyle = selZone && zone?.id === selZone ? pal.gridLineActive : pal.gridLine;
        ctx.lineWidth = selZone && zone?.id === selZone ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // Zone labels + furniture
    for (const zone of OFFICE_ZONES) drawZoneLabel(ctx, zone, offsetX, offsetY, selZone === zone.id);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
    for (const agent of currentAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX, sy = y + offsetY;
      if (selZone && getZoneAt(agent.tileX, agent.tileY)?.id !== selZone) ctx.globalAlpha = 0.25;
      ctx.fillStyle = isDark ? "#3d2b1f" : "#c4a882";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 16, sy + 4);
      ctx.lineTo(sx, sy + 12); ctx.lineTo(sx - 16, sy + 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = isDark ? "#5c4033" : "#a08060"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = isDark ? "#0f0e17" : "#e8e8ed"; ctx.fillRect(sx - 5, sy - 12, 10, 8);
      ctx.fillStyle = "#2cb67d"; ctx.fillRect(sx - 4, sy - 11, 8, 6);
      ctx.globalAlpha = 1;
    }

    // --- Agents (depth sorted) ---
    const sorted = [...currentAgents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);
    for (const agent of sorted) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX, sy = y + offsetY;
      if (selZone && getZoneAt(agent.tileX, agent.tileY)?.id !== selZone) ctx.globalAlpha = 0.2;
      const isActive = agent.status !== "idle" && agent.status !== "sleeping";
      const bob = Math.sin(t * (isActive ? 0.004 : 0.002) + agent.tileX * 2) * (isActive ? 3 : 1.5);
      const breathe = Math.sin(t * 0.002 + agent.tileX * 1.5 + agent.tileY) * 2;
      const agentY = sy - SPRITE_SIZE - 4 + bob + breathe;
      if (phase === "night" && agent.status === "sleeping") ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4);

      // Shadow
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = pal.shadow; ctx.fill();

      // Sprite
      const sprite = getSprite(agent.role);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx - SPRITE_SIZE / 2, agentY, SPRITE_SIZE, SPRITE_SIZE);
      ctx.imageSmoothingEnabled = true;

      // Status dot + pulse
      const color = STATUS_COLORS[agent.status] || "#a7a9be";
      ctx.beginPath(); ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = isDark ? "#0f0e17" : "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
      if (isActive) {
        ctx.beginPath(); ctx.arc(sx + SPRITE_SIZE / 2 - 2, agentY + 4, 7, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.globalAlpha = Math.sin(t * 0.005) * 0.3 + 0.5;
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = selZone ? (getZoneAt(agent.tileX, agent.tileY)?.id === selZone ? 1 : 0.2) : 1;
      }

      // Animation overlay
      const anim = ANIMATIONS[agent.status];
      if (anim) anim(ctx, sx, agentY, t);

      // Name + role
      ctx.font = "bold 11px -apple-system, sans-serif";
      ctx.textAlign = "center"; ctx.fillStyle = pal.text;
      ctx.fillText(agent.name, sx, sy + 16);
      ctx.font = "9px -apple-system, sans-serif"; ctx.fillStyle = pal.textMuted;
      ctx.fillText(agent.role, sx, sy + 27);

      // Task bubble
      if (agent.currentTask && isActive) {
        const bubbleY = agentY - 16;
        const text = agent.currentTask.length > 22 ? agent.currentTask.slice(0, 20) + "…" : agent.currentTask;
        const tw = ctx.measureText(text).width;
        const pad = 8;
        ctx.fillStyle = pal.surface;
        ctx.beginPath(); ctx.roundRect(sx - tw / 2 - pad, bubbleY - 9, tw + pad * 2, 18, 8); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = pal.text;
        ctx.fillText(text, sx, bubbleY);
        ctx.fillStyle = pal.surface;
        ctx.beginPath(); ctx.moveTo(sx - 4, bubbleY + 9);
        ctx.lineTo(sx + 4, bubbleY + 9); ctx.lineTo(sx, bubbleY + 14); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // --- Connection lines ---
    const talking = currentAgents.filter((a) => a.status === "talking");
    if (talking.length >= 2) {
      for (let i = 0; i < talking.length - 1; i++) {
        const p1 = tileToScreen(talking[i].tileX, talking[i].tileY);
        const p2 = tileToScreen(talking[i + 1].tileX, talking[i + 1].tileY);
        ctx.beginPath();
        ctx.moveTo(p1.x + offsetX, p1.y + offsetY - 20);
        ctx.lineTo(p2.x + offsetX, p2.y + offsetY - 20);
        ctx.strokeStyle = "#7f5af0"; ctx.globalAlpha = 0.3 + Math.sin(t * 0.003) * 0.2;
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }

    // --- Particles ---
    if (t - lastParticleTime.current > 3000 + Math.random() * 4000 && currentAgents.length >= 2) {
      lastParticleTime.current = t;
      const fi = Math.floor(Math.random() * currentAgents.length);
      let ti = Math.floor(Math.random() * currentAgents.length);
      if (ti === fi) ti = (ti + 1) % currentAgents.length;
      particlesRef.current.push(createParticle(
        currentAgents[fi].tileX, currentAgents[fi].tileY,
        currentAgents[ti].tileX, currentAgents[ti].tileY, offsetX, offsetY));
    }
    particlesRef.current = particlesRef.current.filter((p) => updateParticle(p, t));
    for (const p of particlesRef.current) drawParticle(ctx, p);

    ctx.restore(); // undo zoom

    // --- HUD (not zoomed) ---
    const phaseIcons: Record<string, string> = { dawn: "🌅", day: "☀️", dusk: "🌇", night: "🌙" };
    ctx.textAlign = "left";
    ctx.font = "bold 18px -apple-system, sans-serif"; ctx.fillStyle = pal.text;
    ctx.fillText("🐾 OpenClaw Office", 16, 28);
    const active = currentAgents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
    ctx.font = "12px -apple-system, sans-serif"; ctx.fillStyle = pal.textSecondary;
    ctx.fillText(`${currentAgents.length} agents · ${active} active  ${phaseIcons[phase] || ""}`, 16, 46);
    ctx.textAlign = "right";
    ctx.font = "11px -apple-system, monospace"; ctx.fillStyle = pal.textMuted;
    ctx.fillText(new Date().toLocaleTimeString("ru"), W - 16, 28);
    if (zoom !== 1) {
      ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = pal.textMuted;
      ctx.fillText(`${Math.round(zoom * 100)}%`, W - 16, 44);
    }

    ctx.restore();
    frameRef.current = requestAnimationFrame(render);
  }, []); // no deps — all via refs

  // ---------- Wheel zoom ----------
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.min(3, Math.max(0.3, zoomRef.current - e.deltaY * 0.001));
  }, []);

  // ---------- Touch: 1-finger pan, 2-finger pinch-to-zoom ----------
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = { active: true, didMove: false, startX: t.clientX, startY: t.clientY,
        panStartX: panRef.current.x, panStartY: panRef.current.y };
      pinchRef.current.active = false;
    } else if (e.touches.length === 2) {
      dragRef.current.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startZoom: zoomRef.current };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (pinchRef.current.active && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchRef.current.startDist;
      zoomRef.current = Math.min(3, Math.max(0.3, pinchRef.current.startZoom * scale));
    } else if (dragRef.current.active && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.startX;
      const dy = t.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.didMove = true;
        panRef.current.x = dragRef.current.panStartX + dx / zoomRef.current;
        panRef.current.y = dragRef.current.panStartY + dy / zoomRef.current;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length === 0) {
      // Tap detection (no pinch, no drag)
      if (dragRef.current.active && !dragRef.current.didMove && !pinchRef.current.active) {
        handleTapAt(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      dragRef.current.active = false;
      pinchRef.current.active = false;
    } else if (e.touches.length === 1) {
      // Went from 2 fingers to 1 — restart pan
      pinchRef.current.active = false;
      const t = e.touches[0];
      dragRef.current = { active: true, didMove: false, startX: t.clientX, startY: t.clientY,
        panStartX: panRef.current.x, panStartY: panRef.current.y };
    }
  }, []);

  // ---------- Mouse: drag to pan ----------
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return; // handled by touch events
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, didMove: false, startX: e.clientX, startY: e.clientY,
      panStartX: panRef.current.x, panStartY: panRef.current.y };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch" || !dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.didMove = true;
      panRef.current.x = dragRef.current.panStartX + dx / zoomRef.current;
      panRef.current.y = dragRef.current.panStartY + dy / zoomRef.current;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!dragRef.current.didMove) handleTapAt(e.clientX, e.clientY);
    dragRef.current.active = false;
  }, []);

  // ---------- Click/tap detection ----------
  const handleTapAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const zoom = zoomRef.current;
    const mx = (clientX - rect.left - W / 2) / zoom + W / 2;
    const my = (clientY - rect.top - H / 2) / zoom + H / 2;
    const offsetX = W / 2 + panRef.current.x;
    const offsetY = H / 2 - 50 + panRef.current.y;

    const currentAgents = agentsRef.current;
    for (const agent of currentAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      if (Math.abs(mx - (x + offsetX)) < 24 && Math.abs(my - (y + offsetY - SPRITE_SIZE / 2)) < 28) {
        onAgentClickRef.current(agent.id);
        return;
      }
    }
    if (onZoneClickRef.current) {
      const curZone = selectedZoneRef.current;
      for (const zone of OFFICE_ZONES) {
        const cc = (zone.col1 + zone.col2) / 2, cr = (zone.row1 + zone.row2) / 2;
        const { x, y } = tileToScreen(cc, cr);
        const zw = (zone.col2 - zone.col1 + 1) * TILE_WIDTH / 2;
        const zh = (zone.row2 - zone.row1 + 1) * TILE_HEIGHT / 2;
        if (Math.abs(mx - (x + offsetX)) < zw && Math.abs(my - (y + offsetY)) < zh) {
          onZoneClickRef.current(curZone === zone.id ? null : zone.id);
          return;
        }
      }
      onZoneClickRef.current(null);
    }
  }, []);

  useEffect(() => {
    resize();
    const canvas = canvasRef.current;
    window.addEventListener("resize", resize);
    canvas?.addEventListener("wheel", handleWheel, { passive: false });
    canvas?.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas?.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas?.addEventListener("touchend", handleTouchEnd, { passive: false });
    frameRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("resize", resize);
      canvas?.removeEventListener("wheel", handleWheel);
      canvas?.removeEventListener("touchstart", handleTouchStart);
      canvas?.removeEventListener("touchmove", handleTouchMove);
      canvas?.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(frameRef.current);
    };
  }, [resize, render, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, touchAction: "none", overflow: "hidden" }}>
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
