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

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function generateRandomBoard(seed: number, opts?: { cols?: number; rows?: number; length?: number }) {
  const rng = mulberry32(seed);

  const cols = opts?.cols ?? 20;
  const rows = opts?.rows ?? 6;
  const targetLen = opts?.length ?? 45;

  const CELL_SIZE = 72;
  const OFFSET_X = 80;
  const OFFSET_Y = 100;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const inBounds = (x: number, y: number) => x >= 0 && x < cols && y >= 0 && y < rows;

  for (let attempt = 0; attempt < 250; attempt++) {
    const startX = Math.floor(rng() * cols);
    const startY = Math.floor(rng() * rows);

    const visited = new Set<string>();
    const path: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    visited.add(key(startX, startY));

    while (path.length < targetLen) {
      const cur = path[path.length - 1];

      // Prefer horizontal moves to use width more than height
      const weightedDirs = [
        dirs[0], dirs[0], dirs[0],
        dirs[1], dirs[1], dirs[1],
        dirs[2],
        dirs[3],
      ];

      const candidates = weightedDirs
        .map((d) => ({ x: cur.x + d.dx, y: cur.y + d.dy }))
        .filter((p) => inBounds(p.x, p.y) && !visited.has(key(p.x, p.y)));

      if (!candidates.length) break;

      const next = candidates[Math.floor(rng() * candidates.length)];
      path.push(next);
      visited.add(key(next.x, next.y));
    }

    if (path.length >= targetLen) {
      const tiles: Tile[] = path.map((p, id) => ({
        id,
        type: 'blue',
        x: OFFSET_X + p.x * CELL_SIZE,
        y: OFFSET_Y + p.y * CELL_SIZE,
        gridX: p.x,
        gridY: p.y,
      }));

      paintTileTypes(tiles, rng);
      return { seed, cols, rows, length: targetLen, tiles };
    }
  }

  return { seed, cols, rows, length: targetLen, tiles: [] as Tile[] };
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
