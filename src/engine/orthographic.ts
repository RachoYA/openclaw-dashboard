/**
 * Orthographic (top-down) coordinate helpers.
 *
 * Replaces isometric.ts — strict top-down projection (view from directly above).
 * Tile (col, row) → screen (x, y): returns the **pixel center** of the tile,
 * matching the API contract of the old isometric.ts so Scene/OfficeZones need
 * minimal changes.
 *
 * Uses square tiles: TILE_SIZE × TILE_SIZE pixels.
 */

export const TILE_SIZE = 64;

/**
 * @deprecated Alias for TILE_SIZE. Kept for import compatibility during migration.
 */
export const TILE_WIDTH = TILE_SIZE;
/**
 * @deprecated Alias for TILE_SIZE. Kept for import compatibility during migration.
 */
export const TILE_HEIGHT = TILE_SIZE;

/**
 * Convert tile coordinates to screen pixel position.
 * Returns the **center** of the tile (matches old isometric.tileToScreen contract).
 */
export function tileToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/**
 * Convert screen pixel position back to tile coordinates.
 * Input is the center pixel of the tile.
 */
export function screenToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

/**
 * Draw the outline path for a square tile centered at (cx, cy).
 * Call ctx.fill() / ctx.stroke() after this.
 */
export function tilePath(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const half = TILE_SIZE / 2;
  ctx.beginPath();
  ctx.rect(cx - half, cy - half, TILE_SIZE, TILE_SIZE);
}
