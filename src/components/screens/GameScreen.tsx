import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuzzwordCategory, GameState, ShopItemType, WhoSaidItRole, WhoSaidItViewState } from "@/types/game";
import { GameBoard } from "../game/GameBoard";
import { BoardV2 } from "../game/BoardV2";
import { PlayerCard } from "../game/PlayerCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { LaunchAnnouncement } from "../game/LaunchAnnouncement";
import { ActionBadge, TurnBanner } from "../game/hud";
import { SHOP_CATALOG } from "@/data/shopCatalog";
import { fr } from "@/i18n/fr";
import {
  CTA_NEON_DANGER,
  CTA_NEON_PRIMARY,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
  GAME_DRAWER_CLOSE_BUTTON,
  GAME_DRAWER_CONTENT,
  GAME_MOBILE_ACTION_BUTTON,
} from "@/lib/uiTokens";
import { ENABLE_BOARD_V2 } from "@/lib/uiMode";
import { perfLog, perfMark, perfMeasure } from "@/lib/perf";

const TURN_ANNOUNCE_MS = 2000;
const MOVE_STEP_MS = 320;
const ROLL_RESULT_READ_MS = 1000;

type ActivityKind = "move" | "decision" | "question" | "shop" | "minigame" | "system";

function classifyActivityKind(log: string): ActivityKind {
  const normalized = log.toLowerCase();
  if (
    normalized.includes("duel") ||
    normalized.includes("bug smash") ||
    normalized.includes("mini-jeu")
  ) {
    return "minigame";
  }
  if (
    normalized.includes("question") ||
    normalized.includes("vote") ||
    normalized.includes("carte")
  ) {
    return "question";
  }
  if (normalized.includes("boutique") || normalized.includes("achete")) {
    return "shop";
  }
  if (
    normalized.includes("choisit") ||
    normalized.includes("valide") ||
    normalized.includes("continue sans") ||
    normalized.includes("refuse")
  ) {
    return "decision";
  }
  if (
    normalized.includes("avance") ||
    normalized.includes("arrive") ||
    normalized.includes("deplacement") ||
    normalized.includes("teleporte")
  ) {
    return "move";
  }
  return "system";
}
const QuestionModal = lazy(() =>
  import("../game/QuestionModal").then((module) => ({ default: module.QuestionModal }))
);
const ShopModal = lazy(() =>
  import("../game/ShopModal").then((module) => ({ default: module.ShopModal }))
);
const PreRollChoiceModal = lazy(() =>
  import("../game/PreRollChoiceModal").then((module) => ({ default: module.PreRollChoiceModal }))
);
const WhoSaidItMinigame = lazy(() =>
  import("../game/WhoSaidItMinigame").then((module) => ({ default: module.WhoSaidItMinigame }))
);
const BugSmashMinigame = lazy(() =>
  import("../game/BugSmashMinigame").then((module) => ({ default: module.BugSmashMinigame }))
);
const BuzzwordDuelMinigame = lazy(() =>
  import("../game/BuzzwordDuelMinigame").then((module) => ({ default: module.BuzzwordDuelMinigame }))
);
const PointDuelMinigame = lazy(() =>
  import("../game/PointDuelMinigame").then((module) => ({ default: module.PointDuelMinigame }))
);

interface GameScreenProps {
  gameState: GameState;
  myPlayerId?: string | null;
  onLeave?: () => void;
  onRollDice: () => void;
  onMovePlayer: (steps: number) => void;
  onChoosePath?: (nextTileId: number) => void;
  onResolveKudoPurchase?: (buyKudo: boolean) => void;
  onBuyShopItem?: (itemType: ShopItemType) => void;
  onCloseShop?: () => void;
  onResolvePreRollChoice?: (itemInstanceId: string | null) => void;
  onOpenQuestionCard: () => void;
  onVoteQuestion: (vote: "up" | "down") => void;
  onValidateQuestion: () => void;
  onCompleteBugSmash?: (score: number) => void;
  onBugSmashProgress?: (score: number) => void;
  whoSaidItState?: WhoSaidItViewState | null;
  onWhoSaidItSubmit?: (role: WhoSaidItRole) => void;
  onBuzzwordSubmit?: (category: BuzzwordCategory) => void;
  onPointDuelRoll?: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  myPlayerId,
  onLeave,
  onRollDice,
  onMovePlayer,
  onChoosePath,
  onResolveKudoPurchase,
  onBuyShopItem,
  onCloseShop,
  onResolvePreRollChoice,
  onOpenQuestionCard,
  onVoteQuestion,
  onValidateQuestion,
  onCompleteBugSmash,
  onBugSmashProgress,
  whoSaidItState,
  onWhoSaidItSubmit,
  onBuzzwordSubmit,
  onPointDuelRoll,
}) => {
  const [hasMovedThisTurn, setHasMovedThisTurn] = useState(false);
  const [isMoveAnimating, setIsMoveAnimating] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"players" | "legend" | "activity">("players");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [whoSaidItIntroAt, setWhoSaidItIntroAt] = useState<number | null>(null);
  const [turnIntroEndsAt, setTurnIntroEndsAt] = useState<number | null>(null);
  const [bugIntroEndsAt, setBugIntroEndsAt] = useState<number | null>(null);
  const [selectedPreRollType, setSelectedPreRollType] = useState<ShopItemType | null>(null);
  const [isQuestionActionUnlocked, setIsQuestionActionUnlocked] = useState(true);
  const [isMoveActionUnlocked, setIsMoveActionUnlocked] = useState(true);
  const [turnTransitionStartMark] = useState(() => `turn-transition-start-${Date.now()}`);
  const previousTurnKeyRef = useRef<string | null>(null);
  const previousMinigameKeyRef = useRef<string | null>(null);

  const autoMoveKeyRef = useRef<string | null>(null);
  const moveAnimationFallbackRef = useRef<number | null>(null);
  const moveActionUnlockTimerRef = useRef<number | null>(null);
  const questionActionUnlockTimerRef = useRef<number | null>(null);
  const questionActionUnlockKeyRef = useRef<string | null>(null);
  const lastWhoSaidItIdleRef = useRef<string | null>(null);
  const turnIntroTimerRef = useRef<number | null>(null);
  const bugIntroTimerRef = useRef<number | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const bugSmashState = gameState.currentMinigame?.minigameId === "BUG_SMASH" ? gameState.currentMinigame : null;
  const buzzwordState = gameState.currentMinigame?.minigameId === "BUZZWORD_DUEL" ? gameState.currentMinigame : null;
  const pointDuelState = gameState.currentMinigame?.minigameId === "POINT_DUEL" ? gameState.currentMinigame : null;
  const isBuzzwordIntroActive =
    !!buzzwordState &&
    buzzwordState.phase === "between" &&
    buzzwordState.roundType === "main" &&
    buzzwordState.currentWordIndex === 1 &&
    !!buzzwordState.nextWordAt;
  const isMinigameActive = !!whoSaidItState || !!bugSmashState || !!buzzwordState || !!pointDuelState;
  const isMyTurn =
    !!currentPlayer && !!myPlayerId && currentPlayer.id === myPlayerId;
  const pendingPathChoice = gameState.pendingPathChoice;
  const pendingKudoPurchase = gameState.pendingKudoPurchase;
  const pendingShop = gameState.pendingShop ?? null;
  const isPathChoiceActive = !!pendingPathChoice;
  const isKudoPurchaseActive = !!pendingKudoPurchase;
  const isShopActive = !!pendingShop;
  const isArrivalEventActive =
    isPathChoiceActive ||
    isKudoPurchaseActive ||
    isShopActive ||
    !!gameState.currentQuestion ||
    isMinigameActive;
  const canChoosePath =
    !!pendingPathChoice &&
    !!myPlayerId &&
    pendingPathChoice.playerId === myPlayerId &&
    !!onChoosePath;
  const canResolveKudoPurchase =
    !!pendingKudoPurchase &&
    !!myPlayerId &&
    pendingKudoPurchase.playerId === myPlayerId &&
    !!onResolveKudoPurchase;
  const isTurnIntroActive = turnIntroEndsAt != null;
  const isBugIntroActive = bugIntroEndsAt != null;
  const catalogByType = SHOP_CATALOG;
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId) ?? null;
  const myPoints = myPlayer?.points ?? 0;
  const myStars = myPlayer?.stars ?? 0;
  const pendingDoubleRollFirstDie = gameState.pendingDoubleRoll?.firstDie ?? null;
  const beforeRollInventory = useMemo(
    () => (myPlayer?.inventory ?? []).filter((item) => catalogByType[item.type]?.timing === "before_roll"),
    [myPlayer?.inventory, catalogByType]
  );
  const preRollChoices = useMemo(() => {
    const grouped = new Map<ShopItemType, { type: ShopItemType; count: number; label: string; description: string }>();
    for (const item of beforeRollInventory) {
      const def = catalogByType[item.type];
      if (!def) continue;
      const prev = grouped.get(item.type);
      if (prev) prev.count += 1;
      else grouped.set(item.type, { type: item.type, count: 1, label: def.label, description: def.description });
    }
    return [...grouped.values()];
  }, [beforeRollInventory, catalogByType]);
  const canUsePreRollAction =
    gameState.phase === "playing" &&
    isMyTurn &&
    gameState.turnPhase === "pre_roll" &&
    !gameState.preRollActionUsed &&
    !isPathChoiceActive &&
    !isKudoPurchaseActive &&
    !isShopActive &&
    !gameState.currentQuestion &&
    !isMinigameActive &&
    !gameState.isRolling &&
    gameState.diceValue == null;
  const shouldShowPreRollChoiceModal =
    canUsePreRollAction &&
    !!onResolvePreRollChoice &&
    beforeRollInventory.length > 0 &&
    !gameState.preRollChoiceResolved &&
    !gameState.pendingPreRollEffect &&
    !gameState.pendingDoubleRoll &&
    !isTurnIntroActive;

  useEffect(() => {
    if (!shouldShowPreRollChoiceModal) setSelectedPreRollType(null);
  }, [shouldShowPreRollChoiceModal]);

  useEffect(() => {
    perfMark(turnTransitionStartMark);
  }, [turnTransitionStartMark]);

  const myIndex = useMemo(() => {
    const idx = gameState.players.findIndex(
      (p) => !!myPlayerId && p.id === myPlayerId
    );
    return idx >= 0 ? idx : 0;
  }, [gameState.players, myPlayerId]);
  const nextPlayer = useMemo(() => {
    if (gameState.players.length === 0) return null;
    const nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    return gameState.players[nextIndex] ?? null;
  }, [gameState.players, gameState.currentPlayerIndex]);
  const playersByTurnOrder = useMemo(() => {
    const total = gameState.players.length;
    if (total === 0) return [];
    return gameState.players
      .map((player, index) => {
        const turnDistance = ((index - gameState.currentPlayerIndex) + total) % total;
        return {
          player,
          index,
          turnDistance,
          isCurrent: turnDistance === 0,
          isNext: turnDistance === 1,
          isMe: !!myPlayerId && player.id === myPlayerId,
        };
      })
      .sort((a, b) => a.turnDistance - b.turnDistance);
  }, [gameState.players, gameState.currentPlayerIndex, myPlayerId]);

  useEffect(() => {
    setHasMovedThisTurn(false);
    setIsMoveAnimating(false);
    setIsMoveActionUnlocked(true);
    autoMoveKeyRef.current = null;
    if (moveAnimationFallbackRef.current) {
      window.clearTimeout(moveAnimationFallbackRef.current);
      moveAnimationFallbackRef.current = null;
    }
    if (moveActionUnlockTimerRef.current) {
      window.clearTimeout(moveActionUnlockTimerRef.current);
      moveActionUnlockTimerRef.current = null;
    }
  }, [gameState.currentPlayerIndex, gameState.currentRound]);

  useEffect(() => {
    const shouldDelayMove =
      gameState.phase === "playing" &&
      isMyTurn &&
      gameState.turnPhase === "moving" &&
      gameState.diceValue != null &&
      !hasMovedThisTurn;

    if (!shouldDelayMove) {
      setIsMoveActionUnlocked(true);
      if (moveActionUnlockTimerRef.current) {
        window.clearTimeout(moveActionUnlockTimerRef.current);
        moveActionUnlockTimerRef.current = null;
      }
      return;
    }

    setIsMoveActionUnlocked(false);
    if (moveActionUnlockTimerRef.current) {
      window.clearTimeout(moveActionUnlockTimerRef.current);
    }
    moveActionUnlockTimerRef.current = window.setTimeout(() => {
      setIsMoveActionUnlocked(true);
      moveActionUnlockTimerRef.current = null;
    }, ROLL_RESULT_READ_MS);

    return () => {
      if (moveActionUnlockTimerRef.current) {
        window.clearTimeout(moveActionUnlockTimerRef.current);
        moveActionUnlockTimerRef.current = null;
      }
    };
  }, [gameState.phase, gameState.turnPhase, gameState.diceValue, hasMovedThisTurn, isMyTurn]);

  const canRoll =
    gameState.phase === "playing" &&
    !isMinigameActive &&
    !isTurnIntroActive &&
    !isPathChoiceActive &&
    !isKudoPurchaseActive &&
    !isShopActive &&
    isMyTurn &&
    gameState.turnPhase === "pre_roll" &&
    !gameState.currentQuestion &&
    gameState.diceValue == null &&
    !gameState.isRolling;

  const canMove =
    gameState.phase === "playing" &&
    !isMinigameActive &&
    !isPathChoiceActive &&
    !isKudoPurchaseActive &&
    !isShopActive &&
    isMyTurn &&
    gameState.turnPhase === "moving" &&
    !gameState.currentQuestion &&
    !gameState.isRolling &&
    isMoveActionUnlocked &&
    gameState.diceValue != null &&
    !hasMovedThisTurn;

  const legend = useMemo(
    () => [
      { k: "blue", label: fr.gameScreen.legendBlue, icon: "💬" },
      { k: "green", label: fr.gameScreen.legendGreen, icon: "🔧" },
      { k: "red", label: fr.gameScreen.legendRed, icon: "🔥" },
      { k: "violet", label: fr.gameScreen.legendViolet, icon: "🎯" },
      { k: "bonus", label: fr.gameScreen.legendBonus, icon: "🎁" },
      { k: "shop", label: fr.game.shopLegend, icon: "🛒" },
    ],
    []
  );

  const handleMove = useCallback(
    (steps: number) => {
      setHasMovedThisTurn(true);
      setIsMoveAnimating(true);
      onMovePlayer(steps);
    },
    [onMovePlayer]
  );

  useEffect(() => {
    if (!canMove || hasMovedThisTurn || gameState.diceValue == null) return;
    const autoMoveKey = `${currentPlayer?.id ?? "unknown"}-${gameState.currentRound}-${gameState.currentPlayerIndex}-${gameState.diceValue}`;
    if (autoMoveKeyRef.current === autoMoveKey) return;

    autoMoveKeyRef.current = autoMoveKey;
    handleMove(gameState.diceValue);
  }, [
    canMove,
    hasMovedThisTurn,
    currentPlayer?.id,
    gameState.currentRound,
    gameState.currentPlayerIndex,
    gameState.diceValue,
    handleMove,
  ]);

  useEffect(() => {
    if (!isMoveAnimating || !gameState.currentQuestion) return;

    if (moveAnimationFallbackRef.current) {
      window.clearTimeout(moveAnimationFallbackRef.current);
    }
    moveAnimationFallbackRef.current = window.setTimeout(() => {
      setIsMoveAnimating(false);
      moveAnimationFallbackRef.current = null;
    }, 1400);

    return () => {
      if (moveAnimationFallbackRef.current) {
        window.clearTimeout(moveAnimationFallbackRef.current);
        moveAnimationFallbackRef.current = null;
      }
    };
  }, [gameState.currentQuestion, isMoveAnimating]);

  useEffect(() => {
    const turnKey = `${gameState.currentRound}-${gameState.currentPlayerIndex}-${gameState.turnPhase}`;
    if (previousTurnKeyRef.current === turnKey) return;
    const endMark = `turn-transition-end-${Date.now()}`;
    perfMark(endMark);
    const duration = perfMeasure(`turn-transition-${turnKey}`, turnTransitionStartMark, endMark);
    perfLog("turn-transition", {
      round: gameState.currentRound,
      playerIndex: gameState.currentPlayerIndex,
      turnPhase: gameState.turnPhase,
      durationMs: duration != null ? Math.round(duration) : null,
    });
    previousTurnKeyRef.current = turnKey;
    perfMark(turnTransitionStartMark);
  }, [gameState.currentRound, gameState.currentPlayerIndex, gameState.turnPhase, turnTransitionStartMark]);

  useEffect(() => {
    const minigameKey = gameState.currentMinigame?.minigameId ?? "none";
    if (previousMinigameKeyRef.current === minigameKey) return;
    perfLog("minigame-transition", {
      from: previousMinigameKeyRef.current ?? "none",
      to: minigameKey,
      round: gameState.currentRound,
    });
    previousMinigameKeyRef.current = minigameKey;
  }, [gameState.currentMinigame?.minigameId, gameState.currentRound]);

  useEffect(() => {
    if (!whoSaidItState || whoSaidItState.phase !== "idle") {
      lastWhoSaidItIdleRef.current = null;
      setWhoSaidItIntroAt(null);
      return;
    }
    const key = `${whoSaidItState.minigameId}-${gameState.currentRound}`;
    if (lastWhoSaidItIdleRef.current === key && whoSaidItIntroAt) return;
    lastWhoSaidItIdleRef.current = key;
    setWhoSaidItIntroAt(Date.now() + 4000);
  }, [gameState.currentRound, whoSaidItIntroAt, whoSaidItState]);

  useEffect(() => {
    if (turnIntroTimerRef.current) {
      window.clearTimeout(turnIntroTimerRef.current);
      turnIntroTimerRef.current = null;
    }
    const shouldShowTurnIntro =
      gameState.phase === "playing" &&
      isMyTurn &&
      !isPathChoiceActive &&
      !isKudoPurchaseActive &&
      !isShopActive &&
      !gameState.currentQuestion &&
      !bugSmashState &&
      !buzzwordState &&
      !whoSaidItState &&
      gameState.turnPhase === "pre_roll" &&
      !gameState.pendingPreRollEffect &&
      !gameState.pendingDoubleRoll &&
      gameState.diceValue == null &&
      !gameState.isRolling;
    if (!shouldShowTurnIntro) {
      setTurnIntroEndsAt(null);
      return;
    }

    const endAt = Date.now() + TURN_ANNOUNCE_MS;
    setTurnIntroEndsAt(endAt);
    turnIntroTimerRef.current = window.setTimeout(() => {
      setTurnIntroEndsAt(null);
      turnIntroTimerRef.current = null;
    }, TURN_ANNOUNCE_MS);

    return () => {
      if (turnIntroTimerRef.current) {
        window.clearTimeout(turnIntroTimerRef.current);
        turnIntroTimerRef.current = null;
      }
    };
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameState.currentRound,
    gameState.currentQuestion,
    gameState.diceValue,
    gameState.isRolling,
    gameState.pendingPreRollEffect,
    gameState.pendingDoubleRoll,
    isMyTurn,
    isPathChoiceActive,
    isKudoPurchaseActive,
    isShopActive,
    bugSmashState,
    buzzwordState,
    whoSaidItState,
    gameState.turnPhase,
  ]);

  useEffect(() => {
    if (bugIntroTimerRef.current) {
      window.clearTimeout(bugIntroTimerRef.current);
      bugIntroTimerRef.current = null;
    }
    if (!bugSmashState) {
      setBugIntroEndsAt(null);
      return;
    }

    const endAt = bugSmashState.startAt ?? Date.now() + 4000;
    const delay = Math.max(0, endAt - Date.now());
    setBugIntroEndsAt(endAt);
    bugIntroTimerRef.current = window.setTimeout(() => {
      setBugIntroEndsAt(null);
      bugIntroTimerRef.current = null;
    }, delay);

    return () => {
      if (bugIntroTimerRef.current) {
        window.clearTimeout(bugIntroTimerRef.current);
        bugIntroTimerRef.current = null;
      }
    };
  }, [bugSmashState]);

  const isMobile = () => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 1279px)").matches;
  };

  const openPlayers = () => {
    if (isMobile()) setPlayersOpen(true);
    else setSidebarTab("players");
  };

  const openLegend = () => {
    if (isMobile()) setLegendOpen(true);
    else setSidebarTab("legend");
  };

  const openMobileInfo = () => {
    if (isMobile()) setMobileInfoOpen(true);
  };

  const openMobileMenu = () => {
    if (isMobile()) setMobileMenuOpen(true);
  };

  const openMobileActivity = () => {
    if (isMobile()) setMobileActivityOpen(true);
  };

  const infoTitle = gameState.currentQuestion
    ? gameState.currentQuestion.status === "pending"
      ? fr.gameScreen.infoQuestionReady
      : fr.gameScreen.infoQuestionOpen
    : isPathChoiceActive
    ? fr.gameScreen.infoIntersection
    : isKudoPurchaseActive
    ? fr.gameScreen.infoKudoboxTile
    : isShopActive
    ? fr.gameScreen.infoShop
    : isMyTurn
    ? fr.gameScreen.infoYourTurn
    : fr.gameScreen.infoWaiting;

  const infoHint = isPathChoiceActive
    ? canChoosePath
      ? fr.gameScreen.hintChooseRoute
      : fr.gameScreen.hintWaitingChoice
    : isKudoPurchaseActive
    ? canResolveKudoPurchase
      ? fr.gameScreen.hintBuyKudo
      : fr.gameScreen.hintWaitingDecision
    : isShopActive
    ? fr.gameScreen.hintBuyAction
    : pendingDoubleRollFirstDie != null
    ? fr.gameScreen.hintDoubleRoll.replace("{firstDie}", String(pendingDoubleRollFirstDie))
    : gameState.pendingPreRollEffect?.type === "double_roll"
    ? fr.gameScreen.hintEffectDoubleRoll
    : gameState.pendingPreRollEffect?.type === "plus_two_roll"
    ? fr.gameScreen.hintEffectPlusTwo
    : canRoll
    ? fr.gameScreen.hintRollDice
    : isMoveAnimating
    ? fr.gameScreen.hintMoving
    : canMove
    ? fr.gameScreen.hintAutoAdvance
    : isMyTurn
    ? fr.gameScreen.waiting
    : fr.gameScreen.hintOpponentTurn;

  useEffect(() => {
    const q = gameState.currentQuestion;
    if (!q || q.status !== "pending" || !myPlayerId || q.targetPlayerId !== myPlayerId) {
      questionActionUnlockKeyRef.current = null;
      setIsQuestionActionUnlocked(true);
      if (questionActionUnlockTimerRef.current) {
        window.clearTimeout(questionActionUnlockTimerRef.current);
        questionActionUnlockTimerRef.current = null;
      }
      return;
    }

    const key = `${q.id}-${q.status}-${q.targetPlayerId}`;
    if (questionActionUnlockKeyRef.current === key) return;
    questionActionUnlockKeyRef.current = key;

    const trace = gameState.lastMoveTrace;
    const isMyMoveTrace =
      !!trace &&
      trace.playerId === myPlayerId &&
      Array.isArray(trace.path) &&
      trace.path.length > 1;
    const delayMs = isMyMoveTrace
      ? Math.max(260, (trace.path.length - 1) * MOVE_STEP_MS + 120)
      : 0;

    if (questionActionUnlockTimerRef.current) {
      window.clearTimeout(questionActionUnlockTimerRef.current);
      questionActionUnlockTimerRef.current = null;
    }

    if (delayMs <= 0) {
      setIsQuestionActionUnlocked(true);
      return;
    }

    setIsQuestionActionUnlocked(false);
    questionActionUnlockTimerRef.current = window.setTimeout(() => {
      setIsQuestionActionUnlocked(true);
      questionActionUnlockTimerRef.current = null;
    }, delayMs);
  }, [gameState.currentQuestion, gameState.lastMoveTrace, myPlayerId]);

  const canOpenQuestionCard =
    !!gameState.currentQuestion &&
    gameState.currentQuestion.status === "pending" &&
    !isMinigameActive &&
    !isPathChoiceActive &&
    !isShopActive &&
    !isMoveAnimating &&
    isQuestionActionUnlocked &&
    gameState.turnPhase !== "moving" &&
    !!currentPlayer &&
    !!myPlayerId &&
    currentPlayer.id === myPlayerId &&
    gameState.currentQuestion.targetPlayerId === myPlayerId;
  const turnOwnerName = currentPlayer?.name ?? fr.pointDuel.playerFallback;
  const primaryAction = isPathChoiceActive
    ? canChoosePath
      ? fr.gameScreen.actionChooseRoute
      : fr.gameScreen.actionWaitRoute.replace("{name}", turnOwnerName)
    : isKudoPurchaseActive
    ? canResolveKudoPurchase
      ? fr.gameScreen.actionResolveKudo
      : fr.gameScreen.actionWaitKudo.replace("{name}", turnOwnerName)
    : isShopActive
    ? pendingShop?.playerId === myPlayerId
      ? fr.gameScreen.actionShopNow
      : fr.gameScreen.actionWaitShop.replace("{name}", turnOwnerName)
    : canOpenQuestionCard
    ? fr.gameScreen.actionOpenQuestion
    : canRoll
    ? fr.gameScreen.actionRoll
    : canMove
    ? fr.gameScreen.actionMove
    : isMoveAnimating
    ? fr.gameScreen.actionMoving
    : isMyTurn
    ? fr.gameScreen.actionWaitTurn
    : fr.gameScreen.actionObserve.replace("{name}", turnOwnerName);
  const activityFeedRaw = (gameState.actionLogs ?? [])
    .filter((entry) => entry != null)
    .map((entry) => (typeof entry === "string" ? entry : String(entry)))
    .slice(-5)
    .reverse();
  const activityFeed = useMemo(
    () =>
      activityFeedRaw.map((log) => ({
        log,
        kind: classifyActivityKind(log),
      })),
    [activityFeedRaw]
  );
  const getTurnOrderLabel = useCallback((turnDistance: number) => {
    if (turnDistance === 0) return fr.gameScreen.nowPlaying;
    if (turnDistance === 1) return fr.gameScreen.nextUp;
    return fr.gameScreen.turnIn.replace("{count}", String(turnDistance));
  }, []);

  const requestLeave = () => {
    if (!onLeave) return;
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave?.();
  };

  useEffect(
    () => () => {
      if (questionActionUnlockTimerRef.current) {
        window.clearTimeout(questionActionUnlockTimerRef.current);
        questionActionUnlockTimerRef.current = null;
      }
      if (moveActionUnlockTimerRef.current) {
        window.clearTimeout(moveActionUnlockTimerRef.current);
        moveActionUnlockTimerRef.current = null;
      }
    },
    []
  );

  const turnStatusClass = gameState.currentQuestion
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : isMyTurn
    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
    : "border-cyan-300/20 bg-slate-900/40 text-slate-300";

  const neonCard = "neon-card";
  const neonPanel = "neon-surface";
  const neutralSecondaryBtn = CTA_NEON_SECONDARY_SUBTLE;
  const activeCyanBtn = CTA_NEON_PRIMARY;
  const dangerLeaveBtn = CTA_NEON_DANGER;
  const roundProgressPct = Math.max(
    0,
    Math.min(100, Math.round((gameState.currentRound / Math.max(1, gameState.maxRounds)) * 100))
  );
  const turnQueue = useMemo(() => playersByTurnOrder.slice(0, Math.min(playersByTurnOrder.length, 5)), [playersByTurnOrder]);
  const activityKindLabel: Record<ActivityKind, string> = {
    move: fr.gameScreen.activityTypeMove,
    decision: fr.gameScreen.activityTypeDecision,
    question: fr.gameScreen.activityTypeQuestion,
    shop: fr.gameScreen.activityTypeShop,
    minigame: fr.gameScreen.activityTypeMinigame,
    system: fr.gameScreen.activityTypeSystem,
  };
  const activityKindClass: Record<ActivityKind, "move" | "decision" | "question" | "shop" | "minigame" | "system"> = {
    move: "move",
    decision: "decision",
    question: "question",
    shop: "shop",
    minigame: "minigame",
    system: "system",
  };

  const handleConfirmPreRollChoice = (itemType: ShopItemType) => {
    const item = beforeRollInventory.find((entry) => entry.type === itemType);
    if (!item) return;
    onResolvePreRollChoice?.(item.id);
    setSelectedPreRollType(null);
  };

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden">
      <RetroScreenBackground />

      <div className="relative z-10 flex h-svh w-full flex-col overflow-hidden p-2 sm:p-3">
        <div className="neon-surface-soft p-1.5 sm:p-2">
          <div className="xl:hidden">
            <TurnBanner
              mode="mobile"
              currentTurnLabel={fr.gameScreen.currentTurn}
              currentPlayerName={currentPlayer?.name ?? "-"}
              primaryAction={primaryAction}
              pointsLabel={fr.gameScreen.points}
              starsLabel={fr.gameScreen.kudobox}
              myPoints={myPoints}
              myStars={myStars}
              isMyTurn={isMyTurn}
              youLabel={fr.gameScreen.you}
              roundLabel={fr.gameScreen.round}
              currentRound={gameState.currentRound}
              maxRounds={gameState.maxRounds}
              roundProgressPct={roundProgressPct}
              nextUpLabel={fr.gameScreen.nextUpLabel}
              nextPlayerName={nextPlayer?.name ?? "-"}
              turnQueue={turnQueue.map((entry) => ({
                id: entry.player.id,
                name: entry.player.name,
                isCurrent: entry.isCurrent,
                isNext: entry.isNext,
              }))}
              neonCardClass={neonCard}
            />
          </div>

          <TurnBanner
            mode="desktop"
            currentTurnLabel={fr.gameScreen.currentTurn}
            currentPlayerName={currentPlayer?.name ?? "-"}
            primaryAction={primaryAction}
            pointsLabel={fr.gameScreen.points}
            starsLabel={fr.gameScreen.kudobox}
            myPoints={myPoints}
            myStars={myStars}
            isMyTurn={isMyTurn}
            youLabel={fr.gameScreen.you}
            roundLabel={fr.gameScreen.round}
            currentRound={gameState.currentRound}
            maxRounds={gameState.maxRounds}
            roundProgressPct={roundProgressPct}
            nextUpLabel={fr.gameScreen.nextUpLabel}
            nextPlayerName={nextPlayer?.name ?? "-"}
            turnQueue={turnQueue.map((entry) => ({
              id: entry.player.id,
              name: entry.player.name,
              isCurrent: entry.isCurrent,
              isNext: entry.isNext,
            }))}
            neonCardClass={neonCard}
            onLeave={onLeave ? requestLeave : undefined}
            leaveLabel={fr.gameScreen.leaveGame}
            leaveBtnClass={dangerLeaveBtn}
          />
        </div>

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:mt-3 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className={cn("min-h-[38svh] flex-1 overflow-hidden p-1 xl:min-h-0", neonPanel)}>
              {ENABLE_BOARD_V2 ? (
                <BoardV2
                  tiles={gameState.tiles}
                  players={gameState.players}
                  pendingPathChoice={pendingPathChoice}
                  lastMoveTrace={gameState.lastMoveTrace}
                  eventOverlayActive={isArrivalEventActive}
                  canChoosePath={canChoosePath}
                  onChoosePath={onChoosePath}
                />
              ) : (
                <GameBoard
                  tiles={gameState.tiles}
                  players={gameState.players}
                  focusPlayerId={currentPlayer?.id ?? null}
                  pendingPathChoice={pendingPathChoice}
                  lastMoveTrace={gameState.lastMoveTrace}
                  eventOverlayActive={isArrivalEventActive}
                  canChoosePath={canChoosePath}
                  onChoosePath={onChoosePath}
                  actionOverlay={{
                    canRoll,
                    canMove,
                    canOpenQuestionCard,
                    isRolling: gameState.isRolling,
                    diceValue: gameState.diceValue,
                    rollResult: gameState.lastRollResult ?? null,
                    pendingDoubleRollFirstDie,
                    onRoll: onRollDice,
                    onMove: handleMove,
                    onOpenQuestionCard,
                    playerIndex: myIndex,
                  }}
                  onMoveAnimationEnd={(playerId) => {
                    if (playerId === currentPlayer?.id) setIsMoveAnimating(false);
                  }}
                />
              )}
            </div>
          </div>

          <div className="hidden min-h-0 min-w-0 flex-col gap-3 xl:flex">
            <Card className={cn(neonCard, "flex min-h-0 flex-1 flex-col px-3 py-3")}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-bold">
                  {sidebarTab === "players"
                    ? fr.gameScreen.players
                    : sidebarTab === "legend"
                    ? fr.gameScreen.legend
                    : fr.gameScreen.activityFeed}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className={
                      sidebarTab === "players"
                        ? activeCyanBtn
                        : `${neutralSecondaryBtn} opacity-95`
                    }
                    onClick={() => setSidebarTab("players")}
                  >
                    {fr.gameScreen.players}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={
                      sidebarTab === "legend"
                        ? activeCyanBtn
                        : `${neutralSecondaryBtn} opacity-95`
                    }
                    onClick={() => setSidebarTab("legend")}
                  >
                    {fr.gameScreen.legend}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={
                      sidebarTab === "activity"
                        ? activeCyanBtn
                        : `${neutralSecondaryBtn} opacity-95`
                    }
                    onClick={() => setSidebarTab("activity")}
                  >
                    {fr.gameScreen.activityFeed}
                  </Button>
                </div>
              </div>

              {sidebarTab === "players" ? (
                <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-auto pr-1">
                  <div
                    className={cn(
                      "rounded border px-2 py-2 text-xs",
                      isMyTurn
                        ? "border-cyan-300/40 bg-cyan-500/15 shadow-[0_0_0_1px_rgba(34,211,238,0.25)_inset]"
                        : "border-cyan-300/20 bg-slate-950/30"
                    )}
                  >
                    <div className="flex items-center gap-2 text-cyan-100/80">
                      <span
                        className={cn(
                          "inline-flex h-2 w-2 rounded-full",
                          isMyTurn ? "bg-cyan-300 animate-pulse" : "bg-slate-500"
                        )}
                      />
                      {fr.gameScreen.nowPlayingLabel} <span className="font-semibold text-cyan-100">{currentPlayer?.name ?? "-"}</span>
                    </div>
                    <div className="text-slate-300">
                      {fr.gameScreen.nextUpLabel} <span className="font-semibold text-slate-200">{nextPlayer?.name ?? "-"}</span>
                    </div>
                  </div>
                  {playersByTurnOrder.map((entry) => (
                    <div
                      key={entry.player.id}
                      className={cn(
                        "grid gap-1 rounded-md border p-1.5 transition-colors",
                        entry.isCurrent
                          ? "border-cyan-300/35 bg-cyan-500/10"
                          : entry.isNext
                          ? "border-emerald-300/30 bg-emerald-500/5"
                          : "border-cyan-300/10 bg-slate-950/20"
                      )}
                    >
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5",
                            entry.isCurrent
                              ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                              : entry.isNext
                              ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                              : "border-cyan-300/20 bg-slate-900/40 text-slate-300"
                          )}
                        >
                          {getTurnOrderLabel(entry.turnDistance)}
                        </span>
                        {entry.isMe && (
                          <span className="inline-flex rounded border border-violet-300/40 bg-violet-500/10 px-2 py-0.5 text-violet-100">
                            {fr.gameScreen.you}
                          </span>
                        )}
                      </div>
                      <PlayerCard
                        player={entry.player}
                        isActive={entry.isCurrent}
                        compact
                      />
                    </div>
                  ))}
                </div>
              ) : sidebarTab === "legend" ? (
                <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-auto pr-1 text-sm text-cyan-50">
                  {legend.map((l) => (
                    <div key={l.k} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-cyan-300/35 bg-slate-900/60 text-[11px] font-semibold text-cyan-200">
                        {l.icon}
                      </span>
                      <span className="leading-tight">{l.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid min-h-0 flex-1 gap-1.5 overflow-auto pr-1 text-xs text-cyan-50/90">
                  {activityFeed.length > 0 ? (
                    activityFeed.map((entry, index) => (
                      <div
                        key={`${entry.log}-${index}`}
                        className={cn(
                          "rounded border px-2 py-1",
                          index === 0
                            ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                            : "border-cyan-300/15 bg-slate-950/25 text-cyan-50/85"
                        )}
                      >
                        <div className="mb-1">
                          <ActionBadge
                            label={activityKindLabel[entry.kind]}
                            tone={activityKindClass[entry.kind]}
                            className="rounded border px-1.5 py-0.5"
                          />
                        </div>
                        <div>{entry.log}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded border border-cyan-300/15 bg-slate-950/25 px-2 py-1 text-slate-300">
                      {fr.gameScreen.noRecentActivity}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 z-30 mt-1 pb-[calc(env(safe-area-inset-bottom)+4px)]">
          <Card className={cn(neonCard, "border px-2 py-2 shadow-[0_-8px_24px_rgba(2,6,23,0.35)] backdrop-blur-md xl:hidden")}>
            <div className="grid grid-cols-3 gap-2">
              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
                size="sm"
                variant="secondary"
                onClick={openMobileInfo}
                aria-label={fr.gameScreen.mobileInfoAria}
              >
                {fr.gameScreen.mobileInfo}
              </Button>

              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
                size="sm"
                variant="secondary"
                onClick={openMobileActivity}
                aria-label={fr.gameScreen.activityFeed}
              >
                {fr.gameScreen.mobileFeed}
              </Button>

              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
                size="sm"
                variant="secondary"
                onClick={openMobileMenu}
                aria-label={fr.gameScreen.mobileMenuAria}
              >
                {fr.gameScreen.mobileMenu}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={playersOpen} onOpenChange={setPlayersOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.players}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fr.gameScreen.closePlayersPanelAria}
                  className={GAME_DRAWER_CLOSE_BUTTON}
                >
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid max-h-[62svh] gap-2 overflow-auto px-4 pb-4">
            <div
              className={cn(
                "rounded border px-2 py-2 text-xs",
                isMyTurn
                  ? "border-cyan-300/40 bg-cyan-500/15 shadow-[0_0_0_1px_rgba(34,211,238,0.25)_inset]"
                  : "border-cyan-300/20 bg-slate-950/30"
              )}
            >
              <div className="flex items-center gap-2 text-cyan-100/80">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    isMyTurn ? "bg-cyan-300 animate-pulse" : "bg-slate-500"
                  )}
                />
                {fr.gameScreen.nowPlayingLabel} <span className="font-semibold text-cyan-100">{currentPlayer?.name ?? "-"}</span>
              </div>
              <div className="text-slate-300">
                {fr.gameScreen.nextUpLabel} <span className="font-semibold text-slate-200">{nextPlayer?.name ?? "-"}</span>
              </div>
            </div>
            {playersByTurnOrder.map((entry) => (
              <div
                key={entry.player.id}
                className={cn(
                  "grid gap-1 rounded-md border p-1.5 transition-colors",
                  entry.isCurrent
                    ? "border-cyan-300/35 bg-cyan-500/10"
                    : entry.isNext
                    ? "border-emerald-300/30 bg-emerald-500/5"
                    : "border-cyan-300/10 bg-slate-950/20"
                )}
              >
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5",
                      entry.isCurrent
                        ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                        : entry.isNext
                        ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                        : "border-cyan-300/20 bg-slate-900/40 text-slate-300"
                    )}
                  >
                    {getTurnOrderLabel(entry.turnDistance)}
                  </span>
                  {entry.isMe && (
                    <span className="inline-flex rounded border border-violet-300/40 bg-violet-500/10 px-2 py-0.5 text-violet-100">
                      {fr.gameScreen.you}
                    </span>
                  )}
                </div>
                <PlayerCard
                  player={entry.player}
                  isActive={entry.isCurrent}
                  compact
                />
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={legendOpen} onOpenChange={setLegendOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.legend}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fr.gameScreen.closeLegendPanelAria}
                  className={GAME_DRAWER_CLOSE_BUTTON}
                >
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid gap-2 px-4 pb-4 text-sm text-cyan-50">
            {legend.map((l) => (
              <div key={l.k} className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-cyan-300/35 bg-slate-900/60 text-[11px] font-semibold text-cyan-200">
                  {l.icon}
                </span>
                <span className="leading-tight">{l.label}</span>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.mobileInfoTitle}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={GAME_DRAWER_CLOSE_BUTTON}
                >
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid gap-2 px-4 pb-4">
            <div className="rounded border border-cyan-300/20 bg-slate-950/30 px-3 py-2">
              <div
                className={`mb-1 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
              >
                {gameState.currentQuestion ? fr.gameScreen.statusQuestion : isMyTurn ? fr.gameScreen.statusYourTurn : fr.gameScreen.statusWaiting}
              </div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-100/70">
                {fr.gameScreen.primaryAction}
              </div>
              <div className="text-sm font-semibold leading-snug text-cyan-100">{primaryAction}</div>
              <div className="text-xs text-cyan-100/90">{infoTitle}</div>
              <div className="text-xs text-slate-300">{infoHint}</div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.mobileMenuTitle}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={GAME_DRAWER_CLOSE_BUTTON}
                >
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid gap-2 px-4 pb-4">
            <Button
              className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMobileMenuOpen(false);
                openMobileActivity();
              }}
            >
              {fr.gameScreen.activityFeed}
            </Button>
            <Button
              className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMobileMenuOpen(false);
                openPlayers();
              }}
            >
              {fr.gameScreen.players}
            </Button>
            <Button
              className={cn(GAME_MOBILE_ACTION_BUTTON, activeCyanBtn)}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMobileMenuOpen(false);
                openLegend();
              }}
            >
              {fr.gameScreen.legend}
            </Button>
            {onLeave && (
              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, dangerLeaveBtn)}
                size="sm"
                variant="secondary"
                onClick={() => {
                  setMobileMenuOpen(false);
                  requestLeave();
                }}
              >
                {fr.gameScreen.leave}
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileActivityOpen} onOpenChange={setMobileActivityOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.activityFeed}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={GAME_DRAWER_CLOSE_BUTTON}
                >
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid max-h-[62svh] gap-1.5 overflow-auto px-4 pb-4 text-xs text-cyan-50/90">
            {activityFeed.length > 0 ? (
              activityFeed.map((entry, index) => (
                <div
                  key={`${entry.log}-${index}`}
                  className={cn(
                    "rounded border px-2 py-1",
                    index === 0
                      ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100"
                      : "border-cyan-300/15 bg-slate-950/25 text-cyan-50/85"
                  )}
                >
                  <div className="mb-1">
                    <ActionBadge
                      label={activityKindLabel[entry.kind]}
                      tone={activityKindClass[entry.kind]}
                      className="rounded border px-1.5 py-0.5"
                    />
                  </div>
                  <div>{entry.log}</div>
                </div>
              ))
            ) : (
              <div className="rounded border border-cyan-300/15 bg-slate-950/25 px-2 py-1 text-slate-300">
                {fr.gameScreen.noRecentActivity}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={GAME_DIALOG_CONTENT}>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.gameScreen.leaveQuestionTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {fr.game.backToOnlineLobby}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn(neutralSecondaryBtn, "text-cyan-100")}>
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction className={dangerLeaveBtn} onClick={confirmLeave}>
              {fr.gameScreen.leave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        {gameState.currentQuestion?.status === "open" && !isMoveAnimating && !isMinigameActive && !isKudoPurchaseActive && !isShopActive && (
          <QuestionModal
            question={gameState.currentQuestion}
            players={gameState.players}
            myPlayerId={myPlayerId}
            onVote={onVoteQuestion}
            onValidate={onValidateQuestion}
          />
        )}
      </Suspense>

      <AlertDialog open={isKudoPurchaseActive && !isMoveAnimating} onOpenChange={() => {}}>
        <AlertDialogContent className={GAME_DIALOG_CONTENT}>
          <AlertDialogHeader>
            <AlertDialogTitle>{fr.gameScreen.buyKudoTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {pendingKudoPurchase?.canAfford
                ? fr.gameScreen.canConvertKudo
                : fr.gameScreen.cannotAffordKudo}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {canResolveKudoPurchase ? (
              <>
                <AlertDialogCancel
                  className={cn(neutralSecondaryBtn, "text-cyan-100")}
                  onClick={() => onResolveKudoPurchase?.(false)}
                >
                  {fr.gameScreen.continue}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={activeCyanBtn}
                  disabled={!pendingKudoPurchase?.canAfford}
                  onClick={() => onResolveKudoPurchase?.(true)}
                >
                  {fr.gameScreen.buyKudo}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogCancel className={cn(neutralSecondaryBtn, "text-cyan-100")}>
                {fr.gameScreen.waiting}
              </AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        <ShopModal
          open={isShopActive && !isMoveAnimating}
          canInteract={!!myPlayerId && pendingShop?.playerId === myPlayerId && !!onBuyShopItem}
          points={myPlayer?.points ?? 0}
          items={Object.values(catalogByType)}
          onBuy={(itemType) => onBuyShopItem?.(itemType)}
          onClose={() => onCloseShop?.()}
          activeBtnClass={activeCyanBtn}
          neutralBtnClass={neutralSecondaryBtn}
        />

        <PreRollChoiceModal
          open={shouldShowPreRollChoiceModal}
          canInteract={!!myPlayerId && isMyTurn && !!onResolvePreRollChoice}
          items={preRollChoices}
          selectedType={selectedPreRollType}
          onSelectType={(itemType) => setSelectedPreRollType(itemType)}
          onConfirmSelection={() => {
            if (!selectedPreRollType) return;
            handleConfirmPreRollChoice(selectedPreRollType);
          }}
          onContinue={() => {
            setSelectedPreRollType(null);
            onResolvePreRollChoice?.(null);
          }}
          activeBtnClass={activeCyanBtn}
          neutralBtnClass={neutralSecondaryBtn}
        />
      </Suspense>

      {isTurnIntroActive && !isPathChoiceActive && !isKudoPurchaseActive && !isShopActive && !gameState.currentQuestion && !isMinigameActive && (
        <LaunchAnnouncement
          title={fr.gameScreen.infoYourTurn}
          subtitle={fr.game.yourTurnLaunch}
          startAt={turnIntroEndsAt ?? undefined}
        />
      )}

      {isBugIntroActive && bugSmashState && (
        <LaunchAnnouncement
          title={fr.game.bugSmashLaunchTitle}
          subtitle={fr.game.bugSmashLaunchSubtitle}
          startAt={bugIntroEndsAt ?? bugSmashState.startAt}
        />
      )}

      {isBuzzwordIntroActive && buzzwordState && (
        <LaunchAnnouncement
          title={fr.game.buzzwordLaunchTitle}
          subtitle={fr.game.buzzwordLaunchSubtitle}
          startAt={buzzwordState.nextWordAt ?? undefined}
        />
      )}

      {whoSaidItState?.phase === "idle" && (
        <LaunchAnnouncement
          title={fr.game.whoSaidItLaunchTitle}
          subtitle={fr.game.whoSaidItLaunchSubtitle}
          startAt={whoSaidItIntroAt ?? undefined}
        />
      )}

      <Suspense
        fallback={
          <div className="fixed inset-0 z-[79] flex items-center justify-center bg-slate-950/55 text-sm font-semibold text-cyan-100">
            {fr.gameScreen.waiting}
          </div>
        }
      >
        {whoSaidItState && whoSaidItState.phase !== "idle" && onWhoSaidItSubmit && (
          <WhoSaidItMinigame
            state={whoSaidItState}
            players={gameState.players}
            myPlayerId={myPlayerId}
            onSubmit={onWhoSaidItSubmit}
          />
        )}

        {bugSmashState && onCompleteBugSmash && !isBugIntroActive && (
          <BugSmashMinigame
            players={gameState.players}
            targetPlayerId={bugSmashState.targetPlayerId}
            myPlayerId={myPlayerId}
            startAt={bugSmashState.startAt}
            durationMs={bugSmashState.durationMs}
            liveScore={bugSmashState.score}
            canPlay={!onLeave}
            onProgress={onBugSmashProgress}
            onComplete={onCompleteBugSmash}
          />
        )}

        {buzzwordState && onBuzzwordSubmit && !isBuzzwordIntroActive && (
          <BuzzwordDuelMinigame
            players={gameState.players}
            state={buzzwordState}
            myPlayerId={myPlayerId}
            canInteract
            onSubmit={onBuzzwordSubmit}
          />
        )}

        {pointDuelState && (
          <PointDuelMinigame
            players={gameState.players}
            state={pointDuelState}
            myPlayerId={myPlayerId}
            onRoll={onPointDuelRoll}
          />
        )}
      </Suspense>
    </div>
  );
};
