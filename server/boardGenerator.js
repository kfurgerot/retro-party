
// server/boardGenerator.js
// Deterministic random board generator (shared by all clients in a room via server state).
// Generates a grid-based random-walk path, then assigns tile types + specials.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(x, y) {
  return `${x},${y}`;
}

export function generateRandomBoard(seed, opts = {}) {
  const rng = mulberry32(seed);

  const cols = opts.cols ?? 20;
  const rows = opts.rows ?? 6;
  const targetLen = opts.length ?? 45;

  const cellSize = opts.cellSize ?? 72;
  const offsetX = opts.offsetX ?? 60;
  const offsetY = opts.offsetY ?? 60;

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const inBounds = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows;

  // Try several attempts; random-walk can get stuck.
  for (let attempt = 0; attempt < 250; attempt++) {
    const startX = Math.floor(rng() * cols);
    const startY = Math.floor(rng() * rows);

    const visited = new Set();
    const path = [{ x: startX, y: startY }];
    visited.add(key(startX, startY));

    while (path.length < targetLen) {
      const cur = path[path.length - 1];

      const candidates = dirs
        .map(d => ({ x: cur.x + d.dx, y: cur.y + d.dy }))
        .filter(p => inBounds(p.x, p.y) && !visited.has(key(p.x, p.y)));

      if (candidates.length === 0) break;

      // Prefer a "wide" board: bias horizontal moves so the path spreads across width
      // (still allows vertical moves to keep it interesting).
      const weighted = [];
      for (const c of candidates) {
        const dx = c.x - cur.x;
        const dy = c.y - cur.y;
        const weight = Math.abs(dx) === 1 ? 3 : 1; // horizontal x3
        for (let k = 0; k < weight; k++) weighted.push(c);
      }
      const next = weighted[Math.floor(rng() * weighted.length)];
      path.push(next);
      visited.add(key(next.x, next.y));
    }

    if (path.length >= targetLen) {
      const tiles = path.map((p, id) => ({
        id,
        gridX: p.x,
        gridY: p.y,
        x: offsetX + p.x * cellSize,
        y: offsetY + p.y * cellSize,
        type: "blue",
        
      }));

      paintTileTypes(tiles, rng);
      return { seed, cols, rows, length: tiles.length, tiles };
    }
  }

  // Fallback: empty board (should be rare).
  return { seed, cols, rows, length: 0, tiles: [] };
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
