// server/gameLogic.js
// Retro Party - Retrospective board game logic (online).
// Server authoritative: generates board + questions and advances turns.

import { generateRandomBoard } from "./boardGenerator.js";
import { pickQuestion } from "./questions.js";
import { BUZZWORD_DUEL_BANK } from "./buzzwordBank.js";
import { SHOP_CATALOG } from "./shopCatalog.js";

const BUG_SMASH_DURATION_MS = 20000;
const BUG_SMASH_ANNOUNCE_MS = 4000;
const ENABLE_RED_TILE_MINIGAME = false;
const ENABLE_COLLISION_DUEL_MINIGAME = false;

const BUZZWORD_MAIN_WORDS = 10;
const BUZZWORD_WORD_DURATION_MS = 3000;
const BUZZWORD_BETWEEN_WORDS_MS = 500;
const BUZZWORD_ANNOUNCE_MS = 4000;
const BUZZWORD_TRANSFER_ANIMATION_MS = 4500;
const BUZZWORD_MAX_STEAL = 5;
const KUDO_COST = 10;
const BOARD_COLORS = ["blue", "green", "red", "violet"];
const STEAL_POINTS_AMOUNT = 5;
const MAX_ACTION_LOGS = 12;

function getBugSmashStars(score) {
  if (score >= 18) return 3;
  if (score >= 12) return 2;
  if (score >= 6) return 1;
  return 0;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntInclusive(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickBuzzwordRounds() {
  const pool = [...BUZZWORD_DUEL_BANK];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, BUZZWORD_MAIN_WORDS);
  const doubleWordIndex = randomIntInclusive(6, 10);

  return {
    rounds: selected.map((item, idx) => ({
      text: item.text,
      category: item.category,
      isDouble: idx + 1 === doubleWordIndex,
    })),
    doubleWordIndex,
  };
}

function pickSuddenDeathWord(excludedTexts) {
  const excluded = new Set(excludedTexts);
  const candidates = BUZZWORD_DUEL_BANK.filter((item) => !excluded.has(item.text));
  const source = candidates.length ? candidates : BUZZWORD_DUEL_BANK;
  const chosen = source[Math.floor(Math.random() * source.length)];
  return { text: chosen.text, category: chosen.category };
}

function buildWordState(word, now, roundType) {
  return {
    phase: roundType === "sudden_death" ? "sudden_death" : "word",
    roundType,
    wordText: word.text,
    isDouble: !!word.isDouble,
    wordStartedAt: now,
    wordEndsAt: now + BUZZWORD_WORD_DURATION_MS,
    nextWordAt: null,
    submittedBy: {},
    _currentCorrectCategory: word.category,
  };
}

function isBuzzwordDuelActive(state) {
  return state.currentMinigame?.minigameId === "BUZZWORD_DUEL";
}

function makeInventoryItemId(itemType) {
  return `${itemType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendActionLog(state, message) {
  const nextLogs = [...(state.actionLogs ?? []), message];
  return {
    ...state,
    actionLogs: nextLogs.slice(-MAX_ACTION_LOGS),
  };
}

export function createInitialState() {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 30, rows: 20, length: 85 });

  return {
    phase: "lobby",

    // players
    players: [],
    currentPlayerIndex: 0,

    // rounds
    currentRound: 1,
    maxRounds: 12,

    // board
    board: { seed: board.seed, cols: board.cols, rows: board.rows, length: board.length },
    tiles: board.tiles ?? [],

    // dice / UX
    diceValue: null,
    isRolling: false,
    turnPhase: "finished",
    preRollActionUsed: false,
    preRollEffect: null,

    // question flow
    currentQuestion: null,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    lastMoveTrace: null,
    questionHistory: [],
    actionLogs: [],
  };
}

export function regenerateBoard(state) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 30, rows: 20, length: 85 });
  return {
    ...state,
    board: { seed: board.seed, cols: board.cols, rows: board.rows, length: board.length },
    tiles: board.tiles ?? [],
  };
}

export function initializePlayers(state, lobbyPlayers, maxRounds = 12) {
  const colors = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#0ea5e9", "#84cc16"];

  const players = lobbyPlayers.map((p, idx) => ({
    id: p.socketId,
    name: p.name,
    avatar: p.avatar ?? 0,
    position: 0,
    positionNodeId: "0",
    lastPosition: -1,
    points: 0,
    stars: 0,
    inventory: [],
    skipNextTurn: false,
    color: colors[idx % colors.length],
    isHost: !!p.isHost,
  }));

  return {
    ...state,
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds,
    diceValue: null,
    isRolling: false,
    turnPhase: "pre_roll",
    preRollActionUsed: false,
    preRollEffect: null,
    currentQuestion: null,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    lastMoveTrace: null,
    questionHistory: [],
    actionLogs: [],
  };
}

function isPlayersTurn(state, socketId) {
  const cur = state.players[state.currentPlayerIndex];
  return !!cur && cur.id === socketId;
}

export function rollDice(state, socketId) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (state.turnPhase !== "pre_roll") return state;
  if (!isPlayersTurn(state, socketId)) return state;

  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  let dice = d1;
  if (state.preRollEffect?.kind === "double_roll") dice = d1 + d2;
  if (state.preRollEffect?.kind === "plus_two_roll") dice = d1 + 2;
  return {
    ...state,
    diceValue: dice,
    isRolling: true,
    turnPhase: "rolling",
    preRollEffect: null,
  };
}

export function settleDice(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.diceValue == null) return state;

  return { ...state, isRolling: false, turnPhase: "moving" };
}

function getNextTileOptions(tiles, tileId) {
  const tile = tiles[tileId];
  if (!tile) return [];
  const options = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [tileId + 1];
  return options.filter((id) => Number.isInteger(id) && id >= 0 && id < tiles.length);
}

function normalizeBoardForRules(board) {
  const sourceNodes = Array.isArray(board?.nodes)
    ? board.nodes
    : Array.isArray(board?.tiles)
      ? board.tiles
      : [];

  const nodes = sourceNodes.map((node, index) => {
    const id = String(node.id ?? index);
    const nextRaw = Array.isArray(node.next)
      ? node.next
      : Array.isArray(node.nextTileIds)
        ? node.nextTileIds
        : [];
    const next = nextRaw.map((value) => String(value));
    const type = String(node.type ?? "blue");
    return { id, type, next };
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const players = Array.isArray(board?.players) ? board.players : [];
  return { nodes, nodeById, players };
}

function normalizeColorType(type) {
  const value = String(type ?? "").toLowerCase();
  if (value === "purple") return "violet";
  if (value === "kudobox" || value === "star") return "bonus";
  return value;
}

function applyTilePoints(type, currentPoints) {
  const normalized = normalizeColorType(type);
  if (normalized === "red") return Math.max(0, currentPoints - 2);
  if (normalized === "blue" || normalized === "green" || normalized === "violet" || normalized === "yellow") {
    return Math.max(0, currentPoints + 2);
  }
  return Math.max(0, currentPoints);
}

function getTilePointDelta(type) {
  const normalized = normalizeColorType(type);
  if (normalized === "red") return -2;
  if (normalized === "blue" || normalized === "green" || normalized === "violet" || normalized === "yellow") return 2;
  return 0;
}

export function movePlayerWithRules(board, playerId, roll, chooseFn) {
  const safeRoll = Math.max(0, Math.floor(Number(roll) || 0));
  const { nodeById, players } = normalizeBoardForRules(board);
  const player = players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const startNodeId = String(player.positionNodeId ?? player.position ?? "0");
  if (!nodeById.has(startNodeId)) {
    throw new Error(`Invalid start node id: ${startNodeId}`);
  }

  let currentNodeId = startNodeId;
  let points = Math.max(0, Math.floor(Number(player.points) || 0));
  let stars = Math.max(0, Math.floor(Number(player.stars) || 0));
  let remaining = safeRoll;

  const path = [currentNodeId];
  const events = [];

  while (remaining > 0) {
    const currentNode = nodeById.get(currentNodeId);
    if (!currentNode) break;

    const options = currentNode.next.filter((nextId) => nodeById.has(nextId));
    if (options.length === 0) {
      events.push({
        type: "dead_end",
        atNodeId: currentNodeId,
      });
      break;
    }

    let chosenNodeId = options[0];
    if (options.length > 1) {
      let picked = options[0];
      if (typeof chooseFn === "function") {
        picked =
          chooseFn.length >= 2
            ? chooseFn(currentNodeId, [...options], remaining, playerId)
            : chooseFn({
                playerId,
                fromNodeId: currentNodeId,
                options: [...options],
                remainingSteps: remaining,
              });
      }

      const pickedId = String(picked);
      if (options.includes(pickedId)) {
        chosenNodeId = pickedId;
      } else {
        events.push({
          type: "invalid_choice_fallback",
          atNodeId: currentNodeId,
          attempted: pickedId,
          chosen: chosenNodeId,
          options: [...options],
        });
      }

      events.push({
        type: "branch_choice",
        atNodeId: currentNodeId,
        chosen: chosenNodeId,
        options: [...options],
      });
    }

    currentNodeId = chosenNodeId;
    path.push(currentNodeId);
    remaining -= 1;

    const landedNode = nodeById.get(currentNodeId);
    const normalizedType = normalizeColorType(landedNode?.type);

    if (normalizedType === "bonus") {
      events.push({
        type: "kudobox_stop",
        nodeId: currentNodeId,
        remainingStepsAfterStop: remaining,
      });
      const wantsToBuy =
        typeof chooseFn === "function"
          ? chooseFn({
              kind: "kudo_purchase",
              playerId,
              nodeId: currentNodeId,
              points,
              stars,
              cost: KUDO_COST,
              remainingSteps: remaining,
            }) !== false
          : points >= KUDO_COST;

      if (wantsToBuy && points >= KUDO_COST) {
        points -= KUDO_COST;
        stars += 1;
        events.push({
          type: "kudobox_buy_star",
          nodeId: currentNodeId,
          pointsAfter: points,
          starsAfter: stars,
        });
      } else {
        events.push({
          type: "kudobox_not_enough_points",
          nodeId: currentNodeId,
          points,
          required: KUDO_COST,
        });
      }
    }
  }

  const finalNode = nodeById.get(currentNodeId);
  const finalType = normalizeColorType(finalNode?.type);
  const pointsBeforeFinal = points;
  points = applyTilePoints(finalType, points);
  if (points !== pointsBeforeFinal) {
    events.push({
      type: "points_change",
      nodeId: currentNodeId,
      tileType: finalType,
      delta: points - pointsBeforeFinal,
      pointsAfter: points,
    });
  }

  // Keep board player in sync for direct integration with current game state.
  player.points = points;
  player.stars = stars;
  player.positionNodeId = currentNodeId;
  if (Object.prototype.hasOwnProperty.call(player, "position")) {
    const numericPos = Number(currentNodeId);
    if (Number.isInteger(numericPos)) player.position = numericPos;
  }

  return {
    path,
    pointsAfter: points,
    starsAfter: stars,
    events,
  };
}

function advancePlayerAlongBoard(state, player, steps, firstChoice = null) {
  let remaining = steps;
  let position = player.position;
  let previous = player.lastPosition ?? -1;
  let forced = firstChoice;
  const path = [position];
  const pointDeltas = [];

  while (remaining > 0) {
    const rawOptions = getNextTileOptions(state.tiles, position);
    const options =
      rawOptions.length > 1 ? rawOptions.filter((id) => id !== previous) : rawOptions;
    if (options.length === 0) break;

    let chosen = null;
    if (options.length > 1 && forced != null) {
      chosen = options.includes(forced) ? forced : null;
      forced = null;
    } else if (options.length === 1) {
      chosen = options[0];
    }

    if (options.length > 1 && chosen == null) {
      player.position = position;
      player.positionNodeId = String(position);
      player.lastPosition = previous;
      return {
        finished: false,
        moveTrace: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          playerId: player.id,
          path,
          pointDeltas,
        },
        pendingPathChoice: {
          playerId: player.id,
          atTileId: position,
          options,
          remainingSteps: remaining,
        },
        pendingKudoPurchase: null,
        pendingShop: null,
      };
    }

    previous = position;
    position = chosen;
    player.position = position;
    player.positionNodeId = String(position);
    player.lastPosition = previous;
    path.push(position);
    const visitedTile = state.tiles[position];
    pointDeltas.push(0);
    remaining -= 1;
    const visitedType = normalizeColorType(visitedTile?.type);
    if (visitedType === "shop") {
      return {
        finished: false,
        moveTrace: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          playerId: player.id,
          path,
          pointDeltas,
        },
        pendingPathChoice: null,
        pendingKudoPurchase: null,
        pendingShop: {
          playerId: player.id,
          atTileId: position,
          remainingSteps: remaining,
        },
      };
    }
    if (visitedType === "bonus") {
      return {
        finished: false,
        moveTrace: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          playerId: player.id,
          path,
          pointDeltas,
        },
        pendingPathChoice: null,
        pendingKudoPurchase: {
          playerId: player.id,
          atTileId: position,
          remainingSteps: remaining,
          cost: KUDO_COST,
          canAfford: player.points >= KUDO_COST,
          turnEndsAfterResolve: false,
        },
        pendingShop: null,
      };
    }
  }

  player.position = position;
  player.positionNodeId = String(position);
  player.lastPosition = previous;
  const finalTile = state.tiles[position];
  const finalDelta = finalTile ? getTilePointDelta(finalTile.type) : 0;
  player.points = Math.max(0, Math.floor(Number(player.points ?? 0) + finalDelta));
  if (pointDeltas.length > 0) pointDeltas[pointDeltas.length - 1] = finalDelta;
  return {
    finished: true,
    moveTrace: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      playerId: player.id,
      path,
      pointDeltas,
    },
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
  };
}

function shuffleInPlace(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function buildIncomingByTile(tiles) {
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

function pickReplacementColor(tiles, tileId) {
  const incomingByTile = buildIncomingByTile(tiles);
  const blocked = new Set();
  const outgoing = Array.isArray(tiles[tileId]?.nextTileIds) ? tiles[tileId].nextTileIds : [];
  const incoming = incomingByTile.get(tileId) ?? [];
  const neighborIds = [...incoming, ...outgoing];
  neighborIds.forEach((id) => {
    const t = normalizeColorType(tiles[id]?.type);
    if (t === "blue" || t === "green" || t === "red" || t === "violet") blocked.add(t);
  });

  const ordered = shuffleInPlace([...BOARD_COLORS]);
  const selected = ordered.find((color) => !blocked.has(color));
  return selected ?? ordered[0] ?? "blue";
}

function relocatePurchasedStar(tiles, purchasedStarTileId) {
  if (!Array.isArray(tiles) || !tiles.length) return;
  const fromTile = tiles[purchasedStarTileId];
  if (!fromTile || normalizeColorType(fromTile.type) !== "bonus") return;

  const candidates = tiles.filter(
    (tile) =>
      tile.id !== purchasedStarTileId &&
      normalizeColorType(tile.type) !== "bonus" &&
      normalizeColorType(tile.type) !== "start"
  );
  if (!candidates.length) return;

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  fromTile.type = pickReplacementColor(tiles, purchasedStarTileId);
  target.type = "bonus";
}

function buildLandingState(state, players) {
  const curPlayer = players[state.currentPlayerIndex];
  const tile = state.tiles[curPlayer.position];
  if (!tile) {
    return {
      ...state,
      players,
      isRolling: false,
      diceValue: null,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
      turnPhase: "resolving",
    };
  }

  const collidedPlayer = players.find(
    (player, idx) => idx !== state.currentPlayerIndex && player.position === curPlayer.position
  );

  const type = tile.type === "bonus" ? "bonus" : tile.type;

  const withBonus = {
    ...state,
    players,
    isRolling: false,
    diceValue: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    turnPhase: "resolving",
  };

  if (ENABLE_COLLISION_DUEL_MINIGAME && collidedPlayer) {
    return startBuzzwordDuel(withBonus, curPlayer.id, collidedPlayer.id);
  }

  const seed = (state.board?.seed ?? 0) + curPlayer.position + state.currentRound * 1000;
  const rng = mulberry32(seed);
  const text = pickQuestion(type, rng) || "(Question manquante)";
  const qId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    ...withBonus,
    currentMinigame: null,
    currentQuestion: {
      id: qId,
      type,
      text,
      targetPlayerId: curPlayer.id,
      votes: { up: [], down: [] },
      status: "pending",
      nextMinigame: type === "red" && ENABLE_RED_TILE_MINIGAME ? "BUG_SMASH" : null,
    },
  };
}

export function movePlayer(state, socketId, steps) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (typeof steps !== "number" || steps <= 0) return state;
  if (state.diceValue == null) return state;

  const players = state.players.map((p) => ({ ...p }));
  const cur = players[state.currentPlayerIndex];
  const moved = advancePlayerAlongBoard(state, cur, steps);

  if (!moved.finished) {
    return {
      ...state,
      players,
      isRolling: false,
      diceValue: null,
      lastMoveTrace: moved.moveTrace,
      pendingPathChoice: moved.pendingPathChoice,
      pendingKudoPurchase: moved.pendingKudoPurchase,
      pendingShop: moved.pendingShop,
      turnPhase: "resolving",
    };
  }

  return {
    ...buildLandingState(state, players),
    lastMoveTrace: moved.moveTrace,
  };
}

export function choosePath(state, socketId, nextTileId) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion || state.currentMinigame) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (!state.pendingPathChoice) return state;
  if (state.pendingPathChoice.playerId !== socketId) return state;
  if (!state.pendingPathChoice.options.includes(nextTileId)) return state;

  const players = state.players.map((p) => ({ ...p }));
  const cur = players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return state;

  const moved = advancePlayerAlongBoard(
    state,
    cur,
    state.pendingPathChoice.remainingSteps,
    nextTileId
  );

  if (!moved.finished) {
    return {
      ...state,
      players,
      lastMoveTrace: moved.moveTrace,
      pendingPathChoice: moved.pendingPathChoice,
      pendingKudoPurchase: moved.pendingKudoPurchase,
      pendingShop: moved.pendingShop,
      isRolling: false,
      diceValue: null,
      turnPhase: "resolving",
    };
  }

  return {
    ...buildLandingState(state, players),
    lastMoveTrace: moved.moveTrace,
  };
}

export function resolveKudoPurchase(state, socketId, buyKudo) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion || state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingShop) return state;
  if (!state.pendingKudoPurchase) return state;
  if (state.pendingKudoPurchase.playerId !== socketId) return state;

  const players = state.players.map((p) => ({ ...p }));
  const tiles = state.tiles.map((tile) => ({ ...tile }));
  const stateWithTiles = { ...state, tiles };
  const cur = players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return state;

  if (buyKudo && cur.points >= KUDO_COST) {
    cur.points = Math.max(0, Math.floor(Number(cur.points ?? 0) - KUDO_COST));
    cur.stars = Math.max(0, Math.floor(Number(cur.stars ?? 0) + 1));
    relocatePurchasedStar(tiles, state.pendingKudoPurchase.atTileId);
  }

  const remaining = Math.max(0, Math.floor(Number(state.pendingKudoPurchase.remainingSteps ?? 0)));
  if (remaining <= 0) {
    if (state.pendingKudoPurchase.turnEndsAfterResolve) {
      const cleared = {
        ...stateWithTiles,
        players,
        currentQuestion: null,
        currentMinigame: null,
        diceValue: null,
        isRolling: false,
        pendingPathChoice: null,
        pendingKudoPurchase: null,
        pendingShop: null,
        turnPhase: "finished",
      };
      return nextTurn(cleared);
    }
    return {
      ...buildLandingState(stateWithTiles, players),
      pendingKudoPurchase: null,
    };
  }

  const moved = advancePlayerAlongBoard(stateWithTiles, cur, remaining);
  if (!moved.finished) {
    return {
      ...stateWithTiles,
      players,
      lastMoveTrace: moved.moveTrace,
      pendingPathChoice: moved.pendingPathChoice,
      pendingKudoPurchase: moved.pendingKudoPurchase,
      pendingShop: moved.pendingShop,
      isRolling: false,
      diceValue: null,
      currentQuestion: null,
      currentMinigame: null,
      turnPhase: "resolving",
    };
  }

  return {
    ...buildLandingState(stateWithTiles, players),
    pendingKudoPurchase: null,
    lastMoveTrace: moved.moveTrace,
  };
}

export function startBuzzwordDuel(state, firstPlayerId, secondPlayerId, now = Date.now()) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion || state.currentMinigame) return state;
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.pendingShop) return state;

  const playerA = state.players.find((p) => p.id === firstPlayerId);
  const playerB = state.players.find((p) => p.id === secondPlayerId);
  if (!playerA || !playerB || playerA.id === playerB.id) return state;

  const { rounds, doubleWordIndex } = pickBuzzwordRounds();
  const firstWord = rounds[0];
  const firstWordAt = now + BUZZWORD_ANNOUNCE_MS;

  return {
    ...state,
    currentQuestion: null,
    diceValue: null,
    isRolling: false,
    currentMinigame: {
      minigameId: "BUZZWORD_DUEL",
      duelists: [playerA.id, playerB.id],
      totalWords: BUZZWORD_MAIN_WORDS,
      currentWordIndex: 1,
      suddenDeathRound: 0,
      doubleWordIndex,
      scores: {
        [playerA.id]: 0,
        [playerB.id]: 0,
      },
      transfer: null,
      ...buildWordState(firstWord, firstWordAt, "main"),
      phase: "between",
      nextWordAt: firstWordAt,
      submittedBy: {},
      _nextMainWord: firstWord,
      _mainRounds: rounds,
      _usedSuddenWords: rounds.map((entry) => entry.text),
    },
  };
}

export function onPlayerLanded(state, socketId) {
  return state;
}

export function openQuestion(state, socketId) {
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (!state.currentQuestion || state.currentQuestion.status !== "pending") return state;
  if (state.currentQuestion.targetPlayerId !== socketId) return state;
  return {
    ...state,
    currentQuestion: {
      ...state.currentQuestion,
      status: "open",
    },
  };
}

export function voteQuestion(state, socketId, vote) {
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (!state.currentQuestion || state.currentQuestion.status !== "open") return state;
  if (vote !== "up" && vote !== "down") return state;

  const q = { ...state.currentQuestion, votes: { up: [...state.currentQuestion.votes.up], down: [...state.currentQuestion.votes.down] } };

  q.votes.up = q.votes.up.filter((id) => id !== socketId);
  q.votes.down = q.votes.down.filter((id) => id !== socketId);
  q.votes[vote].push(socketId);

  return { ...state, currentQuestion: q };
}

export function validateQuestion(state, socketId) {
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (!state.currentQuestion || state.currentQuestion.status !== "open") return state;
  if (state.currentQuestion.targetPlayerId !== socketId) return state;

  const questionHistory = [
    ...(state.questionHistory ?? []),
    {
      id: state.currentQuestion.id,
      type: state.currentQuestion.type,
      text: state.currentQuestion.text,
      upVotes: state.currentQuestion.votes.up.length,
      downVotes: state.currentQuestion.votes.down.length,
    },
  ];

  if (ENABLE_RED_TILE_MINIGAME && state.currentQuestion.nextMinigame === "BUG_SMASH") {
    return {
      ...state,
      questionHistory,
      currentQuestion: null,
      currentMinigame: {
        minigameId: "BUG_SMASH",
        targetPlayerId: state.currentQuestion.targetPlayerId,
        startAt: Date.now() + BUG_SMASH_ANNOUNCE_MS,
        durationMs: BUG_SMASH_DURATION_MS,
        score: 0,
      },
      diceValue: null,
      isRolling: false,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
      turnPhase: "resolving",
    };
  }

  const cleared = {
    ...state,
    currentQuestion: null,
    diceValue: null,
    isRolling: false,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    questionHistory,
    turnPhase: "finished",
  };
  return nextTurn(cleared);
}

export function openShopForPlayer(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  const cur = state.players[state.currentPlayerIndex];
  if (!cur) return state;
  const tile = state.tiles[cur.position];
  if (!tile || String(tile.type).toLowerCase() !== "shop") return state;
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.currentQuestion || state.currentMinigame) {
    return state;
  }
  return {
    ...state,
    pendingShop: {
      playerId: socketId,
      atTileId: cur.position,
      remainingSteps: 0,
    },
    turnPhase: "resolving",
  };
}

function continueFromPendingShop(state, players, socketId) {
  const cur = players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return state;

  const remaining = Math.max(0, Math.floor(Number(state.pendingShop?.remainingSteps ?? 0)));
  if (remaining <= 0) {
    const cleared = {
      ...state,
      players,
      currentQuestion: null,
      currentMinigame: null,
      diceValue: null,
      isRolling: false,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
      turnPhase: "finished",
    };
    return nextTurn(cleared);
  }

  const moved = advancePlayerAlongBoard(state, cur, remaining);
  if (!moved.finished) {
    return {
      ...state,
      players,
      lastMoveTrace: moved.moveTrace,
      pendingPathChoice: moved.pendingPathChoice,
      pendingKudoPurchase: moved.pendingKudoPurchase,
      pendingShop: moved.pendingShop,
      isRolling: false,
      diceValue: null,
      currentQuestion: null,
      currentMinigame: null,
      turnPhase: "resolving",
    };
  }

  return {
    ...buildLandingState(state, players),
    pendingShop: null,
    lastMoveTrace: moved.moveTrace,
  };
}

export function closeShopForPlayer(state, socketId) {
  if (!state.pendingShop || state.pendingShop.playerId !== socketId) return state;
  const players = state.players.map((p) => ({ ...p, inventory: [...(p.inventory ?? [])] }));
  return continueFromPendingShop(state, players, socketId);
}

export function buyShopItem(state, socketId, itemType) {
  if (state.phase !== "playing") return state;
  if (!state.pendingShop || state.pendingShop.playerId !== socketId) return state;
  if (!isPlayersTurn(state, socketId)) return state;
  const catalogEntry = SHOP_CATALOG[itemType];
  if (!catalogEntry) return state;

  const players = state.players.map((p) => ({ ...p, inventory: [...(p.inventory ?? [])] }));
  const cur = players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return state;
  if (cur.points < catalogEntry.cost) return state;

  cur.points = Math.max(0, Math.floor(Number(cur.points ?? 0) - catalogEntry.cost));
  cur.inventory.push({
    id: makeInventoryItemId(catalogEntry.type),
    type: catalogEntry.type,
    purchasedAtTurn: state.currentRound,
  });
  const logged = appendActionLog(
    {
      ...state,
      players,
      turnPhase: "resolving",
    },
    `${cur.name} achete ${catalogEntry.label} pour ${catalogEntry.cost} points`
  );
  return continueFromPendingShop(logged, players, socketId);
}

export function getUsableItemsForTurn(state, socketId) {
  if (state.phase !== "playing") return [];
  if (!isPlayersTurn(state, socketId)) return [];
  if (state.turnPhase !== "pre_roll") return [];
  if (state.preRollActionUsed) return [];
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.pendingShop || state.currentQuestion || state.currentMinigame) {
    return [];
  }
  const cur = state.players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return [];
  const inv = Array.isArray(cur.inventory) ? cur.inventory : [];
  return inv.filter((item) => item && SHOP_CATALOG[item.type]);
}

export function consumeInventoryItem(state, socketId, itemInstanceId) {
  const players = state.players.map((p) => ({ ...p, inventory: [...(p.inventory ?? [])] }));
  const cur = players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return { state, consumed: null };
  const idx = cur.inventory.findIndex((item) => item.id === itemInstanceId);
  if (idx < 0) return { state, consumed: null };
  const [consumed] = cur.inventory.splice(idx, 1);
  return {
    state: { ...state, players },
    consumed,
  };
}

export function useShopItem(state, socketId, itemInstanceId, payload = {}) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.turnPhase !== "pre_roll") return state;
  if (state.preRollActionUsed) return state;
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.pendingShop || state.currentQuestion || state.currentMinigame) {
    return state;
  }

  const { state: afterConsume, consumed } = consumeInventoryItem(state, socketId, itemInstanceId);
  if (!consumed) return state;

  const players = afterConsume.players.map((p) => ({ ...p, inventory: [...(p.inventory ?? [])] }));
  const cur = players[afterConsume.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return state;
  const itemDef = SHOP_CATALOG[consumed.type];
  if (!itemDef) return state;

  let nextState = {
    ...afterConsume,
    players,
    preRollActionUsed: true,
    pendingShop: null,
  };

  if (consumed.type === "double_roll" || consumed.type === "plus_two_roll") {
    nextState = {
      ...nextState,
      preRollEffect: { kind: consumed.type },
      turnPhase: "pre_roll",
    };
    return appendActionLog(nextState, `${cur.name} utilise ${itemDef.label}`);
  }

  if (consumed.type === "swap_position") {
    const targetPlayerId = String(payload.targetPlayerId ?? "");
    const target = players.find((p) => p.id === targetPlayerId);
    if (!target || target.id === cur.id) return state;
    const fromPos = cur.position;
    const fromNodeId = cur.positionNodeId ?? String(cur.position ?? 0);
    const fromPrev = cur.lastPosition ?? -1;
    cur.position = target.position;
    cur.positionNodeId = target.positionNodeId ?? String(target.position ?? 0);
    cur.lastPosition = target.lastPosition ?? -1;
    target.position = fromPos;
    target.positionNodeId = fromNodeId;
    target.lastPosition = fromPrev;
    return appendActionLog(
      {
        ...nextState,
        players,
        turnPhase: "pre_roll",
      },
      `${cur.name} utilise ${itemDef.label} sur ${target.name}`
    );
  }

  if (consumed.type === "steal_points") {
    const targetPlayerId = String(payload.targetPlayerId ?? "");
    const target = players.find((p) => p.id === targetPlayerId);
    if (!target || target.id === cur.id) return state;
    const targetPoints = Math.max(0, Math.floor(Number(target.points ?? 0)));
    const stolen = Math.min(STEAL_POINTS_AMOUNT, targetPoints);
    target.points = targetPoints - stolen;
    cur.points = Math.max(0, Math.floor(Number(cur.points ?? 0) + stolen));
    return appendActionLog(
      {
        ...nextState,
        players,
        turnPhase: "pre_roll",
      },
      `${cur.name} vole ${stolen} points a ${target.name}`
    );
  }

  if (consumed.type === "go_to_star") {
    const starTile = nextState.tiles.find((tile) => normalizeColorType(tile.type) === "bonus");
    if (!starTile) return state;
    const fromPos = cur.position;
    cur.position = starTile.id;
    cur.positionNodeId = String(starTile.id);
    nextState = {
      ...nextState,
      players,
      diceValue: null,
      isRolling: false,
      lastMoveTrace: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        playerId: cur.id,
        path: [fromPos, starTile.id],
        pointDeltas: [0],
      },
      pendingKudoPurchase: {
        playerId: cur.id,
        atTileId: starTile.id,
        remainingSteps: 0,
        cost: KUDO_COST,
        canAfford: cur.points >= KUDO_COST,
        turnEndsAfterResolve: true,
      },
      turnPhase: "resolving",
      preRollEffect: null,
    };
    return appendActionLog(nextState, `${cur.name} utilise ${itemDef.label}`);
  }

  return state;
}

export function nextTurn(state) {
  if (state.phase !== "playing") return state;
  if (state.players.length === 0) return state;
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;

  const players = state.players.map((p) => ({ ...p }));
  let nextIndex = state.currentPlayerIndex + 1;
  let nextRound = state.currentRound;

  if (nextIndex >= players.length) {
    nextIndex = 0;
    nextRound = state.currentRound + 1;
  }

  let safety = 0;
  while (players[nextIndex]?.skipNextTurn && safety < players.length) {
    players[nextIndex].skipNextTurn = false;
    nextIndex += 1;
    if (nextIndex >= players.length) {
      nextIndex = 0;
      nextRound += 1;
    }
    safety += 1;
  }

  if (nextRound > state.maxRounds) {
    return {
      ...state,
      phase: "results",
      players,
      currentRound: state.maxRounds,
      currentPlayerIndex: state.currentPlayerIndex,
      diceValue: null,
      isRolling: false,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
      turnPhase: "finished",
    };
  }

  return {
    ...state,
    players,
    currentPlayerIndex: nextIndex,
    currentRound: nextRound,
    diceValue: null,
    isRolling: false,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    turnPhase: "pre_roll",
    preRollActionUsed: false,
    preRollEffect: null,
  };
}

export function resetGame() {
  return createInitialState();
}

function getBuzzwordDuelists(minigame) {
  return Array.isArray(minigame.duelists) && minigame.duelists.length === 2 ? minigame.duelists : null;
}

function applyBuzzwordDirectGains(players, scores, duelists) {
  if (!scores || !duelists) return;

  duelists.forEach((playerId) => {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    const gained = Math.max(0, Math.floor(Number(scores[playerId] ?? 0)));
    player.stars += gained;
  });
}

function computeSteal(players, winnerId, loserId) {
  const winner = players.find((p) => p.id === winnerId);
  const loser = players.find((p) => p.id === loserId);
  if (!winner || !loser) return { players, amount: 0 };

  const amount = Math.min(BUZZWORD_MAX_STEAL, Math.max(0, Math.floor(loser.stars)));
  loser.stars -= amount;
  winner.stars += amount;
  return { players, amount };
}

function toTransferState(state, winnerId, loserId, now = Date.now()) {
  if (!isBuzzwordDuelActive(state)) return state;

  const minigame = state.currentMinigame;
  const duelists = getBuzzwordDuelists(minigame);
  const players = state.players.map((p) => ({ ...p }));
  applyBuzzwordDirectGains(players, minigame.scores, duelists);
  const transfer = computeSteal(players, winnerId, loserId);

  return {
    ...state,
    players,
    currentMinigame: {
      ...minigame,
      phase: "transfer",
      roundType: minigame.roundType,
      transfer: {
        winnerId,
        loserId,
        amount: transfer.amount,
        startedAt: now,
      },
      submittedBy: {},
      nextWordAt: null,
      winnerId,
      loserId,
      stolenPoints: transfer.amount,
    },
  };
}

export function submitBuzzwordAnswer(state, socketId, category, now = Date.now()) {
  if (!isBuzzwordDuelActive(state)) return state;
  if (category !== "LEGIT" && category !== "BULLSHIT") return state;

  const minigame = state.currentMinigame;
  const duelists = getBuzzwordDuelists(minigame);
  if (!duelists || !duelists.includes(socketId)) return state;
  if (minigame.phase !== "word" && minigame.phase !== "sudden_death") return state;
  if (now >= minigame.wordEndsAt) return state;
  if (minigame.submittedBy?.[socketId]) return state;

  const submittedBy = {
    ...(minigame.submittedBy ?? {}),
    [socketId]: category,
  };

  const nextState = {
    ...state,
    currentMinigame: {
      ...minigame,
      submittedBy,
    },
  };

  if (minigame.roundType === "sudden_death" && minigame._currentCorrectCategory === category) {
    const [a, b] = duelists;
    const winnerId = socketId;
    const loserId = winnerId === a ? b : a;
    return toTransferState(nextState, winnerId, loserId, now);
  }

  return nextState;
}

export function resolveBuzzwordWord(state, now = Date.now()) {
  if (!isBuzzwordDuelActive(state)) return state;

  const minigame = state.currentMinigame;
  if ((minigame.phase !== "word" && minigame.phase !== "sudden_death") || now < minigame.wordEndsAt) {
    return state;
  }

  const duelists = getBuzzwordDuelists(minigame);
  if (!duelists) return state;

  const [playerA, playerB] = duelists;
  const answerA = minigame.submittedBy?.[playerA] ?? null;
  const answerB = minigame.submittedBy?.[playerB] ?? null;

  if (minigame.roundType === "main") {
    const points = minigame.isDouble ? 2 : 1;
    const scores = {
      ...minigame.scores,
      [playerA]: (minigame.scores[playerA] ?? 0) + (answerA === minigame._currentCorrectCategory ? points : 0),
      [playerB]: (minigame.scores[playerB] ?? 0) + (answerB === minigame._currentCorrectCategory ? points : 0),
    };

    if (minigame.currentWordIndex >= BUZZWORD_MAIN_WORDS) {
      if (scores[playerA] > scores[playerB]) {
        return toTransferState(
          {
            ...state,
            currentMinigame: {
              ...minigame,
              scores,
            },
          },
          playerA,
          playerB,
          now
        );
      }
      if (scores[playerB] > scores[playerA]) {
        return toTransferState(
          {
            ...state,
            currentMinigame: {
              ...minigame,
              scores,
            },
          },
          playerB,
          playerA,
          now
        );
      }

      const suddenWord = pickSuddenDeathWord(minigame._usedSuddenWords ?? []);
      return {
        ...state,
        currentMinigame: {
          ...minigame,
          scores,
          suddenDeathRound: (minigame.suddenDeathRound ?? 0) + 1,
          _usedSuddenWords: [...(minigame._usedSuddenWords ?? []), suddenWord.text],
          ...buildWordState(suddenWord, now + BUZZWORD_BETWEEN_WORDS_MS, "sudden_death"),
          phase: "between",
          nextWordAt: now + BUZZWORD_BETWEEN_WORDS_MS,
        },
      };
    }

    const nextWord = minigame._mainRounds[minigame.currentWordIndex];
    return {
      ...state,
      currentMinigame: {
        ...minigame,
        scores,
        currentWordIndex: minigame.currentWordIndex + 1,
        phase: "between",
        nextWordAt: now + BUZZWORD_BETWEEN_WORDS_MS,
        submittedBy: {},
        _nextMainWord: nextWord,
      },
    };
  }

  const suddenWord = pickSuddenDeathWord(minigame._usedSuddenWords ?? []);
  return {
    ...state,
    currentMinigame: {
      ...minigame,
      suddenDeathRound: (minigame.suddenDeathRound ?? 0) + 1,
      _usedSuddenWords: [...(minigame._usedSuddenWords ?? []), suddenWord.text],
      ...buildWordState(suddenWord, now + BUZZWORD_BETWEEN_WORDS_MS, "sudden_death"),
      phase: "between",
      nextWordAt: now + BUZZWORD_BETWEEN_WORDS_MS,
    },
  };
}

export function maybeStartBuzzwordNextWord(state, now = Date.now()) {
  if (!isBuzzwordDuelActive(state)) return state;

  const minigame = state.currentMinigame;
  if (minigame.phase !== "between" || !minigame.nextWordAt || now < minigame.nextWordAt) return state;

  if (minigame.roundType === "sudden_death") {
    return {
      ...state,
      currentMinigame: {
        ...minigame,
        phase: "sudden_death",
        wordStartedAt: now,
        wordEndsAt: now + BUZZWORD_WORD_DURATION_MS,
        nextWordAt: null,
        submittedBy: {},
      },
    };
  }

  const nextWord =
    minigame._nextMainWord ??
    {
      text: minigame.wordText,
      category: minigame._currentCorrectCategory,
      isDouble: minigame.isDouble,
    };
  if (!nextWord) return state;

  return {
    ...state,
    currentMinigame: {
      ...minigame,
      ...buildWordState(nextWord, now, "main"),
      phase: "word",
      nextWordAt: null,
      _nextMainWord: null,
    },
  };
}

export function completeBuzzwordTransfer(state) {
  if (!isBuzzwordDuelActive(state)) return state;
  if (state.currentMinigame.phase !== "transfer") return state;

  const cleared = {
    ...state,
    currentMinigame: null,
    currentQuestion: null,
    diceValue: null,
    isRolling: false,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    turnPhase: "finished",
  };
  return nextTurn(cleared);
}

export function getBuzzwordTransferDelayMs() {
  return BUZZWORD_TRANSFER_ANIMATION_MS;
}

export function completeBugSmash(state, socketId, score) {
  if (state.phase !== "playing") return state;
  if (!state.currentMinigame || state.currentMinigame.minigameId !== "BUG_SMASH") return state;
  if (state.currentMinigame.targetPlayerId !== socketId) return state;

  const numericScore = Number.isFinite(score) ? Number(score) : 0;
  const clampedScore = Math.max(0, Math.min(999, Math.floor(numericScore)));
  const starsEarned = getBugSmashStars(clampedScore);

  const players = state.players.map((p) => ({ ...p }));
  const target = players.find((p) => p.id === socketId);
  if (!target) return state;
  target.stars += starsEarned;

  const cleared = {
    ...state,
    players,
    currentMinigame: null,
    currentQuestion: null,
    diceValue: null,
    isRolling: false,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    turnPhase: "finished",
  };
  return nextTurn(cleared);
}

export function updateBugSmashProgress(state, socketId, score) {
  if (state.phase !== "playing") return state;
  if (!state.currentMinigame || state.currentMinigame.minigameId !== "BUG_SMASH") return state;
  if (state.currentMinigame.targetPlayerId !== socketId) return state;

  const numericScore = Number.isFinite(score) ? Number(score) : 0;
  const clampedScore = Math.max(0, Math.min(999, Math.floor(numericScore)));

  return {
    ...state,
    currentMinigame: {
      ...state.currentMinigame,
      score: clampedScore,
    },
  };
}
