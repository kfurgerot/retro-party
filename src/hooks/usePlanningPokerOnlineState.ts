import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "@/net/socket";
import { C2S_EVENTS, S2C_EVENTS } from "@shared/contracts/socketEvents.js";
import {
  PlanningPokerRole,
  PlanningPokerRoundSummary,
  PlanningPokerState,
  PlanningPokerVoteSystem,
} from "@/types/planningPoker";
import { computePlanningPokerStats } from "@/lib/planningPoker";

type PlanningPokerSession = {
  code: string;
  name: string;
  avatar: number;
  sessionId: string;
};

const EMPTY_STATE: PlanningPokerState = {
  phase: "lobby",
  roomCode: null,
  storyTitle: "Story #1",
  voteSystem: "fibonacci",
  votesOpen: false,
  players: [],
  revealed: false,
  round: 1,
  updatedAt: Date.now(),
  preparedStories: [],
  currentStoryIndex: -1,
};

const STORAGE_KEY = "retro-party:planning-poker:session";
const HISTORY_STORAGE_KEY = "retro-party:planning-poker:history";
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
    return `pp-${Date.now()}-${randomHex}`;
  }

  sessionFallbackCounter += 1;
  return `pp-${Date.now()}-${sessionFallbackCounter.toString(36)}`;
};

const isSession = (value: unknown): value is PlanningPokerSession => {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<PlanningPokerSession>;
  return (
    typeof session.code === "string" &&
    typeof session.name === "string" &&
    typeof session.avatar === "number" &&
    typeof session.sessionId === "string"
  );
};

const loadSession = (): PlanningPokerSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const storeSession = (session: PlanningPokerSession | null) => {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

type PersistedHistory = {
  sessionId: string;
  code: string;
  history: PlanningPokerRoundSummary[];
};

const isRoundSummary = (value: unknown): value is PlanningPokerRoundSummary => {
  if (!value || typeof value !== "object") return false;
  const summary = value as Partial<PlanningPokerRoundSummary>;
  return (
    typeof summary.id === "string" &&
    typeof summary.round === "number" &&
    typeof summary.storyTitle === "string" &&
    typeof summary.voteSystem === "string" &&
    Array.isArray(summary.votes)
  );
};

const loadHistory = (session: PlanningPokerSession | null): PlanningPokerRoundSummary[] => {
  if (typeof window === "undefined" || !session) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedHistory>;
    const history = parsed.history;
    const sameSession =
      parsed.sessionId === session.sessionId &&
      parsed.code === session.code &&
      Array.isArray(history);
    if (!sameSession) return [];
    return history.filter(isRoundSummary);
  } catch {
    return [];
  }
};

const storeHistory = (
  session: PlanningPokerSession | null,
  history: PlanningPokerRoundSummary[],
) => {
  if (typeof window === "undefined") return;
  if (!session || history.length === 0) {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    return;
  }

  const payload: PersistedHistory = {
    sessionId: session.sessionId,
    code: session.code,
    history,
  };
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
};

export function usePlanningPokerOnlineState() {
  const initialSession = loadSession();
  const initialHistory = loadHistory(initialSession);
  const initialState = initialSession?.code
    ? { ...EMPTY_STATE, roomCode: initialSession.code }
    : EMPTY_STATE;

  const [connected, setConnected] = useState(socket.connected);
  const [code, setCode] = useState<string | null>(initialSession?.code ?? null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(socket.id ?? null);
  const [state, setState] = useState<PlanningPokerState>(initialState);
  const [history, setHistory] = useState<PlanningPokerRoundSummary[]>(initialHistory);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<PlanningPokerSession | null>(initialSession);
  const latestStateRef = useRef<PlanningPokerState>(initialState);
  const recordedSummariesRef = useRef<Set<string>>(
    new Set(initialHistory.map((entry) => entry.id)),
  );
  const pendingProfileRef = useRef<{ name: string; avatar: number; sessionId: string } | null>(
    initialSession
      ? {
          name: initialSession.name,
          avatar: initialSession.avatar,
          sessionId: initialSession.sessionId,
        }
      : null,
  );

  useEffect(() => {
    const tryResume = () => {
      const active = sessionRef.current;
      if (!active?.code) return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.emit(C2S_EVENTS.RECONNECT_POKER_ROOM, {
        code: active.code,
        sessionId: active.sessionId,
      });
    };

    const onConnect = () => {
      setConnected(true);
      setMyPlayerId(socket.id ?? null);
      tryResume();
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onStateUpdate = (nextState: PlanningPokerState) => {
      const previousState = latestStateRef.current;
      setState(nextState);
      latestStateRef.current = nextState;
      if (nextState.roomCode) {
        setCode(nextState.roomCode);
      }

      const previousTitle = previousState.storyTitle?.trim() ?? "";
      const nextTitle = nextState.storyTitle?.trim() ?? "";
      const shouldRenameArchivedStory =
        previousState.phase === "playing" &&
        nextState.phase === "playing" &&
        previousState.round === nextState.round &&
        !previousState.revealed &&
        !nextState.revealed &&
        !previousState.votesOpen &&
        !nextState.votesOpen &&
        !!previousTitle &&
        !!nextTitle &&
        previousTitle !== nextTitle;
      if (shouldRenameArchivedStory) {
        setHistory((previousHistory) => {
          const hasPreviousTitle = previousHistory.some(
            (entry) => entry.storyTitle.trim() === previousTitle,
          );
          if (!hasPreviousTitle) return previousHistory;
          const hasNextTitle = previousHistory.some(
            (entry) => entry.storyTitle.trim() === nextTitle,
          );
          if (hasNextTitle) return previousHistory;
          return previousHistory.map((entry) =>
            entry.storyTitle.trim() === previousTitle ? { ...entry, storyTitle: nextTitle } : entry,
          );
        });
      }

      if (nextState.phase !== "playing" || !nextState.roomCode || !nextState.revealed) return;
      const summaryId = `${nextState.roomCode}:${nextState.round}`;
      if (recordedSummariesRef.current.has(summaryId)) return;

      const votedPlayers = nextState.players.filter(
        (player) => player.role === "player" && player.vote != null,
      );
      const stats = computePlanningPokerStats(nextState.players, nextState.voteSystem);
      const summary: PlanningPokerRoundSummary = {
        id: summaryId,
        round: nextState.round,
        storyTitle: nextState.storyTitle,
        voteSystem: nextState.voteSystem,
        totalVotes: stats.totalVotes,
        average: stats.average,
        median: stats.median,
        min: stats.min,
        max: stats.max,
        distribution: stats.distribution,
        votes: votedPlayers.map((player) => ({
          playerName: player.name,
          avatar: player.avatar,
          value: player.vote ?? "-",
        })),
        revealedAt: nextState.updatedAt || Date.now(),
      };

      recordedSummariesRef.current.add(summaryId);
      setHistory((previous) => [...previous, summary]);
    };

    const onRoomKnown = ({ code: roomCode }: { code: string }) => {
      if (sessionRef.current?.code && sessionRef.current.code !== roomCode) {
        recordedSummariesRef.current.clear();
        setHistory([]);
      }
      setCode(roomCode);
      setError(null);
      if (!pendingProfileRef.current) return;

      const nextSession: PlanningPokerSession = {
        code: roomCode,
        name: pendingProfileRef.current.name,
        avatar: pendingProfileRef.current.avatar,
        sessionId: pendingProfileRef.current.sessionId,
      };
      sessionRef.current = nextSession;
      storeSession(nextSession);
    };

    const onError = ({ message }: { message?: string }) => {
      const text = message ?? "Erreur socket";
      setError(text);
      const normalized = text.toLowerCase();
      if (!normalized.includes("introuvable")) return;

      storeHistory(sessionRef.current, []);
      sessionRef.current = null;
      pendingProfileRef.current = null;
      recordedSummariesRef.current.clear();
      setHistory([]);
      storeSession(null);
      setCode(null);
      setState(EMPTY_STATE);
      latestStateRef.current = EMPTY_STATE;
    };

    const onRoomClosed = ({ message }: { message?: string }) => {
      setError(message ?? null);
      storeHistory(sessionRef.current, []);
      sessionRef.current = null;
      pendingProfileRef.current = null;
      recordedSummariesRef.current.clear();
      setHistory([]);
      storeSession(null);
      setCode(null);
      setState(EMPTY_STATE);
      latestStateRef.current = EMPTY_STATE;
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(S2C_EVENTS.POKER_STATE_UPDATE, onStateUpdate);
    socket.on(S2C_EVENTS.POKER_ROOM_CREATED, onRoomKnown);
    socket.on(S2C_EVENTS.POKER_ROOM_JOINED, onRoomKnown);
    socket.on(S2C_EVENTS.POKER_ROOM_RECONNECTED, onRoomKnown);
    socket.on(S2C_EVENTS.POKER_ERROR_MESSAGE, onError);
    socket.on(S2C_EVENTS.POKER_ROOM_CLOSED, onRoomClosed);

    if (socket.connected) onConnect();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      tryResume();
    };
    const onWindowFocus = () => tryResume();
    const onOnline = () => tryResume();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("online", onOnline);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(S2C_EVENTS.POKER_STATE_UPDATE, onStateUpdate);
      socket.off(S2C_EVENTS.POKER_ROOM_CREATED, onRoomKnown);
      socket.off(S2C_EVENTS.POKER_ROOM_JOINED, onRoomKnown);
      socket.off(S2C_EVENTS.POKER_ROOM_RECONNECTED, onRoomKnown);
      socket.off(S2C_EVENTS.POKER_ERROR_MESSAGE, onError);
      socket.off(S2C_EVENTS.POKER_ROOM_CLOSED, onRoomClosed);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const createRoom = useCallback(
    (
      name: string,
      avatar: number,
      role: PlanningPokerRole,
      voteSystem: PlanningPokerVoteSystem,
    ) => {
      const normalizedName = name.trim() || "Hote";
      const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
      pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
      setError(null);
      if (!socket.connected) socket.connect();
      socket.emit(C2S_EVENTS.CREATE_POKER_ROOM, {
        name: normalizedName,
        avatar,
        role,
        voteSystem,
        sessionId,
      });
    },
    [],
  );

  const joinRoom = useCallback(
    (roomCode: string, name: string, avatar: number, role: PlanningPokerRole) => {
      const normalizedName = name.trim() || "Joueur";
      const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
      pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
      setError(null);
      if (!socket.connected) socket.connect();
      socket.emit(C2S_EVENTS.JOIN_POKER_ROOM, {
        code: roomCode,
        name: normalizedName,
        avatar,
        role,
        sessionId,
      });
    },
    [],
  );

  const leaveRoom = useCallback(() => {
    if (socket.connected) {
      socket.emit(C2S_EVENTS.LEAVE_POKER_ROOM);
    }
    storeHistory(sessionRef.current, []);
    sessionRef.current = null;
    pendingProfileRef.current = null;
    recordedSummariesRef.current.clear();
    setHistory([]);
    storeSession(null);
    setCode(null);
    setState(EMPTY_STATE);
    latestStateRef.current = EMPTY_STATE;
  }, []);

  const startSession = useCallback(() => {
    socket.emit(C2S_EVENTS.START_POKER_SESSION);
  }, []);

  const voteCard = useCallback((value: string) => {
    socket.emit(C2S_EVENTS.VOTE_CARD, { value });
  }, []);

  const revealVotes = useCallback(() => {
    socket.emit(C2S_EVENTS.REVEAL_VOTES);
  }, []);

  useEffect(() => {
    storeHistory(sessionRef.current, history);
  }, [history]);

  const openVotes = useCallback(() => {
    socket.emit(C2S_EVENTS.OPEN_VOTES);
  }, []);

  const reopenStoryVote = useCallback((storyTitle: string, returnStoryTitle: string) => {
    socket.emit(C2S_EVENTS.REOPEN_STORY_VOTE, { storyTitle, returnStoryTitle });
  }, []);

  const resetVotes = useCallback(() => {
    socket.emit(C2S_EVENTS.RESET_VOTES);
  }, []);

  const revoteCurrentStory = useCallback(() => {
    socket.emit(C2S_EVENTS.REVOTE_CURRENT_STORY);
  }, []);

  const setVoteSystem = useCallback((voteSystem: PlanningPokerVoteSystem) => {
    socket.emit(C2S_EVENTS.SET_VOTE_SYSTEM, { voteSystem });
  }, []);

  const setRole = useCallback((role: PlanningPokerRole) => {
    socket.emit(C2S_EVENTS.SET_POKER_ROLE, { role });
  }, []);

  const setStoryTitle = useCallback((storyTitle: string) => {
    socket.emit(C2S_EVENTS.SET_STORY_TITLE, { storyTitle });
  }, []);

  const selectPokerStory = useCallback((index: number) => {
    socket.emit(C2S_EVENTS.SELECT_POKER_STORY, { index });
  }, []);

  const selectPokerStoryByTitle = useCallback((storyTitle: string) => {
    socket.emit(C2S_EVENTS.SELECT_POKER_STORY_BY_TITLE, { storyTitle });
  }, []);

  const updatePreparedStoryTitle = useCallback((index: number, storyTitle: string) => {
    socket.emit(C2S_EVENTS.UPDATE_POKER_STORY_TITLE, { index, storyTitle });
  }, []);

  const isHost = useMemo(() => {
    if (!myPlayerId) return false;
    return state.players.some((player) => player.socketId === myPlayerId && player.isHost);
  }, [myPlayerId, state.players]);

  const myRole = useMemo(() => {
    if (!myPlayerId) return "spectator" as PlanningPokerRole;
    return state.players.find((player) => player.socketId === myPlayerId)?.role ?? "spectator";
  }, [myPlayerId, state.players]);

  const myVote = useMemo(() => {
    if (!myPlayerId) return null;
    return state.players.find((player) => player.socketId === myPlayerId)?.vote ?? null;
  }, [myPlayerId, state.players]);

  return {
    connected,
    code,
    error,
    state,
    history,
    myPlayerId,
    myRole,
    myVote,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    startSession,
    voteCard,
    openVotes,
    reopenStoryVote,
    revealVotes,
    resetVotes,
    revoteCurrentStory,
    setVoteSystem,
    setRole,
    setStoryTitle,
    selectPokerStory,
    selectPokerStoryByTitle,
    updatePreparedStoryTitle,
  };
}
