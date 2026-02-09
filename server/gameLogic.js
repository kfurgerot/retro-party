// server/gameLogic.js
// Retro Party - Retrospective board game logic (online).
// Server authoritative: generates board + questions and advances turns.

import { generateRandomBoard } from "./boardGenerator.js";
import { pickQuestion, QUESTIONS } from "./questions.js";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createInitialState() {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 20, rows: 6, length: 45 });

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

    // question flow
    currentQuestion: null, // { id, type, text, targetPlayerId, votes: { up: [], down: [] }, status:"open" }
    questionHistory: [],
  };
}

export function regenerateBoard(state) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 20, rows: 6, length: 45 });
  return {
    ...state,
    board: { seed: board.seed, cols: board.cols, rows: board.rows, length: board.length },
    tiles: board.tiles ?? [],
  };
}

export function initializePlayers(state, lobbyPlayers) {
  const colors = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#0ea5e9", "#84cc16"];

  const players = lobbyPlayers.map((p, idx) => ({
    id: p.socketId,
    name: p.name,
    avatar: p.avatar ?? 0,
    position: 0,
    stars: 0, // kudobox points
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
    diceValue: null,
    isRolling: false,
    currentQuestion: null,
    questionHistory: [],
  };
}

function isPlayersTurn(state, socketId) {
  const cur = state.players[state.currentPlayerIndex];
  return !!cur && cur.id === socketId;
}

export function rollDice(state, socketId) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion) return state; // wait for question validation
  if (!isPlayersTurn(state, socketId)) return state;

  // rolling animation: set isRolling true and diceValue immediately
  const dice = 1 + Math.floor(Math.random() * 6);
  return {
    ...state,
    diceValue: dice,
    isRolling: true,
  };
}

export function settleDice(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.diceValue == null) return state;

  return { ...state, isRolling: false };
}

export function movePlayer(state, socketId, steps) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.currentQuestion) return state;
  if (typeof steps !== "number" || steps <= 0) return state;
  if (state.diceValue == null) return state;

  const tilesLen = state.tiles.length || 1;
  const players = state.players.map(p => ({ ...p }));
  const cur = players[state.currentPlayerIndex];

  cur.position = (cur.position + steps) % tilesLen;

  return {
    ...state,
    players,
  };
}

export function onPlayerLanded(state, socketId) {
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.currentQuestion) return state;

  const curPlayer = state.players[state.currentPlayerIndex];
  const tile = state.tiles[curPlayer.position];
  if (!tile) return state;

  const type = tile.type === "bonus" ? "bonus" : tile.type; // blue/green/red/violet/start/bonus
  const seed = (state.board?.seed ?? 0) + curPlayer.position + state.currentRound * 1000;
  const rng = mulberry32(seed);

  const text = pickQuestion(type, rng) || "(Question manquante)";

  const qId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const players = state.players.map(p => ({ ...p }));
  // bonus awards a star immediately (kudobox)
  if (type === "bonus") {
    players[state.currentPlayerIndex].stars += 1;
  }

  return {
    ...state,
    players,
    isRolling: false,
    currentQuestion: {
      id: qId,
      type,
      text,
      targetPlayerId: curPlayer.id,
      votes: { up: [], down: [] },
      status: "pending",
    },
  };
}

export function openQuestion(state, socketId) {
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
  if (!state.currentQuestion || state.currentQuestion.status !== "open") return state;
  if (vote !== "up" && vote !== "down") return state;

  const q = { ...state.currentQuestion, votes: { up: [...state.currentQuestion.votes.up], down: [...state.currentQuestion.votes.down] } };

  // Remove existing vote
  q.votes.up = q.votes.up.filter(id => id !== socketId);
  q.votes.down = q.votes.down.filter(id => id !== socketId);

  // Add new vote
  q.votes[vote].push(socketId);

  return { ...state, currentQuestion: q };
}

export function validateQuestion(state, socketId) {
  if (!state.currentQuestion || state.currentQuestion.status !== "open") return state;
  // Only the target player (the one who landed) can validate
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

  // Close question and advance turn
  const cleared = {
    ...state,
    currentQuestion: null,
    diceValue: null,
    isRolling: false,
    questionHistory,
  };
  return nextTurn(cleared);
}

export function nextTurn(state) {
  if (state.phase !== "playing") return state;
  if (state.players.length === 0) return state;
  if (state.currentQuestion) return state; // do not advance while question is open

  let players = state.players.map(p => ({ ...p }));
  let nextIndex = state.currentPlayerIndex + 1;
  let nextRound = state.currentRound;

  if (nextIndex >= players.length) {
    nextIndex = 0;
    nextRound = state.currentRound + 1;
  }

  // Skip logic (consume skipNextTurn once)
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

  // End game condition
  if (nextRound > state.maxRounds) {
    return {
      ...state,
      phase: "results",
      players,
      currentRound: state.maxRounds,
      currentPlayerIndex: state.currentPlayerIndex,
      diceValue: null,
      isRolling: false,
    };
  }

  return {
    ...state,
    players,
    currentPlayerIndex: nextIndex,
    currentRound: nextRound,
    diceValue: null,
    isRolling: false,
  };
}

export function resetGame(state) {
  const reset = createInitialState();
  // keep same players? for simplicity keep lobby
  return { ...reset };
}
