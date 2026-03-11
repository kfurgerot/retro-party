import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuzzwordCategory, GameState, ShopItemType, WhoSaidItRole, WhoSaidItViewState } from "@/types/game";
import { GameBoard } from "../game/GameBoard";
import { PlayerCard } from "../game/PlayerCard";
import { Dice } from "../game/Dice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionModal } from "../game/QuestionModal";
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
import { WhoSaidItMinigame } from "../game/WhoSaidItMinigame";
import { BugSmashMinigame } from "../game/BugSmashMinigame";
import { BuzzwordDuelMinigame } from "../game/BuzzwordDuelMinigame";
import { PointDuelMinigame } from "../game/PointDuelMinigame";
import { LaunchAnnouncement } from "../game/LaunchAnnouncement";
import { ShopModal } from "../game/ShopModal";
import { PreRollChoiceModal } from "../game/PreRollChoiceModal";
import { SHOP_CATALOG } from "@/data/shopCatalog";
import { fr } from "@/i18n/fr";

const TURN_ANNOUNCE_MS = 2000;

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
  const [sidebarTab, setSidebarTab] = useState<"players" | "legend">("players");
  const [playersOpen, setPlayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [whoSaidItIntroAt, setWhoSaidItIntroAt] = useState<number | null>(null);
  const [turnIntroEndsAt, setTurnIntroEndsAt] = useState<number | null>(null);
  const [bugIntroEndsAt, setBugIntroEndsAt] = useState<number | null>(null);
  const [selectedPreRollType, setSelectedPreRollType] = useState<ShopItemType | null>(null);

  const autoMoveKeyRef = useRef<string | null>(null);
  const moveAnimationFallbackRef = useRef<number | null>(null);
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

  const myIndex = useMemo(() => {
    const idx = gameState.players.findIndex(
      (p) => !!myPlayerId && p.id === myPlayerId
    );
    return idx >= 0 ? idx : 0;
  }, [gameState.players, myPlayerId]);

  useEffect(() => {
    setHasMovedThisTurn(false);
    setIsMoveAnimating(false);
    autoMoveKeyRef.current = null;
    if (moveAnimationFallbackRef.current) {
      window.clearTimeout(moveAnimationFallbackRef.current);
      moveAnimationFallbackRef.current = null;
    }
  }, [gameState.currentPlayerIndex, gameState.currentRound]);

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
    gameState.diceValue != null &&
    !hasMovedThisTurn;

  const legend = useMemo(
    () => [
      { k: "blue", label: fr.gameScreen.legendBlue, icon: "B" },
      { k: "green", label: fr.gameScreen.legendGreen, icon: "V" },
      { k: "red", label: fr.gameScreen.legendRed, icon: "R" },
      { k: "violet", label: fr.gameScreen.legendViolet, icon: "I" },
      { k: "bonus", label: fr.gameScreen.legendBonus, icon: "*" },
      { k: "shop", label: fr.game.shopLegend, icon: "$" },
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
    return window.matchMedia("(max-width: 1023px)").matches;
  };

  const openPlayers = () => {
    if (isMobile()) setPlayersOpen(true);
    else setSidebarTab("players");
  };

  const openLegend = () => {
    if (isMobile()) setLegendOpen(true);
    else setSidebarTab("legend");
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
    ? "..."
    : fr.gameScreen.hintOpponentTurn;

  const requestLeave = () => {
    if (!onLeave) return;
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave?.();
  };

  const turnStatusClass = gameState.currentQuestion
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : isMyTurn
    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
    : "border-cyan-300/20 bg-slate-900/40 text-slate-300";

  const neonCard =
    "border-cyan-300/30 bg-slate-900/55 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_24px_rgba(34,211,238,0.12)] backdrop-blur";
  const neonPanel =
    "rounded-lg border border-cyan-300/25 bg-slate-900/40 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_20px_rgba(34,211,238,0.08)]";
  const neutralSecondaryBtn =
    "border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70";
  const activeCyanBtn =
    "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400";
  const dangerLeaveBtn =
    "border-rose-300 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.35)] hover:bg-rose-400";

  const canOpenQuestionCard =
    !!gameState.currentQuestion &&
    gameState.currentQuestion.status === "pending" &&
    !isMinigameActive &&
    !isPathChoiceActive &&
    !isShopActive &&
    !isMoveAnimating &&
    !!currentPlayer &&
    !!myPlayerId &&
    currentPlayer.id === myPlayerId &&
    gameState.currentQuestion.targetPlayerId === myPlayerId;

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
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-cyan-300/20 bg-slate-950/25 p-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
          <Card className={cn(neonCard, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              {fr.gameScreen.round}
            </div>
            <div className="text-lg font-bold sm:text-xl">
              {gameState.currentRound} / {gameState.maxRounds}
            </div>
          </Card>

          <Card className={cn(neonCard, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              {fr.gameScreen.currentTurn}
            </div>
            <div className="truncate text-lg font-bold sm:text-xl">{currentPlayer?.name ?? "-"}</div>
          </Card>

          <Card className={cn(neonCard, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              {fr.gameScreen.points}
            </div>
            <div className="text-lg font-bold sm:text-xl">
              {gameState.players.find((p) => p.id === myPlayerId)?.points ?? 0}
            </div>
          </Card>

          <Card className={cn(neonCard, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              {fr.gameScreen.kudobox}
            </div>
            <div className="text-lg font-bold sm:text-xl">
              {gameState.players.find((p) => p.id === myPlayerId)?.stars ?? 0}
            </div>
          </Card>

          {onLeave && (
            <Button
              className={cn("hidden lg:inline-flex", dangerLeaveBtn)}
              variant="secondary"
              onClick={requestLeave}
            >
              {fr.gameScreen.leaveGame}
            </Button>
          )}
        </div>

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:mt-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className={cn("min-h-0 flex-1 overflow-hidden p-1", neonPanel)}>
              <GameBoard
                tiles={gameState.tiles}
                players={gameState.players}
                pendingPathChoice={pendingPathChoice}
                lastMoveTrace={gameState.lastMoveTrace}
                eventOverlayActive={isArrivalEventActive}
                canChoosePath={canChoosePath}
                onChoosePath={onChoosePath}
                onMoveAnimationEnd={(playerId) => {
                  if (playerId === currentPlayer?.id) setIsMoveAnimating(false);
                }}
              />
            </div>
            <Card className={cn(neonCard, "hidden shrink-0 px-4 py-3 lg:block")}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                <div />
                <div className="flex justify-center">
                  <Dice
                    value={gameState.diceValue}
                    rollResult={gameState.lastRollResult ?? null}
                    pendingDoubleRollFirstDie={pendingDoubleRollFirstDie}
                    isRolling={gameState.isRolling}
                    canRoll={canRoll}
                    canMove={canMove}
                    canOpenQuestionCard={canOpenQuestionCard}
                    onRoll={onRollDice}
                    onMove={handleMove}
                    onOpenQuestionCard={onOpenQuestionCard}
                    playerIndex={myIndex}
                  />
                </div>

                <div className="max-w-[360px] justify-self-end rounded-md border border-cyan-300/15 bg-slate-950/30 px-3 py-2 text-right">
                  <div
                    className={`mb-2 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
                  >
                    {gameState.currentQuestion ? fr.gameScreen.statusQuestion : isMyTurn ? fr.gameScreen.statusYourTurn : fr.gameScreen.statusWaiting}
                  </div>
                  <div className="truncate text-sm text-cyan-100/90">{infoTitle}</div>
                  <div className="truncate text-xs text-slate-300">{infoHint}</div>
                </div>
              </div>
            </Card>
          </div>

          <div className="hidden min-h-0 min-w-0 flex-col gap-3 lg:flex">
            <Card className={cn(neonCard, "flex min-h-0 flex-col px-3 py-3")}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-bold">
                  {sidebarTab === "players" ? fr.gameScreen.players : fr.gameScreen.legend}
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
                </div>
              </div>

              {sidebarTab === "players" ? (
                <div className="mt-3 grid max-h-[58vh] gap-2 overflow-auto pr-1">
                  {gameState.players.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      isActive={currentPlayer?.id === p.id}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid max-h-[58vh] gap-2 overflow-auto pr-1 text-sm text-cyan-50">
                  {legend.map((l) => (
                    <div key={l.k} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-cyan-300/35 bg-slate-900/60 text-[11px] font-semibold text-cyan-200">
                        {l.icon}
                      </span>
                      <span className="leading-tight">{l.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 z-30 mt-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <Card className={cn(neonCard, "border px-2 py-2 backdrop-blur-md")}>
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-end gap-3">
                <div className="origin-left shrink-0 scale-[0.88]">
                  <Dice
                    value={gameState.diceValue}
                    rollResult={gameState.lastRollResult ?? null}
                    pendingDoubleRollFirstDie={pendingDoubleRollFirstDie}
                    isRolling={gameState.isRolling}
                    canRoll={canRoll}
                    canMove={canMove}
                    canOpenQuestionCard={canOpenQuestionCard}
                    onRoll={onRollDice}
                    onMove={handleMove}
                    onOpenQuestionCard={onOpenQuestionCard}
                    playerIndex={myIndex}
                  />
                </div>

                <div className="min-w-0 flex-1 self-end rounded border border-cyan-300/15 bg-slate-950/25 px-2 py-1 text-right">
                  <div
                    className={`mb-1 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
                  >
                    {gameState.currentQuestion ? fr.gameScreen.statusQuestion : isMyTurn ? fr.gameScreen.statusYourTurn : fr.gameScreen.statusWaiting}
                  </div>
                  <div className="truncate text-xs text-cyan-100/90 sm:text-sm">{infoTitle}</div>
                  <div className="truncate text-[11px] text-slate-300 sm:text-xs">{infoHint}</div>
                </div>
              </div>

              <div className={`grid gap-2 ${onLeave ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button
                  className="h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                  size="sm"
                  variant="secondary"
                  onClick={openPlayers}
                >
                  {fr.gameScreen.players}
                </Button>

                <Button
                  className="h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                  size="sm"
                  variant="secondary"
                  onClick={openLegend}
                  aria-label={fr.gameScreen.mobileLegendAria}
                >
                  {fr.gameScreen.legend}
                </Button>

                {onLeave && (
                  <Button
                    className={cn("h-10 w-full", dangerLeaveBtn)}
                    size="sm"
                    variant="secondary"
                    onClick={requestLeave}
                  >
                    {fr.gameScreen.leave}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={playersOpen} onOpenChange={setPlayersOpen}>
        <DrawerContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50 lg:hidden">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.players}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fr.gameScreen.closePlayersPanelAria}
                  className="text-cyan-100 hover:bg-slate-800/60 hover:text-cyan-50"
                >
                  X
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="grid max-h-[60svh] gap-2 overflow-auto px-4 pb-4">
            {gameState.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isActive={currentPlayer?.id === p.id}
                compact
              />
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={legendOpen} onOpenChange={setLegendOpen}>
        <DrawerContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50 lg:hidden">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{fr.gameScreen.legend}</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fr.gameScreen.closeLegendPanelAria}
                  className="text-cyan-100 hover:bg-slate-800/60 hover:text-cyan-50"
                >
                  X
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

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50">
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

      {gameState.currentQuestion?.status === "open" && !isMoveAnimating && !isMinigameActive && !isKudoPurchaseActive && !isShopActive && (
        <QuestionModal
          question={gameState.currentQuestion}
          players={gameState.players}
          myPlayerId={myPlayerId}
          onVote={onVoteQuestion}
          onValidate={onValidateQuestion}
        />
      )}

      <AlertDialog open={isKudoPurchaseActive && !isMoveAnimating} onOpenChange={() => {}}>
        <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50">
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
    </div>
  );
};
