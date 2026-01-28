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
  voteQuestion,
  validateQuestion,
  nextTurn,
  resetGame,
} from "./gameLogic.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ORIGIN = process.env.ORIGIN || true; // in prod set to your https domain

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

const rooms = new Map(); // code -> { state, hostSocketId, clients: Set<socketId>, lobby: [] }
const socketToRoom = new Map(); // socketId -> code

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

io.on("connection", (socket) => {
  socket.emit("server_hello", { ok: true });

  socket.on("create_room", ({ name, avatar }) => {
    const code = makeCode();
    const state = createInitialState();
    rooms.set(code, {
      state,
      hostSocketId: socket.id,
      clients: new Set([socket.id]),
      lobby: [{ socketId: socket.id, name: name || "Host", avatar: avatar ?? 0, isHost: true }],
    });
    socketToRoom.set(socket.id, code);
    socket.join(code);
    socket.emit("room_created", { code });
    io.to(code).emit("lobby_update", { players: rooms.get(code).lobby });
    broadcastState(code);
  });

  socket.on("join_room", ({ code, name, avatar }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit("error_msg", { message: "Room introuvable" });

    room.clients.add(socket.id);
    room.lobby.push({ socketId: socket.id, name: name || "Player", avatar: avatar ?? 0, isHost: false });
    socketToRoom.set(socket.id, code);
    socket.join(code);

    socket.emit("room_joined", { code });
    io.to(code).emit("lobby_update", { players: room.lobby });
    broadcastState(code);
  });

  socket.on("start_game", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (room.hostSocketId !== socket.id) return;

    room.state = initializePlayers(room.state, room.lobby);
    broadcastState(code);
  });

  socket.on("roll_dice", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

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

    room.state = voteQuestion(room.state, socket.id, vote);
    broadcastState(code);
  });

  socket.on("validate_question", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    room.state = validateQuestion(room.state, socket.id);
    broadcastState(code);
  });

  // Optional manual next turn (host debugging)
  socket.on("next_turn", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.state = nextTurn(room.state);
    broadcastState(code);
  });

  socket.on("reset_game", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId !== socket.id) return;

    room.state = resetGame(room.state);
    io.to(code).emit("lobby_update", { players: room.lobby });
    broadcastState(code);
  });

  socket.on("disconnect", () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    socketToRoom.delete(socket.id);

    if (!room) return;

    room.clients.delete(socket.id);
    room.lobby = room.lobby.filter((p) => p.socketId !== socket.id);

    if (room.clients.size === 0) {
      rooms.delete(code);
      return;
    }

    // If host left, assign a new host
    if (room.hostSocketId === socket.id) {
      const newHost = [...room.clients][0];
      room.hostSocketId = newHost;
      room.lobby = room.lobby.map((p) => ({ ...p, isHost: p.socketId === newHost }));
      if (room.state?.players?.length) {
        room.state.players = room.state.players.map((p) => ({ ...p, isHost: p.id === newHost }));
      }
    }

    io.to(code).emit("lobby_update", { players: room.lobby });
    broadcastState(code);
  });
});

server.listen(PORT, () => {
  console.log(`Retro Party backend listening on :${PORT}`);
});
