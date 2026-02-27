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
  const cols = opts?.cols ?? 20;
  const rows = opts?.rows ?? 6;
  const targetLen = Math.max(36, opts?.length ?? 45);

  const CELL_SIZE = 72;
  const OFFSET_X = 80;
  const OFFSET_Y = 100;
  const flipX = rng() < 0.5;
  const flipY = rng() < 0.5;
  const baseMaxX = 19;
  const baseMaxY = 5;
  const tx = (x: number) => (flipX ? baseMaxX - x : x);
  const ty = (y: number) => (flipY ? baseMaxY - y : y);

  const line = (from: [number, number], to: [number, number]) => {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const out: Array<{ x: number; y: number }> = [];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let x = x1;
    let y = y1;
    out.push({ x, y });
    while (x !== x2 || y !== y2) {
      if (x !== x2) x += dx;
      if (y !== y2) y += dy;
      out.push({ x, y });
    }
    return out;
  };

  const mainSegments: Array<[[number, number], [number, number]]> = [
    [[15, 5], [4, 5]],
    [[4, 5], [4, 1]],
    [[4, 1], [14, 1]],
    [[14, 1], [14, 4]],
    [[14, 4], [6, 4]],
    [[6, 4], [6, 2]],
    [[6, 2], [13, 2]],
  ];

  const mainCoords: Array<{ x: number; y: number }> = [];
  mainSegments.forEach((seg, idx) => {
    const pts = line(seg[0], seg[1]);
    if (idx === 0) {
      mainCoords.push(...pts);
      return;
    }
    mainCoords.push(...pts.slice(1));
  });

  const transformedMain = mainCoords.map((p) => ({ x: tx(p.x), y: ty(p.y) }));
  const tiles: Tile[] = transformedMain.map((p, id) => ({
    id,
    type: 'blue',
    x: OFFSET_X + p.x * CELL_SIZE,
    y: OFFSET_Y + p.y * CELL_SIZE,
    gridX: p.x,
    gridY: p.y,
    nextTileIds: [id + 1],
  }));
  if (tiles.length) {
    tiles[tiles.length - 1].nextTileIds = [Math.max(0, Math.floor(tiles.length * 0.6))];
  }

  const byCoord = new Map<string, number>();
  tiles.forEach((tile) => byCoord.set(`${tile.gridX},${tile.gridY}`, tile.id));
  const addTile = (x: number, y: number, nextTileIds: number[]) => {
    const id = tiles.length;
    tiles.push({
      id,
      type: 'blue',
      x: OFFSET_X + x * CELL_SIZE,
      y: OFFSET_Y + y * CELL_SIZE,
      gridX: x,
      gridY: y,
      nextTileIds,
    });
    byCoord.set(`${x},${y}`, id);
    return id;
  };

  const branches = [
    { source: [4, 3], path: [[5, 3], [6, 3], [7, 3]], join: [7, 2] },
    { source: [14, 3], path: [[13, 3], [12, 3]], join: [12, 2] },
    { source: [8, 4], path: [[8, 3]], join: [8, 2] },
    { source: [11, 4], path: [[11, 3], [10, 3], [9, 3]], join: [9, 2] },
  ] as const;

  branches.forEach((branch) => {
    if (tiles.length > targetLen + 12) return;

    const sourceKey = `${tx(branch.source[0])},${ty(branch.source[1])}`;
    const joinKey = `${tx(branch.join[0])},${ty(branch.join[1])}`;
    const sourceId = byCoord.get(sourceKey);
    const joinId = byCoord.get(joinKey);
    if (sourceId == null || joinId == null) return;

    const chain: number[] = [];
    for (const [px, py] of branch.path) {
      const x = tx(px);
      const y = ty(py);
      const key = `${x},${y}`;
      let id = byCoord.get(key);
      if (id == null) id = addTile(x, y, []);
      chain.push(id);
    }

    if (!chain.length) {
      tiles[sourceId].nextTileIds = [...(tiles[sourceId].nextTileIds ?? []), joinId];
      return;
    }

    tiles[sourceId].nextTileIds = [...(tiles[sourceId].nextTileIds ?? []), chain[0]];
    for (let i = 0; i < chain.length - 1; i += 1) {
      tiles[chain[i]].nextTileIds = [chain[i + 1]];
    }
    tiles[chain[chain.length - 1]].nextTileIds = [joinId];
  });

  paintTileTypes(tiles, rng);
  return { seed, cols, rows, length: tiles.length, tiles };
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
