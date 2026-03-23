/**
 * TopDownScene — orthographic (top-down) render loop.
 * Replaces isometric Scene.tsx as part of Issue #71.
 *
 * Architecture: FloorRenderer (tiles + zones) + AgentRenderer (agents + desks)
 * sorted by painter's order (row → col), composited on Canvas 2D at 60fps.
 */

import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT } from "./orthographic";
import { type MessageParticle, createParticle, updateParticle, drawParticle } from "./MessageParticle";
import { OFFICE_ZONES } from "./OfficeZones";
import { preloadSprites } from "./SpriteLoader";
import { drawFloor, GRID_COLS, GRID_ROWS } from "./FloorRenderer";
import { drawAgent, drawDesk } from "./AgentRenderer";

export interface SceneHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

interface SceneProps {
  agents: AgentState[];
  onAgentClick: (id: string) => void;
  selectedZone?: string | null;
  onZoneClick?: (zoneId: string | null) => void;
  sceneRef?: React.MutableRefObject<SceneHandle | null>;
}

// Re-export as `Scene` so App.tsx only needs to change the import path
export function Scene({ agents, onAgentClick, selectedZone, onZoneClick, sceneRef }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<MessageParticle[]>([]);
  const lastParticleTime = useRef(0);
  const cancelledRef = useRef(false);

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef({ active: false, didMove: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;

  useEffect(() => {
    if (sceneRef) {
      sceneRef.current = {
        zoomIn: () => { zoomRef.current = Math.min(3, zoomRef.current * 1.25); },
        zoomOut: () => { zoomRef.current = Math.max(0.3, zoomRef.current / 1.25); },
        zoomReset: () => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; },
      };
    }
  }, [sceneRef]);

  const getDayPhase = () => {
    const h = new Date().getHours();
    if (h >= 6 && h < 9) return "dawn";
    if (h >= 9 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  };

  const getGridOffset = (W: number, H: number) => ({
    offsetX: W / 2 - (GRID_COLS * TILE_WIDTH) / 2 + panRef.current.x,
    offsetY: H / 2 - (GRID_ROWS * TILE_HEIGHT) / 2 + panRef.current.y,
  });

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
    const zoom = zoomRef.current;
    const currentAgents = agentsRef.current;
    const selZone = selectedZoneRef.current;

    const { offsetX, offsetY } = getGridOffset(W, H);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    // Background gradient
    const gradColors: Record<string, [string, string]> = {
      dawn: ["#1a0a2e", "#2d1545"], day: ["#0f0e17", "#1a1a2e"],
      dusk: ["#1a1020", "#2d1a25"], night: ["#050510", "#0a0a18"],
    };
    const [g1, g2] = gradColors[phase] || gradColors.day;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, g1); grad.addColorStop(1, g2);
    ctx.fillStyle = grad;
    ctx.fillRect(-W, -H, W * 3, H * 3);

    if (phase === "night") {
      ctx.fillStyle = "rgba(0,0,20,0.3)"; ctx.fillRect(-W, -H, W * 3, H * 3);
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
      ctx.fillStyle = phase === "dawn" ? "rgba(255,137,6,0.06)" : "rgba(229,49,112,0.06)";
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }

    // Floor (tiles + zones + labels)
    drawFloor(ctx, offsetX, offsetY, selZone);

    // Depth-sorted drawables: furniture + desks + agents
    type Drawable = { sortKey: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Furniture
    for (const zone of OFFICE_ZONES) {
      const dimmed = !!(selZone && selZone !== zone.id);
      for (const item of zone.furniture) {
        const { col, row, emoji } = item;
        drawables.push({
          sortKey: row * GRID_COLS + col,
          draw: () => {
            const { x, y } = tileToScreen(col, row);
            ctx.globalAlpha = dimmed ? 0.3 : 0.8;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "16px serif";
            ctx.fillText(emoji, x + offsetX, y + offsetY - 8);
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    // Desks + agents
    for (const agent of currentAgents) {
      const snap = { ...agent };
      drawables.push({
        sortKey: snap.tileY * GRID_COLS + snap.tileX - 0.5,
        draw: () => drawDesk(ctx, snap, offsetX, offsetY, selZone),
      });
      drawables.push({
        sortKey: snap.tileY * GRID_COLS + snap.tileX,
        draw: () => drawAgent(ctx, snap, offsetX, offsetY, t, selZone, phase),
      });
    }

    drawables.sort((a, b) => a.sortKey - b.sortKey);
    for (const d of drawables) d.draw();

    // Connection lines for talking agents
    const talking = currentAgents.filter((a) => a.status === "talking");
    if (talking.length >= 2) {
      for (let i = 0; i < talking.length - 1; i++) {
        const p1 = tileToScreen(talking[i].tileX, talking[i].tileY);
        const p2 = tileToScreen(talking[i + 1].tileX, talking[i + 1].tileY);
        ctx.beginPath();
        ctx.moveTo(p1.x + offsetX, p1.y + offsetY - 20);
        ctx.lineTo(p2.x + offsetX, p2.y + offsetY - 20);
        ctx.strokeStyle = "#7f5af0";
        ctx.globalAlpha = 0.3 + Math.sin(t * 0.003) * 0.2;
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }

    // Particles (capped at 10)
    if (
      t - lastParticleTime.current > 3000 + Math.random() * 4000 &&
      currentAgents.length >= 2 &&
      particlesRef.current.length < 10
    ) {
      lastParticleTime.current = t;
      const fi = Math.floor(Math.random() * currentAgents.length);
      let ti = Math.floor(Math.random() * currentAgents.length);
      if (ti === fi) ti = (ti + 1) % currentAgents.length;
      particlesRef.current.push(createParticle(
        currentAgents[fi].tileX, currentAgents[fi].tileY,
        currentAgents[ti].tileX, currentAgents[ti].tileY,
        offsetX, offsetY,
      ));
    }
    particlesRef.current = particlesRef.current.filter((p) => updateParticle(p, t));
    for (const p of particlesRef.current) drawParticle(ctx, p);

    ctx.restore(); // undo zoom

    // HUD (not zoomed)
    const phaseIcons: Record<string, string> = { dawn: "🌅", day: "☀️", dusk: "🌇", night: "🌙" };
    const isMobile = W < 500;
    ctx.textAlign = "left";
    ctx.font = isMobile ? "bold 14px -apple-system, sans-serif" : "bold 18px -apple-system, sans-serif";
    ctx.fillStyle = "#fffffe";
    ctx.fillText(isMobile ? "🐾 OpenClaw" : "🐾 OpenClaw Office", 12, isMobile ? 24 : 28);
    const active = currentAgents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
    ctx.font = isMobile ? "10px -apple-system, sans-serif" : "12px -apple-system, sans-serif";
    ctx.fillStyle = "#a7a9be";
    ctx.fillText(`${currentAgents.length} agents · ${active} active ${phaseIcons[phase] || ""}`, 12, isMobile ? 40 : 46);
    ctx.textAlign = "right";
    ctx.font = isMobile ? "10px -apple-system, monospace" : "11px -apple-system, monospace";
    ctx.fillStyle = "#525272";
    ctx.fillText(new Date().toLocaleTimeString("ru"), W - 12, isMobile ? 24 : 28);
    if (zoom !== 1) {
      ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = "#525272";
      ctx.fillText(`${Math.round(zoom * 100)}%`, W - 12, isMobile ? 38 : 44);
    }

    ctx.restore();
    if (!cancelledRef.current) {
      frameRef.current = requestAnimationFrame(render);
    }
  }, []);

  // Hit testing
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const zoom = zoomRef.current;
    const mx = (clientX - rect.left - W / 2) / zoom + W / 2;
    const my = (clientY - rect.top - H / 2) / zoom + H / 2;
    const { offsetX, offsetY } = getGridOffset(W, H);

    // Agents — 22px click radius
    for (const agent of agentsRef.current) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      if (Math.abs(mx - (x + offsetX)) < 22 && Math.abs(my - (y + offsetY)) < 22) {
        onAgentClickRef.current(agent.id);
        return;
      }
    }

    // Zones
    const zoneClick = onZoneClickRef.current;
    if (zoneClick) {
      for (const zone of OFFICE_ZONES) {
        const zPixX = zone.col1 * TILE_WIDTH + offsetX;
        const zPixY = zone.row1 * TILE_HEIGHT + offsetY;
        const zw = (zone.col2 - zone.col1 + 1) * TILE_WIDTH;
        const zh = (zone.row2 - zone.row1 + 1) * TILE_HEIGHT;
        if (mx >= zPixX && mx <= zPixX + zw && my >= zPixY && my <= zPixY + zh) {
          zoneClick(selectedZoneRef.current === zone.id ? null : zone.id);
          return;
        }
      }
      zoneClick(null);
    }
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.min(3, Math.max(0.3, zoomRef.current - e.deltaY * 0.001));
  }, []);

  const getPointerDist = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { active: true, didMove: false, startX: e.clientX, startY: e.clientY, panStartX: panRef.current.x, panStartY: panRef.current.y };
      pinchRef.current.active = false;
    } else if (pointersRef.current.size === 2) {
      dragRef.current.active = false;
      pinchRef.current = { active: true, startDist: getPointerDist(), startZoom: zoomRef.current };
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current.active && pointersRef.current.size === 2) {
      const dist = getPointerDist();
      if (pinchRef.current.startDist > 0) {
        zoomRef.current = Math.min(3, Math.max(0.3, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
      }
    } else if (dragRef.current.active && pointersRef.current.size === 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.didMove = true;
        panRef.current.x = dragRef.current.panStartX + dx / zoomRef.current;
        panRef.current.y = dragRef.current.panStartY + dy / zoomRef.current;
      }
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const wasSingleTap = pointersRef.current.size === 1 && dragRef.current.active && !dragRef.current.didMove && !pinchRef.current.active;
    pointersRef.current.delete(e.pointerId);
    if (wasSingleTap) hitTest(e.clientX, e.clientY);
    if (pointersRef.current.size === 0) {
      dragRef.current.active = false;
      pinchRef.current.active = false;
    } else if (pointersRef.current.size === 1) {
      pinchRef.current.active = false;
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = { active: true, didMove: false, startX: remaining.x, startY: remaining.y, panStartX: panRef.current.x, panStartY: panRef.current.y };
    }
  }, [hitTest]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      dragRef.current.active = false;
      pinchRef.current.active = false;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    preloadSprites();
    resize();
    const canvas = canvasRef.current;
    window.addEventListener("resize", resize);
    canvas?.addEventListener("wheel", handleWheel, { passive: false });
    frameRef.current = requestAnimationFrame(render);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener("resize", resize);
      canvas?.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(frameRef.current);
      particlesRef.current = [];
    };
  }, [resize, render, handleWheel]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, touchAction: "none", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
      />
    </div>
  );
}
