/**
 * Office zone definitions — themed areas of the isometric office.
 * Based on Lena's design: docs/office-zones-design.md
 */

import { tileToScreen } from "./orthographic";

export interface OfficeZone {
  id: string;
  name: string;
  emoji: string;
  role: string | null; // filter by role, null = common
  /** Tile bounds: top-left (col1,row1) to bottom-right (col2,row2) */
  col1: number;
  row1: number;
  col2: number;
  row2: number;
  /** Floor color tint */
  floorColor: string;
  floorColorAlt: string;
  /** Zone-specific furniture */
  furniture: Array<{ col: number; row: number; emoji: string }>;
}

export const OFFICE_ZONES: OfficeZone[] = [
  {
    id: "pm-board",
    name: "PM Board",
    emoji: "📋",
    role: "PM",
    col1: 0, row1: 0, col2: 3, row2: 3,
    floorColor: "#1e1545",
    floorColorAlt: "#231a4f",
    furniture: [
      { col: 0, row: 0, emoji: "📋" }, // kanban
      { col: 1, row: 0, emoji: "📅" }, // calendar
      { col: 0, row: 2, emoji: "🪴" },
    ],
  },
  {
    id: "dev-corner",
    name: "Dev Corner",
    emoji: "💻",
    role: "Developer",
    col1: 5, row1: 0, col2: 9, row2: 3,
    floorColor: "#0d2818",
    floorColorAlt: "#103320",
    furniture: [
      { col: 7, row: 0, emoji: "🖥️" }, // monitor
      { col: 8, row: 1, emoji: "🗄️" }, // server rack
      { col: 9, row: 0, emoji: "⌨️" },
      { col: 5, row: 0, emoji: "🪴" },
    ],
  },
  {
    id: "analyst-desk",
    name: "Analyst Desk",
    emoji: "📊",
    role: "Analyst",
    col1: 0, row1: 4, col2: 3, row2: 6,
    floorColor: "#2d1525",
    floorColorAlt: "#361a2e",
    furniture: [
      { col: 0, row: 4, emoji: "📊" },
      { col: 1, row: 5, emoji: "📑" },
      { col: 0, row: 6, emoji: "🔬" },
    ],
  },
  {
    id: "common-area",
    name: "Common Area",
    emoji: "☕",
    role: null,
    col1: 3, row1: 3, col2: 6, row2: 5,
    floorColor: "#1a1a2e",
    floorColorAlt: "#1e1e35",
    furniture: [
      { col: 4, row: 3, emoji: "☕" },
      { col: 5, row: 4, emoji: "🛋️" },
      { col: 3, row: 5, emoji: "📺" },
      { col: 6, row: 3, emoji: "🪴" },
    ],
  },
  {
    id: "qa-lab",
    name: "QA Lab",
    emoji: "🧪",
    role: "QA",
    col1: 6, row1: 4, col2: 9, row2: 6,
    floorColor: "#0d1f33",
    floorColorAlt: "#102640",
    furniture: [
      { col: 7, row: 4, emoji: "🧪" },
      { col: 8, row: 5, emoji: "🐛" },
      { col: 9, row: 6, emoji: "📋" },
    ],
  },
  {
    id: "devops-room",
    name: "DevOps Room",
    emoji: "🛡️",
    role: "DevOps",
    col1: 0, row1: 7, col2: 9, row2: 7,
    floorColor: "#2d1f0d",
    floorColorAlt: "#362510",
    furniture: [
      { col: 1, row: 7, emoji: "🗄️" },
      { col: 3, row: 7, emoji: "🖥️" },
      { col: 5, row: 7, emoji: "🚀" },
      { col: 7, row: 7, emoji: "📊" },
      { col: 9, row: 7, emoji: "🔒" },
    ],
  },
];

/** Find which zone a tile belongs to */
export function getZoneAt(col: number, row: number): OfficeZone | null {
  for (const zone of OFFICE_ZONES) {
    if (col >= zone.col1 && col <= zone.col2 && row >= zone.row1 && row <= zone.row2) {
      return zone;
    }
  }
  return null;
}

/** Draw zone label at the center of a zone (top-down: pixel center of tile rect) */
export function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  zone: OfficeZone,
  offsetX: number,
  offsetY: number,
  isSelected: boolean,
) {
  // Top-down: zone center is midpoint of bounding rect in pixel space
  const centerCol = (zone.col1 + zone.col2) / 2;
  const centerRow = (zone.row1 + zone.row2) / 2;
  const { x, y } = tileToScreen(centerCol, centerRow);
  const sx = x + offsetX;
  const sy = y + offsetY;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (isSelected) {
    // Highlight bg
    ctx.fillStyle = "rgba(127, 90, 240, 0.15)";
    ctx.beginPath();
    ctx.roundRect(sx - 50, sy - 12, 100, 24, 8);
    ctx.fill();
  }

  ctx.font = "10px -apple-system, sans-serif";
  ctx.fillStyle = isSelected ? "#7f5af0" : "#3a3a5c";
  ctx.fillText(`${zone.emoji} ${zone.name}`, sx, sy);
}
