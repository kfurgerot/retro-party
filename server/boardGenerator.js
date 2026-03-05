
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

function isRegularColor(type) {
  return type === "blue" || type === "green" || type === "purple" || type === "red";
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

  // Two star tiles (yellow only)
  for (let i = 0; i < 2; i += 1) {
    const starIndex = place("star");
    if (starIndex != null) {
      tiles[starIndex].label = "Kudo";
      tiles[starIndex].color = "yellow";
    }
  }

  recolorBoard({ tiles }, ["blue", "green", "purple", "red"], rng);
}

function buildIncoming(tiles) {
  const incoming = new Map();
  tiles.forEach((tile) => incoming.set(tile.id, []));
  tiles.forEach((tile) => {
    for (const nextId of tile.nextTileIds ?? []) {
      if (!incoming.has(nextId)) continue;
      incoming.get(nextId).push(tile.id);
    }
  });
  return incoming;
}

function bfsStableOrder(tiles, startId = 0) {
  const order = [];
  const visited = new Set();
  const queue = [];
  const enqueue = (id) => {
    if (visited.has(id) || id < 0 || id >= tiles.length) return;
    visited.add(id);
    queue.push(id);
  };

  enqueue(startId);
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    const next = [...(tiles[id]?.nextTileIds ?? [])].sort((a, b) => a - b);
    next.forEach(enqueue);
  }

  tiles
    .map((t) => t.id)
    .sort((a, b) => a - b)
    .forEach(enqueue);

  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    const next = [...(tiles[id]?.nextTileIds ?? [])].sort((a, b) => a - b);
    next.forEach(enqueue);
  }

  return order;
}

export function validateBoardColors(board) {
  const tiles = Array.isArray(board?.tiles) ? board.tiles : [];
  const violations = [];
  for (const tile of tiles) {
    const fromType = String(tile?.type ?? "").toLowerCase();
    const from = fromType === "violet" ? "purple" : fromType;
    const nextIds = Array.isArray(tile?.nextTileIds) ? tile.nextTileIds : [];
    for (const nextId of nextIds) {
      const target = tiles[nextId];
      if (!target) continue;
      const rawTo = String(target.type ?? "").toLowerCase();
      const to = rawTo === "violet" ? "purple" : rawTo;
      if (isRegularColor(from) && isRegularColor(to) && from === to) {
        violations.push({
          fromId: tile.id,
          toId: nextId,
          color: from,
        });
      }
    }
  }
  return violations;
}

export function recolorBoard(board, allowedColors = ["blue", "green", "purple", "red"], rngFn = Math.random) {
  const tiles = Array.isArray(board?.tiles) ? board.tiles : [];
  if (!tiles.length) return board;

  const allowed = allowedColors.filter((c) => isRegularColor(String(c).toLowerCase()));
  if (!allowed.length) throw new Error("allowedColors must include at least one regular color");

  const incoming = buildIncoming(tiles);
  const order = bfsStableOrder(tiles, 0).filter((id) => {
    const type = String(tiles[id]?.type ?? "").toLowerCase();
    return type !== "start" && type !== "star";
  });

  const original = new Map(order.map((id) => [id, tiles[id].type]));
  const assignment = new Map();

  const shuffledColors = () =>
    [...allowed].sort(() => (rngFn() < 0.5 ? -1 : 1));

  let backtracks = 0;
  const maxBacktracks = Math.max(200, order.length * 40);
  const solve = (idx) => {
    if (idx >= order.length) return true;
    if (backtracks > maxBacktracks) return false;

    const tileId = order[idx];
    const tile = tiles[tileId];
    const blocked = new Set();

    const inNeighbors = incoming.get(tileId) ?? [];
    for (const inId of inNeighbors) {
      const inType = String(assignment.get(inId) ?? tiles[inId]?.type ?? "").toLowerCase();
      const normalized = inType === "violet" ? "purple" : inType;
      if (isRegularColor(normalized)) blocked.add(normalized);
    }

    const outNeighbors = tile.nextTileIds ?? [];
    for (const outId of outNeighbors) {
      const outType = String(assignment.get(outId) ?? tiles[outId]?.type ?? "").toLowerCase();
      const normalized = outType === "violet" ? "purple" : outType;
      if (isRegularColor(normalized)) blocked.add(normalized);
    }

    for (const color of shuffledColors()) {
      if (blocked.has(color)) continue;
      assignment.set(tileId, color);
      if (solve(idx + 1)) return true;
      assignment.delete(tileId);
      backtracks += 1;
      if (backtracks > maxBacktracks) return false;
    }

    return false;
  };

  const solved = solve(0);
  if (!solved) {
    for (const [id, type] of original.entries()) {
      tiles[id].type = type;
    }
    throw new Error("Unable to recolor board without consecutive colors");
  }

  for (const [id, color] of assignment.entries()) {
    tiles[id].type = color;
  }

  for (const tile of tiles) {
    if (tile.type === "star") {
      tile.color = "yellow";
      tile.label = tile.label || "Kudo";
      continue;
    }
    tile.color = tile.type;
    if (tile.type !== "start") delete tile.label;
  }

  const violations = validateBoardColors({ tiles });
  if (violations.length) {
    throw new Error(`Invalid board colors after recolor (${violations.length} violations)`);
  }

  return board;
}
