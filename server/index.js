import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import {
  createInitialState,
  initializePlayers,
  rollDice,
  settleDice,
  movePlayer,
  onPlayerLanded,
  openQuestion,
  voteQuestion,
  validateQuestion,
  nextTurn,
  resetGame,
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
const ORIGIN = process.env.ORIGIN || true; // in prod set to your https domain
const RECONNECT_GRACE_MS = 30000;

const app = express();
app.use(cors({ origin: ORIGIN, credentials: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
});

function makeCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function makeSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const rooms = new Map(); // code -> { state, hostSocketId, clients, lobby, disconnectTimers }
const socketToRoom = new Map(); // socketId -> code

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

function isWhoSaidItActive(room) {
  return !!room?.wsi && room.wsi.minigameId === WHO_SAID_IT_MINIGAME_ID;
}

function startWhoSaidItRoundLoop(code) {
  const room = rooms.get(code);
  if (!room || !isWhoSaidItActive(room)) return;

  const startPayload = startWhoSaidItRound(room.wsi);
  io.to(code).emit("WSI_ROUND_START", startPayload);

  setWhoSaidItTimer(
    room,
    () => {
      const activeRoom = rooms.get(code);
      if (!activeRoom || !isWhoSaidItActive(activeRoom)) return;

      const revealPayload = revealWhoSaidItRound(activeRoom.wsi);
      if (!revealPayload) return;

      io.to(code).emit("WSI_ROUND_REVEAL", revealPayload);

      setWhoSaidItTimer(
        activeRoom,
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
        activeRoom.wsi.revealDurationMs
      );
    },
    room.wsi.answerDurationMs
  );
}

function startWhoSaidItMinigame(code) {
  const room = rooms.get(code);
  if (!room || isWhoSaidItActive(room)) return;
  if (!room.state?.players?.length) return;

  clearWhoSaidItTimers(room);
  room.wsi = createWhoSaidItSession(room.state.players.map((player) => player.id));

  io.to(code).emit("MINIGAME_START", getWhoSaidItStartPayload(room.wsi));
  startWhoSaidItRoundLoop(code);
}

function sanitizeState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      position: p.position,
      stars: p.stars,
      skipNextTurn: p.skipNextTurn,
      color: p.color,
      isHost: p.isHost,
    })),
    currentQuestion: state.currentQuestion
      ? {
          id: state.currentQuestion.id,
          type: state.currentQuestion.type,
          text: state.currentQuestion.text,
          targetPlayerId: state.currentQuestion.targetPlayerId,
          votes: state.currentQuestion.votes,
          status: state.currentQuestion.status,
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
      diceValue: null,
      isRolling: false,
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

  return {
    ...state,
    players,
    currentPlayerIndex,
    currentQuestion,
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

  socket.on("create_room", ({ name, avatar, sessionId }) => {
    const code = makeCode();
    const state = createInitialState();
    const resolvedSessionId = typeof sessionId === "string" ? sessionId : makeSessionId();
    rooms.set(code, {
      state,
      hostSocketId: socket.id,
      clients: new Set([socket.id]),
      disconnectTimers: new Map(),
      wsi: null,
      wsiTimers: new Set(),
      lobby: [
        {
          socketId: socket.id,
          sessionId: resolvedSessionId,
          name: name || "Host",
          avatar: avatar ?? 0,
          isHost: true,
          connected: true,
        },
      ],
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

    if (room.state.phase !== "lobby") {
      return socket.emit("error_msg", { message: "Partie deja demarree" });
    }

    const resolvedSessionId = requestedSessionId ?? makeSessionId();
    room.clients.add(socket.id);
    room.lobby.push({
      socketId: socket.id,
      sessionId: resolvedSessionId,
      name: name || "Player",
      avatar: avatar ?? 0,
      isHost: false,
      connected: true,
    });
    socketToRoom.set(socket.id, code);
    socket.join(code);

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

  socket.on("start_game", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.hostSocketId !== socket.id) return;

    room.state = initializePlayers(
      room.state,
      room.lobby.filter((p) => p.connected !== false)
    );
    broadcastState(code);
  });

  socket.on("roll_dice", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room)) return;

    room.state = rollDice(room.state, socket.id);
    broadcastState(code);

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
    if (isWhoSaidItActive(room)) return;

    room.state = movePlayer(room.state, socket.id, steps);
    // after move, trigger the question popup
    room.state = onPlayerLanded(room.state, socket.id);
    broadcastState(code);
  });

  socket.on("vote_question", ({ vote }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room)) return;

    room.state = voteQuestion(room.state, socket.id, vote);
    broadcastState(code);
  });

  socket.on("open_question", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room)) return;

    room.state = openQuestion(room.state, socket.id);
    broadcastState(code);
  });

  socket.on("validate_question", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (isWhoSaidItActive(room)) return;

    const previousRound = room.state.currentRound;
    room.state = validateQuestion(room.state, socket.id);
    broadcastState(code);

    const shouldStartWhoSaidIt =
      room.state.phase === "playing" &&
      room.state.currentRound > previousRound &&
      !room.state.currentQuestion;
    if (shouldStartWhoSaidIt) {
      startWhoSaidItMinigame(code);
    }
  });

  socket.on("WSI_SUBMIT", ({ roundIndex, role }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (!isWhoSaidItActive(room)) return;

    submitWhoSaidItAnswer(room.wsi, socket.id, roundIndex, role);
  });

  // Optional manual next turn (host debugging)
  socket.on("next_turn", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;
    if (isWhoSaidItActive(room)) return;

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
    room.wsi = null;
    room.state = resetGame(room.state);
    broadcastLobby(code);
    broadcastState(code);
  });

  socket.on("disconnect", () => {
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

server.listen(PORT, () => {
  console.log(`Retro Party backend listening on :${PORT}`);
});
