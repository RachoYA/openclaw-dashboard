import { useRef, useEffect, useCallback } from "react";
import type { AgentState } from "@/data/types";
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT } from "./isometric";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRID_COLS = 10;
const GRID_ROWS = 8;
const AGENT_SIZE = 28;

const STATUS_COLORS: Record<string, string> = {
  idle: "#a7a9be",
  working: "#2cb67d",
  talking: "#7f5af0",
  thinking: "#ff8906",
  sleeping: "#525272",
  celebrating: "#e53170",
};

const STATUS_EMOJI: Record<string, string> = {
  idle: "😴",
  working: "💻",
  talking: "💬",
  thinking: "🤔",
  sleeping: "💤",
  celebrating: "🎉",
};

interface SceneProps {
  agents: AgentState[];
  onAgentClick: (id: string) => void;
}

export function Scene({ agents, onAgentClick }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Resize canvas to fill container
  // ---------------------------------------------------------------------------
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }, []);

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    // Offset so the grid is centered
    const offsetX = W / 2;
    const offsetY = 80;

    ctx.clearRect(0, 0, W, H);

    // --- Draw isometric floor tiles ---
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

        // Checkerboard pattern
        const isLight = (col + row) % 2 === 0;
        ctx.fillStyle = isLight ? "#1a1a2e" : "#16213e";
        ctx.fill();
        ctx.strokeStyle = "#2a2a4a";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // --- Draw agents ---
    for (const agent of agents) {
      const { x, y } = tileToScreen(agent.tileX, agent.tileY);
      const sx = x + offsetX;
      const sy = y + offsetY;

      // Bobbing animation
      const bobOffset = Math.sin(t * 0.003 + agent.tileX * 2) * 3;
      const ay = sy - AGENT_SIZE - 10 + bobOffset;

      // Shadow
      ctx.beginPath();
      ctx.ellipse(sx, sy, 14, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();

      // Agent circle
      const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
      ctx.beginPath();
      ctx.arc(sx, ay, AGENT_SIZE / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fffffe";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Status ring pulse
      if (agent.status === "working" || agent.status === "talking") {
        const pulse = Math.sin(t * 0.005) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(sx, ay, AGENT_SIZE / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = pulse * 0.4;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Initial letter
      ctx.fillStyle = "#fffffe";
      ctx.font = "bold 14px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(agent.name[0], sx, ay);

      // Name label below
      ctx.font = "11px -apple-system, sans-serif";
      ctx.fillStyle = "#a7a9be";
      ctx.fillText(agent.name, sx, ay + AGENT_SIZE / 2 + 14);

      // Status emoji above
      ctx.font = "16px serif";
      ctx.fillText(STATUS_EMOJI[agent.status] || "", sx, ay - AGENT_SIZE / 2 - 10);

      // Status bubble (current task)
      if (agent.currentTask && agent.status !== "idle" && agent.status !== "sleeping") {
        const bubbleY = ay - AGENT_SIZE / 2 - 30;
        const text = agent.currentTask.length > 20 ? agent.currentTask.slice(0, 18) + "…" : agent.currentTask;
        const textWidth = ctx.measureText(text).width;
        const padding = 8;

        ctx.fillStyle = "rgba(26, 26, 46, 0.9)";
        ctx.beginPath();
        ctx.roundRect(sx - textWidth / 2 - padding, bubbleY - 10, textWidth + padding * 2, 20, 6);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#fffffe";
        ctx.font = "10px -apple-system, sans-serif";
        ctx.fillText(text, sx, bubbleY);
      }
    }

    // --- Title ---
    ctx.fillStyle = "#fffffe";
    ctx.font = "bold 18px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("🐾 OpenClaw Office", 20, 30);

    ctx.font = "12px -apple-system, sans-serif";
    ctx.fillStyle = "#a7a9be";
    ctx.fillText(`${agents.length} agents`, 20, 50);

    timeRef.current = performance.now();
    frameRef.current = requestAnimationFrame(render);
  }, [agents]);

  // ---------------------------------------------------------------------------
  // Click handler → detect agent under cursor
  // ---------------------------------------------------------------------------
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const offsetX = canvas.width / 2;
      const offsetY = 80;

      for (const agent of agents) {
        const { x, y } = tileToScreen(agent.tileX, agent.tileY);
        const sx = x + offsetX;
        const bobOffset = Math.sin(timeRef.current * 0.003 + agent.tileX * 2) * 3;
        const ay = y + offsetY - AGENT_SIZE - 10 + bobOffset;

        const dx = mx - sx;
        const dy = my - ay;
        if (dx * dx + dy * dy < (AGENT_SIZE / 2 + 8) ** 2) {
          onAgentClick(agent.id);
          return;
        }
      }
    },
    [agents, onAgentClick],
  );

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
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
