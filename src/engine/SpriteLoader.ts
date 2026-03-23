/**
 * Sprite loader — loads HD PNG spritesheets.
 * Replaces procedural canvas-drawn sprites (SpriteGenerator.ts).
 *
 * Spritesheets: 384×96 (6 frames × 64×96 each)
 * Frames: 0=idle, 1=walk1, 2=walk2, 3=coding, 4=thinking, 5=sleeping
 *
 * Furniture: 2x resolution vs previous generation.
 * atlas.json is the single source of truth for dimensions.
 */

import type { AgentStatus } from "@/data/types";

const BASE_PATH = import.meta.env.BASE_URL + "assets/";

export const SPRITE_W = 64;
export const SPRITE_H = 96;
export const FRAME_COUNT = 6;

/** Map agent ID → spritesheet file */
const AGENT_SPRITE_MAP: Record<string, string> = {
  pm: "sprites/characters/pm.png",
  dev: "sprites/characters/dev1.png",       // Коля
  techlead: "sprites/characters/dev2.png",  // Макс
  analyst: "sprites/characters/analyst.png",
  qa: "sprites/characters/qa.png",
  devops: "sprites/characters/devops.png",
};

/** Map agent status → frame index */
const STATUS_FRAME_MAP: Record<AgentStatus, number> = {
  idle: 0,
  waiting: 0,
  working: 3,     // coding
  talking: 3,     // coding (active)
  thinking: 4,
  sleeping: 5,
  celebrating: 0, // idle pose
  reviewing: 4,   // thinking pose
  deploying: 3,   // coding pose
  testing: 3,     // coding pose
};

/** Walk animation frames for movement */
const WALK_FRAMES = [1, 2];

/** Furniture sprite map — HD (2x) dimensions */
const FURNITURE_SPRITE_MAP: Record<string, { file: string; w: number; h: number }> = {
  "📋": { file: "sprites/furniture/kanban_board.png",   w: 128, h: 96  },
  "📅": { file: "sprites/furniture/whiteboard.png",     w: 96,  h: 80  },
  "🪴": { file: "sprites/furniture/plant.png",          w: 32,  h: 64  },
  "🖥️": { file: "sprites/furniture/monitor.png",       w: 48,  h: 64  },
  "🗄️": { file: "sprites/furniture/server_rack.png",   w: 64,  h: 128 },
  "⌨️": { file: "sprites/furniture/monitor.png",       w: 48,  h: 64  },
  "📊": { file: "sprites/furniture/whiteboard.png",     w: 96,  h: 80  },
  "📑": { file: "sprites/furniture/bookshelf.png",      w: 96,  h: 96  },
  "🔬": { file: "sprites/furniture/bookshelf.png",      w: 96,  h: 96  },
  "☕": { file: "sprites/furniture/coffee_machine.png", w: 48,  h: 64  },
  "🛋️": { file: "sprites/furniture/sofa.png",          w: 128, h: 64  },
  "📺": { file: "sprites/furniture/monitor.png",        w: 48,  h: 64  },
  "🧪": { file: "sprites/furniture/bookshelf.png",      w: 96,  h: 96  },
  "🐛": { file: "sprites/furniture/bug_board.png",      w: 96,  h: 96  },
  "🚀": { file: "sprites/furniture/printer.png",        w: 64,  h: 48  },
  "🔒": { file: "sprites/furniture/server_rack.png",    w: 64,  h: 128 },
};

/** Action icon map */
const ACTION_ICON_MAP: Record<string, string> = {
  working: "sprites/icons/action_coding.png",
  talking: "sprites/icons/action_chat.png",
  deploying: "sprites/icons/action_deploy.png",
  testing: "sprites/icons/action_testing.png",
  reviewing: "sprites/icons/action_review.png",
  thinking: "sprites/icons/action_research.png",
};

/** Status icon map */
const STATUS_ICON_MAP: Record<string, string> = {
  idle: "sprites/icons/status_idle.png",
  sleeping: "sprites/icons/status_sleeping.png",
  working: "sprites/icons/status_active.png",
  talking: "sprites/icons/status_active.png",
};

// --- Image cache ---
const imageCache = new Map<string, HTMLImageElement>();
const loadingSet = new Set<string>();

function loadImage(path: string): HTMLImageElement | null {
  const fullPath = BASE_PATH + path;
  if (imageCache.has(fullPath)) return imageCache.get(fullPath)!;
  if (loadingSet.has(fullPath)) return null;

  loadingSet.add(fullPath);
  const img = new Image();
  img.src = fullPath;
  img.onload = () => {
    imageCache.set(fullPath, img);
    loadingSet.delete(fullPath);
  };
  img.onerror = () => {
    loadingSet.delete(fullPath);
    console.warn(`[SpriteLoader] Failed to load: ${fullPath}`);
  };
  return null;
}

/** Preload all sprites */
export function preloadSprites(): void {
  Object.values(AGENT_SPRITE_MAP).forEach(loadImage);
  Object.values(FURNITURE_SPRITE_MAP).forEach((f) => loadImage(f.file));
  Object.values(ACTION_ICON_MAP).forEach(loadImage);
  Object.values(STATUS_ICON_MAP).forEach(loadImage);
  loadImage("sprites/ui/speech_bubble.png");
}

/**
 * Get the frame index for an agent based on status and time.
 * Walking agents alternate between walk frames.
 */
export function getFrame(status: AgentStatus, t: number, isMoving: boolean = false): number {
  if (isMoving) {
    const idx = Math.floor(t / 250) % WALK_FRAMES.length;
    return WALK_FRAMES[idx];
  }
  return STATUS_FRAME_MAP[status] ?? 0;
}

/**
 * Draw an agent sprite (single frame from spritesheet).
 * Returns false if sprite not loaded yet (fallback to procedural).
 */
export function drawAgentSprite(
  ctx: CanvasRenderingContext2D,
  agentId: string,
  status: AgentStatus,
  x: number, y: number,
  t: number,
  scale: number = 1,
  isMoving: boolean = false,
): boolean {
  const spritePath = AGENT_SPRITE_MAP[agentId];
  if (!spritePath) return false;
  const img = loadImage(spritePath);
  if (!img) return false;

  const frame = getFrame(status, t, isMoving);
  const srcX = frame * SPRITE_W;
  const srcY = 0;
  const dw = SPRITE_W * scale;
  const dh = SPRITE_H * scale;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, srcX, srcY, SPRITE_W, SPRITE_H, x - dw / 2, y - dh, dw, dh);
  ctx.imageSmoothingEnabled = true;
  return true;
}

/**
 * Draw furniture sprite. Returns false if not loaded (fallback to emoji).
 */
export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number, y: number,
  scale: number = 1,
): boolean {
  const info = FURNITURE_SPRITE_MAP[emoji];
  if (!info) return false;
  const img = loadImage(info.file);
  if (!img) return false;

  const dw = info.w * scale;
  const dh = info.h * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - dw / 2, y - dh + 8, dw, dh);
  ctx.imageSmoothingEnabled = true;
  return true;
}

/**
 * Draw action icon above agent. Returns false if not loaded.
 */
export function drawActionIcon(
  ctx: CanvasRenderingContext2D,
  status: AgentStatus,
  x: number, y: number,
): boolean {
  const path = ACTION_ICON_MAP[status];
  if (!path) return false;
  const img = loadImage(path);
  if (!img) return false;

  ctx.drawImage(img, x - 12, y - 28, 24, 24);
  return true;
}

/**
 * Draw speech bubble from sprite.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
): boolean {
  const img = loadImage("sprites/ui/speech_bubble.png");
  if (!img) return false;

  ctx.drawImage(img, x - width / 2, y - height, width, height);
  return true;
}

/**
 * Draw status icon next to agent name.
 */
export function drawStatusIcon(
  ctx: CanvasRenderingContext2D,
  status: AgentStatus,
  x: number, y: number,
): boolean {
  const path = STATUS_ICON_MAP[status];
  if (!path) return false;
  const img = loadImage(path);
  if (!img) return false;

  ctx.drawImage(img, x, y, 12, 12);
  return true;
}
