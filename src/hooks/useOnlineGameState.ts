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

type LobbyPlayer = { socketId?: string; name: string; avatar: number; isHost: boolean };
type OnlineSession = {
  code: string;
  name: string;
  avatar: number;
  sessionId: string;
};

const EMPTY_STATE: GameState = {
  phase: "lobby",
  players: [],
  currentPlayerIndex: 0,
  currentRound: 1,
  maxRounds: 12,
  tiles: [],
  diceValue: null,
  isRolling: false,
  currentQuestion: null,
  questionHistory: [],
};

const SESSION_STORAGE_KEY = "retro-party:online-session";

const makeSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

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

const loadStoredSession = (): OnlineSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isOnlineSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const storeSession = (session: OnlineSession | null) => {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export function useOnlineGameState() {
  const initialSession = loadStoredSession();
  const [code, setCode] = useState<string | null>(initialSession?.code ?? null);
  const [lobby, setLobby] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState>(EMPTY_STATE);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [whoSaidIt, setWhoSaidIt] = useState<WhoSaidItViewState | null>(null);

  const sessionRef = useRef<OnlineSession | null>(initialSession);
  const pendingProfileRef = useRef<{ name: string; avatar: number; sessionId: string } | null>(
    initialSession
      ? { name: initialSession.name, avatar: initialSession.avatar, sessionId: initialSession.sessionId }
      : null
  );
  const minigameCleanupRef = useRef<number | null>(null);

  useEffect(() => {
    const onState = (state: GameState) => setGameState(state);
    const onLobby = ({ players }: { players: LobbyPlayer[] }) => setLobby(players);
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
      const activeSession = sessionRef.current;
      if (activeSession?.code) {
        socket.emit("reconnect_room", {
          code: activeSession.code,
          sessionId: activeSession.sessionId,
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onRoomClosed = () => {
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
      sessionRef.current = null;
      pendingProfileRef.current = null;
      storeSession(null);
      setCode(null);
      setLobby([]);
      setGameState(EMPTY_STATE);
      setWhoSaidIt(null);
    };
    const onError = ({ message }: { message?: string }) => {
      const normalized = message?.toLowerCase() ?? "";
      const shouldResetSession =
        normalized.includes("room introuvable") ||
        normalized.includes("session introuvable");
      if (!shouldResetSession) return;
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
      sessionRef.current = null;
      pendingProfileRef.current = null;
      storeSession(null);
      setCode(null);
      setLobby([]);
      setGameState(EMPTY_STATE);
      setWhoSaidIt(null);
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

    socket.on("state_update", onState);
    socket.on("lobby_update", onLobby);
    socket.on("room_created", onRoomKnown);
    socket.on("room_joined", onRoomKnown);
    socket.on("room_reconnected", onRoomKnown);
    socket.on("room_closed", onRoomClosed);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error_msg", onError);
    socket.on("MINIGAME_START", onWhoSaidItStart);
    socket.on("WSI_ROUND_START", onWhoSaidItRoundStart);
    socket.on("WSI_ROUND_REVEAL", onWhoSaidItRoundReveal);
    socket.on("MINIGAME_END", onWhoSaidItEnd);

    if (socket.connected) onConnect();

    return () => {
      socket.off("state_update", onState);
      socket.off("lobby_update", onLobby);
      socket.off("room_created", onRoomKnown);
      socket.off("room_joined", onRoomKnown);
      socket.off("room_reconnected", onRoomKnown);
      socket.off("room_closed", onRoomClosed);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error_msg", onError);
      socket.off("MINIGAME_START", onWhoSaidItStart);
      socket.off("WSI_ROUND_START", onWhoSaidItRoundStart);
      socket.off("WSI_ROUND_REVEAL", onWhoSaidItRoundReveal);
      socket.off("MINIGAME_END", onWhoSaidItEnd);
      if (minigameCleanupRef.current) {
        window.clearTimeout(minigameCleanupRef.current);
        minigameCleanupRef.current = null;
      }
    };
  }, []);

  const createRoom = useCallback((name: string, avatar: number) => {
    const normalizedName = name.trim() || "Host";
    const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
    pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
    if (!socket.connected) socket.connect();
    socket.emit("create_room", { name: normalizedName, avatar, sessionId });
  }, []);

  const joinRoom = useCallback((roomCode: string, name: string, avatar: number) => {
    const normalizedName = name.trim() || "Player";
    const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
    pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
    if (!socket.connected) socket.connect();
    socket.emit("join_room", { code: roomCode, name: normalizedName, avatar, sessionId });
  }, []);

  const leaveRoom = useCallback(() => {
    if (socket.connected) socket.emit("leave_room");
    if (minigameCleanupRef.current) {
      window.clearTimeout(minigameCleanupRef.current);
      minigameCleanupRef.current = null;
    }
    sessionRef.current = null;
    pendingProfileRef.current = null;
    storeSession(null);
    setCode(null);
    setLobby([]);
    setGameState(EMPTY_STATE);
    setWhoSaidIt(null);
  }, []);

  const startGame = useCallback(() => socket.emit("start_game"), []);
  const rollDice = useCallback(() => socket.emit("roll_dice"), []);
  const movePlayer = useCallback((steps: number) => socket.emit("move_player", { steps }), []);
  const openQuestionCard = useCallback(() => socket.emit("open_question"), []);
  const voteQuestion = useCallback((vote: "up" | "down") => socket.emit("vote_question", { vote }), []);
  const validateQuestion = useCallback(() => socket.emit("validate_question"), []);
  const resetGame = useCallback(() => socket.emit("reset_game"), []);
  const submitWhoSaidIt = useCallback((role: WhoSaidItRole) => {
    setWhoSaidIt((prev) => {
      if (!prev || prev.phase !== "answer") return prev;
      socket.emit("WSI_SUBMIT", { roundIndex: prev.roundIndex, role });
      return { ...prev, selectedRole: role };
    });
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
    myPlayerId,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    rollDice,
    movePlayer,
    openQuestionCard,
    voteQuestion,
    validateQuestion,
    resetGame,
    whoSaidIt,
    submitWhoSaidIt,
    isHost,
  };
}
