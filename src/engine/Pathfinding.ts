/**
 * Simple A* pathfinding on the isometric grid.
 * Agents move between tiles when status changes or randomly (idle wander).
 */

interface Point { col: number; row: number }

const GRID_COLS = 10;
const GRID_ROWS = 8;

/** Get walkable neighbors (4-directional) */
function neighbors(p: Point): Point[] {
  const dirs = [
    { col: p.col + 1, row: p.row },
    { col: p.col - 1, row: p.row },
    { col: p.col, row: p.row + 1 },
    { col: p.col, row: p.row - 1 },
  ];
  return dirs.filter((d) => d.col >= 0 && d.col < GRID_COLS && d.row >= 0 && d.row < GRID_ROWS);
}

/** Manhattan distance heuristic */
function heuristic(a: Point, b: Point): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/** A* pathfinding — returns path as list of tile coords (excludes start) */
export function findPath(start: Point, end: Point, occupied: Set<string>): Point[] {
  const key = (p: Point) => `${p.col},${p.row}`;
  if (key(start) === key(end)) return [];

  const open: Point[] = [start];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, end));

  while (open.length > 0) {
    // Pick lowest fScore
    open.sort((a, b) => (fScore.get(key(a)) || Infinity) - (fScore.get(key(b)) || Infinity));
    const current = open.shift()!;
    const ck = key(current);

    if (current.col === end.col && current.row === end.row) {
      // Reconstruct path
      const path: Point[] = [];
      let c = current;
      while (cameFrom.has(key(c))) {
        path.unshift(c);
        c = cameFrom.get(key(c))!;
      }
      return path;
    }

    for (const n of neighbors(current)) {
      const nk = key(n);
      if (occupied.has(nk) && nk !== key(end)) continue; // blocked

      const tentG = (gScore.get(ck) || 0) + 1;
      if (tentG < (gScore.get(nk) || Infinity)) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentG);
        fScore.set(nk, tentG + heuristic(n, end));
        if (!open.find((o) => o.col === n.col && o.row === n.row)) {
          open.push(n);
        }
      }
    }
  }

  return []; // no path
}

/** Get a random nearby walkable tile for idle wandering */
export function randomNearbyTile(current: Point, occupied: Set<string>, range: number = 2): Point {
  for (let attempt = 0; attempt < 10; attempt++) {
    const col = current.col + Math.floor(Math.random() * (range * 2 + 1)) - range;
    const row = current.row + Math.floor(Math.random() * (range * 2 + 1)) - range;
    const key = `${col},${row}`;
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && !occupied.has(key)) {
      return { col, row };
    }
  }
  return current;
}
