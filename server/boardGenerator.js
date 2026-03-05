
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
    while (x !== x2) {
      x += Math.sign(x2 - x);
      out.push([x, y]);
    }
    while (y !== y2) {
      y += Math.sign(y2 - y);
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

  // Main directed loop (clockwise).
  pathByWaypoints([[2, 2], [18, 2], [18, 10], [2, 10], [2, 2]]);

  // Branch 1: top lane detour.
  pathByWaypoints([
    [8, 2], [8, 6], [14, 6], [14, 2],
  ]);

  // Branch 2: right-side middle detour.
  pathByWaypoints([
    [18, 5], [15, 5], [15, 8], [18, 8],
  ]);

  // Branch 3: bottom-middle detour.
  pathByWaypoints([
    [12, 10], [12, 7], [10, 7], [10, 10],
  ]);

  // Branch 4: left-side shortcut.
  pathByWaypoints([
    [2, 7], [5, 7], [5, 4], [2, 4],
  ]);
  validateBoardGraph(tiles);

  paintTileTypes(tiles, rng);
  return { seed, cols, rows, length: Math.max(targetLen, tiles.length), tiles };
}

function hasDirectedCycle(tiles) {
  const visiting = new Set();
  const visited = new Set();

  const dfs = (nodeId) => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const nextIds = tiles[nodeId]?.nextTileIds ?? [];
    for (const nextId of nextIds) {
      if (dfs(nextId)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const tile of tiles) {
    if (dfs(tile.id)) return true;
  }
  return false;
}

function validateBoardGraph(tiles) {
  if (!tiles.length) throw new Error("Board must contain at least one tile");

  const indegree = new Array(tiles.length).fill(0);
  let branchCount = 0;
  const directedEdges = new Set();

  for (const tile of tiles) {
    const next = (tile.nextTileIds ?? []).filter((id) => Number.isInteger(id) && id >= 0 && id < tiles.length && id !== tile.id);
    if (next.length < 1) throw new Error(`Tile ${tile.id} has no outgoing edge`);
    if (next.length >= 2) branchCount += 1;
    tile.nextTileIds = next;

    for (const to of next) {
      directedEdges.add(`${tile.id}->${to}`);
      indegree[to] += 1;

      if (directedEdges.has(`${to}->${tile.id}`)) {
        throw new Error(`Direct backward edge detected between ${tile.id} and ${to}`);
      }

      const fromX = tile.gridX ?? 0;
      const fromY = tile.gridY ?? 0;
      const toX = tiles[to].gridX ?? 0;
      const toY = tiles[to].gridY ?? 0;
      const manhattan = Math.abs(fromX - toX) + Math.abs(fromY - toY);
      if (manhattan > 1) throw new Error(`Non-continuous edge detected: ${tile.id} -> ${to}`);
    }
  }

  const joinCount = indegree.filter((value) => value >= 2).length;
  if (branchCount < 4) throw new Error(`Board requires >=4 branches (got ${branchCount})`);
  if (joinCount < 3) throw new Error(`Board requires >=3 joins (got ${joinCount})`);
  if (!hasDirectedCycle(tiles)) throw new Error("Board requires at least one loop");
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
