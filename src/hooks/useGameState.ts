import { useCallback, useState } from "react";
import { GameState, Player } from "@/types/game";
import { generateRandomBoard } from "@/data/boardGenerator";
import { pickQuestion } from "@/data/questions";

const BUG_SMASH_DURATION_MS = 20000;
const BUG_SMASH_ANNOUNCE_MS = 4000;
const ENABLE_RED_TILE_MINIGAME = false;
const KUDO_COST = 10;
const BOARD_COLORS = ["blue", "green", "red", "violet"] as const;

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
    positionNodeId: "0",
    lastPosition: -1,
    points: 0,
    stars: 0,
    inventory: [],
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

const normalizeTileType = (type: string) => {
  const value = String(type ?? "").toLowerCase();
  if (value === "purple") return "violet";
  if (value === "kudobox" || value === "star") return "bonus";
  return value;
};

const getTilePointDelta = (tileType: string) => {
  const normalized = normalizeTileType(tileType);
  if (normalized === "red") return -2;
  if (normalized === "blue" || normalized === "green" || normalized === "violet" || normalized === "yellow") return 2;
  return 0;
};

const shuffleInPlace = <T,>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

const buildIncomingByTile = (tiles: GameState["tiles"]) => {
  const incoming = new Map<number, number[]>();
  tiles.forEach((tile) => incoming.set(tile.id, []));
  tiles.forEach((tile) => {
    const next = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [];
    next.forEach((toId) => {
      if (!incoming.has(toId)) incoming.set(toId, []);
      incoming.get(toId)?.push(tile.id);
    });
  });
  return incoming;
};

const pickReplacementColor = (tiles: GameState["tiles"], tileId: number) => {
  const incomingByTile = buildIncomingByTile(tiles);
  const blocked = new Set<string>();
  const outgoing = Array.isArray(tiles[tileId]?.nextTileIds) ? tiles[tileId].nextTileIds : [];
  const incoming = incomingByTile.get(tileId) ?? [];
  [...incoming, ...outgoing].forEach((id) => {
    const t = normalizeTileType(tiles[id]?.type ?? "");
    if (t === "blue" || t === "green" || t === "red" || t === "violet") blocked.add(t);
  });

  const ordered = shuffleInPlace([...BOARD_COLORS]);
  return (ordered.find((color) => !blocked.has(color)) ?? ordered[0] ?? "blue");
};

const relocatePurchasedStar = (tiles: GameState["tiles"], purchasedStarTileId: number) => {
  const fromTile = tiles[purchasedStarTileId];
  if (!fromTile || normalizeTileType(fromTile.type ?? "") !== "bonus") return;

  const candidates = tiles.filter(
    (tile) =>
      tile.id !== purchasedStarTileId &&
      normalizeTileType(tile.type ?? "") !== "bonus" &&
      normalizeTileType(tile.type ?? "") !== "start"
  );
  if (!candidates.length) return;

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  fromTile.type = pickReplacementColor(tiles, purchasedStarTileId);
  target.type = "bonus";
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
  const path = [position];
  const pointDeltas: number[] = [];

  while (remaining > 0) {
    const rawOptions = getNextTileOptions(state, position);
    const options =
      rawOptions.length > 1 ? rawOptions.filter((id) => id !== previous) : rawOptions;
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
      player.positionNodeId = String(position);
      player.lastPosition = previous;
      return {
        finished: false,
        moveTrace: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          playerId: player.id,
          path,
          pointDeltas,
        },
        pendingPathChoice: {
          playerId: player.id,
          atTileId: position,
          options,
          remainingSteps: remaining,
        },
        pendingKudoPurchase: null,
      };
    }

    previous = position;
    position = chosen as number;
    player.position = position;
    player.positionNodeId = String(position);
    player.lastPosition = previous;
    path.push(position);
    const visitedTile = state.tiles[position];
    pointDeltas.push(0);
    remaining -= 1;
    const visitedType = normalizeTileType(visitedTile?.type ?? "");
    if (visitedType === "bonus") {
      return {
        finished: false,
        moveTrace: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          playerId: player.id,
          path,
          pointDeltas,
        },
        pendingPathChoice: null,
        pendingKudoPurchase: {
          playerId: player.id,
          atTileId: position,
          remainingSteps: remaining,
          cost: KUDO_COST,
          canAfford: (player.points ?? 0) >= KUDO_COST,
        },
      };
    }
  }

  player.position = position;
  player.positionNodeId = String(position);
  player.lastPosition = previous;
  const finalTile = state.tiles[position];
  const finalDelta = finalTile ? getTilePointDelta(finalTile.type) : 0;
  player.points = Math.max(0, Math.floor(Number(player.points ?? 0) + finalDelta));
  if (pointDeltas.length > 0) pointDeltas[pointDeltas.length - 1] = finalDelta;
  return {
    finished: true,
    moveTrace: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      playerId: player.id,
      path,
      pointDeltas,
    },
    pendingPathChoice: null,
    pendingKudoPurchase: null,
  };
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
      pendingKudoPurchase: null,
      pendingShop: null,
      diceValue: null,
      isRolling: false,
      turnPhase: "resolving",
    };
  }

  const type = tile.type === "bonus" ? "bonus" : tile.type;

  const text = pickQuestion(type as any);

  return {
    ...prev,
    players,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingShop: null,
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
    turnPhase: "resolving",
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
    lastRollResult: null,
    isRolling: false,
    turnPhase: "finished",
    preRollActionUsed: false,
    pendingPreRollEffect: null,
    pendingDoubleRoll: null,
    currentQuestion: null,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
    actionLogs: [],
    lastMoveTrace: null,
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
      lastRollResult: null,
      isRolling: false,
      turnPhase: "pre_roll",
      preRollActionUsed: false,
      pendingPreRollEffect: null,
      pendingDoubleRoll: null,
      currentQuestion: null,
      currentMinigame: null,
      pendingPathChoice: null,
      pendingKudoPurchase: null,
      pendingShop: null,
      actionLogs: [],
      lastMoveTrace: null,
      questionHistory: [],
    }));
  }, []);

  const rollDice = useCallback(() => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.pendingPathChoice || prev.pendingKudoPurchase || prev.pendingShop) return prev;
      if (prev.turnPhase && prev.turnPhase !== "pre_roll") return prev;
      const dice = 1 + Math.floor(Math.random() * 6);
      return { ...prev, diceValue: dice, isRolling: true, turnPhase: "rolling" };
    });
    setTimeout(() => {
      setGameState((prev) => ({ ...prev, isRolling: false, turnPhase: "moving" }));
    }, 650);
  }, []);

  const movePlayer = useCallback((steps: number) => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.pendingPathChoice || prev.pendingKudoPurchase || prev.pendingShop) return prev;
      if (prev.diceValue == null) return prev;
      const players = prev.players.map((p) => ({ ...p }));
      const cur = players[prev.currentPlayerIndex];
      const moved = advancePlayerAlongBoard(prev, cur, steps);
      if (!moved.finished) {
        return {
          ...prev,
          players,
          pendingPathChoice: moved.pendingPathChoice,
          pendingKudoPurchase: moved.pendingKudoPurchase,
          lastMoveTrace: moved.moveTrace,
          currentQuestion: null,
          currentMinigame: null,
          diceValue: null,
          isRolling: false,
          turnPhase: "resolving",
        };
      }
      return { ...buildLandingState(prev, players), lastMoveTrace: moved.moveTrace };
    });
  }, []);

  const choosePath = useCallback((nextTileId: number, playerId: string) => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.pendingKudoPurchase) return prev;
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
          pendingKudoPurchase: moved.pendingKudoPurchase,
          lastMoveTrace: moved.moveTrace,
          currentQuestion: null,
          currentMinigame: null,
          diceValue: null,
          isRolling: false,
          turnPhase: "resolving",
        };
      }

      return { ...buildLandingState(prev, players), lastMoveTrace: moved.moveTrace };
    });
  }, []);

  const resolveKudoPurchase = useCallback((buyKudo: boolean, playerId: string) => {
    setGameState((prev) => {
      if (prev.phase !== "playing" || prev.currentQuestion || prev.currentMinigame) return prev;
      if (prev.pendingPathChoice) return prev;
      if (!prev.pendingKudoPurchase) return prev;
      if (prev.pendingKudoPurchase.playerId !== playerId) return prev;

      const players = prev.players.map((p) => ({ ...p }));
      const tiles = prev.tiles.map((tile) => ({ ...tile }));
      const stateWithTiles = { ...prev, tiles };
      const cur = players[prev.currentPlayerIndex];
      if (!cur || cur.id !== playerId) return prev;

      if (buyKudo && (cur.points ?? 0) >= KUDO_COST) {
        cur.points = Math.max(0, Math.floor(Number(cur.points ?? 0) - KUDO_COST));
        cur.stars = Math.max(0, Math.floor(Number(cur.stars ?? 0) + 1));
        relocatePurchasedStar(tiles, prev.pendingKudoPurchase.atTileId);
      }

      const remaining = Math.max(0, Math.floor(Number(prev.pendingKudoPurchase.remainingSteps ?? 0)));
      if (remaining <= 0) {
        return {
          ...buildLandingState(stateWithTiles, players),
          pendingKudoPurchase: null,
        };
      }

      const moved = advancePlayerAlongBoard(stateWithTiles, cur, remaining);
      if (!moved.finished) {
        return {
          ...stateWithTiles,
          players,
          pendingPathChoice: moved.pendingPathChoice,
          pendingKudoPurchase: moved.pendingKudoPurchase,
          lastMoveTrace: moved.moveTrace,
          currentQuestion: null,
          currentMinigame: null,
          diceValue: null,
          isRolling: false,
          turnPhase: "resolving",
        };
      }

      return {
        ...buildLandingState(stateWithTiles, players),
        pendingKudoPurchase: null,
        lastMoveTrace: moved.moveTrace,
      };
    });
  }, []);

  const openQuestionCard = useCallback((playerId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (prev.pendingPathChoice || prev.pendingKudoPurchase || prev.pendingShop) return prev;
      const q = prev.currentQuestion;
      if (!q || q.status !== "pending") return prev;
      if (q.targetPlayerId !== playerId) return prev;
      return { ...prev, currentQuestion: { ...q, status: "open" } };
    });
  }, []);

  const voteQuestion = useCallback((vote: "up" | "down", voterId: string) => {
    setGameState((prev) => {
      if (prev.currentMinigame) return prev;
      if (prev.pendingPathChoice || prev.pendingKudoPurchase || prev.pendingShop) return prev;
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
      if (prev.pendingPathChoice || prev.pendingKudoPurchase || prev.pendingShop) return prev;
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
          pendingKudoPurchase: null,
          pendingShop: null,
          diceValue: null,
          isRolling: false,
          turnPhase: "resolving",
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
          turnPhase: "finished",
          questionHistory,
        };
      }
      return {
        ...prev,
        currentQuestion: null,
        currentMinigame: null,
        pendingPathChoice: null,
        pendingKudoPurchase: null,
        pendingShop: null,
        diceValue: null,
        isRolling: false,
        turnPhase: "pre_roll",
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
          pendingKudoPurchase: null,
          pendingShop: null,
          currentQuestion: null,
          diceValue: null,
          isRolling: false,
          turnPhase: "finished",
        };
      }

      return {
        ...prev,
        players,
        currentPlayerIndex: nextIndex,
        currentRound: nextRound,
        currentMinigame: null,
        pendingPathChoice: null,
        pendingKudoPurchase: null,
        pendingShop: null,
        currentQuestion: null,
        diceValue: null,
        isRolling: false,
        turnPhase: "pre_roll",
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
    resolveKudoPurchase,
    openQuestionCard,
    voteQuestion,
    validateQuestion,
    completeBugSmash,
    updateBugSmashProgress,
    submitBuzzwordAnswer,
    resetGame,
  };
}
