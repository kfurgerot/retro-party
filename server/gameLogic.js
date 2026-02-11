// server/gameLogic.js
// Retro Party - Retrospective board game logic (online).
// Server authoritative: generates board + questions and advances turns.

import { generateRandomBoard } from "./boardGenerator.js";
import { pickQuestion } from "./questions.js";
import { BUZZWORD_DUEL_BANK } from "./buzzwordBank.js";

const BUG_SMASH_DURATION_MS = 20000;
const BUG_SMASH_ANNOUNCE_MS = 4000;

const BUZZWORD_MAIN_WORDS = 10;
const BUZZWORD_WORD_DURATION_MS = 3000;
const BUZZWORD_BETWEEN_WORDS_MS = 500;
const BUZZWORD_ANNOUNCE_MS = 4000;
const BUZZWORD_TRANSFER_ANIMATION_MS = 1800;
const BUZZWORD_MAX_STEAL = 5;

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
    currentQuestion: null,
    currentMinigame: null,
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
    stars: 0,
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
    currentMinigame: null,
    questionHistory: [],
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
  if (!isPlayersTurn(state, socketId)) return state;

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
  if (state.currentMinigame) return state;
  if (typeof steps !== "number" || steps <= 0) return state;
  if (state.diceValue == null) return state;

  const tilesLen = state.tiles.length || 1;
  const players = state.players.map((p) => ({ ...p }));
  const cur = players[state.currentPlayerIndex];
  const lastTileIndex = Math.max(0, tilesLen - 1);

  cur.position = Math.min(cur.position + steps, lastTileIndex);

  return {
    ...state,
    players,
  };
}

export function startBuzzwordDuel(state, firstPlayerId, secondPlayerId, now = Date.now()) {
  if (state.phase !== "playing") return state;
  if (state.currentQuestion || state.currentMinigame) return state;

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
  if (state.phase !== "playing") return state;
  if (!isPlayersTurn(state, socketId)) return state;
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;

  const players = state.players.map((p) => ({ ...p }));
  const curPlayer = players[state.currentPlayerIndex];
  const tile = state.tiles[curPlayer.position];
  if (!tile) return state;

  const collidedPlayer = players.find(
    (player, idx) => idx !== state.currentPlayerIndex && player.position === curPlayer.position
  );

  const type = tile.type === "bonus" ? "bonus" : tile.type;
  if (type === "bonus") {
    players[state.currentPlayerIndex].stars += 1;
  }

  const withBonus = {
    ...state,
    players,
    isRolling: false,
    diceValue: null,
  };

  if (collidedPlayer) {
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
      nextMinigame: type === "red" ? "BUG_SMASH" : null,
    },
  };
}

export function openQuestion(state, socketId) {
  if (state.currentMinigame) return state;
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

  if (state.currentQuestion.nextMinigame === "BUG_SMASH") {
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
    };
  }

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
  if (state.currentQuestion) return state;
  if (state.currentMinigame) return state;

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

export function resetGame() {
  return createInitialState();
}

function getBuzzwordDuelists(minigame) {
  return Array.isArray(minigame.duelists) && minigame.duelists.length === 2 ? minigame.duelists : null;
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
  const players = state.players.map((p) => ({ ...p }));
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
