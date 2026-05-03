import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GameState,
  WhoSaidItRole,
  WhoSaidItRoundRevealPayload,
  WhoSaidItRoundStartPayload,
  WhoSaidItSummaryPayload,
  WhoSaidItViewState,
} from "@/types/game";
import { socket } from "@/net/socket";
import { C2S_EVENTS, S2C_EVENTS } from "@shared/contracts/socketEvents.js";

type LobbyPlayer = {
  socketId?: string;
  sessionId?: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected?: boolean;
};
type RoomPresenceNotice = {
  id: number;
  message: string;
};
type OnlineSession = {
  code: string;
  name: string;
  avatar: number;
  sessionId: string;
  updatedAt?: number;
};

const EMPTY_STATE: GameState = {
  phase: "lobby",
  players: [],
  currentPlayerIndex: 0,
  currentRound: 1,
  maxRounds: 12,
  tiles: [],
  diceValue: null,
  lastRollResult: null,
  isRolling: false,
  turnPhase: "finished",
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
  actionLogs: [],
  lastMoveTrace: null,
  questionHistory: [],
};

const SESSION_STORAGE_KEY = "retro-party:online-session";
let sessionFallbackCounter = 0;

const makeSessionId = () => {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    webCrypto.getRandomValues(bytes);
    const randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `session-${Date.now()}-${randomHex}`;
  }

  sessionFallbackCounter += 1;
  return `session-${Date.now()}-${sessionFallbackCounter.toString(36)}`;
};

const normalizeCode = (value: string | null | undefined) => (value || "").trim().toUpperCase();

const isOnlineSession = (value: unknown): value is OnlineSession => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnlineSession>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.avatar === "number" &&
    typeof candidate.sessionId === "string"
  );
};

const loadStoredSessions = (): Record<string, OnlineSession> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (isOnlineSession(parsed)) return { [normalizeCode(parsed.code)]: parsed };

    const sessions = parsed?.sessions;
    if (!sessions || typeof sessions !== "object") return {};

    return Object.fromEntries(
      Object.entries(sessions as Record<string, unknown>)
        .filter(([, session]) => isOnlineSession(session))
        .map(([code, session]) => [normalizeCode(code), session as OnlineSession]),
    );
  } catch {
    return {};
  }
};

const loadStoredSession = (code?: string | null): OnlineSession | null => {
  const sessions = loadStoredSessions();
  const requestedCode = normalizeCode(code);
  if (requestedCode) return sessions[requestedCode] ?? null;
  return Object.values(sessions).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0] ?? null;
};

const storeSession = (session: OnlineSession) => {
  if (typeof window === "undefined") return;
  const sessions = loadStoredSessions();
  const code = normalizeCode(session.code);
  if (!code) return;
  sessions[code] = { ...session, code, updatedAt: Date.now() };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ sessions }));
};

const removeStoredSession = (code?: string | null) => {
  if (typeof window === "undefined") return;
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  const sessions = loadStoredSessions();
  delete sessions[normalizedCode];
  if (Object.keys(sessions).length === 0) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ sessions }));
  }
};

type UseOnlineGameStateOptions = {
  skipRestore?: boolean;
  restoreCode?: string | null;
};

export function useOnlineGameState(options: UseOnlineGameStateOptions = {}) {
  const skipRestore = options.skipRestore === true;
  const initialSession = skipRestore ? null : loadStoredSession(options.restoreCode);
  const [code, setCode] = useState<string | null>(initialSession?.code ?? null);
  const [lobby, setLobby] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState>(EMPTY_STATE);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [whoSaidIt, setWhoSaidIt] = useState<WhoSaidItViewState | null>(null);
  const [roomNotice, setRoomNotice] = useState<RoomPresenceNotice | null>(null);

  const sessionRef = useRef<OnlineSession | null>(initialSession);
  const pendingProfileRef = useRef<{ name: string; avatar: number; sessionId: string } | null>(
    initialSession
      ? {
          name: initialSession.name,
          avatar: initialSession.avatar,
          sessionId: initialSession.sessionId,
        }
      : null,
  );
  const minigameCleanupRef = useRef<number | null>(null);
  const previousLobbyRef = useRef<LobbyPlayer[] | null>(null);
  const roomNoticeSeqRef = useRef(0);

  useEffect(() => {
    const tryResumeSession = () => {
      if (skipRestore) return;
      const activeSession = sessionRef.current;
      if (!activeSession?.code) return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.emit(C2S_EVENTS.RECONNECT_ROOM, {
        code: activeSession.code,
        sessionId: activeSession.sessionId,
      });
    };

    const onState = (state: GameState) => setGameState(state);
    const onLobby = ({ players }: { players: LobbyPlayer[] }) => {
      const nextLobby = Array.isArray(players) ? players : [];
      const previousLobby = previousLobbyRef.current;
      setLobby(nextLobby);

      if (!previousLobby) {
        previousLobbyRef.current = nextLobby;
        return;
      }

      const presenceKey = (player: LobbyPlayer, index: number) =>
        player.sessionId || player.socketId || `${player.name}-${index}`;
      const selfSessionId = sessionRef.current?.sessionId ?? null;
      const isSelf = (player: LobbyPlayer) =>
        (!!selfSessionId && player.sessionId === selfSessionId) ||
        (!!player.socketId && player.socketId === socket.id);
      const prevById = new Map(
        previousLobby.map((player, index) => [presenceKey(player, index), player]),
      );
      const nextById = new Map(
        nextLobby.map((player, index) => [presenceKey(player, index), player]),
      );

      const notices: string[] = [];

      for (const [socketId, player] of nextById) {
        if (!socketId || prevById.has(socketId)) continue;
        if (isSelf(player)) continue;
        notices.push(`${player.name} a rejoint la partie`);
      }

      for (const [socketId, player] of prevById) {
        if (!socketId || nextById.has(socketId)) continue;
        if (isSelf(player)) continue;
        notices.push(`${player.name} a quitte la partie`);
      }

      for (const [socketId, nextPlayer] of nextById) {
        if (!socketId) continue;
        const prevPlayer = prevById.get(socketId);
        if (!prevPlayer) continue;
        if (isSelf(nextPlayer)) continue;

        const wasConnected = prevPlayer.connected !== false;
        const isConnectedNow = nextPlayer.connected !== false;

        if (!wasConnected && isConnectedNow) {
          notices.push(`${nextPlayer.name} a rejoint la partie`);
        } else if (wasConnected && !isConnectedNow) {
          notices.push(`${nextPlayer.name} a quitte la partie`);
        }
      }

      if (notices.length > 0 && sessionRef.current?.code) {
        roomNoticeSeqRef.current += 1;
        setRoomNotice({
          id: roomNoticeSeqRef.current,
          message: notices[0],
        });
      }

      previousLobbyRef.current = nextLobby;
    };
    const onRoomKnown = ({ code: roomCode }: { code: string }) => {
      setCode(roomCode);
      if (!pendingProfileRef.current) return;

      const nextSession: OnlineSession = {
        code: roomCode,
        name: pendingProfileRef.current.name,
        avatar: pendingProfileRef.current.avatar,
        sessionId: pendingProfileRef.current.sessionId,
      };
      sessionRef.current = nextSession;
      storeSession(nextSession);
    };
    const onConnect = () => {
      setMyPlayerId(socket.id ?? null);
      setConnected(true);
      tryResumeSession();
    };
    const onDisconnect = () => setConnected(false);
    const onRoomClosed = () => {
      const previousCode = sessionRef.current?.code;
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
      sessionRef.current = null;
      pendingProfileRef.current = null;
      removeStoredSession(previousCode);
      setCode(null);
      setLobby([]);
      previousLobbyRef.current = null;
      setGameState(EMPTY_STATE);
      setWhoSaidIt(null);
      setRoomNotice(null);
    };
    const onError = ({ message }: { message?: string }) => {
      const normalized = message?.toLowerCase() ?? "";
      const shouldResetSession =
        normalized.includes("room introuvable") || normalized.includes("session introuvable");
      if (!shouldResetSession) return;
      const previousCode = sessionRef.current?.code;
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
      sessionRef.current = null;
      pendingProfileRef.current = null;
      removeStoredSession(previousCode);
      setCode(null);
      setLobby([]);
      previousLobbyRef.current = null;
      setGameState(EMPTY_STATE);
      setWhoSaidIt(null);
      setRoomNotice(null);
    };
    const onWhoSaidItStart = ({
      minigameId,
      rounds,
    }: {
      minigameId: "WHO_SAID_IT";
      rounds: number;
    }) => {
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
      setWhoSaidIt({
        minigameId,
        totalRounds: rounds,
        phase: "idle",
        roundIndex: 1,
        quoteId: null,
        quoteText: "",
        endsAtServerTs: null,
        selectedRole: null,
        answerRole: null,
        distribution: {
          MANAGER: 0,
          PO: 0,
          DEV: 0,
          SCRUM_MASTER: 0,
          QA_SUPPORT: 0,
        },
        winners: [],
        pointsDelta: {},
        summary: null,
      });
    };
    const onWhoSaidItRoundStart = (payload: WhoSaidItRoundStartPayload) => {
      setWhoSaidIt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: "answer",
          roundIndex: payload.roundIndex,
          quoteId: payload.quoteId,
          quoteText: payload.text,
          endsAtServerTs: payload.endsAtServerTs,
          selectedRole: null,
          answerRole: null,
          winners: [],
          pointsDelta: {},
          distribution: {
            MANAGER: 0,
            PO: 0,
            DEV: 0,
            SCRUM_MASTER: 0,
            QA_SUPPORT: 0,
          },
        };
      });
    };
    const onWhoSaidItRoundReveal = (payload: WhoSaidItRoundRevealPayload) => {
      setWhoSaidIt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: "reveal",
          roundIndex: payload.roundIndex,
          answerRole: payload.answerRole,
          distribution: payload.distribution,
          winners: payload.winners,
          pointsDelta: payload.pointsDelta,
        };
      });
    };
    const onWhoSaidItEnd = ({ summary }: { summary: WhoSaidItSummaryPayload }) => {
      setWhoSaidIt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phase: "done",
          summary,
        };
      });

      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
      }
      minigameCleanupRef.current = window.setTimeout(() => {
        setWhoSaidIt(null);
        minigameCleanupRef.current = null;
      }, 2500);
    };

    socket.on(S2C_EVENTS.STATE_UPDATE, onState);
    socket.on(S2C_EVENTS.LOBBY_UPDATE, onLobby);
    socket.on(S2C_EVENTS.ROOM_CREATED, onRoomKnown);
    socket.on(S2C_EVENTS.ROOM_JOINED, onRoomKnown);
    socket.on(S2C_EVENTS.ROOM_RECONNECTED, onRoomKnown);
    socket.on(S2C_EVENTS.ROOM_CLOSED, onRoomClosed);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(S2C_EVENTS.ERROR_MESSAGE, onError);
    socket.on(S2C_EVENTS.MINIGAME_START, onWhoSaidItStart);
    socket.on(S2C_EVENTS.WSI_ROUND_START, onWhoSaidItRoundStart);
    socket.on(S2C_EVENTS.WSI_ROUND_REVEAL, onWhoSaidItRoundReveal);
    socket.on(S2C_EVENTS.MINIGAME_END, onWhoSaidItEnd);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      tryResumeSession();
    };
    const onWindowFocus = () => {
      tryResumeSession();
    };
    const onNetworkBack = () => {
      tryResumeSession();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("online", onNetworkBack);

    if (socket.connected) onConnect();

    return () => {
      socket.off(S2C_EVENTS.STATE_UPDATE, onState);
      socket.off(S2C_EVENTS.LOBBY_UPDATE, onLobby);
      socket.off(S2C_EVENTS.ROOM_CREATED, onRoomKnown);
      socket.off(S2C_EVENTS.ROOM_JOINED, onRoomKnown);
      socket.off(S2C_EVENTS.ROOM_RECONNECTED, onRoomKnown);
      socket.off(S2C_EVENTS.ROOM_CLOSED, onRoomClosed);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(S2C_EVENTS.ERROR_MESSAGE, onError);
      socket.off(S2C_EVENTS.MINIGAME_START, onWhoSaidItStart);
      socket.off(S2C_EVENTS.WSI_ROUND_START, onWhoSaidItRoundStart);
      socket.off(S2C_EVENTS.WSI_ROUND_REVEAL, onWhoSaidItRoundReveal);
      socket.off(S2C_EVENTS.MINIGAME_END, onWhoSaidItEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onNetworkBack);
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
    };
  }, [skipRestore]);

  const createRoom = useCallback((name: string, avatar: number) => {
    const normalizedName = name.trim() || "Hote";
    const sessionId = makeSessionId();
    pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
    if (!socket.connected) socket.connect();
    socket.emit(C2S_EVENTS.CREATE_ROOM, { name: normalizedName, avatar, sessionId });
  }, []);

  const joinRoom = useCallback((roomCode: string, name: string, avatar: number) => {
    const normalizedName = name.trim() || "Joueur";
    const normalizedRoomCode = normalizeCode(roomCode);
    const sessionId =
      sessionRef.current?.code === normalizedRoomCode
        ? sessionRef.current.sessionId
        : makeSessionId();
    pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
    if (!socket.connected) socket.connect();
    socket.emit(C2S_EVENTS.JOIN_ROOM, { code: roomCode, name: normalizedName, avatar, sessionId });
  }, []);

  const leaveRoom = useCallback(async () => {
    // Soft-leave côté serveur : le slot est conservé pour permettre la
    // reconnexion (RECONNECT_ROOM avec le même sessionId), tant que la
    // session n'est pas terminée par le host (POST /sessions/:code/end).
    // La sessionId reste donc en localStorage pour que /play?code=XXX
    // ré-hydrate proprement et reattach automatiquement le slot existant
    // (notice "X a rejoint" côté autres joueurs).
    if (socket.connected) {
      await new Promise<void>((resolve) => {
        socket.timeout(1500).emit(C2S_EVENTS.LEAVE_ROOM, () => {
          resolve();
        });
      });
    }
    if (minigameCleanupRef.current) {
      window.clearTimeout(minigameCleanupRef.current);
      minigameCleanupRef.current = null;
    }
    sessionRef.current = null;
    pendingProfileRef.current = null;
    setCode(null);
    setLobby([]);
    previousLobbyRef.current = null;
    setGameState(EMPTY_STATE);
    setWhoSaidIt(null);
    setRoomNotice(null);
  }, []);

  const startGame = useCallback(
    (maxRounds: number) => socket.emit(C2S_EVENTS.START_GAME, { maxRounds }),
    [],
  );
  const rollDice = useCallback(() => socket.emit(C2S_EVENTS.ROLL_DICE), []);
  const movePlayer = useCallback(
    (steps: number) => socket.emit(C2S_EVENTS.MOVE_PLAYER, { steps }),
    [],
  );
  const choosePath = useCallback(
    (nextTileId: number) => socket.emit(C2S_EVENTS.CHOOSE_PATH, { nextTileId }),
    [],
  );
  const resolveKudoPurchase = useCallback((buyKudo: boolean) => {
    socket.emit(C2S_EVENTS.RESOLVE_KUDO_PURCHASE, { buyKudo });
  }, []);
  const openShop = useCallback(() => socket.emit(C2S_EVENTS.OPEN_SHOP), []);
  const closeShop = useCallback(() => socket.emit(C2S_EVENTS.CLOSE_SHOP), []);
  const buyShopItem = useCallback((itemType: string) => {
    socket.emit(C2S_EVENTS.BUY_SHOP_ITEM, { itemType });
  }, []);
  const useShopItem = useCallback((itemInstanceId: string, payload?: Record<string, unknown>) => {
    socket.emit(C2S_EVENTS.USE_SHOP_ITEM, { itemInstanceId, payload: payload ?? {} });
  }, []);
  const resolvePreRollChoice = useCallback((itemInstanceId: string | null) => {
    socket.emit(C2S_EVENTS.RESOLVE_PRE_ROLL_CHOICE, { itemInstanceId });
  }, []);
  const openQuestionCard = useCallback(() => socket.emit(C2S_EVENTS.OPEN_QUESTION), []);
  const voteQuestion = useCallback(
    (vote: "up" | "down") => socket.emit(C2S_EVENTS.VOTE_QUESTION, { vote }),
    [],
  );
  const validateQuestion = useCallback(() => socket.emit(C2S_EVENTS.VALIDATE_QUESTION), []);
  const resetGame = useCallback(() => socket.emit(C2S_EVENTS.RESET_GAME), []);
  const completeBugSmash = useCallback((score: number) => {
    socket.emit(C2S_EVENTS.BUG_SMASH_COMPLETE, { score });
  }, []);
  const updateBugSmashProgress = useCallback((score: number) => {
    socket.emit(C2S_EVENTS.BUG_SMASH_PROGRESS, { score });
  }, []);
  const submitWhoSaidIt = useCallback((role: WhoSaidItRole) => {
    setWhoSaidIt((prev) => {
      if (!prev || prev.phase !== "answer") return prev;
      socket.emit(C2S_EVENTS.WSI_SUBMIT, { roundIndex: prev.roundIndex, role });
      return { ...prev, selectedRole: role };
    });
  }, []);
  const submitBuzzwordDuel = useCallback((category: "LEGIT" | "BULLSHIT") => {
    socket.emit(C2S_EVENTS.BUZZWORD_SUBMIT, { category });
  }, []);
  const rollPointDuel = useCallback(() => {
    socket.emit(C2S_EVENTS.POINT_DUEL_ROLL);
  }, []);

  const isHost = useMemo(() => {
    if (!myPlayerId) return false;
    return lobby.some((p) => p.isHost && p.socketId === myPlayerId);
  }, [lobby, myPlayerId]);

  return {
    connected,
    code,
    lobby,
    gameState,
    roomNotice,
    myPlayerId,
    sessionId: sessionRef.current?.sessionId ?? null,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    rollDice,
    movePlayer,
    choosePath,
    resolveKudoPurchase,
    openShop,
    closeShop,
    buyShopItem,
    useShopItem,
    resolvePreRollChoice,
    openQuestionCard,
    voteQuestion,
    validateQuestion,
    completeBugSmash,
    updateBugSmashProgress,
    resetGame,
    whoSaidIt,
    submitWhoSaidIt,
    submitBuzzwordDuel,
    rollPointDuel,
    isHost,
  };
}
