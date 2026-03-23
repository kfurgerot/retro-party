import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "@/net/socket";
import { PlanningPokerRole, PlanningPokerState, PlanningPokerVoteSystem } from "@/types/planningPoker";

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
  players: [],
  revealed: false,
  round: 1,
  updatedAt: Date.now(),
};

const STORAGE_KEY = "retro-party:planning-poker:session";
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

export function usePlanningPokerOnlineState() {
  const initialSession = loadSession();

  const [connected, setConnected] = useState(socket.connected);
  const [code, setCode] = useState<string | null>(initialSession?.code ?? null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(socket.id ?? null);
  const [state, setState] = useState<PlanningPokerState>(
    initialSession?.code ? { ...EMPTY_STATE, roomCode: initialSession.code } : EMPTY_STATE
  );
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<PlanningPokerSession | null>(initialSession);
  const pendingProfileRef = useRef<{ name: string; avatar: number; sessionId: string } | null>(
    initialSession
      ? { name: initialSession.name, avatar: initialSession.avatar, sessionId: initialSession.sessionId }
      : null
  );

  useEffect(() => {
    const tryResume = () => {
      const active = sessionRef.current;
      if (!active?.code) return;
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.emit("reconnect_poker_room", {
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
      setState(nextState);
      if (nextState.roomCode) {
        setCode(nextState.roomCode);
      }
    };

    const onRoomKnown = ({ code: roomCode }: { code: string }) => {
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

      sessionRef.current = null;
      pendingProfileRef.current = null;
      storeSession(null);
      setCode(null);
      setState(EMPTY_STATE);
    };

    const onRoomClosed = ({ message }: { message?: string }) => {
      setError(message ?? null);
      sessionRef.current = null;
      pendingProfileRef.current = null;
      storeSession(null);
      setCode(null);
      setState(EMPTY_STATE);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("poker_state_update", onStateUpdate);
    socket.on("poker_room_created", onRoomKnown);
    socket.on("poker_room_joined", onRoomKnown);
    socket.on("poker_room_reconnected", onRoomKnown);
    socket.on("poker_error_msg", onError);
    socket.on("poker_room_closed", onRoomClosed);

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
      socket.off("poker_state_update", onStateUpdate);
      socket.off("poker_room_created", onRoomKnown);
      socket.off("poker_room_joined", onRoomKnown);
      socket.off("poker_room_reconnected", onRoomKnown);
      socket.off("poker_error_msg", onError);
      socket.off("poker_room_closed", onRoomClosed);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const createRoom = useCallback(
    (name: string, avatar: number, role: PlanningPokerRole, voteSystem: PlanningPokerVoteSystem) => {
      const normalizedName = name.trim() || "Hote";
      const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
      pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
      setError(null);
      if (!socket.connected) socket.connect();
      socket.emit("create_poker_room", {
        name: normalizedName,
        avatar,
        role,
        voteSystem,
        sessionId,
      });
    },
    []
  );

  const joinRoom = useCallback((roomCode: string, name: string, avatar: number, role: PlanningPokerRole) => {
    const normalizedName = name.trim() || "Joueur";
    const sessionId = sessionRef.current?.sessionId ?? makeSessionId();
    pendingProfileRef.current = { name: normalizedName, avatar, sessionId };
    setError(null);
    if (!socket.connected) socket.connect();
    socket.emit("join_poker_room", {
      code: roomCode,
      name: normalizedName,
      avatar,
      role,
      sessionId,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    if (socket.connected) {
      socket.emit("leave_poker_room");
    }
    sessionRef.current = null;
    pendingProfileRef.current = null;
    storeSession(null);
    setCode(null);
    setState(EMPTY_STATE);
  }, []);

  const startSession = useCallback(() => {
    socket.emit("start_poker_session");
  }, []);

  const voteCard = useCallback((value: string) => {
    socket.emit("vote_card", { value });
  }, []);

  const revealVotes = useCallback(() => {
    socket.emit("reveal_votes");
  }, []);

  const resetVotes = useCallback(() => {
    socket.emit("reset_votes");
  }, []);

  const setVoteSystem = useCallback((voteSystem: PlanningPokerVoteSystem) => {
    socket.emit("set_vote_system", { voteSystem });
  }, []);

  const setRole = useCallback((role: PlanningPokerRole) => {
    socket.emit("set_poker_role", { role });
  }, []);

  const setStoryTitle = useCallback((storyTitle: string) => {
    socket.emit("set_story_title", { storyTitle });
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
    myPlayerId,
    myRole,
    myVote,
    isHost,
    createRoom,
    joinRoom,
    leaveRoom,
    startSession,
    voteCard,
    revealVotes,
    resetVotes,
    setVoteSystem,
    setRole,
    setStoryTitle,
  };
}
