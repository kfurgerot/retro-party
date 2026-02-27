import { useCallback, useState } from "react";
import { GameState, Player } from "@/types/game";
import { generateRandomBoard } from "@/data/boardGenerator";
import { pickQuestion } from "@/data/questions";

const BUG_SMASH_DURATION_MS = 20000;
const BUG_SMASH_ANNOUNCE_MS = 4000;
const ENABLE_RED_TILE_MINIGAME = false;

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
    lastPosition: -1,
    stars: 0,
    skipNextTurn: false,
    color: colors[idx % colors.length],
    isHost: idx === 0,
  }));
};

const getNextTileOptions = (state: GameState, tileId: number): number[] => {
  const tile = state.tiles[tileId];
  if (!tile) return [];
  const options = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [tileId + 1];
  return options.filter((id) => Number.isInteger(id) && id >= 0 && id < state.tiles.length);
};

const advancePlayerAlongBoard = (
  state: GameState,
  player: Player,
  steps: number,
  firstChoice: number | null = null
) => {
  let remaining = steps;
  let position = player.position;
  let previous = player.lastPosition ?? -1;
  let forced = firstChoice;

  while (remaining > 0) {
    const rawOptions = getNextTileOptions(state, position);
    const options =
      rawOptions.length > 1
        ? rawOptions.filter((id) => id !== previous)
        : rawOptions;
    if (!options.length) break;

    let chosen: number | null = null;
    if (options.length > 1 && forced != null) {
      chosen = options.includes(forced) ? forced : null;
      forced = null;
    } else if (options.length === 1) {
      chosen = options[0];
    }

    if (options.length > 1 && chosen == null) {
      player.position = position;
      player.lastPosition = previous;
      return {
        finished: false,
        pendingPathChoice: {
          playerId: player.id,
          atTileId: position,
          options,
          remainingSteps: remaining,
        },
      };
    }

    previous = position;
    position = chosen as number;
    remaining -= 1;
  }

  player.position = position;
  player.lastPosition = previous;
  return { finished: true, pendingPathChoice: null };
};

const buildLandingState = (prev: GameState, players: Player[]): GameState => {
  const cur = players[prev.currentPlayerIndex];
  const tile = prev.tiles[cur.position];
  if (!tile) {
    return {
      ...prev,
      players,
      currentQuestion: null,
      currentMinigame: null,
      pendingPathChoice: null,
      diceValue: null,
      isRolling: false,
    };
  }

  const type = tile.type === "bonus" ? "bonus" : tile.type;
  if (type === "bonus") cur.stars += 1;

  const text = pickQuestion(type as any);

  return {
    ...prev,
    players,
    currentMinigame: null,
    pendingPathChoice: null,
    currentQuestion: {
      id: `${Date.now()}`,
      type: type as any,
      text,
      targetPlayerId: cur.id,
      votes: { up: [], down: [] },
      status: "pending",
      nextMinigame: type === "red" && ENABLE_RED_TILE_MINIGAME ? "BUG_SMASH" : null,
    },
    diceValue: null,
    isRolling: false,
  };
};

const createInitialState = (): GameState => {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const board = generateRandomBoard(seed, { cols: 30, rows: 20, length: 85 });
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
    pendingPathChoice: null,
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
      pendingPathChoice: null,
      questionHistory: [],
    }));
  }, []);

  const rollDice = useCallback(() => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.pendingPathChoice) return prev;
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
      if (prev.pendingPathChoice) return prev;
      if (prev.diceValue == null) return prev;
      const players = prev.players.map((p) => ({ ...p }));
      const cur = players[prev.currentPlayerIndex];
      const moved = advancePlayerAlongBoard(prev, cur, steps);
      if (!moved.finished) {
        return {
          ...prev,
          players,
          pendingPathChoice: moved.pendingPathChoice,
          currentQuestion: null,
          currentMinigame: null,
          diceValue: null,
          isRolling: false,
        };
      }
      return buildLandingState(prev, players);
    });
  }, []);

  const choosePath = useCallback((nextTileId: number, playerId: string) => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (!prev.pendingPathChoice) return prev;
      if (prev.pendingPathChoice.playerId !== playerId) return prev;
      if (!prev.pendingPathChoice.options.includes(nextTileId)) return prev;

      const players = prev.players.map((p) => ({ ...p }));
      const cur = players[prev.currentPlayerIndex];
      if (!cur || cur.id !== playerId) return prev;

      const moved = advancePlayerAlongBoard(
        prev,
        cur,
        prev.pendingPathChoice.remainingSteps,
        nextTileId
      );

      if (!moved.finished) {
        return {
          ...prev,
          players,
          pendingPathChoice: moved.pendingPathChoice,
          currentQuestion: null,
          currentMinigame: null,
          diceValue: null,
          isRolling: false,
        };
      }

      return buildLandingState(prev, players);
    });
  }, []);

  const openQuestionCard = useCallback((playerId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (prev.pendingPathChoice) return prev;
      const q = prev.currentQuestion;
      if (!q || q.status !== "pending") return prev;
      if (q.targetPlayerId !== playerId) return prev;
      return { ...prev, currentQuestion: { ...q, status: "open" } };
    });
  }, []);

  const voteQuestion = useCallback((vote: "up" | "down", voterId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (prev.pendingPathChoice) return prev;
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
      if (prev.pendingPathChoice) return prev;
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

      if (ENABLE_RED_TILE_MINIGAME && prev.currentQuestion.nextMinigame === "BUG_SMASH") {
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
          pendingPathChoice: null,
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
        pendingPathChoice: null,
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
          pendingPathChoice: null,
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
        pendingPathChoice: null,
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
  const submitBuzzwordAnswer = useCallback((_playerId: string, _category: "LEGIT" | "BULLSHIT") => {
    // Local mode currently does not run server-authoritative Buzzword Duel.
  }, []);

  return {
    gameState,
    startGame,
    rollDice,
    movePlayer,
    choosePath,
    openQuestionCard,
    voteQuestion,
    validateQuestion,
    completeBugSmash,
    updateBugSmashProgress,
    submitBuzzwordAnswer,
    resetGame,
  };
}
