import { Tile, TileType } from '@/types/game';

// Random board generator (local mode).
// For online mode, the server is authoritative and sends tiles in state_update.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomBoard(seed: number, opts?: { cols?: number; rows?: number; length?: number }) {
  const rng = mulberry32(seed);
  const cols = opts?.cols ?? 30;
  const rows = opts?.rows ?? 20;
  const targetLen = Math.max(50, opts?.length ?? 85);

  const CELL_SIZE = 72;
  const OFFSET_X = 80;
  const OFFSET_Y = 100;
  const flipX = rng() < 0.5;
  const flipY = rng() < 0.5;
  const baseMaxX = 27;
  const baseMaxY = 17;
  const tx = (x: number) => (flipX ? baseMaxX - x : x);
  const ty = (y: number) => (flipY ? baseMaxY - y : y);

  const tiles: Tile[] = [];
  const byCoord = new Map<string, number>();
  const keyOf = (x: number, y: number) => `${x},${y}`;
  const ensureNode = (rawX: number, rawY: number) => {
    const x = tx(rawX);
    const y = ty(rawY);
    const key = keyOf(x, y);
    const existing = byCoord.get(key);
    if (existing != null) return existing;
    const id = tiles.length;
    tiles.push({
      id,
      type: "blue",
      x: OFFSET_X + x * CELL_SIZE,
      y: OFFSET_Y + y * CELL_SIZE,
      gridX: x,
      gridY: y,
      nextTileIds: [],
    });
    byCoord.set(key, id);
    return id;
  };
  const connect = (fromId: number, toId: number) => {
    const list = tiles[fromId].nextTileIds ?? [];
    if (!list.includes(toId)) list.push(toId);
    tiles[fromId].nextTileIds = list;
  };
  const walk = (from: [number, number], to: [number, number]) => {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const out: Array<[number, number]> = [[x1, y1]];
    let x = x1;
    let y = y1;
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    while (x !== x2 || y !== y2) {
      if (x !== x2) x += dx;
      if (y !== y2) y += dy;
      out.push([x, y]);
    }
    return out;
  };
  const pathByWaypoints = (points: Array<[number, number]>) => {
    let prevId: number | null = null;
    points.forEach((pt, idx) => {
      const segment = idx === 0 ? [pt] : walk(points[idx - 1], pt).slice(1);
      segment.forEach(([x, y]) => {
        const id = ensureNode(x, y);
        if (prevId != null) connect(prevId, id);
        prevId = id;
      });
    });
  };

  // Main route inspired by the provided map.
  pathByWaypoints([
    [3, 3], [11, 3], [11, 8], [3, 8], [3, 15], [7, 17], [13, 17], [17, 15], [17, 13], [14, 13], [3, 13], [3, 3],
  ]);

  // Branch 1: top-right loop entry from top bar.
  pathByWaypoints([
    [11, 3], [18, 3], [20, 2], [22, 2], [24, 3], [24, 5], [23, 7], [21, 8], [19, 8], [18, 8],
  ]);

  // Branch 2: middle lane to right column.
  pathByWaypoints([
    [3, 8], [23, 8], [23, 13], [17, 13],
  ]);

  // Branch 3: bottom-right loop.
  pathByWaypoints([
    [17, 13], [20, 13], [20, 11], [23, 11], [25, 13], [25, 16], [23, 17], [20, 17], [18, 17], [17, 15],
  ]);

  // Branch 4: left-bottom shortcut back to lower center.
  pathByWaypoints([
    [3, 15], [6, 15], [8, 13], [10, 11], [12, 11], [14, 13],
  ]);

  const ensureNoDeadEnds = () => {
    if (!tiles.length) return;
    tiles.forEach((tile) => {
      const exits = (tile.nextTileIds ?? []).filter((id) => id >= 0 && id < tiles.length && id !== tile.id);
      if (exits.length > 0) {
        tile.nextTileIds = exits;
        return;
      }

      // No cul-de-sac: fallback to the nearest tile.
      let bestId = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const candidate of tiles) {
        if (candidate.id === tile.id) continue;
        const dx = (candidate.gridX ?? 0) - (tile.gridX ?? 0);
        const dy = (candidate.gridY ?? 0) - (tile.gridY ?? 0);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestId = candidate.id;
        }
      }
      tile.nextTileIds = [bestId];
    });
  };
  ensureNoDeadEnds();

  paintTileTypes(tiles, rng);
  return { seed, cols, rows, length: Math.max(targetLen, tiles.length), tiles };
}

function paintTileTypes(tiles: Tile[], rng: () => number) {
  if (!tiles.length) return;

  tiles[0].type = 'start';

  const baseTypes: TileType[] = ['blue','blue','blue','blue','green','green','red','violet'];
  for (let i = 1; i < tiles.length; i++) {
    tiles[i].type = baseTypes[Math.floor(rng() * baseTypes.length)];
  }

  const minIdx = Math.min(6, tiles.length - 1);
  const pickIndex = () => minIdx + Math.floor(rng() * (tiles.length - minIdx));

  const used = new Set<number>([0]);
  const place = (type: TileType) => {
    for (let tries = 0; tries < 400; tries++) {
      const idx = pickIndex();
      if (!used.has(idx)) {
        used.add(idx);
        tiles[idx].type = type;
        return;
      }
    }
  };

  place('bonus');
  place('bonus');
  place('bonus');
  place('bonus');
}
