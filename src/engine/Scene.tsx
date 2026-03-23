import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT, tilePath } from "./orthographic";
import { ANIMATIONS } from "./Animations";
import { type MessageParticle, createParticle, updateParticle, drawParticle } from "./MessageParticle";
import { OFFICE_ZONES, getZoneAt, drawZoneLabel } from "./OfficeZones";
import {
  preloadSprites, drawAgentSprite, drawFurniture, drawActionIcon,
  drawSpeechBubble, drawStatusIcon, SPRITE_W, SPRITE_H,
} from "./SpriteLoader";

const GRID_COLS = 10;
const GRID_ROWS = 8;

const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be", working: "#2cb67d", talking: "#7f5af0", thinking: "#ff8906",
  sleeping: "#525272", celebrating: "#e53170", reviewing: "#3da9fc",
  deploying: "#ff8906", testing: "#3da9fc", waiting: "#a7a9be",
};

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

export function Scene({ agents, onAgentClick, selectedZone, onZoneClick, sceneRef }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<MessageParticle[]>([]);
  const lastParticleTime = useRef(0);
  const cancelledRef = useRef(false);

  // All mutable state in refs
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Unified pointer tracking (supports multi-touch for pinch)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef({ active: false, didMove: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

  // Props in refs
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;
  const onAgentClickRef = useRef(onAgentClick);
  onAgentClickRef.current = onAgentClick;
  const onZoneClickRef = useRef(onZoneClick);
  onZoneClickRef.current = onZoneClick;

  // Expose zoom controls
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

  // ===== Render loop =====
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

    // Top-down: center the grid rectangle in the viewport
    const gridW = GRID_COLS * TILE_WIDTH;
    const gridH = GRID_ROWS * TILE_HEIGHT;
    const offsetX = W / 2 - gridW / 2 + panRef.current.x;
    const offsetY = H / 2 - gridH / 2 + panRef.current.y;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    // --- Background ---
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

    // --- Floor tiles (top-down: square tiles) ---
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const { x, y } = tileToScreen(col, row);
        const sx = x + offsetX, sy = y + offsetY;
        tilePath(ctx, sx, sy);
        const zone = getZoneAt(col, row);
        const isLt = (col + row) % 2 === 0;
        if (zone) {
          ctx.fillStyle = isLt ? zone.floorColor : zone.floorColorAlt;
          if (selZone === zone.id) ctx.fillStyle = isLt ? "#2a1f5a" : "#332466";
        } else {
          ctx.fillStyle = isLt ? "#1a1a2e" : "#16213e";
        }
        ctx.fill();
        ctx.strokeStyle = selZone && zone?.id === selZone ? "#7f5af0" : "#2a2a4a";
        ctx.lineWidth = selZone && zone?.id === selZone ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // Zone labels (floor level — drawn before any sprites)
    for (const zone of OFFICE_ZONES) drawZoneLabel(ctx, zone, offsetX, offsetY, selZone === zone.id);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    // --- Unified depth-sorted render: furniture + desks + agents ---
    // Collect all drawables with isometric sort key (tileY * GRID_COLS + tileX)
    type Drawable = { sortKey: number; draw: () => void };
    const drawables: Drawable[] = [];

    // Furniture items
    for (const zone of OFFICE_ZONES) {
      const dimmed = !!(selZone && selZone !== zone.id);
      for (const item of zone.furniture) {
        const col = item.col, row = item.row, emoji = item.emoji;
        drawables.push({
          sortKey: row * GRID_COLS + col,
          draw: () => {
            const { x, y } = tileToScreen(col, row);
            ctx.globalAlpha = dimmed ? 0.3 : 0.8;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            if (!drawFurniture(ctx, emoji, x + offsetX, y + offsetY)) {
              ctx.font = "16px serif";
              ctx.fillText(emoji, x + offsetX, y + offsetY - 8);
            }
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    // Desks + agents (paired so desk is always under its agent)
    const sorted = [...currentAgents].sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);
    for (const agent of sorted) {
      const agentSnap = { ...agent }; // capture for closure
      // Desk drawable (sort at tile center)
      drawables.push({
        sortKey: agentSnap.tileY * GRID_COLS + agentSnap.tileX - 0.5, // desk just before agent
        draw: () => {
          const { x, y } = tileToScreen(agentSnap.tileX, agentSnap.tileY);
          const sx = x + offsetX, sy = y + offsetY;
          if (selZone && getZoneAt(agentSnap.tileX, agentSnap.tileY)?.id !== selZone) ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#3d2b1f";
          ctx.beginPath();
          ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 16, sy + 4);
          ctx.lineTo(sx, sy + 12); ctx.lineTo(sx - 16, sy + 4);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#5c4033"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#0f0e17"; ctx.fillRect(sx - 5, sy - 12, 10, 8);
          ctx.fillStyle = "#2cb67d"; ctx.fillRect(sx - 4, sy - 11, 8, 6);
          ctx.globalAlpha = 1;
        },
      });
      // Agent drawable
      drawables.push({
        sortKey: agentSnap.tileY * GRID_COLS + agentSnap.tileX,
        draw: () => {
          const { x, y } = tileToScreen(agentSnap.tileX, agentSnap.tileY);
          const sx = x + offsetX, sy = y + offsetY;
          if (selZone && getZoneAt(agentSnap.tileX, agentSnap.tileY)?.id !== selZone) ctx.globalAlpha = 0.2;
          const isActive = agentSnap.status !== "idle" && agentSnap.status !== "sleeping";
          const bob = Math.sin(t * (isActive ? 0.004 : 0.002) + agentSnap.tileX * 2) * (isActive ? 3 : 1.5);
          const breathe = Math.sin(t * 0.002 + agentSnap.tileX * 1.5 + agentSnap.tileY) * 2;
          const agentY = sy - SPRITE_H - 4 + bob + breathe;
          if (phase === "night" && agentSnap.status === "sleeping") ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.4);

          // Shadow
          ctx.beginPath(); ctx.ellipse(sx, sy + 2, 16, 6, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill();

          // Sprite — HD PNG with graceful fallback to colored rectangle
          const drewPng = drawAgentSprite(ctx, agentSnap.id, agentSnap.status, sx, sy + 4, t, 1.0);
          if (!drewPng) {
            ctx.fillStyle = "#7f5af0";
            ctx.fillRect(sx - 12, agentY + SPRITE_H - 24, 24, 24);
          }

          // Status dot + pulse
          const color = STATUS_COLORS[agentSnap.status] || "#a7a9be";
          const dotX = sx + SPRITE_W * 0.6 - 2;
          const dotY = agentY + 4;
          ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.strokeStyle = "#0f0e17"; ctx.lineWidth = 1.5; ctx.stroke();
          if (isActive) {
            ctx.beginPath(); ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
            ctx.strokeStyle = color; ctx.globalAlpha = Math.sin(t * 0.005) * 0.3 + 0.5;
            ctx.lineWidth = 1.5; ctx.stroke();
            ctx.globalAlpha = selZone ? (getZoneAt(agentSnap.tileX, agentSnap.tileY)?.id === selZone ? 1 : 0.2) : 1;
          }

          // Action icon or animation overlay
          if (!drawActionIcon(ctx, agentSnap.status, sx, agentY)) {
            const anim = ANIMATIONS[agentSnap.status];
            if (anim) anim(ctx, sx, agentY, t);
          }
          drawStatusIcon(ctx, agentSnap.status, sx + 30, sy + 10);

          // Name + role
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.textAlign = "center"; ctx.fillStyle = "#fffffe";
          ctx.fillText(agentSnap.name, sx, sy + 16);
          ctx.font = "9px -apple-system, sans-serif"; ctx.fillStyle = "#525272";
          ctx.fillText(agentSnap.role, sx, sy + 27);

          // Task bubble
          if (agentSnap.currentTask && isActive) {
            const bubbleY = agentY - 16;
            const text = agentSnap.currentTask.length > 22 ? agentSnap.currentTask.slice(0, 20) + "…" : agentSnap.currentTask;
            const tw = ctx.measureText(text).width;
            const pad = 8;
            const bubbleW = tw + pad * 2 + 10;
            if (!drawSpeechBubble(ctx, sx, bubbleY + 5, bubbleW, 24)) {
              ctx.fillStyle = "rgba(15,14,23,0.92)";
              ctx.beginPath(); ctx.roundRect(sx - tw / 2 - pad, bubbleY - 9, tw + pad * 2, 18, 8); ctx.fill();
              ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
            }
            ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = "#fffffe";
            ctx.fillText(text, sx, bubbleY);
            ctx.fillStyle = "rgba(15,14,23,0.92)";
            ctx.beginPath(); ctx.moveTo(sx - 4, bubbleY + 9);
            ctx.lineTo(sx + 4, bubbleY + 9); ctx.lineTo(sx, bubbleY + 14); ctx.closePath(); ctx.fill();
          }
          ctx.globalAlpha = 1;
        },
      });
    }

    // Execute all drawables in painter's order (back-to-front by isometric depth)
    drawables.sort((a, b) => a.sortKey - b.sortKey);
    for (const d of drawables) d.draw();

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

    // --- Particles (capped at 10 to prevent memory growth) ---
    if (t - lastParticleTime.current > 3000 + Math.random() * 4000 && currentAgents.length >= 2 && particlesRef.current.length < 10) {
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

    // --- HUD (not zoomed, responsive) ---
    const phaseIcons: Record<string, string> = { dawn: "🌅", day: "☀️", dusk: "🌇", night: "🌙" };
    const isMobileCanvas = W < 500;
    const hudFont = isMobileCanvas ? "bold 14px -apple-system, sans-serif" : "bold 18px -apple-system, sans-serif";
    const subFont = isMobileCanvas ? "10px -apple-system, sans-serif" : "12px -apple-system, sans-serif";

    ctx.textAlign = "left";
    ctx.font = hudFont; ctx.fillStyle = "#fffffe";
    ctx.fillText(isMobileCanvas ? "🐾 OpenClaw" : "🐾 OpenClaw Office", 12, isMobileCanvas ? 24 : 28);
    const active = currentAgents.filter((a) => a.status !== "idle" && a.status !== "sleeping").length;
    ctx.font = subFont; ctx.fillStyle = "#a7a9be";
    ctx.fillText(`${currentAgents.length} agents · ${active} active ${phaseIcons[phase] || ""}`, 12, isMobileCanvas ? 40 : 46);
    ctx.textAlign = "right";
    ctx.font = isMobileCanvas ? "10px -apple-system, monospace" : "11px -apple-system, monospace";
    ctx.fillStyle = "#525272";
    ctx.fillText(new Date().toLocaleTimeString("ru"), W - 12, isMobileCanvas ? 24 : 28);
    if (zoom !== 1) {
      ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = "#525272";
      ctx.fillText(`${Math.round(zoom * 100)}%`, W - 12, isMobileCanvas ? 38 : 44);
    }

    ctx.restore();
    if (!cancelledRef.current) {
      frameRef.current = requestAnimationFrame(render);
    }
  }, []);

  // ===== Hit test (called on tap/click) =====
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const zoom = zoomRef.current;
    const mx = (clientX - rect.left - W / 2) / zoom + W / 2;
    const my = (clientY - rect.top - H / 2) / zoom + H / 2;
    // Top-down: same centering as render
    const gridW = GRID_COLS * TILE_WIDTH;
    const gridH = GRID_ROWS * TILE_HEIGHT;
    const offsetX = W / 2 - gridW / 2 + panRef.current.x;
    const offsetY = H / 2 - gridH / 2 + panRef.current.y;

    // Hit test agents — match render position (sprite drawn at sy - SPRITE_H - 4)
    const currentAgents = agentsRef.current;
    for (const agent of currentAgents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const agentCenterX = x + offsetX;
      const agentCenterY = y + offsetY - SPRITE_H / 2 - 4; // match render offset
      if (Math.abs(mx - agentCenterX) < 36 && Math.abs(my - agentCenterY) < 40) {
        onAgentClickRef.current(agent.id);
        return;
      }
    }
    const curZone = selectedZoneRef.current;
    const zoneClick = onZoneClickRef.current;
    if (zoneClick) {
      for (const zone of OFFICE_ZONES) {
        // Top-down: zone is a pixel rectangle; tileToScreen returns tile center
        // Zone top-left pixel = (zone.col1 * TILE_WIDTH, zone.row1 * TILE_HEIGHT) + offset
        const zPixX = zone.col1 * TILE_WIDTH + offsetX;
        const zPixY = zone.row1 * TILE_HEIGHT + offsetY;
        const zw = (zone.col2 - zone.col1 + 1) * TILE_WIDTH;
        const zh = (zone.row2 - zone.row1 + 1) * TILE_HEIGHT;
        if (mx >= zPixX && mx <= zPixX + zw && my >= zPixY && my <= zPixY + zh) {
          zoneClick(curZone === zone.id ? null : zone.id);
          return;
        }
      }
      zoneClick(null);
    }
  }, []);

  // ===== Wheel zoom =====
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.min(3, Math.max(0.3, zoomRef.current - e.deltaY * 0.001));
  }, []);

  // ===== Unified Pointer Events (mouse + touch) =====
  const getPointerDist = () => {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const canvas = e.currentTarget as HTMLElement;
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      // Single pointer → start pan
      dragRef.current = {
        active: true, didMove: false,
        startX: e.clientX, startY: e.clientY,
        panStartX: panRef.current.x, panStartY: panRef.current.y,
      };
      pinchRef.current.active = false;
    } else if (pointersRef.current.size === 2) {
      // Two pointers → start pinch
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

    if (wasSingleTap) {
      // Click/tap — hit test
      hitTest(e.clientX, e.clientY);
    }

    if (pointersRef.current.size === 0) {
      dragRef.current.active = false;
      pinchRef.current.active = false;
    } else if (pointersRef.current.size === 1) {
      // Went from 2→1: restart pan from remaining pointer
      pinchRef.current.active = false;
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = {
        active: true, didMove: false,
        startX: remaining.x, startY: remaining.y,
        panStartX: panRef.current.x, panStartY: panRef.current.y,
      };
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
      // Clear particles to free memory
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
