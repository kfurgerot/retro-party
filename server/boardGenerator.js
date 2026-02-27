
// server/boardGenerator.js
// Deterministic random board generator (shared by all clients in a room via server state).
// Generates a loop board with branching intersections.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomBoard(seed, opts = {}) {
  const rng = mulberry32(seed);

  const cols = opts.cols ?? 30;
  const rows = opts.rows ?? 20;
  const targetLen = Math.max(50, opts.length ?? 85);

  const cellSize = opts.cellSize ?? 72;
  const offsetX = opts.offsetX ?? 60;
  const offsetY = opts.offsetY ?? 60;
  const flipX = rng() < 0.5;
  const flipY = rng() < 0.5;
  const baseMaxX = 27;
  const baseMaxY = 17;
  const tx = (x) => (flipX ? baseMaxX - x : x);
  const ty = (y) => (flipY ? baseMaxY - y : y);

  const tiles = [];
  const byCoord = new Map();
  const keyOf = (x, y) => `${x},${y}`;
  const ensureNode = (rawX, rawY) => {
    const x = tx(rawX);
    const y = ty(rawY);
    const key = keyOf(x, y);
    const existing = byCoord.get(key);
    if (existing != null) return existing;
    const id = tiles.length;
    tiles.push({
      id,
      gridX: x,
      gridY: y,
      x: offsetX + x * cellSize,
      y: offsetY + y * cellSize,
      type: "blue",
      nextTileIds: [],
    });
    byCoord.set(key, id);
    return id;
  };
  const connect = (fromId, toId) => {
    const list = tiles[fromId].nextTileIds ?? [];
    if (!list.includes(toId)) list.push(toId);
    tiles[fromId].nextTileIds = list;
  };
  const walk = (from, to) => {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const out = [[x1, y1]];
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
  const pathByWaypoints = (points) => {
    let prevId = null;
    points.forEach((pt, idx) => {
      const segment = idx === 0 ? [pt] : walk(points[idx - 1], pt).slice(1);
      segment.forEach(([x, y]) => {
        const id = ensureNode(x, y);
        if (prevId != null) connect(prevId, id);
        prevId = id;
      });
    });
  };

  pathByWaypoints([
    [3, 3], [11, 3], [11, 8], [3, 8], [3, 15], [7, 17], [13, 17], [17, 15], [17, 13], [14, 13], [3, 13], [3, 3],
  ]);

  pathByWaypoints([
    [11, 3], [18, 3], [20, 2], [22, 2], [24, 3], [24, 5], [23, 7], [21, 8], [19, 8], [18, 8],
  ]);

  pathByWaypoints([
    [3, 8], [23, 8], [23, 13], [17, 13],
  ]);

  pathByWaypoints([
    [17, 13], [20, 13], [20, 11], [23, 11], [25, 13], [25, 16], [23, 17], [20, 17], [18, 17], [17, 15],
  ]);

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

function paintTileTypes(tiles, rng) {
  if (!tiles.length) return;

  // Start tile
  tiles[0].type = "start";

  // Base distribution (weighted by repetition)
  const baseTypes = ["blue","blue","blue","blue","green","green","red","violet"];
  for (let i = 1; i < tiles.length; i++) {
    tiles[i].type = baseTypes[Math.floor(rng() * baseTypes.length)];
  }

  // Place BONUS tiles away from the start (avoid first few tiles)
  const minIdx = Math.min(6, tiles.length - 1);
  const pickIndex = () => minIdx + Math.floor(rng() * (tiles.length - minIdx));

  const used = new Set([0]);
  const place = (type) => {
    for (let tries = 0; tries < 400; tries++) {
      const idx = pickIndex();
      if (!used.has(idx)) {
        used.add(idx);
        tiles[idx].type = type;
        return idx;
      }
    }
    return null;
  };

  // 4 bonus tiles by default (you can tune)
  place("bonus");
  place("bonus");
  place("bonus");
  place("bonus");
}
