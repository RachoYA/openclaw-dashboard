/**
 * Procedural pixel-art sprite generator for agent characters.
 * No external assets needed — generates all sprites at runtime.
 */

const SPRITE_SIZE = 32;

interface SpriteColors {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoes: string;
}

// Predefined color palettes per agent role
const ROLE_PALETTES: Record<string, SpriteColors> = {
  PM:        { skin: "#ffd5b8", hair: "#4a3728", shirt: "#7f5af0", pants: "#2d2d3d", shoes: "#1a1a2e" },
  Developer: { skin: "#ffd5b8", hair: "#2d2d2d", shirt: "#2cb67d", pants: "#2d2d3d", shoes: "#1a1a2e" },
  Analyst:   { skin: "#ffe0c2", hair: "#8b4513", shirt: "#e53170", pants: "#2d2d3d", shoes: "#1a1a2e" },
  DevOps:    { skin: "#ffd5b8", hair: "#555555", shirt: "#ff8906", pants: "#2d2d3d", shoes: "#1a1a2e" },
  QA:        { skin: "#ffd5b8", hair: "#3d2b1f", shirt: "#3da9fc", pants: "#2d2d3d", shoes: "#1a1a2e" },
  "Tech Lead": { skin: "#ffd5b8", hair: "#1a1a1a", shirt: "#fffffe", pants: "#2d2d3d", shoes: "#1a1a2e" },
};

const DEFAULT_PALETTE: SpriteColors = { skin: "#ffd5b8", hair: "#4a3728", shirt: "#7f5af0", pants: "#2d2d3d", shoes: "#1a1a2e" };

/** Generate a base character sprite as an offscreen canvas */
export function generateCharacterSprite(role: string): HTMLCanvasElement {
  const colors = ROLE_PALETTES[role] || DEFAULT_PALETTE;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Head
  ctx.fillStyle = colors.skin;
  ctx.fillRect(12, 4, 8, 8);

  // Hair
  ctx.fillStyle = colors.hair;
  ctx.fillRect(12, 3, 8, 3);
  ctx.fillRect(11, 4, 1, 4);
  ctx.fillRect(20, 4, 1, 4);

  // Eyes
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(14, 7, 2, 2);
  ctx.fillRect(18, 7, 2, 2);

  // Body / shirt
  ctx.fillStyle = colors.shirt;
  ctx.fillRect(10, 12, 12, 8);

  // Arms
  ctx.fillRect(7, 13, 3, 6);
  ctx.fillRect(22, 13, 3, 6);

  // Hands
  ctx.fillStyle = colors.skin;
  ctx.fillRect(7, 19, 3, 2);
  ctx.fillRect(22, 19, 3, 2);

  // Pants
  ctx.fillStyle = colors.pants;
  ctx.fillRect(10, 20, 5, 6);
  ctx.fillRect(17, 20, 5, 6);

  // Shoes
  ctx.fillStyle = colors.shoes;
  ctx.fillRect(9, 26, 6, 3);
  ctx.fillRect(17, 26, 6, 3);

  return canvas;
}

/** Sprite cache keyed by role */
const spriteCache = new Map<string, HTMLCanvasElement>();

export function getSprite(role: string): HTMLCanvasElement {
  if (!spriteCache.has(role)) {
    spriteCache.set(role, generateCharacterSprite(role));
  }
  return spriteCache.get(role)!;
}

export { SPRITE_SIZE };
