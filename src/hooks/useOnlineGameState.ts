import { useCallback, useEffect, useMemo, useState } from "react";
import { GameState } from "@/types/game";
import { socket } from "@/net/socket";

type LobbyPlayer = { socketId?: string; name: string; avatar: number; isHost: boolean };

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
};

export function useOnlineGameState() {
  const [code, setCode] = useState<string | null>(null);
  const [lobby, setLobby] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState>(EMPTY_STATE);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    const onState = (state: GameState) => setGameState(state);
    const onLobby = ({ players }: { players: LobbyPlayer[] }) => setLobby(players);

    socket.on("state_update", onState);
    socket.on("lobby_update", onLobby);
    socket.on("room_created", ({ code }: { code: string }) => setCode(code));
    socket.on("room_joined", ({ code }: { code: string }) => setCode(code));
    socket.on("connect", () => { setMyPlayerId(socket.id ?? null); setConnected(true); });
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.off("state_update", onState);
      socket.off("lobby_update", onLobby);
      socket.off("room_created");
      socket.off("room_joined");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  const createRoom = useCallback((name: string, avatar: number) => {
    socket.emit("create_room", { name, avatar });
  }, []);

  const joinRoom = useCallback((roomCode: string, name: string, avatar: number) => {
    socket.emit("join_room", { code: roomCode, name, avatar });
  }, []);

  const startGame = useCallback(() => socket.emit("start_game"), []);
  const rollDice = useCallback(() => socket.emit("roll_dice"), []);
  const movePlayer = useCallback((steps: number) => socket.emit("move_player", { steps }), []);
  const voteQuestion = useCallback((vote: "up" | "down") => socket.emit("vote_question", { vote }), []);
  const validateQuestion = useCallback(() => socket.emit("validate_question"), []);
  const resetGame = useCallback(() => socket.emit("reset_game"), []);

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
    startGame,
    rollDice,
    movePlayer,
    voteQuestion,
    validateQuestion,
    resetGame,
    isHost,
  };
}
