import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BuzzwordCategory,
  GameState,
  ShopItemType,
  WhoSaidItRole,
  WhoSaidItViewState,
} from "@/types/game";
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
import { LaunchAnnouncement } from "../game/LaunchAnnouncement";
import { ActionBadge, TurnBanner } from "../game/hud";
import { SHOP_CATALOG } from "@/data/shopCatalog";
import { fr } from "@/i18n/fr";
const CTA_NEON_PRIMARY =
  "border-pink-400/40 bg-pink-500 text-white shadow-[0_4px_16px_rgba(236,72,153,0.35)] hover:bg-pink-400";
const CTA_NEON_SECONDARY_SUBTLE =
  "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white";
const CTA_NEON_DANGER = "border-rose-400/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25";
const GAME_DIALOG_CONTENT =
  "rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.65)] sm:p-6";
const GAME_DRAWER_CLOSE_BUTTON = "h-10 text-slate-200 hover:bg-slate-800/60 hover:text-white";
const GAME_DRAWER_CONTENT =
  "border-pink-400/25 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] text-slate-100 lg:hidden";
const GAME_HUD_SURFACE =
  "rounded-2xl border border-pink-400/28 bg-slate-950/72 text-slate-100 backdrop-blur shadow-[0_0_0_1px_rgba(236,72,153,0.11),0_10px_26px_rgba(2,6,23,0.45)]";
const GAME_MOBILE_ACTION_BUTTON = "h-12 w-full rounded-xl";
const GAME_PANEL_SURFACE =
  "rounded-xl border border-pink-400/20 bg-slate-900/55 text-slate-100 shadow-[0_0_0_1px_rgba(236,72,153,0.07),0_8px_24px_rgba(2,6,23,0.34)]";
const GAME_SUBPANEL_SURFACE = "rounded-xl border border-pink-400/15 bg-slate-950/32";
const GAME_TAB_BUTTON =
  "h-9 rounded-xl border border-pink-400/18 bg-slate-900/45 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-900/65";
const GAME_TAB_BUTTON_ACTIVE =
  "border-pink-400/50 bg-pink-500/18 text-pink-100 shadow-[0_0_0_1px_rgba(236,72,153,0.20)]";
import { ENABLE_BOARD_V2 } from "@/lib/uiMode";
import { perfLog, perfMark, perfMeasure } from "@/lib/perf";

const TURN_ANNOUNCE_MS = 2000;
const MOVE_STEP_MS = 320;
const ROLL_RESULT_READ_MS = 1000;
const ROLL_ANNOUNCE_MS = 2000;
const ROOM_ONBOARDING_STORAGE_PREFIX = "retro-party:guide-seen:";

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
  import("../game/QuestionModal").then((module) => ({ default: module.QuestionModal })),
);
const ShopModal = lazy(() =>
  import("../game/ShopModal").then((module) => ({ default: module.ShopModal })),
);
const PreRollChoiceModal = lazy(() =>
  import("../game/PreRollChoiceModal").then((module) => ({ default: module.PreRollChoiceModal })),
);
const WhoSaidItMinigame = lazy(() =>
  import("../game/WhoSaidItMinigame").then((module) => ({ default: module.WhoSaidItMinigame })),
);
const BugSmashMinigame = lazy(() =>
  import("../game/BugSmashMinigame").then((module) => ({ default: module.BugSmashMinigame })),
);
const BuzzwordDuelMinigame = lazy(() =>
  import("../game/BuzzwordDuelMinigame").then((module) => ({
    default: module.BuzzwordDuelMinigame,
  })),
);
const PointDuelMinigame = lazy(() =>
  import("../game/PointDuelMinigame").then((module) => ({ default: module.PointDuelMinigame })),
);

interface GameScreenProps {
  gameState: GameState;
  roomCode?: string | null;
  roomNotice?: { id: number; message: string } | null;
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
  roomCode,
  roomNotice,
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
  const [sidebarTab, setSidebarTab] = useState<"players" | "activity">("players");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [whoSaidItIntroAt, setWhoSaidItIntroAt] = useState<number | null>(null);
  const [turnIntroEndsAt, setTurnIntroEndsAt] = useState<number | null>(null);
  const [rollIntroEndsAt, setRollIntroEndsAt] = useState<number | null>(null);
  const [rollAnnouncementValue, setRollAnnouncementValue] = useState<number | null>(null);
  const [bugIntroEndsAt, setBugIntroEndsAt] = useState<number | null>(null);
  const [presenceNotice, setPresenceNotice] = useState<{ id: number; message: string } | null>(
    null,
  );
  const [onboardingStepIndex, setOnboardingStepIndex] = useState<number | null>(null);
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
  const lastRollAnnouncementKeyRef = useRef<string | null>(null);
  const bugIntroTimerRef = useRef<number | null>(null);
  const presenceNoticeTimerRef = useRef<number | null>(null);
  const onboardingShownKeyRef = useRef<string | null>(null);
  const hasMovedThisTurnRef = useRef(hasMovedThisTurn);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const boardPlayers = useMemo(
    () => gameState.players.filter((player) => !player.disconnected),
    [gameState.players],
  );
  const bugSmashState =
    gameState.currentMinigame?.minigameId === "BUG_SMASH" ? gameState.currentMinigame : null;
  const buzzwordState =
    gameState.currentMinigame?.minigameId === "BUZZWORD_DUEL" ? gameState.currentMinigame : null;
  const pointDuelState =
    gameState.currentMinigame?.minigameId === "POINT_DUEL" ? gameState.currentMinigame : null;
  const onboardingScreens = useMemo(
    () => [
      {
        icon: "🎮",
        title: "Bienvenue dans Retro Party",
        body: [
          "Ici, on apprend tout en s'amusant.",
          "Le jeu transforme la retrospective en une experience ludique pour aider l'equipe a echanger, reflechir et faire emerger des pistes d'amelioration.",
        ],
      },
      {
        icon: "🎲",
        title: "Avance sur le plateau",
        body: [
          "A ton tour, lance le de pour deplacer ton pion.",
          "Chaque case peut te faire gagner des points, t'en faire perdre, ou declencher une interaction avec le reste de l'equipe.",
        ],
      },
      {
        icon: "💬",
        title: "Reponds aux questions",
        body: [
          "En tombant sur certaines cases, tu devras repondre a des questions a theme.",
          "Le but n'est pas de 'bien repondre', mais de faire emerger des constats, des idees, et des actions concretes pour aider l'equipe a progresser.",
        ],
      },
      {
        icon: "⭐",
        title: "Gagne des points et utilise la boutique",
        body: [
          "Certaines cases te font gagner +2 points. Les cases rouges t'en font perdre -2.",
          "Tu peux aussi tomber sur des boutiques pour acheter des actions speciales, et des cases Kudobox pour recuperer des bonus precieux.",
        ],
      },
      {
        icon: "🏆",
        title: "Vise la victoire",
        body: [
          "A la fin de la partie, le vainqueur est le joueur qui possede le plus de Kudobox et/ou le plus de points.",
          "Joue, participe, partage tes idees... et amuse-toi avec l'equipe.",
        ],
      },
    ],
    [],
  );
  const isOnboardingOpen = onboardingStepIndex != null;
  const activeOnboardingStep =
    onboardingStepIndex != null ? onboardingScreens[onboardingStepIndex] : null;
  const isBuzzwordIntroActive =
    !!buzzwordState &&
    buzzwordState.phase === "between" &&
    buzzwordState.roundType === "main" &&
    buzzwordState.currentWordIndex === 1 &&
    !!buzzwordState.nextWordAt;
  const isMinigameActive =
    !!whoSaidItState || !!bugSmashState || !!buzzwordState || !!pointDuelState;
  const isMyTurn = !!currentPlayer && !!myPlayerId && currentPlayer.id === myPlayerId;
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
  const shouldShowKudoPurchaseModal = canResolveKudoPurchase && !isMoveAnimating;
  const canInteractWithShop =
    !!myPlayerId && pendingShop?.playerId === myPlayerId && !!onBuyShopItem;
  const shouldShowShopModal = canInteractWithShop && !isMoveAnimating;
  const isTurnIntroActive = turnIntroEndsAt != null;
  const isBugIntroActive = bugIntroEndsAt != null;
  const catalogByType = SHOP_CATALOG;
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId) ?? null;
  const myPoints = myPlayer?.points ?? 0;
  const myStars = myPlayer?.stars ?? 0;
  const pendingDoubleRollFirstDie = gameState.pendingDoubleRoll?.firstDie ?? null;
  const beforeRollInventory = useMemo(
    () =>
      (myPlayer?.inventory ?? []).filter(
        (item) => catalogByType[item.type]?.timing === "before_roll",
      ),
    [myPlayer?.inventory, catalogByType],
  );
  const preRollChoices = useMemo(() => {
    const grouped = new Map<
      ShopItemType,
      { type: ShopItemType; count: number; label: string; description: string }
    >();
    for (const item of beforeRollInventory) {
      const def = catalogByType[item.type];
      if (!def) continue;
      const prev = grouped.get(item.type);
      if (prev) prev.count += 1;
      else
        grouped.set(item.type, {
          type: item.type,
          count: 1,
          label: def.label,
          description: def.description,
        });
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
    !gameState.pendingDoubleRoll;

  useEffect(() => {
    if (!shouldShowPreRollChoiceModal) setSelectedPreRollType(null);
  }, [shouldShowPreRollChoiceModal]);

  useEffect(() => {
    perfMark(turnTransitionStartMark);
  }, [turnTransitionStartMark]);

  const myIndex = useMemo(() => {
    const idx = gameState.players.findIndex((p) => !!myPlayerId && p.id === myPlayerId);
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
        const turnDistance = (index - gameState.currentPlayerIndex + total) % total;
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

  const isRollAnnouncementActive = rollIntroEndsAt != null && rollAnnouncementValue != null;

  const canMove =
    gameState.phase === "playing" &&
    !isMinigameActive &&
    !isPathChoiceActive &&
    !isKudoPurchaseActive &&
    !isShopActive &&
    !isRollAnnouncementActive &&
    isMyTurn &&
    gameState.turnPhase === "moving" &&
    !gameState.currentQuestion &&
    !gameState.isRolling &&
    isMoveActionUnlocked &&
    gameState.diceValue != null &&
    !hasMovedThisTurn;

  const handleMove = useCallback(
    (steps: number) => {
      setHasMovedThisTurn(true);
      setIsMoveAnimating(true);
      onMovePlayer(steps);
    },
    [onMovePlayer],
  );

  useEffect(() => {
    hasMovedThisTurnRef.current = hasMovedThisTurn;
  }, [hasMovedThisTurn]);

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
  }, [
    gameState.currentRound,
    gameState.currentPlayerIndex,
    gameState.turnPhase,
    turnTransitionStartMark,
  ]);

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
      !isPathChoiceActive &&
      !isKudoPurchaseActive &&
      !isShopActive &&
      !gameState.currentQuestion &&
      !bugSmashState &&
      !buzzwordState &&
      !whoSaidItState &&
      !isOnboardingOpen &&
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
    isPathChoiceActive,
    isKudoPurchaseActive,
    isShopActive,
    bugSmashState,
    buzzwordState,
    whoSaidItState,
    isOnboardingOpen,
    gameState.turnPhase,
  ]);

  useEffect(() => {
    if (gameState.isRolling || gameState.turnPhase !== "moving" || gameState.diceValue == null) {
      return;
    }

    const total = gameState.lastRollResult?.total;
    const stepsToMove = Number(gameState.diceValue);
    if (!Number.isFinite(stepsToMove) || stepsToMove <= 0) return;
    const announcedTotal = typeof total === "number" ? total : stepsToMove;
    const diceKey = (gameState.lastRollResult?.dice ?? []).join("-");
    const key = `${gameState.currentRound}-${gameState.currentPlayerIndex}-${announcedTotal}-${stepsToMove}-${diceKey}`;
    if (lastRollAnnouncementKeyRef.current === key) return;
    lastRollAnnouncementKeyRef.current = key;
    autoMoveKeyRef.current = key;

    setRollAnnouncementValue(announcedTotal);
    const endAt = Date.now() + ROLL_ANNOUNCE_MS;
    setRollIntroEndsAt(endAt);

    const timeoutId = window.setTimeout(() => {
      setRollIntroEndsAt(null);
      setRollAnnouncementValue(null);
      if (isMyTurn && !hasMovedThisTurnRef.current) {
        handleMove(stepsToMove);
      }
    }, ROLL_ANNOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    gameState.currentPlayerIndex,
    gameState.currentRound,
    gameState.isRolling,
    gameState.lastRollResult?.total,
    (gameState.lastRollResult?.dice ?? []).join("-"),
    gameState.turnPhase,
    gameState.diceValue,
    hasMovedThisTurn,
    isMyTurn,
    handleMove,
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
    const delayMs = isMyMoveTrace ? Math.max(260, (trace.path.length - 1) * MOVE_STEP_MS + 120) : 0;

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
    [activityFeedRaw],
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
      if (presenceNoticeTimerRef.current) {
        window.clearTimeout(presenceNoticeTimerRef.current);
        presenceNoticeTimerRef.current = null;
      }
    },
    [],
  );

  const turnStatusClass = gameState.currentQuestion
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : isMyTurn
      ? "border-pink-400/40 bg-pink-500/15 text-pink-100"
      : "border-pink-400/20 bg-slate-900/40 text-slate-300";

  const neonCard = GAME_PANEL_SURFACE;
  const neonPanel = GAME_SUBPANEL_SURFACE;
  const neutralSecondaryBtn = CTA_NEON_SECONDARY_SUBTLE;
  const activeCyanBtn = CTA_NEON_PRIMARY;
  const dangerLeaveBtn = CTA_NEON_DANGER;
  const desktopLeaveBtn = cn(
    GAME_TAB_BUTTON,
    "border-rose-300/45 bg-rose-500/14 text-rose-100 hover:bg-rose-500/22 hover:text-rose-50",
  );
  const roundProgressPct = Math.max(
    0,
    Math.min(100, Math.round((gameState.currentRound / Math.max(1, gameState.maxRounds)) * 100)),
  );
  const turnQueue = useMemo(
    () => playersByTurnOrder.slice(0, Math.min(playersByTurnOrder.length, 5)),
    [playersByTurnOrder],
  );
  const activityKindLabel: Record<ActivityKind, string> = {
    move: fr.gameScreen.activityTypeMove,
    decision: fr.gameScreen.activityTypeDecision,
    question: fr.gameScreen.activityTypeQuestion,
    shop: fr.gameScreen.activityTypeShop,
    minigame: fr.gameScreen.activityTypeMinigame,
    system: fr.gameScreen.activityTypeSystem,
  };
  const activityKindClass: Record<
    ActivityKind,
    "move" | "decision" | "question" | "shop" | "minigame" | "system"
  > = {
    move: "move",
    decision: "decision",
    question: "question",
    shop: "shop",
    minigame: "minigame",
    system: "system",
  };
  const activePlayerHint = useMemo(() => {
    if (gameState.phase !== "playing") return null;
    if (gameState.isRolling || gameState.turnPhase === "rolling") return "Lance le dé";
    if (isPathChoiceActive) return "Choisit une route";
    if (isKudoPurchaseActive) return "Achete un kudo";
    if (isShopActive) return "Achete un item";
    if (gameState.currentQuestion?.status === "pending") return "Ouvre la carte";
    if (gameState.currentQuestion?.status === "open") return "Repond a la carte";
    if (isMinigameActive) return "Mini-jeu en cours";
    if (gameState.turnPhase === "pre_roll") {
      return "Lance le dé";
    }
    if (gameState.turnPhase === "moving" && gameState.diceValue != null) {
      return `Avance de ${gameState.diceValue}`;
    }
    return "Joue son tour";
  }, [
    gameState.phase,
    gameState.isRolling,
    gameState.turnPhase,
    gameState.currentQuestion?.status,
    gameState.preRollChoiceResolved,
    gameState.preRollActionUsed,
    gameState.diceValue,
    isPathChoiceActive,
    isKudoPurchaseActive,
    isShopActive,
    isMinigameActive,
  ]);

  useEffect(() => {
    if (!roomNotice) return;
    setPresenceNotice(roomNotice);
    if (presenceNoticeTimerRef.current) {
      window.clearTimeout(presenceNoticeTimerRef.current);
    }
    presenceNoticeTimerRef.current = window.setTimeout(() => {
      setPresenceNotice((current) => (current?.id === roomNotice.id ? null : current));
      presenceNoticeTimerRef.current = null;
    }, 2800);
  }, [roomNotice]);

  useEffect(() => {
    if (!roomCode || gameState.phase !== "playing") {
      setOnboardingStepIndex(null);
      onboardingShownKeyRef.current = null;
      return;
    }
    if (onboardingStepIndex != null) return;
    if (typeof window === "undefined") return;

    const onboardingKey = `${ROOM_ONBOARDING_STORAGE_PREFIX}${roomCode}`;
    if (window.localStorage.getItem(onboardingKey) === "1") {
      onboardingShownKeyRef.current = roomCode;
      return;
    }
    if (onboardingShownKeyRef.current === roomCode) return;
    onboardingShownKeyRef.current = roomCode;
    setOnboardingStepIndex(0);
  }, [roomCode, gameState.phase, onboardingStepIndex, myPlayerId]);

  const closeOnboarding = useCallback(() => {
    if (roomCode && typeof window !== "undefined") {
      window.localStorage.setItem(`${ROOM_ONBOARDING_STORAGE_PREFIX}${roomCode}`, "1");
    }
    setOnboardingStepIndex(null);
  }, [roomCode]);

  const goToNextOnboardingStep = useCallback(() => {
    setOnboardingStepIndex((current) => {
      if (current == null) return current;
      if (current >= onboardingScreens.length - 1) {
        closeOnboarding();
        return null;
      }
      return current + 1;
    });
  }, [closeOnboarding, onboardingScreens.length]);

  const goToPreviousOnboardingStep = useCallback(() => {
    setOnboardingStepIndex((current) => {
      if (current == null) return current;
      return Math.max(0, current - 1);
    });
  }, []);

  const handleConfirmPreRollChoice = (itemType: ShopItemType) => {
    const item = beforeRollInventory.find((entry) => entry.type === itemType);
    if (!item) return;
    onResolvePreRollChoice?.(item.id);
    setSelectedPreRollType(null);
  };

  return (
    <div
      className="relative min-h-svh w-full overflow-hidden"
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(236,72,153,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex h-svh w-full flex-col overflow-hidden p-2 sm:p-3">
        {isOnboardingOpen && activeOnboardingStep ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/86 p-3 backdrop-blur-[2px] sm:p-5">
            <Card
              className={cn(
                GAME_HUD_SURFACE,
                "w-full max-w-2xl rounded-2xl border-pink-400/40 bg-slate-950/95 p-4 sm:p-6",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/35 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">
                  <span>{activeOnboardingStep.icon}</span>
                  <span>Guide de partie</span>
                </div>
                <div className="text-xs text-slate-300">
                  {(onboardingStepIndex ?? 0) + 1}/{onboardingScreens.length}
                </div>
              </div>

              <h2 className="mt-4 text-xl font-black text-slate-100 sm:text-2xl">
                {activeOnboardingStep.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-100 sm:text-base">
                {activeOnboardingStep.body.map((paragraph, idx) => (
                  <p key={`${onboardingStepIndex}-${idx}`}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11")}
                  disabled={onboardingStepIndex === 0}
                  onClick={goToPreviousOnboardingStep}
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  className={cn(CTA_NEON_PRIMARY, "h-11")}
                  onClick={goToNextOnboardingStep}
                >
                  {onboardingStepIndex === onboardingScreens.length - 1
                    ? "J'ai compris"
                    : "Suivant"}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
        {presenceNotice ? (
          <div className="pointer-events-none absolute left-1/2 top-16 z-30 w-[min(92vw,560px)] -translate-x-1/2 sm:top-20">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border border-amber-300/70 bg-slate-950/96 px-3 py-2 text-sm text-slate-50 shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_12px_44px_rgba(0,0,0,0.6),0_0_28px_rgba(251,191,36,0.22)] backdrop-blur",
              )}
            >
              <ActionBadge label="Info" tone="decision" />
              <span className="truncate font-bold tracking-[0.01em]">{presenceNotice.message}</span>
            </div>
          </div>
        ) : null}
        <div className={cn(GAME_HUD_SURFACE, "p-1.5 sm:p-2")}>
          <div className="xl:hidden">
            <TurnBanner
              mode="mobile"
              currentTurnLabel={fr.gameScreen.currentTurn}
              currentPlayerName={currentPlayer?.name ?? "-"}
              roomCode={roomCode}
              roomCodeLabel={fr.onlineLobby.codeLabel}
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
            roomCode={roomCode}
            roomCodeLabel={fr.onlineLobby.codeLabel}
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
            leaveBtnClass={desktopLeaveBtn}
          />
        </div>

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:mt-3 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className={cn("min-h-[38svh] flex-1 overflow-hidden p-1 xl:min-h-0", neonPanel)}>
              {ENABLE_BOARD_V2 ? (
                <BoardV2
                  tiles={gameState.tiles}
                  players={boardPlayers}
                  pendingPathChoice={pendingPathChoice}
                  lastMoveTrace={gameState.lastMoveTrace}
                  eventOverlayActive={isArrivalEventActive}
                  canChoosePath={canChoosePath}
                  onChoosePath={onChoosePath}
                />
              ) : (
                <GameBoard
                  tiles={gameState.tiles}
                  players={boardPlayers}
                  focusPlayerId={currentPlayer?.id ?? null}
                  activePlayerHint={!isMyTurn ? activePlayerHint : null}
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
            <Card className={cn(neonCard, "flex min-h-0 flex-1 flex-col rounded-2xl px-3 py-3")}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-bold">
                  {sidebarTab === "players" ? fr.gameScreen.players : fr.gameScreen.activityFeed}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className={cn(
                      GAME_TAB_BUTTON,
                      sidebarTab === "players" ? GAME_TAB_BUTTON_ACTIVE : "opacity-95",
                    )}
                    onClick={() => setSidebarTab("players")}
                  >
                    {fr.gameScreen.players}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={cn(
                      GAME_TAB_BUTTON,
                      sidebarTab === "activity" ? GAME_TAB_BUTTON_ACTIVE : "opacity-95",
                    )}
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
                      `px-2 py-2 text-xs ${GAME_SUBPANEL_SURFACE}`,
                      isMyTurn
                        ? "border-pink-400/45 bg-pink-500/18 shadow-[0_0_0_1px_rgba(236,72,153,0.22)_inset]"
                        : "",
                    )}
                  >
                    <div className="flex items-center gap-2 text-pink-100/80">
                      <span
                        className={cn(
                          "inline-flex h-2 w-2 rounded-full",
                          isMyTurn ? "bg-pink-400 animate-pulse" : "bg-slate-500",
                        )}
                      />
                      {fr.gameScreen.nowPlayingLabel}{" "}
                      <span className="font-semibold text-pink-100">
                        {currentPlayer?.name ?? "-"}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      {fr.gameScreen.nextUpLabel}{" "}
                      <span className="font-semibold text-slate-200">
                        {nextPlayer?.name ?? "-"}
                      </span>
                    </div>
                  </div>
                  {playersByTurnOrder.map((entry) => (
                    <div
                      key={entry.player.id}
                      className={cn(
                        "grid gap-1 rounded-xl border p-1.5 transition-colors",
                        entry.isCurrent
                          ? "border-pink-400/35 bg-pink-500/10"
                          : entry.isNext
                            ? "border-emerald-300/30 bg-emerald-500/5"
                            : "border-pink-400/10 bg-slate-950/20",
                      )}
                    >
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]",
                            entry.isCurrent
                              ? "border-pink-400/45 bg-pink-500/15 text-pink-100"
                              : entry.isNext
                                ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                                : "border-pink-400/20 bg-slate-900/40 text-slate-300",
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
                      <PlayerCard player={entry.player} isActive={entry.isCurrent} compact />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid min-h-0 flex-1 gap-1.5 overflow-auto pr-1 text-xs text-slate-100/90">
                  {activityFeed.length > 0 ? (
                    activityFeed.map((entry, index) => (
                      <div
                        key={`${entry.log}-${index}`}
                        className={cn(
                          "rounded-xl border px-2 py-1.5",
                          index === 0
                            ? "border-pink-400/30 bg-pink-500/10 text-pink-100"
                            : "border-pink-400/15 bg-slate-950/25 text-slate-100/85",
                        )}
                      >
                        <div className="mb-1">
                          <ActionBadge
                            label={activityKindLabel[entry.kind]}
                            tone={activityKindClass[entry.kind]}
                            className="rounded-full border px-2 py-0.5"
                          />
                        </div>
                        <div>{entry.log}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-pink-400/15 bg-slate-950/25 px-2 py-1.5 text-slate-300">
                      {fr.gameScreen.noRecentActivity}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 z-30 mt-1 pb-[calc(env(safe-area-inset-bottom)+4px)]">
          <Card
            className={cn(
              GAME_HUD_SURFACE,
              "px-2 py-2 shadow-[0_-8px_24px_rgba(2,6,23,0.35)] xl:hidden",
            )}
          >
            <div className="grid grid-cols-3 gap-2">
              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, neutralSecondaryBtn)}
                size="sm"
                variant="secondary"
                onClick={openPlayers}
                aria-label={fr.gameScreen.players}
              >
                {fr.gameScreen.players}
              </Button>

              <Button
                className={cn(GAME_MOBILE_ACTION_BUTTON, neutralSecondaryBtn)}
                size="sm"
                variant="secondary"
                onClick={openMobileMenu}
                aria-label={fr.gameScreen.mobileMenuAria}
              >
                {fr.gameScreen.mobileMenu}
              </Button>

              <Button
                className={cn(
                  GAME_MOBILE_ACTION_BUTTON,
                  onLeave ? dangerLeaveBtn : neutralSecondaryBtn,
                  !onLeave && "opacity-60",
                )}
                size="sm"
                variant="secondary"
                onClick={requestLeave}
                aria-label={fr.gameScreen.leave}
                disabled={!onLeave}
              >
                {fr.gameScreen.leave}
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
                "px-2 py-2 text-xs",
                GAME_SUBPANEL_SURFACE,
                isMyTurn
                  ? "border-pink-400/45 bg-pink-500/18 shadow-[0_0_0_1px_rgba(236,72,153,0.22)_inset]"
                  : "",
              )}
            >
              <div className="flex items-center gap-2 text-pink-100/80">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    isMyTurn ? "bg-pink-400 animate-pulse" : "bg-slate-500",
                  )}
                />
                {fr.gameScreen.nowPlayingLabel}{" "}
                <span className="font-semibold text-pink-100">{currentPlayer?.name ?? "-"}</span>
              </div>
              <div className="text-slate-300">
                {fr.gameScreen.nextUpLabel}{" "}
                <span className="font-semibold text-slate-200">{nextPlayer?.name ?? "-"}</span>
              </div>
            </div>
            {playersByTurnOrder.map((entry) => (
              <div
                key={entry.player.id}
                className={cn(
                  "grid gap-1 rounded-xl border p-1.5 transition-colors",
                  entry.isCurrent
                    ? "border-pink-400/35 bg-pink-500/10"
                    : entry.isNext
                      ? "border-emerald-300/30 bg-emerald-500/5"
                      : "border-pink-400/10 bg-slate-950/20",
                )}
              >
                <div className="flex items-center justify-between px-1 text-[11px]">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]",
                      entry.isCurrent
                        ? "border-pink-400/45 bg-pink-500/15 text-pink-100"
                        : entry.isNext
                          ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                          : "border-pink-400/20 bg-slate-900/40 text-slate-300",
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
                <PlayerCard player={entry.player} isActive={entry.isCurrent} compact />
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
                <Button variant="ghost" size="sm" className={GAME_DRAWER_CLOSE_BUTTON}>
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid gap-2 px-4 pb-4">
            <div className={cn("px-3 py-2", GAME_SUBPANEL_SURFACE)}>
              <div
                className={`mb-1 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
              >
                {gameState.currentQuestion
                  ? fr.gameScreen.statusQuestion
                  : isMyTurn
                    ? fr.gameScreen.statusYourTurn
                    : fr.gameScreen.statusWaiting}
              </div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-pink-100/70">
                {fr.gameScreen.primaryAction}
              </div>
              <div className="text-sm font-semibold leading-snug text-pink-100">
                {primaryAction}
              </div>
              <div className="text-xs text-pink-100/90">{infoTitle}</div>
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
                <Button variant="ghost" size="sm" className={GAME_DRAWER_CLOSE_BUTTON}>
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid gap-2 px-4 pb-4">
            <Button
              className={cn(GAME_MOBILE_ACTION_BUTTON, neutralSecondaryBtn)}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMobileMenuOpen(false);
                openMobileInfo();
              }}
            >
              {fr.gameScreen.mobileInfo}
            </Button>
            <Button
              className={cn(GAME_MOBILE_ACTION_BUTTON, neutralSecondaryBtn)}
              size="sm"
              variant="secondary"
              onClick={() => {
                setMobileMenuOpen(false);
                openMobileActivity();
              }}
            >
              {fr.gameScreen.mobileFeed}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={mobileActivityOpen} onOpenChange={setMobileActivityOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.activityFeed}</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" className={GAME_DRAWER_CLOSE_BUTTON}>
                  {fr.gameScreen.close}
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid max-h-[62svh] gap-1.5 overflow-auto px-4 pb-4 text-xs text-slate-100/90">
            {activityFeed.length > 0 ? (
              activityFeed.map((entry, index) => (
                <div
                  key={`${entry.log}-${index}`}
                  className={cn(
                    "rounded-xl border px-2 py-1.5",
                    index === 0
                      ? "border-pink-400/30 bg-pink-500/10 text-pink-100"
                      : "border-pink-400/15 bg-slate-950/25 text-slate-100/85",
                  )}
                >
                  <div className="mb-1">
                    <ActionBadge
                      label={activityKindLabel[entry.kind]}
                      tone={activityKindClass[entry.kind]}
                      className="rounded-full border px-2 py-0.5"
                    />
                  </div>
                  <div>{entry.log}</div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-pink-400/15 bg-slate-950/25 px-2 py-1.5 text-slate-300">
                {fr.gameScreen.noRecentActivity}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md")}>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-rose-300/45 bg-rose-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-rose-100">
              <span>Quitter</span>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              {fr.gameScreen.leaveQuestionTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-300">
              {fr.game.backToOnlineLobby}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn(neutralSecondaryBtn, "h-11 w-full rounded-xl text-slate-200")}
            >
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(dangerLeaveBtn, "h-11 w-full rounded-xl")}
              onClick={confirmLeave}
            >
              {fr.gameScreen.leave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        {gameState.currentQuestion?.status === "open" &&
          !isMoveAnimating &&
          !isMinigameActive &&
          !isKudoPurchaseActive &&
          !isShopActive && (
            <QuestionModal
              question={gameState.currentQuestion}
              players={gameState.players}
              myPlayerId={myPlayerId}
              onVote={onVoteQuestion}
              onValidate={onValidateQuestion}
            />
          )}
      </Suspense>

      <AlertDialog open={shouldShowKudoPurchaseModal} onOpenChange={() => {}}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md")}>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/45 bg-amber-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-amber-100">
              <span className="text-base leading-none">🎁</span>
              <span>Kudobox</span>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              {fr.gameScreen.buyKudoTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-300">
              {pendingKudoPurchase?.canAfford
                ? fr.gameScreen.canConvertKudo
                : fr.gameScreen.cannotAffordKudo}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-pink-400/20 bg-slate-950/30 p-2 text-center">
            <div className="rounded-lg border border-pink-400/20 bg-pink-500/10 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-pink-200/80">Cout</div>
              <div className="text-lg font-bold text-pink-100">10 pts</div>
            </div>
            <div className="rounded-lg border border-pink-400/20 bg-pink-500/10 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-pink-200/80">
                Mes points
              </div>
              <div className="text-lg font-bold text-pink-100">{myPoints}</div>
            </div>
          </div>
          <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn(neutralSecondaryBtn, "h-11 w-full rounded-xl text-slate-200")}
              onClick={() => onResolveKudoPurchase?.(false)}
            >
              {fr.gameScreen.continue}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(activeCyanBtn, "h-11 w-full rounded-xl")}
              disabled={!pendingKudoPurchase?.canAfford}
              onClick={() => onResolveKudoPurchase?.(true)}
            >
              {fr.gameScreen.buyKudo}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        <ShopModal
          open={shouldShowShopModal}
          canInteract={canInteractWithShop}
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

      {isTurnIntroActive &&
        !isPathChoiceActive &&
        !isKudoPurchaseActive &&
        !isShopActive &&
        !gameState.currentQuestion &&
        !isMinigameActive && (
          <LaunchAnnouncement
            title={isMyTurn ? "A ton tour" : "Au tour de"}
            subtitle={isMyTurn ? fr.game.yourTurnLaunch : "Preparez-vous, un joueur va agir."}
            emphasisText={!isMyTurn ? (currentPlayer?.name ?? fr.terms.player) : null}
            startAt={turnIntroEndsAt ?? undefined}
            variant="turn"
          />
        )}

      {rollIntroEndsAt != null && rollAnnouncementValue != null && (
        <LaunchAnnouncement
          title={fr.gameScreen.rollResult}
          subtitle={`obtient ${String(rollAnnouncementValue)}`}
          emphasisText={currentPlayer?.name ?? fr.terms.player}
          startAt={rollIntroEndsAt}
          variant="roll"
          highlightValue={rollAnnouncementValue}
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
          <div className="fixed inset-0 z-[79] flex items-center justify-center bg-slate-950/55 text-sm font-semibold text-pink-100">
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
