
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
  const mainPathIds = new Set();
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
        if (mainPathIds !== null) mainPathIds.add(id);
        prevId = id;
      });
    });
  };

  // Main directed loop (clockwise).
  pathByWaypoints([[2, 2], [18, 2], [18, 10], [2, 10], [2, 2]]);
  const stableMainPathIds = new Set(mainPathIds);
  mainPathIds.clear();

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

  paintTileTypes(tiles, rng, stableMainPathIds);
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

function buildIncomingMap(tiles) {
  const incoming = new Map();
  tiles.forEach((tile) => incoming.set(tile.id, []));
  tiles.forEach((tile) => {
    const next = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [];
    next.forEach((toId) => {
      if (!incoming.has(toId)) incoming.set(toId, []);
      incoming.get(toId).push(tile.id);
    });
  });
  return incoming;
}

function manhattanTileDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const ax = Number(a.gridX ?? 0);
  const ay = Number(a.gridY ?? 0);
  const bx = Number(b.gridX ?? 0);
  const by = Number(b.gridY ?? 0);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function chooseShopCandidate(candidates, selected, starIds, tiles, minGap, rng) {
  const shuffled = [...candidates].sort(() => (rng() < 0.5 ? -1 : 1));
  for (const tileId of shuffled) {
    if (selected.some((otherId) => Math.abs(otherId - tileId) < minGap)) continue;
    const next = Array.isArray(tiles[tileId]?.nextTileIds) ? tiles[tileId].nextTileIds : [];
    if (next.some((id) => starIds.has(id))) continue;
    return tileId;
  }
  return null;
}

function validateBoardShopsInternal(tiles) {
  const violations = [];
  const shopTiles = tiles.filter((tile) => String(tile.type).toLowerCase() === "shop");
  const boardSize = tiles.length;
  if (boardSize >= 40 && boardSize <= 60 && shopTiles.length !== 3) {
    violations.push({ type: "invalid_shop_count", expected: 3, actual: shopTiles.length });
  }

  const forbidden = new Set(["start", "star", "bonus", "warp", "vs"]);
  for (const tile of shopTiles) {
    const normalized = String(tile.type).toLowerCase();
    if (forbidden.has(normalized)) {
      violations.push({ type: "shop_on_forbidden_tile", tileId: tile.id, tileType: tile.type });
    }
  }

  for (let i = 0; i < shopTiles.length; i += 1) {
    for (let j = i + 1; j < shopTiles.length; j += 1) {
      if (Math.abs(shopTiles[i].id - shopTiles[j].id) < 6) {
        violations.push({
          type: "shops_too_close",
          fromTileId: shopTiles[i].id,
          toTileId: shopTiles[j].id,
        });
      }
    }
  }

  const starIds = new Set(
    tiles.filter((tile) => String(tile.type).toLowerCase() === "bonus").map((tile) => tile.id)
  );
  for (const tile of shopTiles) {
    const next = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [];
    if (next.some((id) => starIds.has(id))) {
      violations.push({ type: "shop_before_star", tileId: tile.id });
    }
  }

  return violations;
}

export function validateBoardShops(board) {
  const tiles = Array.isArray(board?.tiles) ? board.tiles : Array.isArray(board) ? board : [];
  return validateBoardShopsInternal(tiles);
}

function paintTileTypes(tiles, rng, mainPathIds = new Set()) {
  if (!tiles.length) return;

  // Start tile
  tiles[0].type = "start";

  // Balanced distribution across board colors.
  const balancedColors = ["blue", "green", "red", "violet"].sort(() => (rng() < 0.5 ? -1 : 1));
  for (let i = 1; i < tiles.length; i++) {
    tiles[i].type = balancedColors[(i - 1) % balancedColors.length];
  }

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

  // Keep exactly 2 bonus/star tiles and spread them out.
  const bonusCount = 2;
  const bonusIdGap = Math.max(8, Math.floor(tiles.length * 0.16));
  const bonusGridGap = 6;
  const bonusCandidates = tiles.map((tile) => tile.id).filter((id) => id >= minIdx && !used.has(id));
  const pickBonusWithGap = (gapById, gapByGrid, selected) => {
    const shuffled = [...bonusCandidates].sort(() => (rng() < 0.5 ? -1 : 1));
    for (const candidate of shuffled) {
      if (used.has(candidate)) continue;
      const tooClose = selected.some((otherId) =>
        Math.abs(otherId - candidate) < gapById
        || manhattanTileDistance(tiles[otherId], tiles[candidate]) < gapByGrid
      );
      if (tooClose) continue;
      used.add(candidate);
      tiles[candidate].type = "bonus";
      selected.push(candidate);
      return true;
    }
    return false;
  };
  const bonusSelected = [];
  while (bonusSelected.length < bonusCount) {
    if (pickBonusWithGap(bonusIdGap, bonusGridGap, bonusSelected)) continue;
    if (pickBonusWithGap(Math.max(6, bonusIdGap - 2), Math.max(4, bonusGridGap - 2), bonusSelected)) continue;
    if (pickBonusWithGap(4, 2, bonusSelected)) continue;
    if (place("bonus") == null) break;
    const placed = tiles
      .filter((tile) => String(tile.type).toLowerCase() === "bonus" && !bonusSelected.includes(tile.id))
      .map((tile) => tile.id)
      .sort((a, b) => b - a)[0];
    if (Number.isInteger(placed)) bonusSelected.push(placed);
  }
  if (bonusSelected.length < bonusCount) {
    const fallbackCandidates = tiles.map((tile) => tile.id).filter((id) => id >= minIdx && !bonusSelected.includes(id));
    for (const candidate of fallbackCandidates) {
      if (bonusSelected.length >= bonusCount) break;
      if (used.has(candidate)) continue;
      used.add(candidate);
      tiles[candidate].type = "bonus";
      bonusSelected.push(candidate);
    }
  }
  if (bonusSelected.length !== bonusCount) {
    throw new Error(`Invalid bonus layout: expected ${bonusCount}, got ${bonusSelected.length}`);
  }
  const starIds = new Set(bonusSelected.slice(0, bonusCount));

  // Place 3 shops with spacing and zone constraints.
  const count = 3;
  const n = tiles.length;
  const firstZoneMax = Math.max(minIdx + 1, Math.floor(n * 0.33));
  const middleZoneMin = Math.max(minIdx + 1, Math.floor(n * 0.34));
  const middleZoneMax = Math.max(middleZoneMin + 1, Math.floor(n * 0.72));
  const minGap = 7;
  const selected = [];

  const firstZone = tiles
    .map((tile) => tile.id)
    .filter((id) => id >= minIdx && id <= firstZoneMax && !used.has(id));
  const middleZone = tiles
    .map((tile) => tile.id)
    .filter((id) => id >= middleZoneMin && id <= middleZoneMax && !used.has(id));
  const incoming = buildIncomingMap(tiles);
  const branchZone = tiles
    .map((tile) => tile.id)
    .filter((id) => {
      if (used.has(id)) return false;
      if (mainPathIds.has(id)) return false;
      const incomingCount = (incoming.get(id) ?? []).length;
      const outgoingCount = Array.isArray(tiles[id]?.nextTileIds) ? tiles[id].nextTileIds.length : 0;
      return incomingCount >= 1 && outgoingCount >= 1;
    });

  const zones = [firstZone, middleZone, branchZone];
  zones.forEach((zone) => {
    const chosen = chooseShopCandidate(zone, selected, starIds, tiles, minGap, rng);
    if (chosen != null) {
      selected.push(chosen);
      used.add(chosen);
    }
  });

  const fallback = tiles
    .map((tile) => tile.id)
    .filter((id) => id >= minIdx && !used.has(id));
  while (selected.length < count) {
    const chosen = chooseShopCandidate(fallback, selected, starIds, tiles, minGap, rng);
    if (chosen == null) break;
    selected.push(chosen);
    used.add(chosen);
  }

  selected.forEach((id) => {
    tiles[id].type = "shop";
  });

  const violations = validateBoardShopsInternal(tiles);
  if (violations.length > 0) {
    throw new Error(`Invalid shop layout: ${JSON.stringify(violations[0])}`);
  }
}

