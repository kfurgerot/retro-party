import express from "express";
import http from "http";
import cors from "cors";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { initDatabase, pool } from "./db.js";
import { registerApiRoutes } from "./restApi.js";
import {
  createInitialState,
  initializePlayers,
  rollDice,
  settleDice,
  movePlayer,
  choosePath,
  resolveKudoPurchase,
  openShopForPlayer,
  closeShopForPlayer,
  buyShopItem,
  useShopItem,
  resolvePreRollChoice,
  completeBugSmash,
  updateBugSmashProgress,
  openQuestion,
  voteQuestion,
  validateQuestion,
  nextTurn,
  resetGame,
  submitBuzzwordAnswer,
  resolveBuzzwordWord,
  maybeStartBuzzwordNextWord,
  completeBuzzwordTransfer,
  getBuzzwordTransferDelayMs,
  resolvePointDuelStep,
  rollPointDuelDie,
} from "./gameLogic.js";
import {
  WHO_SAID_IT_MINIGAME_ID,
  applyWhoSaidItPointsToState,
  advanceWhoSaidItSession,
  createWhoSaidItSession,
  getWhoSaidItEndPayload,
  getWhoSaidItStartPayload,
  remapWhoSaidItPlayerId,
  removeWhoSaidItPlayer,
  revealWhoSaidItRound,
  startWhoSaidItRound,
  submitWhoSaidItAnswer,
} from "./whoSaidItEngine.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) > 0
  ? Number(process.env.RECONNECT_GRACE_MS)
  : 20 * 60 * 1000;
const MAX_PLAYERS = 20;
const PLAYER_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#0ea5e9", "#84cc16"];
const WHO_SAID_IT_ANNOUNCE_MS = 4000;
const ENABLE_WHO_SAID_IT_MINIGAME = process.env.ENABLE_WHO_SAID_IT_MINIGAME === "1";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOW_PRIVATE_LAN_ORIGINS = process.env.ALLOW_PRIVATE_LAN_ORIGINS !== "0";

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;

  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

function isLocalDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") {
      return true;
    }
    return isPrivateIpv4(parsed.hostname);
  } catch (_err) {
    return false;
  }
}

function getAllowedOrigins() {
  const raw = process.env.ORIGIN;
  const configured = (raw ? raw.split(",") : ["http://localhost:8088", "http://127.0.0.1:8088"])
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = [];

  for (const origin of configured) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        allowed.push(parsed.origin);
      }
    } catch (_err) {
      // Ignore invalid origin values from env.
    }
  }

  if (allowed.length === 0) {
    allowed.push("http://localhost:8088");
  }

  return new Set(allowed);
}

const ALLOWED_ORIGINS = getAllowedOrigins();

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (ALLOW_PRIVATE_LAN_ORIGINS && isLocalDevOrigin(origin)) return true;
  return !IS_PRODUCTION && isLocalDevOrigin(origin);
}

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

function makeCode() {
  return crypto.randomInt(36 ** 4).toString(36).toUpperCase().padStart(4, "0");
}

function makeSessionId() {
  return `session-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

function pickNextPlayerColor(players = []) {
  const blocked = new Set((players ?? []).map((p) => p?.color).filter(Boolean));
  const firstAvailable = PLAYER_COLORS.find((color) => !blocked.has(color));
  if (firstAvailable) return firstAvailable;
  return PLAYER_COLORS[(players?.length ?? 0) % PLAYER_COLORS.length];
}

const rooms = new Map(); // code -> { state, hostSocketId, clients, lobby, disconnectTimers }
const socketToRoom = new Map(); // socketId -> code
const pokerRooms = new Map(); // code -> { code, phase, voteSystem, round, revealed, hostSocketId, clients, lobby, disconnectTimers }
const socketToPokerRoom = new Map(); // socketId -> code
const POKER_VOTE_SYSTEMS = new Set(["fibonacci", "man-day", "tshirt"]);
const POKER_MAX_PLAYERS = 20;

function makeUniqueRoomCode() {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode();
    if (!rooms.has(code) && !pokerRooms.has(code)) return code;
  }
  throw new Error("Unable to generate room code");
}

function normalizePokerRole(role) {
  return role === "spectator" ? "spectator" : "player";
}

function normalizePokerVoteSystem(value) {
  return POKER_VOTE_SYSTEMS.has(value) ? value : "fibonacci";
}

function createPokerRoom({
  code,
  hostSocketId = null,
  sessionId = null,
  name = "Host",
  avatar = 0,
  role = "player",
  voteSystem = "fibonacci",
} = {}) {
  if (pokerRooms.has(code)) return pokerRooms.get(code);

  const hasHost = Boolean(hostSocketId);
  const room = {
    code,
    phase: "lobby",
    storyTitle: "Story #1",
    voteSystem: normalizePokerVoteSystem(voteSystem),
    votesOpen: false,
    round: 1,
    revealed: false,
    hostSocketId,
    clients: hasHost ? new Set([hostSocketId]) : new Set(),
    disconnectTimers: new Map(),
    lobby: hasHost
      ? [
          {
            socketId: hostSocketId,
            sessionId,
            name,
            avatar,
            isHost: true,
            connected: true,
            role: normalizePokerRole(role),
            hasVoted: false,
            vote: null,
          },
        ]
      : [],
  };

  pokerRooms.set(code, room);
  return room;
}

function syncPokerHostFlags(room) {
  if (!room) return;
  if (room.hostSocketId && !room.lobby.some((player) => player.socketId === room.hostSocketId && player.connected !== false)) {
    const nextHost = room.lobby.find((player) => player.connected !== false) ?? room.lobby[0] ?? null;
    room.hostSocketId = nextHost?.socketId ?? null;
  }
  room.lobby = room.lobby.map((player) => ({
    ...player,
    isHost: !!room.hostSocketId && player.socketId === room.hostSocketId,
  }));
}

function sanitizePokerState(room) {
  return {
    phase: room.phase,
    roomCode: room.code,
    storyTitle: room.storyTitle || `Story #${room.round ?? 1}`,
    voteSystem: room.voteSystem,
    votesOpen: !!room.votesOpen,
    revealed: room.revealed,
    round: room.round,
    updatedAt: Date.now(),
    players: room.lobby.map((player) => ({
      socketId: player.socketId,
      name: player.name,
      avatar: player.avatar,
      isHost: player.isHost,
      connected: player.connected !== false,
      role: normalizePokerRole(player.role),
      hasVoted: !!player.hasVoted,
      vote: player.vote ?? null,
    })),
  };
}

function broadcastPokerState(code) {
  const room = pokerRooms.get(code);
  if (!room) return;
  io.to(code).emit("poker_state_update", sanitizePokerState(room));
}

function broadcastPokerLobby(code) {
  const room = pokerRooms.get(code);
  if (!room) return;
  io.to(code).emit("poker_lobby_update", {
    players: room.lobby.map((player) => ({
      socketId: player.socketId,
      name: player.name,
      avatar: player.avatar,
      isHost: player.isHost,
      connected: player.connected !== false,
      role: normalizePokerRole(player.role),
      hasVoted: !!player.hasVoted,
      vote: player.vote ?? null,
    })),
  });
}

function clearPokerDisconnectTimer(room, sessionId) {
  if (!room || !sessionId) return;
  const timer = room.disconnectTimers.get(sessionId);
  if (!timer) return;
  clearTimeout(timer);
  room.disconnectTimers.delete(sessionId);
}

function closePokerRoomForAll(code, reason = "Session Planning Poker fermee") {
  const room = pokerRooms.get(code);
  if (!room) return;

  io.to(code).emit("poker_room_closed", { message: reason });
  room.disconnectTimers.forEach((timer) => clearTimeout(timer));
  room.disconnectTimers.clear();

  room.clients.forEach((clientId) => {
    socketToPokerRoom.delete(clientId);
    const clientSocket = io.sockets.sockets.get(clientId);
    if (clientSocket) clientSocket.leave(code);
  });

  pokerRooms.delete(code);
}

function removePokerPlayerNow(code, socketId) {
  const room = pokerRooms.get(code);
  if (!room) return;

  if (room.hostSocketId === socketId) {
    closePokerRoomForAll(code);
    return;
  }

  room.clients.delete(socketId);
  socketToPokerRoom.delete(socketId);

  const index = room.lobby.findIndex((player) => player.socketId === socketId);
  if (index >= 0) {
    const player = room.lobby[index];
    clearPokerDisconnectTimer(room, player.sessionId);
    room.lobby.splice(index, 1);
  }

  syncPokerHostFlags(room);

  if (room.lobby.length === 0 && room.clients.size === 0) {
    pokerRooms.delete(code);
    return;
  }

  broadcastPokerLobby(code);
  broadcastPokerState(code);
}

function schedulePokerDisconnectCleanup(code, socketId, sessionId) {
  const room = pokerRooms.get(code);
  if (!room || !sessionId) return;

  clearPokerDisconnectTimer(room, sessionId);
  const timer = setTimeout(() => {
    const activeRoom = pokerRooms.get(code);
    if (!activeRoom) return;

    const stillDisconnected = activeRoom.lobby.find(
      (player) => player.sessionId === sessionId && player.socketId === socketId && player.connected === false
    );
    if (!stillDisconnected) return;
    removePokerPlayerNow(code, socketId);
  }, RECONNECT_GRACE_MS);

  room.disconnectTimers.set(sessionId, timer);
}

function attachSocketToExistingPokerPlayer(code, room, player, socket) {
  const oldSocketId = player.socketId;
  if (oldSocketId && oldSocketId !== socket.id) {
    room.clients.delete(oldSocketId);
    socketToPokerRoom.delete(oldSocketId);
    if (room.hostSocketId === oldSocketId) {
      room.hostSocketId = socket.id;
    }
  }

  player.socketId = socket.id;
  player.connected = true;
  delete player.disconnectedAt;

  room.clients.add(socket.id);
  socketToPokerRoom.set(socket.id, code);
  socket.join(code);
  clearPokerDisconnectTimer(room, player.sessionId);
  syncPokerHostFlags(room);
}

function createRuntimeRoom({
  code,
  hostSocketId = null,
  sessionId = null,
  name = "Host",
  avatar = 0,
  configSnapshot = null,
  mode = "quick",
  sourceTemplateId = null,
  createdByUserId = null,
} = {}) {
  if (rooms.has(code)) return rooms.get(code);

  const initialState = createInitialState();
  const customQuestions = Array.isArray(configSnapshot?.customQuestions)
    ? configSnapshot.customQuestions
        .filter((q) => q && typeof q.text === "string" && q.text.trim().length > 0)
        .map((q) => ({
          text: q.text.trim(),
          category: typeof q.category === "string" ? q.category.trim().toLowerCase() : null,
          isActive: q.isActive !== false,
        }))
    : [];

  initialState.templateCustomQuestions = customQuestions;

  const hasHost = Boolean(hostSocketId);
  const room = {
    state: initialState,
    hostSocketId,
    clients: hasHost ? new Set([hostSocketId]) : new Set(),
    disconnectTimers: new Map(),
    wsi: null,
    wsiTimers: new Set(),
    bwdTimers: new Set(),
    pointDuelTimers: new Set(),
    configSnapshot,
    mode,
    sourceTemplateId,
    createdByUserId,
    lobby: hasHost
      ? [
          {
            socketId: hostSocketId,
            sessionId,
            name,
            avatar,
            isHost: true,
            connected: true,
          },
        ]
      : [],
  };

  rooms.set(code, room);
  return room;
}

registerApiRoutes({
  app,
  pool,
  rooms,
  createRuntimeRoom,
  makeCode,
  isCodeReserved: (code) => pokerRooms.has(code),
});

function setWhoSaidItTimer(room, callback, delayMs) {
  const timeout = setTimeout(() => {
    room.wsiTimers.delete(timeout);
    callback();
  }, delayMs);
  room.wsiTimers.add(timeout);
  return timeout;
}

function clearWhoSaidItTimers(room) {
  if (!room?.wsiTimers) return;
  room.wsiTimers.forEach((timeout) => clearTimeout(timeout));
  room.wsiTimers.clear();
}

function setBuzzwordTimer(room, callback, delayMs) {
  const timeout = setTimeout(() => {
    room.bwdTimers.delete(timeout);
    callback();
  }, delayMs);
  room.bwdTimers.add(timeout);
  return timeout;
}

function clearBuzzwordTimers(room) {
  if (!room?.bwdTimers) return;
  room.bwdTimers.forEach((timeout) => clearTimeout(timeout));
  room.bwdTimers.clear();
}

function setPointDuelTimer(room, callback, delayMs) {
  const timeout = setTimeout(() => {
    room.pointDuelTimers.delete(timeout);
    callback();
  }, delayMs);
  room.pointDuelTimers.add(timeout);
  return timeout;
}

function clearPointDuelTimers(room) {
  if (!room?.pointDuelTimers) return;
  room.pointDuelTimers.forEach((timeout) => clearTimeout(timeout));
  room.pointDuelTimers.clear();
}

function isBuzzwordDuelActive(room) {
  return room?.state?.currentMinigame?.minigameId === "BUZZWORD_DUEL";
}

function isPointDuelActive(room) {
  return room?.state?.currentMinigame?.minigameId === "POINT_DUEL";
}

function isWhoSaidItActive(room) {
  return !!room?.wsi && room.wsi.minigameId === WHO_SAID_IT_MINIGAME_ID;
}

function schedulePointDuelTick(code, delayMs = 30) {
  const room = rooms.get(code);
  if (!room) return;
  clearPointDuelTimers(room);
  if (!isPointDuelActive(room)) return;
  const nextStepAt = room.state.currentMinigame?.nextStepAt ?? null;
  if (!nextStepAt) return;

  setPointDuelTimer(room, () => {
    const activeRoom = rooms.get(code);
    if (!activeRoom || !isPointDuelActive(activeRoom)) return;

    const now = Date.now();
    activeRoom.state = resolvePointDuelStep(activeRoom.state, now);
    broadcastState(code);

    if (!isPointDuelActive(activeRoom)) return;
    const nextDueAt = activeRoom.state.currentMinigame?.nextStepAt ?? null;
    if (!nextDueAt) return;
    const waitMs = Math.max(30, nextDueAt - Date.now() + 5);
    schedulePointDuelTick(code, waitMs);
  }, delayMs);
}

function runWhoSaidItReveal(code) {
  const room = rooms.get(code);
  if (!room || !isWhoSaidItActive(room)) return;
  if (!room.wsi?.currentRound || room.wsi.status !== "answer") return;

  const revealPayload = revealWhoSaidItRound(room.wsi);
  if (!revealPayload) return;

  io.to(code).emit("WSI_ROUND_REVEAL", revealPayload);

  setWhoSaidItTimer(
    room,
    () => {
      const postRevealRoom = rooms.get(code);
      if (!postRevealRoom || !isWhoSaidItActive(postRevealRoom)) return;

      const { done } = advanceWhoSaidItSession(postRevealRoom.wsi);

      if (done) {
        postRevealRoom.state = applyWhoSaidItPointsToState(postRevealRoom.state, postRevealRoom.wsi);
        io.to(code).emit("MINIGAME_END", getWhoSaidItEndPayload(postRevealRoom.wsi));
        postRevealRoom.wsi = null;
        clearWhoSaidItTimers(postRevealRoom);
        broadcastState(code);
        return;
      }

      setWhoSaidItTimer(postRevealRoom, () => startWhoSaidItRoundLoop(code), postRevealRoom.wsi.betweenRoundsMs);
    },
    room.wsi.revealDurationMs
  );
}

function startWhoSaidItRoundLoop(code) {
  const room = rooms.get(code);
  if (!room || !isWhoSaidItActive(room)) return;

  const startPayload = startWhoSaidItRound(room.wsi);
  io.to(code).emit("WSI_ROUND_START", startPayload);

  setWhoSaidItTimer(room, () => runWhoSaidItReveal(code), room.wsi.answerDurationMs);
}

function startWhoSaidItMinigame(code) {
  const room = rooms.get(code);
  if (!room || isWhoSaidItActive(room)) return;
  if (!room.state?.players?.length) return;

  clearWhoSaidItTimers(room);
  room.wsi = createWhoSaidItSession(room.state.players.map((player) => player.id), {
    rounds: 1,
  });

  io.to(code).emit("MINIGAME_START", getWhoSaidItStartPayload(room.wsi));
  setWhoSaidItTimer(room, () => startWhoSaidItRoundLoop(code), WHO_SAID_IT_ANNOUNCE_MS);
}

function scheduleBuzzwordTick(code, delayMs = 30) {
  const room = rooms.get(code);
  if (!room) return;
  clearBuzzwordTimers(room);

  setBuzzwordTimer(room, () => {
    const activeRoom = rooms.get(code);
    if (!activeRoom || !isBuzzwordDuelActive(activeRoom)) return;

    const now = Date.now();
    const beforePhase = activeRoom.state.currentMinigame.phase;
    activeRoom.state = resolveBuzzwordWord(activeRoom.state, now);
    activeRoom.state = maybeStartBuzzwordNextWord(activeRoom.state, now);
    broadcastState(code);

    const nextMinigame = activeRoom.state.currentMinigame;
    if (!nextMinigame || nextMinigame.minigameId !== "BUZZWORD_DUEL") return;

    if (nextMinigame.phase === "transfer") {
      setBuzzwordTimer(activeRoom, () => {
        const transferRoom = rooms.get(code);
        if (!transferRoom || !isBuzzwordDuelActive(transferRoom)) return;
        const previousRound = transferRoom.state.currentRound;
        transferRoom.state = completeBuzzwordTransfer(transferRoom.state);
        broadcastState(code);
        maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
      }, getBuzzwordTransferDelayMs());
      return;
    }

    if (beforePhase !== nextMinigame.phase || nextMinigame.phase === "between") {
      const waitMs = Math.max(30, (nextMinigame.nextWordAt ?? now) - Date.now() + 5);
      scheduleBuzzwordTick(code, waitMs);
      return;
    }

    const dueAt = nextMinigame.phase === "between" ? nextMinigame.nextWordAt : nextMinigame.wordEndsAt;
    const waitMs = Math.max(30, (dueAt ?? now) - Date.now() + 5);
    scheduleBuzzwordTick(code, waitMs);
  }, delayMs);
}

function sanitizeState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      position: p.position,
      positionNodeId: p.positionNodeId ?? String(p.position ?? 0),
      points: p.points ?? 0,
      stars: p.stars,
      inventory: Array.isArray(p.inventory) ? p.inventory : [],
      skipNextTurn: p.skipNextTurn,
      color: p.color,
      isHost: p.isHost,
    })),
    turnPhase: state.turnPhase ?? "finished",
    preRollActionUsed: !!state.preRollActionUsed,
    pendingPreRollEffect: state.pendingPreRollEffect ?? null,
    pendingDoubleRoll: state.pendingDoubleRoll ?? null,
    preRollChoiceResolved: !!state.preRollChoiceResolved,
    preRollSelectedItemId: state.preRollSelectedItemId ?? null,
    lastRollResult: state.lastRollResult ?? null,
    actionLogs: Array.isArray(state.actionLogs)
      ? state.actionLogs
          .filter((entry) => entry != null)
          .map((entry) => (typeof entry === "string" ? entry : String(entry)))
      : [],
    currentQuestion: state.currentQuestion
      ? {
          id: state.currentQuestion.id,
          type: state.currentQuestion.type,
          text: state.currentQuestion.text,
          targetPlayerId: state.currentQuestion.targetPlayerId,
          votes: state.currentQuestion.votes,
          status: state.currentQuestion.status,
          startAt: state.currentQuestion.startAt,
          endsAt: state.currentQuestion.endsAt,
          durationMs: state.currentQuestion.durationMs,
          nextMinigame: state.currentQuestion.nextMinigame ?? null,
        }
      : null,
    currentMinigame: state.currentMinigame
      ? state.currentMinigame.minigameId === "BUG_SMASH"
        ? {
            minigameId: state.currentMinigame.minigameId,
            targetPlayerId: state.currentMinigame.targetPlayerId,
            startAt: state.currentMinigame.startAt,
            durationMs: state.currentMinigame.durationMs,
            score: state.currentMinigame.score,
          }
        : state.currentMinigame.minigameId === "POINT_DUEL"
        ? {
            minigameId: "POINT_DUEL",
            phase: state.currentMinigame.phase,
            attackerId: state.currentMinigame.attackerId,
            defenderId: state.currentMinigame.defenderId,
            attackerRoll: state.currentMinigame.attackerRoll ?? null,
            defenderRoll: state.currentMinigame.defenderRoll ?? null,
            winnerId: state.currentMinigame.winnerId ?? null,
            stolenPoints: state.currentMinigame.stolenPoints ?? 0,
            startedAt: state.currentMinigame.startedAt,
            nextStepAt: state.currentMinigame.nextStepAt ?? null,
          }
        : {
            minigameId: state.currentMinigame.minigameId,
            duelists: state.currentMinigame.duelists,
            phase: state.currentMinigame.phase,
            roundType: state.currentMinigame.roundType,
            totalWords: state.currentMinigame.totalWords,
            currentWordIndex: state.currentMinigame.currentWordIndex,
            suddenDeathRound: state.currentMinigame.suddenDeathRound,
            wordText: state.currentMinigame.wordText,
            isDouble: state.currentMinigame.isDouble,
            wordStartedAt: state.currentMinigame.wordStartedAt,
            wordEndsAt: state.currentMinigame.wordEndsAt,
            nextWordAt: state.currentMinigame.nextWordAt ?? null,
            scores: state.currentMinigame.scores,
            submittedPlayerIds: Object.keys(state.currentMinigame.submittedBy ?? {}),
            transfer: state.currentMinigame.transfer ?? null,
          }
      : null,
    pendingPathChoice: state.pendingPathChoice
      ? {
          playerId: state.pendingPathChoice.playerId,
          atTileId: state.pendingPathChoice.atTileId,
          options: state.pendingPathChoice.options,
          remainingSteps: state.pendingPathChoice.remainingSteps,
        }
      : null,
    pendingKudoPurchase: state.pendingKudoPurchase
      ? {
          playerId: state.pendingKudoPurchase.playerId,
          atTileId: state.pendingKudoPurchase.atTileId,
          remainingSteps: state.pendingKudoPurchase.remainingSteps,
          cost: state.pendingKudoPurchase.cost,
          canAfford: state.pendingKudoPurchase.canAfford,
          turnEndsAfterResolve: !!state.pendingKudoPurchase.turnEndsAfterResolve,
        }
      : null,
    pendingShop: state.pendingShop
      ? {
          playerId: state.pendingShop.playerId,
          atTileId: state.pendingShop.atTileId,
          remainingSteps: state.pendingShop.remainingSteps ?? 0,
        }
      : null,
    lastMoveTrace: state.lastMoveTrace
      ? {
          id: state.lastMoveTrace.id,
          playerId: state.lastMoveTrace.playerId,
          path: state.lastMoveTrace.path,
          pointDeltas: state.lastMoveTrace.pointDeltas,
        }
      : null,
  };
}

function broadcastState(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("state_update", sanitizeState(room.state));
}

function broadcastLobby(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(code).emit("lobby_update", { players: room.lobby });
}

function maybeStartWhoSaidItAfterTurnAdvance(code, previousRound) {
  if (!ENABLE_WHO_SAID_IT_MINIGAME) return;
  const room = rooms.get(code);
  if (!room) return;
  const shouldStartWhoSaidIt =
    room.state.phase === "playing" &&
    room.state.currentRound > previousRound &&
    !room.state.currentQuestion &&
    !room.state.currentMinigame &&
    !room.state.pendingPathChoice &&
    !room.state.pendingKudoPurchase &&
    !room.state.pendingShop;
  if (shouldStartWhoSaidIt) startWhoSaidItMinigame(code);
}

function clearDisconnectTimer(room, sessionId) {
  if (!sessionId) return;
  const timer = room.disconnectTimers.get(sessionId);
  if (!timer) return;
  clearTimeout(timer);
  room.disconnectTimers.delete(sessionId);
}

function remapSocketIdInState(state, oldSocketId, newSocketId) {
  let nextState = { ...state };

  if (nextState.players?.length) {
    nextState.players = nextState.players.map((p) =>
      p.id === oldSocketId ? { ...p, id: newSocketId } : p
    );
  }

  if (nextState.currentQuestion) {
    const q = nextState.currentQuestion;
    nextState.currentQuestion = {
      ...q,
      targetPlayerId: q.targetPlayerId === oldSocketId ? newSocketId : q.targetPlayerId,
      votes: {
        up: q.votes.up.map((id) => (id === oldSocketId ? newSocketId : id)),
        down: q.votes.down.map((id) => (id === oldSocketId ? newSocketId : id)),
      },
    };
  }

  if (nextState.currentMinigame) {
    if (nextState.currentMinigame.minigameId === "BUG_SMASH") {
      nextState.currentMinigame = {
        ...nextState.currentMinigame,
        targetPlayerId:
          nextState.currentMinigame.targetPlayerId === oldSocketId
            ? newSocketId
            : nextState.currentMinigame.targetPlayerId,
      };
    } else if (nextState.currentMinigame.minigameId === "POINT_DUEL") {
      nextState.currentMinigame = {
        ...nextState.currentMinigame,
        attackerId:
          nextState.currentMinigame.attackerId === oldSocketId
            ? newSocketId
            : nextState.currentMinigame.attackerId,
        defenderId:
          nextState.currentMinigame.defenderId === oldSocketId
            ? newSocketId
            : nextState.currentMinigame.defenderId,
        winnerId:
          nextState.currentMinigame.winnerId === oldSocketId
            ? newSocketId
            : nextState.currentMinigame.winnerId,
      };
    } else {
      const duelists = nextState.currentMinigame.duelists.map((id) =>
        id === oldSocketId ? newSocketId : id
      );
      const scores = { ...nextState.currentMinigame.scores };
      if (Object.prototype.hasOwnProperty.call(scores, oldSocketId)) {
        scores[newSocketId] = scores[oldSocketId];
        delete scores[oldSocketId];
      }
      const submittedBy = { ...(nextState.currentMinigame.submittedBy ?? {}) };
      if (Object.prototype.hasOwnProperty.call(submittedBy, oldSocketId)) {
        submittedBy[newSocketId] = submittedBy[oldSocketId];
        delete submittedBy[oldSocketId];
      }
      const transfer = nextState.currentMinigame.transfer
        ? {
            ...nextState.currentMinigame.transfer,
            winnerId:
              nextState.currentMinigame.transfer.winnerId === oldSocketId
                ? newSocketId
                : nextState.currentMinigame.transfer.winnerId,
            loserId:
              nextState.currentMinigame.transfer.loserId === oldSocketId
                ? newSocketId
                : nextState.currentMinigame.transfer.loserId,
          }
        : null;
      nextState.currentMinigame = {
        ...nextState.currentMinigame,
        duelists,
        scores,
        submittedBy,
        transfer,
      };
    }
  }

  if (nextState.pendingPathChoice) {
    nextState.pendingPathChoice = {
      ...nextState.pendingPathChoice,
      playerId:
        nextState.pendingPathChoice.playerId === oldSocketId
          ? newSocketId
          : nextState.pendingPathChoice.playerId,
    };
  }
  if (nextState.pendingKudoPurchase) {
    nextState.pendingKudoPurchase = {
      ...nextState.pendingKudoPurchase,
      playerId:
        nextState.pendingKudoPurchase.playerId === oldSocketId
          ? newSocketId
          : nextState.pendingKudoPurchase.playerId,
    };
  }
  if (nextState.pendingShop) {
    nextState.pendingShop = {
      ...nextState.pendingShop,
      playerId:
        nextState.pendingShop.playerId === oldSocketId
          ? newSocketId
          : nextState.pendingShop.playerId,
    };
  }

  return nextState;
}

function removePlayerFromState(state, socketId) {
  if (!state?.players?.length) return state;
  const leavingIndex = state.players.findIndex((p) => p.id === socketId);
  if (leavingIndex === -1) return state;

  const players = state.players.filter((p) => p.id !== socketId);
  if (players.length === 0) {
    return {
      ...state,
      phase: "lobby",
      players: [],
      currentPlayerIndex: 0,
      currentQuestion: null,
      currentMinigame: null,
      diceValue: null,
      isRolling: false,
      pendingPreRollEffect: null,
      pendingDoubleRoll: null,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
    };
  }

  let currentPlayerIndex = state.currentPlayerIndex;
  if (leavingIndex < currentPlayerIndex) currentPlayerIndex -= 1;
  if (currentPlayerIndex >= players.length) currentPlayerIndex = 0;

  let currentQuestion = state.currentQuestion;
  if (currentQuestion) {
    if (currentQuestion.targetPlayerId === socketId) {
      currentQuestion = null;
    } else {
      currentQuestion = {
        ...currentQuestion,
        votes: {
          up: currentQuestion.votes.up.filter((id) => id !== socketId),
          down: currentQuestion.votes.down.filter((id) => id !== socketId),
        },
      };
    }
  }

  let currentMinigame = state.currentMinigame;
  if (currentMinigame) {
    if (currentMinigame.minigameId === "BUG_SMASH") {
      if (currentMinigame.targetPlayerId === socketId) currentMinigame = null;
    } else if (currentMinigame.minigameId === "POINT_DUEL") {
      if (currentMinigame.attackerId === socketId || currentMinigame.defenderId === socketId) {
        currentMinigame = null;
      } else if (currentMinigame.winnerId === socketId) {
        currentMinigame = { ...currentMinigame, winnerId: null };
      }
    } else if (currentMinigame.duelists.includes(socketId)) {
      currentMinigame = null;
    } else {
      const scores = { ...currentMinigame.scores };
      delete scores[socketId];
      const submittedBy = { ...(currentMinigame.submittedBy ?? {}) };
      delete submittedBy[socketId];
      currentMinigame = {
        ...currentMinigame,
        scores,
        submittedBy,
      };
    }
  }

  let pendingPathChoice = state.pendingPathChoice ?? null;
  if (pendingPathChoice) {
    const pendingPlayerStillThere = players.some((p) => p.id === pendingPathChoice.playerId);
    if (!pendingPlayerStillThere) {
      pendingPathChoice = null;
    }
  }
  let pendingKudoPurchase = state.pendingKudoPurchase ?? null;
  if (pendingKudoPurchase) {
    const pendingPlayerStillThere = players.some((p) => p.id === pendingKudoPurchase.playerId);
    if (!pendingPlayerStillThere) {
      pendingKudoPurchase = null;
    }
  }
  let pendingShop = state.pendingShop ?? null;
  if (pendingShop) {
    const pendingPlayerStillThere = players.some((p) => p.id === pendingShop.playerId);
    if (!pendingPlayerStillThere) {
      pendingShop = null;
    }
  }

  return {
    ...state,
    players,
    currentPlayerIndex,
    currentQuestion,
    currentMinigame,
    pendingPathChoice,
    pendingKudoPurchase,
    pendingShop,
  };
}

function syncHostFlags(room) {
  room.lobby = room.lobby.map((p) => ({ ...p, isHost: p.socketId === room.hostSocketId }));
  if (room.state?.players?.length) {
    room.state.players = room.state.players.map((p) => ({
      ...p,
      isHost: p.id === room.hostSocketId,
    }));
  }
}

function closeRoomForAll(code, reason = "Le host a quitte la partie") {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit("room_closed", { message: reason });

  room.disconnectTimers.forEach((timer) => clearTimeout(timer));
  room.disconnectTimers.clear();
  clearWhoSaidItTimers(room);
  clearBuzzwordTimers(room);
  clearPointDuelTimers(room);

  room.clients.forEach((clientId) => {
    socketToRoom.delete(clientId);
    const clientSocket = io.sockets.sockets.get(clientId);
    if (clientSocket) clientSocket.leave(code);
  });

  rooms.delete(code);
}

function removePlayerNow(code, socketId) {
  const room = rooms.get(code);
  if (!room) return;

  if (room.hostSocketId === socketId) {
    closeRoomForAll(code);
    return;
  }

  room.clients.delete(socketId);
  socketToRoom.delete(socketId);

  const leavingIndex = room.lobby.findIndex((p) => p.socketId === socketId);
  if (leavingIndex >= 0) {
    const leaving = room.lobby[leavingIndex];
    clearDisconnectTimer(room, leaving.sessionId);
    room.lobby.splice(leavingIndex, 1);
  }

  room.state = removePlayerFromState(room.state, socketId);
  if (isWhoSaidItActive(room)) {
    removeWhoSaidItPlayer(room.wsi, socketId);
    if (!room.wsi.playerIds.length) {
      clearWhoSaidItTimers(room);
      room.wsi = null;
    }
  }
  clearBuzzwordTimers(room);
  clearPointDuelTimers(room);

  syncHostFlags(room);

  if (room.lobby.length === 0 && room.clients.size === 0) {
    rooms.delete(code);
    return;
  }

  broadcastLobby(code);
  broadcastState(code);
}

function scheduleDisconnectCleanup(code, socketId, sessionId) {
  const room = rooms.get(code);
  if (!room || !sessionId) return;

  clearDisconnectTimer(room, sessionId);
  const timer = setTimeout(() => {
    const activeRoom = rooms.get(code);
    if (!activeRoom) return;

    const stillDisconnected = activeRoom.lobby.find(
      (p) => p.sessionId === sessionId && p.socketId === socketId && !p.connected
    );
    if (!stillDisconnected) return;

    removePlayerNow(code, socketId);
  }, RECONNECT_GRACE_MS);

  room.disconnectTimers.set(sessionId, timer);
}

function attachSocketToExistingPlayer(code, room, player, socket) {
  const oldSocketId = player.socketId;
  if (oldSocketId && oldSocketId !== socket.id) {
    room.clients.delete(oldSocketId);
    socketToRoom.delete(oldSocketId);
    room.state = remapSocketIdInState(room.state, oldSocketId, socket.id);
    if (room.hostSocketId === oldSocketId) {
      room.hostSocketId = socket.id;
    }
    if (isWhoSaidItActive(room)) {
      remapWhoSaidItPlayerId(room.wsi, oldSocketId, socket.id);
    }
  }

  player.socketId = socket.id;
  player.connected = true;
  delete player.disconnectedAt;

  room.clients.add(socket.id);
  socketToRoom.set(socket.id, code);
  socket.join(code);
  clearDisconnectTimer(room, player.sessionId);
  syncHostFlags(room);
}

io.on("connection", (socket) => {
  socket.emit("server_hello", { ok: true });

  socket.on("create_poker_room", ({ name, avatar, role, voteSystem, sessionId }) => {
    const code = makeUniqueRoomCode();
    const resolvedSessionId = typeof sessionId === "string" ? sessionId : makeSessionId();
    createPokerRoom({
      code,
      hostSocketId: socket.id,
      sessionId: resolvedSessionId,
      name: name || "Host",
      avatar: avatar ?? 0,
      role: normalizePokerRole(role),
      voteSystem: normalizePokerVoteSystem(voteSystem),
    });
    socketToPokerRoom.set(socket.id, code);
    socket.join(code);
    socket.emit("poker_room_created", { code });
    broadcastPokerLobby(code);
    broadcastPokerState(code);
  });

  socket.on("join_poker_room", ({ code, name, avatar, role, sessionId }) => {
    const room = pokerRooms.get(code);
    if (!room) return socket.emit("poker_error_msg", { message: "Room introuvable" });

    const requestedSessionId = typeof sessionId === "string" ? sessionId : null;
    if (requestedSessionId) {
      const existing = room.lobby.find((player) => player.sessionId === requestedSessionId);
      if (existing) {
        attachSocketToExistingPokerPlayer(code, room, existing, socket);
        socket.emit("poker_room_reconnected", { code });
        broadcastPokerLobby(code);
        broadcastPokerState(code);
        return;
      }
    }

    if (room.lobby.length >= POKER_MAX_PLAYERS) {
      return socket.emit("poker_error_msg", { message: "Room pleine (20 joueurs max)" });
    }

    const resolvedSessionId = requestedSessionId ?? makeSessionId();
    const becomesHost = !room.hostSocketId;
    if (becomesHost) room.hostSocketId = socket.id;
    room.clients.add(socket.id);
    room.lobby.push({
      socketId: socket.id,
      sessionId: resolvedSessionId,
      name: name || "Player",
      avatar: avatar ?? 0,
      isHost: becomesHost,
      connected: true,
      role: normalizePokerRole(role),
      hasVoted: false,
      vote: null,
    });
    socketToPokerRoom.set(socket.id, code);
    socket.join(code);
    syncPokerHostFlags(room);

    socket.emit("poker_room_joined", { code });
    broadcastPokerLobby(code);
    broadcastPokerState(code);
  });

  socket.on("reconnect_poker_room", ({ code, sessionId }) => {
    if (!code || typeof sessionId !== "string") return;
    const room = pokerRooms.get(code);
    if (!room) return socket.emit("poker_error_msg", { message: "Room introuvable" });

    const existing = room.lobby.find((player) => player.sessionId === sessionId);
    if (!existing) return socket.emit("poker_error_msg", { message: "Session introuvable" });

    attachSocketToExistingPokerPlayer(code, room, existing, socket);
    socket.emit("poker_room_reconnected", { code });
    broadcastPokerLobby(code);
    broadcastPokerState(code);
  });

  socket.on("leave_poker_room", () => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    socket.leave(code);
    removePokerPlayerNow(code, socket.id);
  });

  socket.on("start_poker_session", () => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.phase = "playing";
    room.votesOpen = false;
    room.revealed = false;
    if (!room.storyTitle) room.storyTitle = `Story #${room.round}`;
    room.lobby = room.lobby.map((player) => ({
      ...player,
      hasVoted: false,
      vote: null,
    }));
    broadcastPokerState(code);
  });

  socket.on("set_vote_system", ({ voteSystem }) => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.voteSystem = normalizePokerVoteSystem(voteSystem);
    room.votesOpen = false;
    room.revealed = false;
    room.lobby = room.lobby.map((player) => ({
      ...player,
      hasVoted: false,
      vote: null,
    }));
    broadcastPokerState(code);
  });

  socket.on("set_poker_role", ({ role }) => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;

    const player = room.lobby.find((entry) => entry.socketId === socket.id);
    if (!player) return;
    player.role = normalizePokerRole(role);
    if (player.role === "spectator") {
      player.hasVoted = false;
      player.vote = null;
    }
    broadcastPokerLobby(code);
    broadcastPokerState(code);
  });

  socket.on("vote_card", ({ value }) => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.phase !== "playing") return;
    if (!room.votesOpen) return;
    if (room.revealed) return;

    const player = room.lobby.find((entry) => entry.socketId === socket.id);
    if (!player || player.role !== "player") return;

    const nextVote =
      typeof value === "string" ? value.trim().slice(0, 12) : "";

    if (!nextVote) {
      player.hasVoted = false;
      player.vote = null;
    } else {
      player.hasVoted = true;
      player.vote = nextVote;
    }
    broadcastPokerState(code);
  });

  socket.on("reveal_votes", () => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (!room.votesOpen) return;

    room.revealed = true;
    broadcastPokerState(code);
  });

  socket.on("open_votes", () => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (room.phase !== "playing") return;

    room.votesOpen = true;
    room.revealed = false;
    room.lobby = room.lobby.map((player) => ({
      ...player,
      hasVoted: false,
      vote: null,
    }));
    broadcastPokerState(code);
  });

  socket.on("reset_votes", () => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.votesOpen = false;
    room.revealed = false;
    room.round += 1;
    if (!room.storyTitle || room.storyTitle.startsWith("Story #")) {
      room.storyTitle = `Story #${room.round}`;
    }
    room.lobby = room.lobby.map((player) => ({
      ...player,
      hasVoted: false,
      vote: null,
    }));
    broadcastPokerState(code);
  });

  socket.on("set_story_title", ({ storyTitle }) => {
    const code = socketToPokerRoom.get(socket.id);
    if (!code) return;
    const room = pokerRooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    const nextTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
    room.storyTitle = nextTitle || `Story #${room.round}`;
    broadcastPokerState(code);
  });

  socket.on("create_room", ({ name, avatar, sessionId }) => {
    const code = makeUniqueRoomCode();
    const resolvedSessionId = typeof sessionId === "string" ? sessionId : makeSessionId();
    createRuntimeRoom({
      code,
      hostSocketId: socket.id,
      sessionId: resolvedSessionId,
      name: name || "Host",
      avatar: avatar ?? 0,
      mode: "quick",
    });
    socketToRoom.set(socket.id, code);
    socket.join(code);
    socket.emit("room_created", { code });
    broadcastLobby(code);
    broadcastState(code);
  });

  socket.on("join_room", ({ code, name, avatar, sessionId }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit("error_msg", { message: "Room introuvable" });

    const requestedSessionId = typeof sessionId === "string" ? sessionId : null;
    if (requestedSessionId) {
      const existing = room.lobby.find((p) => p.sessionId === requestedSessionId);
      if (existing) {
        attachSocketToExistingPlayer(code, room, existing, socket);
        socket.emit("room_reconnected", { code });
        broadcastLobby(code);
        broadcastState(code);
        return;
      }
    }

    if (room.state.phase === "results") {
      return socket.emit("error_msg", { message: "Partie terminee" });
    }
    if (room.lobby.length >= MAX_PLAYERS) {
      return socket.emit("error_msg", { message: "Room pleine (20 joueurs max)" });
    }

    const resolvedSessionId = requestedSessionId ?? makeSessionId();
    const becomesHost = !room.hostSocketId;
    if (becomesHost) room.hostSocketId = socket.id;
    room.clients.add(socket.id);
    room.lobby.push({
      socketId: socket.id,
      sessionId: resolvedSessionId,
      name: name || "Player",
      avatar: avatar ?? 0,
      isHost: becomesHost,
      connected: true,
    });
    socketToRoom.set(socket.id, code);
    socket.join(code);
    syncHostFlags(room);

    if (room.state.phase === "playing") {
      const alreadyInState = room.state.players.some((player) => player.id === socket.id);
      if (!alreadyInState) {
        const color = pickNextPlayerColor(room.state.players);
        room.state = {
          ...room.state,
          players: [
            ...room.state.players,
            {
              id: socket.id,
              name: name || "Player",
              avatar: avatar ?? 0,
              position: 0,
              positionNodeId: "0",
              lastPosition: -1,
              points: 0,
              stars: 0,
              inventory: [],
              skipNextTurn: false,
              color,
              isHost: becomesHost,
            },
          ],
        };
      }
    }

    socket.emit("room_joined", { code });
    broadcastLobby(code);
    broadcastState(code);
  });

  socket.on("reconnect_room", ({ code, sessionId }) => {
    if (!code || typeof sessionId !== "string") return;
    const room = rooms.get(code);
    if (!room) return socket.emit("error_msg", { message: "Room introuvable" });

    const existing = room.lobby.find((p) => p.sessionId === sessionId);
    if (!existing) return socket.emit("error_msg", { message: "Session introuvable" });

    attachSocketToExistingPlayer(code, room, existing, socket);
    socket.emit("room_reconnected", { code });
    broadcastLobby(code);
    broadcastState(code);
  });

  socket.on("leave_room", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    socket.leave(code);
    removePlayerNow(code, socket.id);
  });

  socket.on("start_game", ({ maxRounds } = {}) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.hostSocketId !== socket.id) return;

    const connectedPlayers = room.lobby.filter((p) => p.connected !== false);
    const rounds = Number.isFinite(maxRounds) ? Math.max(1, Math.min(30, Math.floor(maxRounds))) : 12;
    room.state = initializePlayers(room.state, connectedPlayers, rounds);
    broadcastState(code);
  });

  socket.on("roll_dice", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = rollDice(room.state, socket.id);
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const waitMs = Math.max(30, (room.state.currentMinigame?.nextStepAt ?? Date.now()) - Date.now() + 5);
      schedulePointDuelTick(code, waitMs);
    }

    // settle rolling after a short delay to let the UI animate
    setTimeout(() => {
      const r = rooms.get(code);
      if (!r) return;
      r.state = settleDice(r.state, socket.id);
      broadcastState(code);
    }, 650);
  });

  socket.on("move_player", ({ steps }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = movePlayer(room.state, socket.id, steps);
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
      if (dueAt) {
        const waitMs = Math.max(30, dueAt - Date.now() + 5);
        schedulePointDuelTick(code, waitMs);
      }
      return;
    }
    if (isBuzzwordDuelActive(room)) {
      const dueAt =
        room.state.currentMinigame.phase === "between"
          ? room.state.currentMinigame.nextWordAt
          : room.state.currentMinigame.wordEndsAt;
      scheduleBuzzwordTick(code, Math.max(30, (dueAt ?? Date.now()) - Date.now() + 5));
    }
  });

  socket.on("choose_path", ({ nextTileId }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = choosePath(room.state, socket.id, Number(nextTileId));
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
      if (dueAt) {
        const waitMs = Math.max(30, dueAt - Date.now() + 5);
        schedulePointDuelTick(code, waitMs);
      }
      return;
    }
    if (isBuzzwordDuelActive(room)) {
      const dueAt =
        room.state.currentMinigame.phase === "between"
          ? room.state.currentMinigame.nextWordAt
          : room.state.currentMinigame.wordEndsAt;
      scheduleBuzzwordTick(code, Math.max(30, (dueAt ?? Date.now()) - Date.now() + 5));
    }
  });

  socket.on("resolve_kudo_purchase", ({ buyKudo }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = resolveKudoPurchase(room.state, socket.id, !!buyKudo);
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
      if (dueAt) {
        const waitMs = Math.max(30, dueAt - Date.now() + 5);
        schedulePointDuelTick(code, waitMs);
      }
    }
  });

  socket.on("open_shop", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = openShopForPlayer(room.state, socket.id);
    broadcastState(code);
  });

  socket.on("close_shop", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    const previousRound = room.state.currentRound;
    room.state = closeShopForPlayer(room.state, socket.id);
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
      if (dueAt) {
        const waitMs = Math.max(30, dueAt - Date.now() + 5);
        schedulePointDuelTick(code, waitMs);
      }
      return;
    }
    maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
  });

  socket.on("buy_shop_item", ({ itemType }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    const previousRound = room.state.currentRound;
    room.state = buyShopItem(room.state, socket.id, String(itemType ?? ""));
    broadcastState(code);
    if (isPointDuelActive(room)) {
      const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
      if (dueAt) {
        const waitMs = Math.max(30, dueAt - Date.now() + 5);
        schedulePointDuelTick(code, waitMs);
      }
      return;
    }
    maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
  });

  socket.on("use_shop_item", ({ itemInstanceId, payload }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    const beforeRound = room.state.currentRound;
    room.state = useShopItem(room.state, socket.id, String(itemInstanceId ?? ""), payload ?? {});
    broadcastState(code);
    maybeStartWhoSaidItAfterTurnAdvance(code, beforeRound);
  });

  socket.on("point_duel_roll", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!isPointDuelActive(room)) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room)) return;

    room.state = rollPointDuelDie(room.state, socket.id, Date.now());
    broadcastState(code);

    const dueAt = room.state.currentMinigame?.nextStepAt ?? null;
    if (dueAt) {
      const waitMs = Math.max(30, dueAt - Date.now() + 5);
      schedulePointDuelTick(code, waitMs);
    }
  });

  socket.on("resolve_pre_roll_choice", ({ itemInstanceId } = {}) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = resolvePreRollChoice(room.state, socket.id, itemInstanceId ?? null);
    broadcastState(code);
  });

  socket.on("vote_question", ({ vote }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = voteQuestion(room.state, socket.id, vote);
    broadcastState(code);
  });

  socket.on("open_question", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = openQuestion(room.state, socket.id);
    broadcastState(code);
  });

  socket.on("validate_question", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    const previousRound = room.state.currentRound;
    room.state = validateQuestion(room.state, socket.id);
    broadcastState(code);
    maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
  });

  socket.on("BUG_SMASH_COMPLETE", ({ score }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    const previousRound = room.state.currentRound;
    room.state = completeBugSmash(room.state, socket.id, score);
    broadcastState(code);
    maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
  });

  socket.on("BUG_SMASH_PROGRESS", ({ score }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = updateBugSmashProgress(room.state, socket.id, score);
    broadcastState(code);
  });

  socket.on("BUZZWORD_SUBMIT", ({ category }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!isBuzzwordDuelActive(room)) return;

    room.state = submitBuzzwordAnswer(room.state, socket.id, category, Date.now());
    broadcastState(code);

    if (room.state.currentMinigame?.minigameId === "BUZZWORD_DUEL") {
      if (room.state.currentMinigame.phase === "transfer") {
        clearBuzzwordTimers(room);
        setBuzzwordTimer(room, () => {
          const transferRoom = rooms.get(code);
          if (!transferRoom || !isBuzzwordDuelActive(transferRoom)) return;
          const previousRound = transferRoom.state.currentRound;
          transferRoom.state = completeBuzzwordTransfer(transferRoom.state);
          broadcastState(code);
          maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
        }, getBuzzwordTransferDelayMs());
      } else {
        const dueAt =
          room.state.currentMinigame.phase === "between"
            ? room.state.currentMinigame.nextWordAt
            : room.state.currentMinigame.wordEndsAt;
        const waitMs = Math.max(30, (dueAt ?? Date.now()) - Date.now() + 5);
        scheduleBuzzwordTick(code, waitMs);
      }
    }
  });

  socket.on("WSI_SUBMIT", ({ roundIndex, role }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!isWhoSaidItActive(room)) return;

    const result = submitWhoSaidItAnswer(room.wsi, socket.id, roundIndex, role);
    if (!result?.accepted) return;

    if (!room.wsi?.currentRound || room.wsi.status !== "answer") return;
    const totalPlayers = room.wsi.playerIds.length;
    if (totalPlayers <= 0) return;
    const submittedCount = Object.keys(room.wsi.currentRound.submissions ?? {}).length;
    if (submittedCount >= totalPlayers) {
      clearWhoSaidItTimers(room);
      runWhoSaidItReveal(code);
    }
  });

  // Optional manual next turn (host debugging)
  socket.on("next_turn", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

    room.state = nextTurn(room.state);
    broadcastState(code);
  });

  socket.on("reset_game", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    clearWhoSaidItTimers(room);
    clearBuzzwordTimers(room);
    room.wsi = null;
    room.state = resetGame(room.state);
    clearPointDuelTimers(room);
    broadcastLobby(code);
    broadcastState(code);
  });

  socket.on("disconnect", () => {
    const pokerCode = socketToPokerRoom.get(socket.id);
    if (pokerCode) {
      const pokerRoom = pokerRooms.get(pokerCode);
      socketToPokerRoom.delete(socket.id);

      if (pokerRoom) {
        pokerRoom.clients.delete(socket.id);

        const pokerPlayer = pokerRoom.lobby.find((player) => player.socketId === socket.id);
        if (pokerPlayer) {
          pokerPlayer.connected = false;
          pokerPlayer.disconnectedAt = Date.now();

          if (!pokerPlayer.sessionId) {
            removePokerPlayerNow(pokerCode, socket.id);
          } else {
            schedulePokerDisconnectCleanup(pokerCode, socket.id, pokerPlayer.sessionId);
            broadcastPokerLobby(pokerCode);
            broadcastPokerState(pokerCode);
          }
        } else if (pokerRoom.lobby.length === 0 && pokerRoom.clients.size === 0) {
          pokerRooms.delete(pokerCode);
        }
      }
    }

    const code = socketToRoom.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    socketToRoom.delete(socket.id);

    if (!room) return;

    room.clients.delete(socket.id);

    const player = room.lobby.find((p) => p.socketId === socket.id);
    if (!player) {
      if (room.lobby.length === 0 && room.clients.size === 0) {
        rooms.delete(code);
      }
      return;
    }

    player.connected = false;
    player.disconnectedAt = Date.now();

    if (!player.sessionId) {
      removePlayerNow(code, socket.id);
      return;
    }

    scheduleDisconnectCleanup(code, socket.id, player.sessionId);
    broadcastLobby(code);
    broadcastState(code);
  });
});

async function startServer() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Retro Party backend listening on :${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start backend", err);
  process.exit(1);
});
