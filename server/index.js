import express from "express";
import http from "http";
import cors from "cors";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { initDatabase, pool } from "./db.js";
import { registerApiRoutes } from "./restApi.js";
import { sessionLifecycle } from "./src/services/sessionLifecycle.js";
import {
  markRetroDirty,
  markPokerDirty,
  hydrateRooms,
  startSnapshotFlushLoop,
  persistQuickRoom,
} from "./src/services/roomSnapshot.js";
import { registerSocketHandlers } from "./src/socket/registerSocketHandlers.js";
import { S2C_EVENTS } from "../shared/contracts/socketEvents.js";
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
  appendActionLog,
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
const RECONNECT_GRACE_MS =
  Number(process.env.RECONNECT_GRACE_MS) > 0
    ? Number(process.env.RECONNECT_GRACE_MS)
    : 20 * 60 * 1000;
const MAX_PLAYERS = 20;
const PLAYER_COLORS = [
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
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    ) {
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
  }),
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
  return crypto
    .randomInt(36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
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
const socketToRadarRoom = new Map(); // socketId -> code
const socketToSkillsMatrixRoom = new Map(); // socketId -> code
const POKER_VOTE_SYSTEMS = new Set(["fibonacci", "man-day", "tshirt"]);
const POKER_MAX_PLAYERS = 20;

function normalizeSessionCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function radarRoomKey(code) {
  return `radar:${code}`;
}

function skillsMatrixRoomKey(code) {
  return `skills-matrix:${code}`;
}

function attachSocketToRadarRoom(socket, rawCode) {
  const code = normalizeSessionCode(rawCode);
  if (!code) return null;

  const previous = socketToRadarRoom.get(socket.id);
  if (previous && previous !== code) {
    socket.leave(radarRoomKey(previous));
  }

  socketToRadarRoom.set(socket.id, code);
  socket.join(radarRoomKey(code));
  return code;
}

function detachSocketFromRadarRoom(socket, codeHint = null) {
  const activeCode = socketToRadarRoom.get(socket.id);
  const code = activeCode || normalizeSessionCode(codeHint ?? "");
  if (!code) return null;
  socket.leave(radarRoomKey(code));
  if (activeCode) socketToRadarRoom.delete(socket.id);
  return code;
}

function attachSocketToSkillsMatrixRoom(socket, rawCode) {
  const code = normalizeSessionCode(rawCode);
  if (!code) return null;

  const previous = socketToSkillsMatrixRoom.get(socket.id);
  if (previous && previous !== code) {
    socket.leave(skillsMatrixRoomKey(previous));
  }

  socketToSkillsMatrixRoom.set(socket.id, code);
  socket.join(skillsMatrixRoomKey(code));
  return code;
}

function detachSocketFromSkillsMatrixRoom(socket, codeHint = null) {
  const activeCode = socketToSkillsMatrixRoom.get(socket.id);
  const code = activeCode || normalizeSessionCode(codeHint ?? "");
  if (!code) return null;
  socket.leave(skillsMatrixRoomKey(code));
  if (activeCode) socketToSkillsMatrixRoom.delete(socket.id);
  return code;
}

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

function buildNextPokerStoryTitle(currentTitle, fallbackRound) {
  const raw = typeof currentTitle === "string" ? currentTitle.trim() : "";
  const match = raw.match(/^(.*?)(\d+)\s*$/);
  if (match) {
    const prefix = match[1] || "Story #";
    const value = Number(match[2]);
    if (Number.isFinite(value)) {
      return `${prefix}${value + 1}`;
    }
  }
  return `Story #${Math.max(1, fallbackRound)}`;
}

function createPokerRoom({
  code,
  hostSocketId = null,
  sessionId = null,
  name = "Host",
  avatar = 0,
  role = "player",
  voteSystem = "fibonacci",
  preparedStories = [],
  isPreparedSession = false,
} = {}) {
  if (pokerRooms.has(code)) return pokerRooms.get(code);

  const hasHost = Boolean(hostSocketId);
  const stories = Array.isArray(preparedStories)
    ? preparedStories.filter((s) => s && typeof s.title === "string" && s.title.trim())
    : [];
  const room = {
    code,
    phase: "lobby",
    storyTitle: stories.length > 0 ? stories[0].title : "Story #1",
    isPreparedSession: !!isPreparedSession,
    sessionEnded: false,
    voteSystem: normalizePokerVoteSystem(voteSystem),
    returnStoryTitle: null,
    votesOpen: false,
    round: 1,
    revealed: false,
    hostSocketId,
    preparedStories: stories,
    currentStoryIndex: stories.length > 0 ? 0 : -1,
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
  if (
    !room.hostSocketId ||
    !room.lobby.some(
      (player) => player.socketId === room.hostSocketId && player.connected !== false,
    )
  ) {
    const hasDesignatedHost = room.lobby.some((player) => player.isHost);
    const nextHost =
      room.lobby.find((player) => player.connected !== false && player.isHost) ??
      (!hasDesignatedHost
        ? (room.lobby.find((player) => player.connected !== false) ?? room.lobby[0] ?? null)
        : null);
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
    sessionEnded: !!room.sessionEnded,
    voteSystem: room.voteSystem,
    votesOpen: !!room.votesOpen,
    revealed: room.revealed,
    round: room.round,
    updatedAt: Date.now(),
    isPreparedSession: !!room.isPreparedSession,
    preparedStories: room.preparedStories ?? [],
    currentStoryIndex: room.currentStoryIndex ?? -1,
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
  markPokerDirty(code);
  io.to(code).emit(S2C_EVENTS.POKER_STATE_UPDATE, sanitizePokerState(room));
}

function broadcastPokerLobby(code) {
  const room = pokerRooms.get(code);
  if (!room) return;
  markPokerDirty(code);
  io.to(code).emit(S2C_EVENTS.POKER_LOBBY_UPDATE, {
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

  io.to(code).emit(S2C_EVENTS.POKER_ROOM_CLOSED, { message: reason });
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

  // Idem retro-party : quitter ne tue pas la room, même pour l'host.
  // Seul POST /api/sessions/:code/end (auth) clôture définitivement.
  const wasHost = room.hostSocketId === socketId;
  if (wasHost) {
    room.hostSocketId = null;
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

// Idem retro-party : LEAVE_POKER_ROOM conserve le slot pour permettre
// la reconnexion, ne tue pas la room.
function softLeavePokerPlayer(code, socketId) {
  const room = pokerRooms.get(code);
  if (!room) return;

  if (room.hostSocketId === socketId) {
    room.hostSocketId = null;
  }

  room.clients.delete(socketId);
  socketToPokerRoom.delete(socketId);

  const slot = room.lobby.find((p) => p.socketId === socketId);
  if (slot) {
    slot.socketId = null;
    slot.connected = false;
    slot.disconnectedAt = Date.now();
  }

  syncPokerHostFlags(room);
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
      (player) =>
        player.sessionId === sessionId &&
        player.socketId === socketId &&
        player.connected === false,
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
  if (!room.hostSocketId && player.isHost) {
    room.hostSocketId = socket.id;
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
  io,
  createPokerRoom,
  pokerRooms,
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

  setPointDuelTimer(
    room,
    () => {
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
    },
    delayMs,
  );
}

function runWhoSaidItReveal(code) {
  const room = rooms.get(code);
  if (!room || !isWhoSaidItActive(room)) return;
  if (!room.wsi?.currentRound || room.wsi.status !== "answer") return;

  const revealPayload = revealWhoSaidItRound(room.wsi);
  if (!revealPayload) return;

  io.to(code).emit(S2C_EVENTS.WSI_ROUND_REVEAL, revealPayload);

  setWhoSaidItTimer(
    room,
    () => {
      const postRevealRoom = rooms.get(code);
      if (!postRevealRoom || !isWhoSaidItActive(postRevealRoom)) return;

      const { done } = advanceWhoSaidItSession(postRevealRoom.wsi);

      if (done) {
        postRevealRoom.state = applyWhoSaidItPointsToState(
          postRevealRoom.state,
          postRevealRoom.wsi,
        );
        io.to(code).emit(S2C_EVENTS.MINIGAME_END, getWhoSaidItEndPayload(postRevealRoom.wsi));
        postRevealRoom.wsi = null;
        clearWhoSaidItTimers(postRevealRoom);
        broadcastState(code);
        return;
      }

      setWhoSaidItTimer(
        postRevealRoom,
        () => startWhoSaidItRoundLoop(code),
        postRevealRoom.wsi.betweenRoundsMs,
      );
    },
    room.wsi.revealDurationMs,
  );
}

function startWhoSaidItRoundLoop(code) {
  const room = rooms.get(code);
  if (!room || !isWhoSaidItActive(room)) return;

  const startPayload = startWhoSaidItRound(room.wsi);
  io.to(code).emit(S2C_EVENTS.WSI_ROUND_START, startPayload);

  setWhoSaidItTimer(room, () => runWhoSaidItReveal(code), room.wsi.answerDurationMs);
}

function startWhoSaidItMinigame(code) {
  const room = rooms.get(code);
  if (!room || isWhoSaidItActive(room)) return;
  if (!room.state?.players?.length) return;

  clearWhoSaidItTimers(room);
  room.wsi = createWhoSaidItSession(
    room.state.players.map((player) => player.id),
    {
      rounds: 1,
    },
  );

  io.to(code).emit(S2C_EVENTS.MINIGAME_START, getWhoSaidItStartPayload(room.wsi));
  setWhoSaidItTimer(room, () => startWhoSaidItRoundLoop(code), WHO_SAID_IT_ANNOUNCE_MS);
}

function scheduleBuzzwordTick(code, delayMs = 30) {
  const room = rooms.get(code);
  if (!room) return;
  clearBuzzwordTimers(room);

  setBuzzwordTimer(
    room,
    () => {
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
        setBuzzwordTimer(
          activeRoom,
          () => {
            const transferRoom = rooms.get(code);
            if (!transferRoom || !isBuzzwordDuelActive(transferRoom)) return;
            const previousRound = transferRoom.state.currentRound;
            transferRoom.state = completeBuzzwordTransfer(transferRoom.state);
            broadcastState(code);
            maybeStartWhoSaidItAfterTurnAdvance(code, previousRound);
          },
          getBuzzwordTransferDelayMs(),
        );
        return;
      }

      if (beforePhase !== nextMinigame.phase || nextMinigame.phase === "between") {
        const waitMs = Math.max(30, (nextMinigame.nextWordAt ?? now) - Date.now() + 5);
        scheduleBuzzwordTick(code, waitMs);
        return;
      }

      const dueAt =
        nextMinigame.phase === "between" ? nextMinigame.nextWordAt : nextMinigame.wordEndsAt;
      const waitMs = Math.max(30, (dueAt ?? now) - Date.now() + 5);
      scheduleBuzzwordTick(code, waitMs);
    },
    delayMs,
  );
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
  markRetroDirty(code);
  io.to(code).emit(S2C_EVENTS.STATE_UPDATE, sanitizeState(room.state));
}

function broadcastLobby(code) {
  const room = rooms.get(code);
  if (!room) return;
  markRetroDirty(code);
  io.to(code).emit(S2C_EVENTS.LOBBY_UPDATE, { players: room.lobby });
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
      p.id === oldSocketId ? { ...p, id: newSocketId } : p,
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
        id === oldSocketId ? newSocketId : id,
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
  const designatedHost = room.lobby.find((p) => p.isHost) ?? null;
  const designatedHostSessionId = designatedHost?.sessionId ?? null;
  const designatedHostStatePlayerId =
    designatedHost?.statePlayerId ?? designatedHost?.socketId ?? null;

  if (
    !room.hostSocketId ||
    !room.lobby.some((p) => p.socketId === room.hostSocketId && p.connected !== false)
  ) {
    const hasDesignatedHost = room.lobby.some((p) => p.isHost);
    const nextHost =
      room.lobby.find((p) => p.connected !== false && p.isHost) ??
      (!hasDesignatedHost
        ? (room.lobby.find((p) => p.connected !== false) ?? room.lobby[0] ?? null)
        : null);
    room.hostSocketId = nextHost?.socketId ?? null;
  }
  room.lobby = room.lobby.map((p) => ({
    ...p,
    isHost: room.hostSocketId
      ? p.socketId === room.hostSocketId
      : !!designatedHostSessionId && p.sessionId === designatedHostSessionId,
  }));
  if (room.state?.players?.length) {
    room.state.players = room.state.players.map((p) => ({
      ...p,
      isHost: room.hostSocketId
        ? p.id === room.hostSocketId
        : !!designatedHostStatePlayerId && p.id === designatedHostStatePlayerId,
    }));
  }
}

function closeRoomForAll(code, reason = "Le host a quitte la partie") {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit(S2C_EVENTS.ROOM_CLOSED, { message: reason });

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

  // Quitter ne tue plus la room, même si c'est l'host. Le seul moyen de
  // terminer définitivement la session est l'endpoint auth-protégé
  // POST /api/sessions/:code/end (via /app/sessions ou la route runtime).
  // Sémantique : seul le créateur authentifié peut clôturer ; aucun
  // membre ne reprend le rôle d'host.
  const wasHost = room.hostSocketId === socketId;
  if (wasHost) {
    room.hostSocketId = null;
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

  // Auto-clean si la room est totalement vide (plus aucun client connecté).
  // Si le host est parti mais des membres restent, la room continue à vivre.
  if (room.lobby.length === 0 && room.clients.size === 0) {
    rooms.delete(code);
    return;
  }

  broadcastLobby(code);
  broadcastState(code);
}

// Soft-leave : l'utilisateur clique "Quitter" volontairement.
// Le slot reste dans la lobby (sessionId persisté) et son entrée dans
// state.players est conservée avec un flag disconnected:true — sa
// progression (position, points, inventaire) n'est PAS perdue. Le
// socket est détaché. Aucun timer de cleanup : le slot persiste jusqu'à
// END_SESSION (REST auth).
// Lifecycle reconnect : RECONNECT_ROOM avec le même sessionId remap
// l'id de l'entrée state.players vers le nouveau socketId via
// attachSocketToExistingPlayer (qui clear aussi disconnected:false).
// Le joueur reprend exactement où il en était, qu'il soit authentifié
// ou anonyme (la sessionId est portée par le client via localStorage).
function softLeavePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return;

  const leavingPlayer = room.state.players?.find((p) => p.id === socketId) ?? null;

  if (room.hostSocketId === socketId) {
    room.hostSocketId = null;
  }

  room.clients.delete(socketId);
  socketToRoom.delete(socketId);

  const slot = room.lobby.find((p) => p.socketId === socketId);
  if (slot) {
    // On garde sessionId, name, avatar, isHost. socketId passe à null
    // pour indiquer "vacant" et connected à false pour les notices UI.
    slot.statePlayerId = socketId;
    slot.socketId = null;
    slot.connected = false;
    slot.disconnectedAt = Date.now();
  }

  // Marque la live entry comme disconnected pour signaler aux autres
  // joueurs (UI fade) et pour que nextTurn() saute le tour. Ne PAS
  // appeler removePlayerFromState : on conserve la progression.
  if (room.state.players?.length) {
    const wasCurrent =
      room.state.phase === "playing" &&
      room.state.players[room.state.currentPlayerIndex]?.id === socketId;
    room.state = {
      ...room.state,
      players: room.state.players.map((p) =>
        p.id === socketId ? { ...p, disconnected: true } : p,
      ),
    };
    const blocksTurn =
      room.state.currentQuestion?.targetPlayerId === socketId ||
      room.state.currentMinigame?.targetPlayerId === socketId ||
      room.state.currentMinigame?.attackerId === socketId ||
      room.state.currentMinigame?.defenderId === socketId ||
      room.state.currentMinigame?.duelists?.includes?.(socketId) ||
      room.state.pendingPathChoice?.playerId === socketId ||
      room.state.pendingKudoPurchase?.playerId === socketId ||
      room.state.pendingShop?.playerId === socketId;

    if (blocksTurn) {
      room.state = {
        ...room.state,
        currentQuestion: null,
        currentMinigame: null,
        pendingPathChoice: null,
        pendingKudoPurchase: null,
        pendingShop: null,
        diceValue: null,
        isRolling: false,
        pendingPreRollEffect: null,
        pendingDoubleRoll: null,
        preRollChoiceResolved: true,
        preRollSelectedItemId: null,
        turnPhase: "finished",
      };
    }
    room.state = appendActionLog(
      room.state,
      `${slot?.name ?? leavingPlayer?.name ?? "Un joueur"} a quitte la partie.`,
    );

    // Si le joueur qui quitte était le joueur courant, on avance le tour
    // après avoir nettoyé ses choix/mini-jeux éventuels.
    if (wasCurrent) {
      room.state = nextTurn(room.state);
    }
  }
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
      (p) => p.sessionId === sessionId && p.socketId === socketId && !p.connected,
    );
    if (!stillDisconnected) return;

    removePlayerNow(code, socketId);
  }, RECONNECT_GRACE_MS);

  room.disconnectTimers.set(sessionId, timer);
}

function attachSocketToExistingPlayer(code, room, player, socket) {
  const oldSocketId = player.socketId;
  const previousPlayerId = oldSocketId || player.statePlayerId || null;
  if (previousPlayerId && previousPlayerId !== socket.id) {
    room.clients.delete(oldSocketId);
    socketToRoom.delete(oldSocketId);
    room.state = remapSocketIdInState(room.state, previousPlayerId, socket.id);
    if (room.hostSocketId === previousPlayerId) {
      room.hostSocketId = socket.id;
    }
    if (isWhoSaidItActive(room)) {
      remapWhoSaidItPlayerId(room.wsi, previousPlayerId, socket.id);
    }
  }
  if (!room.hostSocketId && player.isHost) {
    room.hostSocketId = socket.id;
  }

  player.socketId = socket.id;
  player.statePlayerId = socket.id;
  player.connected = true;
  delete player.disconnectedAt;

  room.clients.add(socket.id);
  socketToRoom.set(socket.id, code);
  socket.join(code);
  clearDisconnectTimer(room, player.sessionId);
  syncHostFlags(room);

  // Reconnect après soft-leave : remap a déjà mis à jour player.id vers
  // le nouveau socketId. On clear le flag disconnected pour réintégrer
  // le joueur dans le tour-loop. Sa progression (position, points,
  // inventaire) est conservée intacte.
  if (room.state.players?.length) {
    const stateEntry = room.state.players.find((p) => p.id === socket.id);
    if (stateEntry?.disconnected) {
      room.state = {
        ...room.state,
        players: room.state.players.map((p) =>
          p.id === socket.id ? { ...p, disconnected: false } : p,
        ),
      };
    }
  }
}
registerSocketHandlers({
  io,
  pool,
  crypto,
  sessionLifecycle,
  persistQuickRoom,
  attachSocketToRadarRoom,
  detachSocketFromRadarRoom,
  attachSocketToSkillsMatrixRoom,
  detachSocketFromSkillsMatrixRoom,
  makeUniqueRoomCode,
  makeSessionId,
  createPokerRoom,
  normalizePokerRole,
  normalizePokerVoteSystem,
  socketToPokerRoom,
  broadcastPokerLobby,
  broadcastPokerState,
  pokerRooms,
  attachSocketToExistingPokerPlayer,
  POKER_MAX_PLAYERS,
  syncPokerHostFlags,
  syncHostFlags,
  removePokerPlayerNow,
  createRuntimeRoom,
  socketToRoom,
  broadcastLobby,
  broadcastState,
  rooms,
  attachSocketToExistingPlayer,
  MAX_PLAYERS,
  pickNextPlayerColor,
  initializePlayers,
  isWhoSaidItActive,
  isBuzzwordDuelActive,
  isPointDuelActive,
  rollDice,
  schedulePointDuelTick,
  settleDice,
  movePlayer,
  scheduleBuzzwordTick,
  choosePath,
  resolveKudoPurchase,
  openShopForPlayer,
  closeShopForPlayer,
  maybeStartWhoSaidItAfterTurnAdvance,
  buyShopItem,
  useShopItem,
  rollPointDuelDie,
  resolvePreRollChoice,
  voteQuestion,
  openQuestion,
  validateQuestion,
  completeBugSmash,
  updateBugSmashProgress,
  submitBuzzwordAnswer,
  clearBuzzwordTimers,
  setBuzzwordTimer,
  completeBuzzwordTransfer,
  getBuzzwordTransferDelayMs,
  submitWhoSaidItAnswer,
  clearWhoSaidItTimers,
  runWhoSaidItReveal,
  nextTurn,
  resetGame,
  clearPointDuelTimers,
  socketToRadarRoom,
  socketToSkillsMatrixRoom,
  schedulePokerDisconnectCleanup,
  scheduleDisconnectCleanup,
  removePlayerNow,
  softLeavePlayer,
  softLeavePokerPlayer,
});

async function startServer() {
  await initDatabase();

  // Phase β — rehydrate rooms persisted from previous boot.
  try {
    const { retroCount, pokerCount } = await hydrateRooms(pool, { rooms, pokerRooms });
    if (retroCount + pokerCount > 0) {
      console.log(`[snapshot] hydrated ${retroCount} retro / ${pokerCount} poker room(s)`);
    }
  } catch (err) {
    console.error("[snapshot] hydrate failed", err);
  }

  server.listen(PORT, () => {
    console.log(`Retro Party backend listening on :${PORT}`);
  });

  // Phase β — flush dirty room snapshots every second.
  startSnapshotFlushLoop(pool, { rooms, pokerRooms }, 1000);

  // Phase α — abandon idle sessions every 5 minutes.
  setInterval(
    () => {
      sessionLifecycle
        .markAbandonedSessions(pool)
        .then((count) => {
          if (count > 0) console.log(`[lifecycle] marked ${count} session(s) as abandoned`);
        })
        .catch((err) => console.error("[lifecycle] abandon sweep failed", err));
    },
    5 * 60 * 1000,
  );
}

startServer().catch((err) => {
  console.error("Failed to start backend", err);
  process.exit(1);
});
