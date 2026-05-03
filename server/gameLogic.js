// server/gameLogic.js
// Retro Party - Retrospective board game logic (online).
// Server authoritative: generates board + questions and advances turns.

import { generateRandomBoard } from "./boardGenerator.js";
import { pickUniqueQuestion } from "./questions.js";
import { BUZZWORD_DUEL_BANK } from "./buzzwordBank.js";
import { SHOP_CATALOG } from "./shopCatalog.js";
import { actionLogMessage, currentPlayerName, playerName } from "./actionLogMessages.js";

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
const POINT_DUEL_ANNOUNCE_MS = 1800;
const POINT_DUEL_ROLL_REVEAL_MS = 2200;
const POINT_DUEL_RESULT_MS = 3200;
const POINT_DUEL_STEAL = 5;

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

export function appendActionLog(state, message) {
  const nextLogs = [...(state.actionLogs ?? []), message];
  return {
    ...state,
    actionLogs: nextLogs.slice(-MAX_ACTION_LOGS),
  };
}

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function resolveRoll(state) {
  const effect = state.pendingPreRollEffect?.type ?? "normal";
  if (effect === "plus_two_roll") {
    const die = rollDie();
    return {
      dice: [die],
      bonus: 2,
      total: die + 2,
      effectType: "plus_two_roll",
    };
  }
  const die = rollDie();
  return {
    dice: [die],
    bonus: 0,
    total: die,
    effectType: "normal",
  };
}

export function consumePendingPreRollEffect(state) {
  return {
    ...state,
    pendingPreRollEffect: null,
  };
}

export function consumePendingDoubleRoll(state) {
  return {
    ...state,
    pendingDoubleRoll: null,
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
    lastRollResult: null,
    isRolling: false,
    turnPhase: "finished",
    preRollActionUsed: false,
    pendingPreRollEffect: null,
    pendingDoubleRoll: null,
    preRollChoiceResolved: false,
    preRollSelectedItemId: null,

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
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#22c55e",
    "#a855f7",
    "#f97316",
    "#14b8a6",
    "#eab308",
    "#ec4899",
    "#0ea5e9",
    "#84cc16",
  ];

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
    lastRollResult: null,
    isRolling: false,
    turnPhase: "pre_roll",
    preRollActionUsed: false,
    pendingPreRollEffect: null,
    pendingDoubleRoll: null,
    preRollChoiceResolved: false,
    preRollSelectedItemId: null,
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

function getBeforeRollInventoryForCurrentPlayer(state, socketId) {
  if (!isPlayersTurn(state, socketId)) return [];
  const cur = state.players[state.currentPlayerIndex];
  if (!cur) return [];
  const inv = Array.isArray(cur.inventory) ? cur.inventory : [];
  return inv.filter((item) => {
    const def = item ? SHOP_CATALOG[item.type] : null;
    return !!def && def.timing === "before_roll";
  });
}

function shouldRequirePreRollChoice(state, socketId) {
  if (!isPlayersTurn(state, socketId)) return false;
  if (state.pendingPreRollEffect || state.pendingDoubleRoll) return false;
  if (state.preRollChoiceResolved) return false;
  return getBeforeRollInventoryForCurrentPlayer(state, socketId).length > 0;
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
  if (shouldRequirePreRollChoice(state, socketId)) return state;

  let workingState = state;
  if (
    !workingState.pendingPreRollEffect &&
    !workingState.pendingDoubleRoll &&
    workingState.preRollSelectedItemId
  ) {
    const { state: consumedState, consumed } = consumeInventoryItem(
      {
        ...workingState,
        preRollSelectedItemId: null,
      },
      socketId,
      workingState.preRollSelectedItemId,
    );
    if (consumed?.type === "double_roll" || consumed?.type === "plus_two_roll") {
      workingState = appendActionLog(
        {
          ...consumedState,
          pendingPreRollEffect: { type: consumed.type },
          preRollActionUsed: true,
        },
        actionLogMessage.preRollEffectArmed(currentPlayerName(consumedState), consumed.type),
      );
      console.debug(`[retro-party] pre-roll item used: ${consumed.type}`);
    } else {
      workingState = consumedState;
    }
  }

  if (workingState.pendingPreRollEffect?.type === "double_roll") {
    const firstDie = Number(workingState.pendingDoubleRoll?.firstDie ?? 0);
    if (firstDie > 0) {
      const die2 = rollDie();
      const rollResult = {
        dice: [firstDie, die2],
        bonus: 0,
        total: firstDie + die2,
        effectType: "double_roll",
      };
      console.debug("[retro-party] rolling with effect: double_roll (second die)");
      console.debug(
        `[retro-party] roll result = ${JSON.stringify({ dice: rollResult.dice, bonus: rollResult.bonus, total: rollResult.total })}`,
      );
      const withLogs = appendActionLog(
        appendActionLog(
          workingState,
          actionLogMessage.rollSecondDieStart(currentPlayerName(workingState)),
        ),
        actionLogMessage.rollSecondDieResult(
          currentPlayerName(workingState),
          firstDie,
          die2,
          rollResult.total,
        ),
      );
      const clearedPreRoll = consumePendingPreRollEffect(withLogs);
      const next = consumePendingDoubleRoll(clearedPreRoll);
      return {
        ...next,
        diceValue: rollResult.total,
        lastRollResult: rollResult,
        isRolling: true,
        turnPhase: "rolling",
      };
    }

    const die1 = rollDie();
    const firstRollResult = {
      dice: [die1],
      bonus: 0,
      total: die1,
      effectType: "double_roll",
    };
    console.debug("[retro-party] rolling with effect: double_roll (first die)");
    console.debug(`[retro-party] first die result = ${die1}`);
    const withLogs = appendActionLog(
      appendActionLog(
        workingState,
        actionLogMessage.rollDoubleFirstDieStart(currentPlayerName(workingState)),
      ),
      actionLogMessage.rollDoubleFirstDieResult(currentPlayerName(workingState), die1),
    );
    return {
      ...withLogs,
      diceValue: null,
      lastRollResult: firstRollResult,
      isRolling: true,
      turnPhase: "rolling",
      pendingDoubleRoll: { firstDie: die1 },
    };
  }

  const rollResult = resolveRoll(workingState);
  console.debug(`[retro-party] rolling with effect: ${rollResult.effectType}`);
  if (!rollResult.dice.length) {
    console.error("[retro-party] invalid rollResult: empty dice", rollResult);
  }
  console.debug(
    `[retro-party] roll result = ${JSON.stringify({ dice: rollResult.dice, bonus: rollResult.bonus, total: rollResult.total })}`,
  );
  const withLogs = appendActionLog(
    appendActionLog(workingState, actionLogMessage.rollStart(currentPlayerName(workingState))),
    rollResult.bonus > 0
      ? actionLogMessage.rollResultWithBonus(
          currentPlayerName(workingState),
          rollResult.dice[0],
          rollResult.bonus,
          rollResult.total,
        )
      : actionLogMessage.rollResult(currentPlayerName(workingState), rollResult.total),
  );
  const next = consumePendingPreRollEffect(withLogs);
  return {
    ...next,
    diceValue: rollResult.total,
    lastRollResult: rollResult,
    isRolling: true,
    turnPhase: "rolling",
    pendingDoubleRoll: null,
  };
}

export function settleDice(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.pendingPreRollEffect?.type === "double_roll" && state.pendingDoubleRoll?.firstDie) {
    return { ...state, isRolling: false, turnPhase: "pre_roll" };
  }
  if (state.diceValue == null) return { ...state, isRolling: false };

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
  if (
    normalized === "blue" ||
    normalized === "green" ||
    normalized === "violet" ||
    normalized === "yellow"
  ) {
    return Math.max(0, currentPoints + 2);
  }
  return Math.max(0, currentPoints);
}

function getTilePointDelta(type) {
  const normalized = normalizeColorType(type);
  if (normalized === "red") return -2;
  if (
    normalized === "blue" ||
    normalized === "green" ||
    normalized === "violet" ||
    normalized === "yellow"
  )
    return 2;
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
    const options = rawOptions.length > 1 ? rawOptions.filter((id) => id !== previous) : rawOptions;
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
      normalizeColorType(tile.type) !== "start",
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
    (player, idx) => idx !== state.currentPlayerIndex && player.position === curPlayer.position,
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

  if (collidedPlayer) {
    return startPointDuel(withBonus, curPlayer.id, collidedPlayer.id);
  }

  return buildQuestionStateForCurrentPlayer(withBonus, players);
}

function buildQuestionStateForCurrentPlayer(state, players) {
  const curPlayer = players[state.currentPlayerIndex];
  const tile = state.tiles[curPlayer.position];
  if (!tile) {
    return {
      ...state,
      players,
      currentMinigame: null,
      currentQuestion: null,
      turnPhase: "resolving",
    };
  }
  const seed = (state.board?.seed ?? 0) + curPlayer.position + state.currentRound * 1000;
  const rng = mulberry32(seed);
  const type = tile.type === "bonus" ? "bonus" : tile.type;
  const normalizedType =
    type === "purple" ? "violet" : type === "star" || type === "yellow" ? "bonus" : type;
  const usedQuestionTexts = [
    ...(Array.isArray(state.questionHistory)
      ? state.questionHistory.map((entry) => entry?.text)
      : []),
    state.currentQuestion?.text ?? null,
  ].filter((entry) => typeof entry === "string" && entry.length > 0);
  const usedQuestionSet = new Set(usedQuestionTexts);
  const customPool = Array.isArray(state.templateCustomQuestions)
    ? state.templateCustomQuestions.filter((q) => {
        if (!q || q.isActive === false || typeof q.text !== "string") return false;
        if (usedQuestionSet.has(q.text)) return false;
        if (!q.category) return true;
        const normalizedCategory =
          q.category === "purple"
            ? "violet"
            : q.category === "star" || q.category === "yellow"
              ? "bonus"
              : q.category;
        return normalizedCategory === normalizedType;
      })
    : [];
  const customText = customPool.length
    ? (customPool[Math.floor(rng() * customPool.length)]?.text ?? "")
    : "";
  const text =
    customText ||
    pickUniqueQuestion(type, usedQuestionTexts, rng) ||
    "(Plus de questions disponibles)";
  const qId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    ...state,
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

export function startPointDuel(state, firstPlayerId, secondPlayerId, now = Date.now()) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion || state.currentMinigame) return state;
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.pendingShop) return state;

  const playerA = state.players.find((p) => p.id === firstPlayerId);
  const playerB = state.players.find((p) => p.id === secondPlayerId);
  if (!playerA || !playerB || playerA.id === playerB.id) return state;

  return appendActionLog(
    {
      ...state,
      currentQuestion: null,
      currentMinigame: {
        minigameId: "POINT_DUEL",
        phase: "announce",
        attackerId: playerA.id,
        defenderId: playerB.id,
        attackerRoll: null,
        defenderRoll: null,
        winnerId: null,
        stolenPoints: 0,
        startedAt: now,
        nextStepAt: now + POINT_DUEL_ANNOUNCE_MS,
      },
      turnPhase: "resolving",
    },
    actionLogMessage.pointDuelStart(playerA.name, playerB.name),
  );
}

function isPointDuelActiveState(state) {
  return state.currentMinigame?.minigameId === "POINT_DUEL";
}

function resolvePointDuelResult(players, attackerId, defenderId, attackerRoll, defenderRoll) {
  const attacker = players.find((p) => p.id === attackerId);
  const defender = players.find((p) => p.id === defenderId);
  if (!attacker || !defender) {
    return { players, winnerId: null, stolenPoints: 0 };
  }

  if (attackerRoll === defenderRoll) {
    return { players, winnerId: null, stolenPoints: 0 };
  }

  const winner = attackerRoll > defenderRoll ? attacker : defender;
  const loser = winner.id === attacker.id ? defender : attacker;
  const available = Math.max(0, Math.floor(Number(loser.points ?? 0)));
  const stolen = Math.min(POINT_DUEL_STEAL, available);
  loser.points = Math.max(0, available - stolen);
  winner.points = Math.max(0, Math.floor(Number(winner.points ?? 0) + stolen));
  return { players, winnerId: winner.id, stolenPoints: stolen };
}

export function resolvePointDuelStep(state, now = Date.now()) {
  if (!isPointDuelActiveState(state)) return state;
  const duel = state.currentMinigame;
  if (!duel.nextStepAt || now < duel.nextStepAt) return state;

  if (duel.phase === "announce") {
    return {
      ...state,
      currentMinigame: {
        ...duel,
        phase: "waiting_attacker_roll",
        nextStepAt: null,
      },
    };
  }

  if (duel.phase === "show_attacker_roll") {
    return {
      ...state,
      currentMinigame: {
        ...duel,
        phase: "waiting_defender_roll",
        nextStepAt: null,
      },
    };
  }

  if (duel.phase === "show_defender_roll") {
    const players = state.players.map((p) => ({ ...p }));
    const attackerRoll = Math.max(1, Math.floor(Number(duel.attackerRoll ?? 1)));
    const defenderRoll = Math.max(1, Math.floor(Number(duel.defenderRoll ?? 1)));
    const result = resolvePointDuelResult(
      players,
      duel.attackerId,
      duel.defenderId,
      attackerRoll,
      defenderRoll,
    );
    const winnerName = result.winnerId
      ? (players.find((p) => p.id === result.winnerId)?.name ?? "Gagnant")
      : "Egalite";
    const loserName =
      result.winnerId == null
        ? null
        : (players.find(
            (p) =>
              p.id !== result.winnerId && (p.id === duel.attackerId || p.id === duel.defenderId),
          )?.name ?? null);

    const withResult = {
      ...state,
      players,
      currentMinigame: {
        ...duel,
        phase: "result",
        winnerId: result.winnerId,
        stolenPoints: result.stolenPoints,
        nextStepAt: now + POINT_DUEL_RESULT_MS,
      },
    };
    if (!result.winnerId) {
      return appendActionLog(withResult, actionLogMessage.pointDuelTie());
    }
    return appendActionLog(
      withResult,
      actionLogMessage.pointDuelSteal(winnerName, result.stolenPoints, loserName),
    );
  }

  if (duel.phase === "result") {
    return completePointDuel(state);
  }

  return state;
}

export function rollPointDuelDie(state, socketId, now = Date.now()) {
  if (!isPointDuelActiveState(state)) return state;
  const duel = state.currentMinigame;
  const attackerName = playerName(state, duel.attackerId, "Attaquant");
  const defenderName = playerName(state, duel.defenderId, "Defenseur");

  if (duel.phase === "waiting_attacker_roll") {
    if (duel.attackerId !== socketId) return state;
    const attackerRoll = rollDie();
    return appendActionLog(
      {
        ...state,
        currentMinigame: {
          ...duel,
          phase: "show_attacker_roll",
          attackerRoll,
          nextStepAt: now + POINT_DUEL_ROLL_REVEAL_MS,
        },
      },
      actionLogMessage.pointDuelAttackerRoll(attackerName, attackerRoll),
    );
  }

  if (duel.phase === "waiting_defender_roll") {
    if (duel.defenderId !== socketId) return state;
    const defenderRoll = rollDie();
    return appendActionLog(
      {
        ...state,
        currentMinigame: {
          ...duel,
          phase: "show_defender_roll",
          defenderRoll,
          nextStepAt: now + POINT_DUEL_ROLL_REVEAL_MS,
        },
      },
      actionLogMessage.pointDuelDefenderRoll(defenderName, defenderRoll),
    );
  }

  return state;
}

export function completePointDuel(state) {
  if (!isPointDuelActiveState(state)) return state;
  const players = state.players.map((p) => ({ ...p }));
  const cleared = {
    ...state,
    players,
    currentMinigame: null,
    currentQuestion: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    turnPhase: "resolving",
  };
  return buildQuestionStateForCurrentPlayer(cleared, players);
}

export function movePlayer(state, socketId, steps) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (state.diceValue == null) return state;
  // Use authoritative server roll value to guarantee pre-roll bonuses are applied.
  const numericSteps = Math.max(0, Math.floor(Number(state.diceValue) || 0));
  if (numericSteps <= 0) return state;
  console.debug(`[retro-party] moving player with total roll: ${numericSteps}`);
  const activePlayerName = currentPlayerName(state);
  const loggedState = appendActionLog(
    state,
    actionLogMessage.moveStart(activePlayerName, numericSteps),
  );

  const players = loggedState.players.map((p) => ({ ...p }));
  const cur = players[state.currentPlayerIndex];
  const moved = advancePlayerAlongBoard(loggedState, cur, numericSteps);

  if (!moved.finished) {
    const withPending = {
      ...loggedState,
      players,
      isRolling: false,
      diceValue: null,
      lastMoveTrace: moved.moveTrace,
      pendingPathChoice: moved.pendingPathChoice,
      pendingKudoPurchase: moved.pendingKudoPurchase,
      pendingShop: moved.pendingShop,
      turnPhase: "resolving",
    };
    if (moved.pendingPathChoice) {
      return appendActionLog(withPending, actionLogMessage.moveIntersection(activePlayerName));
    }
    if (moved.pendingKudoPurchase) {
      return appendActionLog(withPending, actionLogMessage.moveKudobox(activePlayerName));
    }
    if (moved.pendingShop) {
      return appendActionLog(withPending, actionLogMessage.moveShop(activePlayerName));
    }
    return withPending;
  }
  const landedTileType = state.tiles[cur.position]?.type;
  return appendActionLog(
    {
      ...buildLandingState(loggedState, players),
      lastMoveTrace: moved.moveTrace,
    },
    actionLogMessage.moveFinished(activePlayerName, landedTileType),
  );
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
    nextTileId,
  );

  if (!moved.finished) {
    const withPending = {
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
    return appendActionLog(withPending, actionLogMessage.pathContinue(cur.name));
  }
  return appendActionLog(
    {
      ...buildLandingState(state, players),
      lastMoveTrace: moved.moveTrace,
    },
    actionLogMessage.pathValidated(cur.name),
  );
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
  const canBuyKudo = cur.points >= KUDO_COST;
  const didBuyKudo = !!buyKudo && canBuyKudo;

  if (didBuyKudo) {
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
      return nextTurn(
        appendActionLog(
          cleared,
          didBuyKudo
            ? actionLogMessage.kudoConverted(cur.name, KUDO_COST)
            : actionLogMessage.kudoPassed(cur.name),
        ),
      );
    }
    return appendActionLog(
      {
        ...buildLandingState(stateWithTiles, players),
        pendingKudoPurchase: null,
      },
      didBuyKudo ? actionLogMessage.kudoBought(cur.name) : actionLogMessage.kudoSkipped(cur.name),
    );
  }

  const moved = advancePlayerAlongBoard(stateWithTiles, cur, remaining);
  if (!moved.finished) {
    const withPending = {
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
    return appendActionLog(
      withPending,
      didBuyKudo
        ? actionLogMessage.kudoBoughtAndContinue(cur.name)
        : actionLogMessage.kudoRefusedAndContinue(cur.name),
    );
  }
  return appendActionLog(
    {
      ...buildLandingState(stateWithTiles, players),
      pendingKudoPurchase: null,
      lastMoveTrace: moved.moveTrace,
    },
    didBuyKudo ? actionLogMessage.kudoBought(cur.name) : actionLogMessage.kudoSkipped(cur.name),
  );
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
  const nextState = {
    ...state,
    currentQuestion: {
      ...state.currentQuestion,
      status: "open",
    },
  };
  return appendActionLog(nextState, actionLogMessage.questionOpened(playerName(state, socketId)));
}

export function voteQuestion(state, socketId, vote) {
  if (state.currentMinigame) return state;
  if (state.pendingPathChoice) return state;
  if (state.pendingKudoPurchase) return state;
  if (state.pendingShop) return state;
  if (!state.currentQuestion || state.currentQuestion.status !== "open") return state;
  if (vote !== "up" && vote !== "down") return state;

  const q = {
    ...state.currentQuestion,
    votes: { up: [...state.currentQuestion.votes.up], down: [...state.currentQuestion.votes.down] },
  };

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
    return appendActionLog(
      {
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
      },
      actionLogMessage.questionValidatedWithBugSmash(playerName(state, socketId)),
    );
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
  return nextTurn(
    appendActionLog(
      cleared,
      actionLogMessage.questionValidated(
        playerName(state, socketId),
        state.currentQuestion.votes.up.length,
        state.currentQuestion.votes.down.length,
      ),
    ),
  );
}

export function openShopForPlayer(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  const cur = state.players[state.currentPlayerIndex];
  if (!cur) return state;
  const tile = state.tiles[cur.position];
  if (!tile || String(tile.type).toLowerCase() !== "shop") return state;
  if (
    state.pendingPathChoice ||
    state.pendingKudoPurchase ||
    state.currentQuestion ||
    state.currentMinigame
  ) {
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
  const cur = players[state.currentPlayerIndex];
  const withLog = appendActionLog(state, actionLogMessage.shopClosed(cur?.name ?? "Joueur"));
  return continueFromPendingShop(withLog, players, socketId);
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
    actionLogMessage.shopBoughtItem(cur.name, catalogEntry.label, catalogEntry.cost),
  );
  return continueFromPendingShop(logged, players, socketId);
}

export function getUsableItemsForTurn(state, socketId) {
  if (state.phase !== "playing") return [];
  if (!isPlayersTurn(state, socketId)) return [];
  if (state.turnPhase !== "pre_roll") return [];
  if (state.preRollActionUsed) return [];
  if (
    state.pendingPathChoice ||
    state.pendingKudoPurchase ||
    state.pendingShop ||
    state.currentQuestion ||
    state.currentMinigame
  ) {
    return [];
  }
  const cur = state.players[state.currentPlayerIndex];
  if (!cur || cur.id !== socketId) return [];
  const inv = Array.isArray(cur.inventory) ? cur.inventory : [];
  return inv.filter((item) => {
    const def = item ? SHOP_CATALOG[item.type] : null;
    return !!def && def.timing === "before_roll";
  });
}

export function resolvePreRollChoice(state, socketId, itemInstanceId = null) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.turnPhase !== "pre_roll") return state;
  if (state.currentQuestion || state.currentMinigame) return state;
  if (state.pendingPathChoice || state.pendingKudoPurchase || state.pendingShop) return state;
  if (state.pendingPreRollEffect || state.pendingDoubleRoll) return state;

  const usableItems = getBeforeRollInventoryForCurrentPlayer(state, socketId);
  const curName = currentPlayerName(state);
  if (usableItems.length === 0) {
    return {
      ...state,
      preRollChoiceResolved: true,
      preRollSelectedItemId: null,
    };
  }

  if (!itemInstanceId) {
    return appendActionLog(
      {
        ...state,
        preRollChoiceResolved: true,
        preRollSelectedItemId: null,
      },
      actionLogMessage.preRollNoItem(curName),
    );
  }

  const selected = usableItems.find((item) => item.id === itemInstanceId);
  if (!selected) return state;
  const selectedLabel = SHOP_CATALOG[selected.type]?.label ?? "objet";
  return appendActionLog(
    {
      ...state,
      preRollChoiceResolved: true,
      preRollSelectedItemId: selected.id,
    },
    actionLogMessage.preRollPreparedItem(curName, selectedLabel),
  );
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
  if (
    state.pendingPathChoice ||
    state.pendingKudoPurchase ||
    state.pendingShop ||
    state.currentQuestion ||
    state.currentMinigame
  ) {
    return state;
  }

  const previewPlayer = state.players[state.currentPlayerIndex];
  if (!previewPlayer || previewPlayer.id !== socketId) return state;
  const previewItem = (Array.isArray(previewPlayer.inventory) ? previewPlayer.inventory : []).find(
    (item) => item.id === itemInstanceId,
  );
  if (!previewItem) return state;
  const previewDef = SHOP_CATALOG[previewItem.type];
  if (!previewDef || previewDef.timing !== "before_roll") return state;

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
    pendingDoubleRoll: null,
  };

  if (consumed.type === "double_roll" || consumed.type === "plus_two_roll") {
    console.debug(`[retro-party] pre-roll item used: ${consumed.type}`);
    nextState = {
      ...nextState,
      pendingPreRollEffect: { type: consumed.type },
      pendingDoubleRoll: null,
      turnPhase: "pre_roll",
    };
    console.debug(`[retro-party] pending effect set: ${consumed.type}`);
    return appendActionLog(nextState, actionLogMessage.itemActivated(cur.name, itemDef.label));
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
      actionLogMessage.itemUsedOnTarget(cur.name, itemDef.label, target.name),
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
      actionLogMessage.itemStolePoints(cur.name, stolen, target.name),
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
      pendingPreRollEffect: null,
      pendingDoubleRoll: null,
    };
    return appendActionLog(nextState, actionLogMessage.itemTeleportStar(cur.name, itemDef.label));
  }

  return state;
}

export const applyPreRollItem = useShopItem;

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
  // Skip players who are flagged skipNextTurn OR currently disconnected
  // (soft-leave). When a disconnected player reconnects, they reclaim
  // their slot at the next free turn cycle.
  while (
    (players[nextIndex]?.skipNextTurn || players[nextIndex]?.disconnected) &&
    safety < players.length
  ) {
    if (players[nextIndex].skipNextTurn) {
      players[nextIndex].skipNextTurn = false;
    }
    nextIndex += 1;
    if (nextIndex >= players.length) {
      nextIndex = 0;
      nextRound += 1;
    }
    safety += 1;
  }

  if (nextRound > state.maxRounds) {
    return appendActionLog(
      {
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
        pendingPreRollEffect: null,
        pendingDoubleRoll: null,
        preRollChoiceResolved: true,
        preRollSelectedItemId: null,
      },
      actionLogMessage.gameFinished(),
    );
  }
  return appendActionLog(
    {
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
      pendingPreRollEffect: null,
      pendingDoubleRoll: null,
      preRollChoiceResolved: false,
      preRollSelectedItemId: null,
    },
    actionLogMessage.nextTurn(players[nextIndex]?.name, nextRound, state.maxRounds),
  );
}

export function resetGame() {
  return createInitialState();
}

function getBuzzwordDuelists(minigame) {
  return Array.isArray(minigame.duelists) && minigame.duelists.length === 2
    ? minigame.duelists
    : null;
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
  if (
    (minigame.phase !== "word" && minigame.phase !== "sudden_death") ||
    now < minigame.wordEndsAt
  ) {
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
      [playerA]:
        (minigame.scores[playerA] ?? 0) +
        (answerA === minigame._currentCorrectCategory ? points : 0),
      [playerB]:
        (minigame.scores[playerB] ?? 0) +
        (answerB === minigame._currentCorrectCategory ? points : 0),
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
          now,
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
          now,
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
  if (minigame.phase !== "between" || !minigame.nextWordAt || now < minigame.nextWordAt)
    return state;

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

  const nextWord = minigame._nextMainWord ?? {
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
  return nextTurn(
    appendActionLog(
      cleared,
      actionLogMessage.bugSmashCompleted(target.name, clampedScore, starsEarned),
    ),
  );
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
