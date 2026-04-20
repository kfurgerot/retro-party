import { C2S_EVENTS, S2C_EVENTS } from "../../../shared/contracts/socketEvents.js";
export function registerSocketHandlers(deps) {
  const {
    io,
    attachSocketToRadarRoom,
    detachSocketFromRadarRoom,
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
    schedulePokerDisconnectCleanup,
    scheduleDisconnectCleanup,
    removePlayerNow,
  } = deps;

  io.on("connection", (socket) => {
    socket.emit(S2C_EVENTS.SERVER_HELLO, { ok: true });

    socket.on(C2S_EVENTS.JOIN_RADAR_ROOM, ({ code }) => {
      const joined = attachSocketToRadarRoom(socket, code);
      if (!joined) return;
      socket.emit(S2C_EVENTS.RADAR_ROOM_JOINED, { code: joined });
    });

    socket.on(C2S_EVENTS.LEAVE_RADAR_ROOM, ({ code } = {}) => {
      detachSocketFromRadarRoom(socket, code);
    });

    socket.on(C2S_EVENTS.CREATE_POKER_ROOM, ({ name, avatar, role, voteSystem, sessionId }) => {
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
      socket.emit(S2C_EVENTS.POKER_ROOM_CREATED, { code });
      broadcastPokerLobby(code);
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.JOIN_POKER_ROOM, ({ code, name, avatar, role, sessionId }) => {
      const room = pokerRooms.get(code);
      if (!room)
        return socket.emit(S2C_EVENTS.POKER_ERROR_MESSAGE, { message: "Room introuvable" });

      const requestedSessionId = typeof sessionId === "string" ? sessionId : null;
      if (requestedSessionId) {
        const existing = room.lobby.find((player) => player.sessionId === requestedSessionId);
        if (existing) {
          attachSocketToExistingPokerPlayer(code, room, existing, socket);
          socket.emit(S2C_EVENTS.POKER_ROOM_RECONNECTED, { code });
          broadcastPokerLobby(code);
          broadcastPokerState(code);
          return;
        }
      }

      if (room.lobby.length >= POKER_MAX_PLAYERS) {
        return socket.emit(S2C_EVENTS.POKER_ERROR_MESSAGE, {
          message: "Room pleine (20 joueurs max)",
        });
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

      socket.emit(S2C_EVENTS.POKER_ROOM_JOINED, { code });
      broadcastPokerLobby(code);
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.RECONNECT_POKER_ROOM, ({ code, sessionId }) => {
      if (!code || typeof sessionId !== "string") return;
      const room = pokerRooms.get(code);
      if (!room)
        return socket.emit(S2C_EVENTS.POKER_ERROR_MESSAGE, { message: "Room introuvable" });

      const existing = room.lobby.find((player) => player.sessionId === sessionId);
      if (!existing)
        return socket.emit(S2C_EVENTS.POKER_ERROR_MESSAGE, { message: "Session introuvable" });

      attachSocketToExistingPokerPlayer(code, room, existing, socket);
      socket.emit(S2C_EVENTS.POKER_ROOM_RECONNECTED, { code });
      broadcastPokerLobby(code);
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.LEAVE_POKER_ROOM, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      socket.leave(code);
      removePokerPlayerNow(code, socket.id);
    });

    socket.on(C2S_EVENTS.START_POKER_SESSION, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;

      room.phase = "playing";
      room.sessionEnded = false;
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

    socket.on(C2S_EVENTS.SET_VOTE_SYSTEM, ({ voteSystem }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;

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

    socket.on(C2S_EVENTS.SET_POKER_ROLE, ({ role }) => {
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

    socket.on(C2S_EVENTS.VOTE_CARD, ({ value }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;
      if (!room.votesOpen) return;
      if (room.revealed) return;

      const player = room.lobby.find((entry) => entry.socketId === socket.id);
      if (!player || player.role !== "player") return;

      const nextVote = typeof value === "string" ? value.trim().slice(0, 12) : "";

      if (!nextVote) {
        player.hasVoted = false;
        player.vote = null;
      } else {
        player.hasVoted = true;
        player.vote = nextVote;
      }
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.REVEAL_VOTES, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;
      if (!room.votesOpen) return;

      room.revealed = true;
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.OPEN_VOTES, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;

      room.returnStoryTitle = null;
      room.votesOpen = true;
      room.revealed = false;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.REVOTE_CURRENT_STORY, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;

      room.votesOpen = true;
      room.revealed = false;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.REOPEN_STORY_VOTE, ({ storyTitle, returnStoryTitle }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;

      const nextStoryTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
      if (!nextStoryTitle) return;

      const returnTitleRaw =
        typeof returnStoryTitle === "string" ? returnStoryTitle.trim().slice(0, 64) : "";
      room.returnStoryTitle = returnTitleRaw || null;
      room.storyTitle = nextStoryTitle;
      room.votesOpen = true;
      room.revealed = false;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.END_POKER_SESSION, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;

      room.sessionEnded = true;
      room.votesOpen = false;
      room.revealed = false;
      room.returnStoryTitle = null;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.RESET_VOTES, () => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;

      room.votesOpen = false;
      room.revealed = false;
      room.round += 1;
      if (room.returnStoryTitle) {
        room.storyTitle = room.returnStoryTitle;
        room.returnStoryTitle = null;
      } else if (
        Array.isArray(room.preparedStories) &&
        room.preparedStories.length > 0 &&
        room.currentStoryIndex >= 0
      ) {
        const nextIdx = room.currentStoryIndex + 1;
        if (nextIdx < room.preparedStories.length) {
          room.currentStoryIndex = nextIdx;
          room.storyTitle = room.preparedStories[nextIdx].title;
        } else {
          room.currentStoryIndex = -1;
          room.storyTitle = `Story #${room.round}`;
        }
      } else {
        room.storyTitle = `Story #${room.round}`;
      }
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.SELECT_POKER_STORY, ({ index }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;
      if (!Array.isArray(room.preparedStories)) return;
      const idx = typeof index === "number" ? Math.floor(index) : -1;
      if (idx < 0 || idx >= room.preparedStories.length) return;

      room.currentStoryIndex = idx;
      room.storyTitle = room.preparedStories[idx].title;
      room.votesOpen = false;
      room.revealed = false;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.SELECT_POKER_STORY_BY_TITLE, ({ storyTitle }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;

      const nextTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
      if (!nextTitle) return;

      room.currentStoryIndex = Array.isArray(room.preparedStories)
        ? room.preparedStories.findIndex((story) => story?.title === nextTitle)
        : -1;
      room.storyTitle = nextTitle;
      room.returnStoryTitle = null;
      room.votesOpen = false;
      room.revealed = false;
      room.lobby = room.lobby.map((player) => ({
        ...player,
        hasVoted: false,
        vote: null,
      }));
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.UPDATE_POKER_STORY_TITLE, ({ index, storyTitle }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;
      if (!Array.isArray(room.preparedStories)) return;

      const idx = typeof index === "number" ? Math.floor(index) : -1;
      if (idx < 0 || idx >= room.preparedStories.length) return;

      const nextTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
      if (!nextTitle) return;

      const currentStory = room.preparedStories[idx];
      const previousTitle = typeof currentStory?.title === "string" ? currentStory.title : "";
      if (previousTitle === nextTitle) return;

      room.preparedStories[idx] = {
        ...currentStory,
        title: nextTitle,
      };

      if (room.currentStoryIndex === idx) {
        room.storyTitle = nextTitle;
      }
      if (room.returnStoryTitle && room.returnStoryTitle === previousTitle) {
        room.returnStoryTitle = nextTitle;
      }

      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.ADD_POKER_STORY, ({ storyTitle }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.phase !== "playing") return;
      if (room.sessionEnded) return;
      if (!room.isPreparedSession) return;

      const nextTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
      if (!nextTitle) return;

      const nextStory = {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: nextTitle,
        description: null,
      };
      room.preparedStories = Array.isArray(room.preparedStories)
        ? [...room.preparedStories, nextStory]
        : [nextStory];

      if (room.currentStoryIndex < 0) {
        room.currentStoryIndex = 0;
        room.storyTitle = nextTitle;
      }

      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.SET_STORY_TITLE, ({ storyTitle }) => {
      const code = socketToPokerRoom.get(socket.id);
      if (!code) return;
      const room = pokerRooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (room.sessionEnded) return;

      const nextTitle = typeof storyTitle === "string" ? storyTitle.trim().slice(0, 64) : "";
      room.storyTitle = nextTitle || `Story #${room.round}`;
      broadcastPokerState(code);
    });

    socket.on(C2S_EVENTS.CREATE_ROOM, ({ name, avatar, sessionId }) => {
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
      socket.emit(S2C_EVENTS.ROOM_CREATED, { code });
      broadcastLobby(code);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.JOIN_ROOM, ({ code, name, avatar, sessionId }) => {
      const room = rooms.get(code);
      if (!room) return socket.emit(S2C_EVENTS.ERROR_MESSAGE, { message: "Room introuvable" });

      const requestedSessionId = typeof sessionId === "string" ? sessionId : null;
      if (requestedSessionId) {
        const existing = room.lobby.find((p) => p.sessionId === requestedSessionId);
        if (existing) {
          attachSocketToExistingPlayer(code, room, existing, socket);
          socket.emit(S2C_EVENTS.ROOM_RECONNECTED, { code });
          broadcastLobby(code);
          broadcastState(code);
          return;
        }
      }

      if (room.state.phase === "results") {
        return socket.emit(S2C_EVENTS.ERROR_MESSAGE, { message: "Partie terminee" });
      }
      if (room.lobby.length >= MAX_PLAYERS) {
        return socket.emit(S2C_EVENTS.ERROR_MESSAGE, { message: "Room pleine (20 joueurs max)" });
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

      socket.emit(S2C_EVENTS.ROOM_JOINED, { code });
      broadcastLobby(code);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.RECONNECT_ROOM, ({ code, sessionId }) => {
      if (!code || typeof sessionId !== "string") return;
      const room = rooms.get(code);
      if (!room) return socket.emit(S2C_EVENTS.ERROR_MESSAGE, { message: "Room introuvable" });

      const existing = room.lobby.find((p) => p.sessionId === sessionId);
      if (!existing)
        return socket.emit(S2C_EVENTS.ERROR_MESSAGE, { message: "Session introuvable" });

      attachSocketToExistingPlayer(code, room, existing, socket);
      socket.emit(S2C_EVENTS.ROOM_RECONNECTED, { code });
      broadcastLobby(code);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.LEAVE_ROOM, () => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      socket.leave(code);
      removePlayerNow(code, socket.id);
    });

    socket.on(C2S_EVENTS.START_GAME, ({ maxRounds } = {}) => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;

      if (room.hostSocketId !== socket.id) return;

      const connectedPlayers = room.lobby.filter((p) => p.connected !== false);
      const rounds = Number.isFinite(maxRounds)
        ? Math.max(1, Math.min(30, Math.floor(maxRounds)))
        : 12;
      room.state = initializePlayers(room.state, connectedPlayers, rounds);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.ROLL_DICE, () => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = rollDice(room.state, socket.id);
      broadcastState(code);
      if (isPointDuelActive(room)) {
        const waitMs = Math.max(
          30,
          (room.state.currentMinigame?.nextStepAt ?? Date.now()) - Date.now() + 5,
        );
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

    socket.on(C2S_EVENTS.MOVE_PLAYER, ({ steps }) => {
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

    socket.on(C2S_EVENTS.CHOOSE_PATH, ({ nextTileId }) => {
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

    socket.on(C2S_EVENTS.RESOLVE_KUDO_PURCHASE, ({ buyKudo }) => {
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

    socket.on(C2S_EVENTS.OPEN_SHOP, () => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = openShopForPlayer(room.state, socket.id);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.CLOSE_SHOP, () => {
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

    socket.on(C2S_EVENTS.BUY_SHOP_ITEM, ({ itemType }) => {
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

    socket.on(C2S_EVENTS.USE_SHOP_ITEM, ({ itemInstanceId, payload }) => {
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

    socket.on(C2S_EVENTS.POINT_DUEL_ROLL, () => {
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

    socket.on(C2S_EVENTS.RESOLVE_PRE_ROLL_CHOICE, ({ itemInstanceId } = {}) => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = resolvePreRollChoice(room.state, socket.id, itemInstanceId ?? null);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.VOTE_QUESTION, ({ vote }) => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = voteQuestion(room.state, socket.id, vote);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.OPEN_QUESTION, () => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = openQuestion(room.state, socket.id);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.VALIDATE_QUESTION, () => {
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

    socket.on(C2S_EVENTS.BUG_SMASH_COMPLETE, ({ score }) => {
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

    socket.on(C2S_EVENTS.BUG_SMASH_PROGRESS, ({ score }) => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = updateBugSmashProgress(room.state, socket.id, score);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.BUZZWORD_SUBMIT, ({ category }) => {
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
          setBuzzwordTimer(
            room,
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

    socket.on(C2S_EVENTS.WSI_SUBMIT, ({ roundIndex, role }) => {
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
    socket.on(C2S_EVENTS.NEXT_TURN, () => {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (isWhoSaidItActive(room) || isBuzzwordDuelActive(room) || isPointDuelActive(room)) return;

      room.state = nextTurn(room.state);
      broadcastState(code);
    });

    socket.on(C2S_EVENTS.RESET_GAME, () => {
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
      socketToRadarRoom.delete(socket.id);

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
}
