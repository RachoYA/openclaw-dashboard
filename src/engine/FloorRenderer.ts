/**
 * FloorRenderer — top-down floor layer: square tile grid + zone fills + zone labels.
 * Extracted from Scene.tsx as part of Issue #71 decomposition.
 */

import { tileToScreen, tilePath } from "./orthographic";
import { OFFICE_ZONES, getZoneAt, drawZoneLabel } from "./OfficeZones";

const GRID_COLS = 10;
const GRID_ROWS = 8;

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  selZone: string | null | undefined,
): void {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const { x, y } = tileToScreen(col, row);
      const sx = x + offsetX;
      const sy = y + offsetY;
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

  // Zone labels
  for (const zone of OFFICE_ZONES) {
    drawZoneLabel(ctx, zone, offsetX, offsetY, selZone === zone.id);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

export { GRID_COLS, GRID_ROWS };
