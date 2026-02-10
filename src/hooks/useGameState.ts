import { useCallback, useState } from "react";
import { GameState, Player } from "@/types/game";
import { generateRandomBoard } from "@/data/boardGenerator";
import { pickQuestion } from "@/data/questions";

const BUG_SMASH_DURATION_MS = 20000;
const BUG_SMASH_ANNOUNCE_MS = 4000;

const getBugSmashStars = (score: number) => {
  if (score >= 18) return 3;
  if (score >= 12) return 2;
  if (score >= 6) return 1;
  return 0;
};

const makePlayers = (names: string[], avatars: number[]): Player[] => {
  const colors = ["#3b82f6", "#ef4444", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#0ea5e9", "#84cc16"];
  return names.map((name, idx) => ({
    id: `local-${idx}`,
    name,
    avatar: avatars[idx] ?? 0,
    position: 0,
    stars: 0,
    skipNextTurn: false,
    color: colors[idx % colors.length],
    isHost: idx === 0,
  }));
};

const createInitialState = (): GameState => {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 20, rows: 6, length: 45 });
  return {
    phase: "lobby",
    players: [],
    currentPlayerIndex: 0,
    currentRound: 1,
    maxRounds: 12,
    board: { seed, cols: board.cols, rows: board.rows, length: board.length },
    tiles: board.tiles,
    diceValue: null,
    isRolling: false,
    currentQuestion: null,
    currentMinigame: null,
    questionHistory: [],
  };
};

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState());

  const startGame = useCallback((names: string[], avatars: number[]) => {
    setGameState((prev) => ({
      ...prev,
      phase: "playing",
      players: makePlayers(names, avatars),
      currentPlayerIndex: 0,
      currentRound: 1,
      diceValue: null,
      isRolling: false,
      currentQuestion: null,
      currentMinigame: null,
      questionHistory: [],
    }));
  }, []);

  const rollDice = useCallback(() => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      const dice = 1 + Math.floor(Math.random() * 6);
      return { ...prev, diceValue: dice, isRolling: true };
    });
    setTimeout(() => {
      setGameState((prev) => ({ ...prev, isRolling: false }));
    }, 650);
  }, []);

  const movePlayer = useCallback((steps: number) => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.diceValue == null) return prev;
      const tilesLen = prev.tiles.length || 1;
      const players = prev.players.map((p) => ({ ...p }));
      const cur = players[prev.currentPlayerIndex];
      const lastTileIndex = Math.max(0, tilesLen - 1);
      cur.position = Math.min(cur.position + steps, lastTileIndex);

      const tile = prev.tiles[cur.position];
      const type = tile.type === "bonus" ? "bonus" : tile.type;

      if (type === "bonus") cur.stars += 1;

      const text = pickQuestion(type as any);

      return {
        ...prev,
        players,
        currentMinigame: null,
        currentQuestion: {
          id: `${Date.now()}`,
          type: type as any,
          text,
          targetPlayerId: cur.id,
          votes: { up: [], down: [] },
          status: "pending",
          nextMinigame: type === "red" ? "BUG_SMASH" : null,
        },
      };
    });
  }, []);

  const openQuestionCard = useCallback((playerId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      const q = prev.currentQuestion;
      if (!q || q.status !== "pending") return prev;
      if (q.targetPlayerId !== playerId) return prev;
      return { ...prev, currentQuestion: { ...q, status: "open" } };
    });
  }, []);

  const voteQuestion = useCallback((vote: "up" | "down", voterId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (!prev.currentQuestion) return prev;
      const q = { ...prev.currentQuestion, votes: { up: [...prev.currentQuestion.votes.up], down: [...prev.currentQuestion.votes.down] } };
      q.votes.up = q.votes.up.filter((id) => id !== voterId);
      q.votes.down = q.votes.down.filter((id) => id !== voterId);
      q.votes[vote].push(voterId);
      return { ...prev, currentQuestion: q };
    });
  }, []);

  const validateQuestion = useCallback(() => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (prev.phase !== "playing" || prev.currentQuestion) {
        // allow validate if question open
      }
      if (!prev.currentQuestion) return prev;

      const questionHistory = [
        ...prev.questionHistory,
        {
          id: prev.currentQuestion.id,
          type: prev.currentQuestion.type,
          text: prev.currentQuestion.text,
          upVotes: prev.currentQuestion.votes.up.length,
          downVotes: prev.currentQuestion.votes.down.length,
        },
      ];

      if (prev.currentQuestion.nextMinigame === "BUG_SMASH") {
        return {
          ...prev,
          questionHistory,
          currentQuestion: null,
          currentMinigame: {
            minigameId: "BUG_SMASH",
            targetPlayerId: prev.currentQuestion.targetPlayerId,
            startAt: Date.now() + BUG_SMASH_ANNOUNCE_MS,
            durationMs: BUG_SMASH_DURATION_MS,
            score: 0,
          },
          diceValue: null,
          isRolling: false,
        };
      }

      // close question and advance turn
      let nextIndex = prev.currentPlayerIndex + 1;
      let nextRound = prev.currentRound;
      if (nextIndex >= prev.players.length) {
        nextIndex = 0;
        nextRound += 1;
      }
      if (nextRound > prev.maxRounds) {
        return {
          ...prev,
          phase: "results",
          currentQuestion: null,
          diceValue: null,
          isRolling: false,
          questionHistory,
        };
      }
      return {
        ...prev,
        currentQuestion: null,
        currentMinigame: null,
        diceValue: null,
        isRolling: false,
        currentPlayerIndex: nextIndex,
        currentRound: nextRound,
        questionHistory,
      };
    });
  }, []);

  const completeBugSmash = useCallback((score: number, playerId: string) => {
    setGameState((prev) => {
      const minigame = prev.currentMinigame;
      if (!minigame || minigame.minigameId !== "BUG_SMASH") return prev;
      if (minigame.targetPlayerId !== playerId) return prev;

      const players = prev.players.map((p) => ({ ...p }));
      const player = players.find((p) => p.id === playerId);
      if (!player) return prev;
      player.stars += getBugSmashStars(score);

      let nextIndex = prev.currentPlayerIndex + 1;
      let nextRound = prev.currentRound;
      if (nextIndex >= players.length) {
        nextIndex = 0;
        nextRound += 1;
      }

      if (nextRound > prev.maxRounds) {
        return {
          ...prev,
          phase: "results",
          players,
          currentRound: prev.maxRounds,
          currentMinigame: null,
          currentQuestion: null,
          diceValue: null,
          isRolling: false,
        };
      }

      return {
        ...prev,
        players,
        currentPlayerIndex: nextIndex,
        currentRound: nextRound,
        currentMinigame: null,
        currentQuestion: null,
        diceValue: null,
        isRolling: false,
      };
    });
  }, []);

  const updateBugSmashProgress = useCallback((score: number, playerId: string) => {
    setGameState((prev) => {
      const minigame = prev.currentMinigame;
      if (!minigame || minigame.minigameId !== "BUG_SMASH") return prev;
      if (minigame.targetPlayerId !== playerId) return prev;
      const normalized = Math.max(0, Math.floor(score));
      return {
        ...prev,
        currentMinigame: {
          ...minigame,
          score: normalized,
        },
      };
    });
  }, []);

  const resetGame = useCallback(() => setGameState(createInitialState()), []);

  return {
    gameState,
    startGame,
    rollDice,
    movePlayer,
    openQuestionCard,
    voteQuestion,
    validateQuestion,
    completeBugSmash,
    updateBugSmashProgress,
    resetGame,
  };
}
