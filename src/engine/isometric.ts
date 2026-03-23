/**
 * @deprecated Isometric projection — superseded by orthographic.ts (top-down).
 * This file is kept for reference during the iso→ortho migration (PR-A / issue #69).
 * DO NOT import from this file in new code — use orthographic.ts instead.
 *
 * Original: Tile (col, row) → screen (x, y) using standard 2:1 diamond projection.
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

/** Convert tile coordinates to screen pixel position */
export function tileToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  };
}

/** Convert screen pixel position back to tile coordinates */
export function screenToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: (x / (TILE_WIDTH / 2) + y / (TILE_HEIGHT / 2)) / 2,
    row: (y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2,
  };
}

/** Draw a diamond-shaped tile (for canvas 2D fallback) */
export function tilePath(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);       // top
  ctx.lineTo(cx + hw, cy);       // right
  ctx.lineTo(cx, cy + hh);       // bottom
  ctx.lineTo(cx - hw, cy);       // left
  ctx.closePath();
}
