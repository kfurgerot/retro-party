import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuzzwordCategory, GameState, WhoSaidItRole, WhoSaidItViewState } from "@/types/game";
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
import { LaunchAnnouncement } from "../game/LaunchAnnouncement";

interface GameScreenProps {
  gameState: GameState;
  myPlayerId?: string | null;
  onLeave?: () => void;
  onRollDice: () => void;
  onMovePlayer: (steps: number) => void;
  onOpenQuestionCard: () => void;
  onVoteQuestion: (vote: "up" | "down") => void;
  onValidateQuestion: () => void;
  onCompleteBugSmash?: (score: number) => void;
  onBugSmashProgress?: (score: number) => void;
  whoSaidItState?: WhoSaidItViewState | null;
  onWhoSaidItSubmit?: (role: WhoSaidItRole) => void;
  onBuzzwordSubmit?: (category: BuzzwordCategory) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  myPlayerId,
  onLeave,
  onRollDice,
  onMovePlayer,
  onOpenQuestionCard,
  onVoteQuestion,
  onValidateQuestion,
  onCompleteBugSmash,
  onBugSmashProgress,
  whoSaidItState,
  onWhoSaidItSubmit,
  onBuzzwordSubmit,
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

  const autoMoveKeyRef = useRef<string | null>(null);
  const moveAnimationFallbackRef = useRef<number | null>(null);
  const lastWhoSaidItIdleRef = useRef<string | null>(null);
  const turnIntroTimerRef = useRef<number | null>(null);
  const bugIntroTimerRef = useRef<number | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const bugSmashState = gameState.currentMinigame?.minigameId === "BUG_SMASH" ? gameState.currentMinigame : null;
  const buzzwordState = gameState.currentMinigame?.minigameId === "BUZZWORD_DUEL" ? gameState.currentMinigame : null;
  const isBuzzwordIntroActive =
    !!buzzwordState &&
    buzzwordState.phase === "between" &&
    buzzwordState.roundType === "main" &&
    buzzwordState.currentWordIndex === 1 &&
    !!buzzwordState.nextWordAt;
  const isMinigameActive = !!whoSaidItState || !!bugSmashState || !!buzzwordState;
  const isMyTurn =
    !!currentPlayer && !!myPlayerId && currentPlayer.id === myPlayerId;
  const isTurnIntroActive = turnIntroEndsAt != null;
  const isBugIntroActive = bugIntroEndsAt != null;

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
    isMyTurn &&
    !gameState.currentQuestion &&
    gameState.diceValue == null &&
    !gameState.isRolling;

  const canMove =
    gameState.phase === "playing" &&
    !isMinigameActive &&
    isMyTurn &&
    !gameState.currentQuestion &&
    !gameState.isRolling &&
    gameState.diceValue != null &&
    !hasMovedThisTurn;

  const legend = useMemo(
    () => [
      { k: "blue", label: "BLEU - Comprendre", icon: "B" },
      { k: "green", label: "VERT - Ameliorer", icon: "V" },
      { k: "red", label: "ROUGE - Frictions", icon: "R" },
      { k: "violet", label: "VIOLET - Vision", icon: "I" },
      { k: "bonus", label: "BONUS - Kudobox", icon: "*" },
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
      !gameState.currentQuestion &&
      !bugSmashState &&
      !buzzwordState &&
      !whoSaidItState &&
      gameState.diceValue == null &&
      !gameState.isRolling;
    if (!shouldShowTurnIntro) {
      setTurnIntroEndsAt(null);
      return;
    }

    const endAt = Date.now() + 4000;
    setTurnIntroEndsAt(endAt);
    turnIntroTimerRef.current = window.setTimeout(() => {
      setTurnIntroEndsAt(null);
      turnIntroTimerRef.current = null;
    }, 4000);

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
    isMyTurn,
    bugSmashState,
    buzzwordState,
    whoSaidItState,
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
  }, [bugSmashState?.targetPlayerId, bugSmashState?.startAt]);

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
      ? "Question prete"
      : "Question en cours..."
    : isMyTurn
    ? "A toi de jouer"
    : "En attente...";

  const infoHint = canRoll
    ? "Lance le de"
    : isMoveAnimating
    ? "Deplacement en cours..."
    : canMove
    ? "Avance auto..."
    : isMyTurn
    ? "..."
    : "Tour adverse";

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
    !isMoveAnimating &&
    !!currentPlayer &&
    !!myPlayerId &&
    currentPlayer.id === myPlayerId &&
    gameState.currentQuestion.targetPlayerId === myPlayerId;

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden">
      <RetroScreenBackground />

      <div className="relative z-10 flex h-svh w-full flex-col overflow-hidden p-2 sm:p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
          <Card className={cn(neonCard, "px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              Manche
            </div>
            <div className="text-xl font-bold">
              {gameState.currentRound} / {gameState.maxRounds}
            </div>
          </Card>

          <Card className={cn(neonCard, "px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              Tour de
            </div>
            <div className="truncate text-xl font-bold">{currentPlayer?.name ?? "-"}</div>
          </Card>

          <Card className={cn(neonCard, "px-3 py-2 sm:px-4 sm:py-3")}>
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              Kudobox
            </div>
            <div className="text-xl font-bold">
              {gameState.players.find((p) => p.id === myPlayerId)?.stars ?? 0}
            </div>
          </Card>

          {onLeave && (
            <Button
              className={cn("hidden lg:inline-flex", dangerLeaveBtn)}
              variant="secondary"
              onClick={requestLeave}
            >
              Quitter la partie
            </Button>
          )}
        </div>

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:mt-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-cyan-300/25 bg-slate-900/35 p-1 shadow-[0_0_24px_rgba(34,211,238,0.1)]">
              <GameBoard
                tiles={gameState.tiles}
                players={gameState.players}
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

                <div className="max-w-[360px] justify-self-end text-right">
                  <div
                    className={`mb-2 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
                  >
                    {gameState.currentQuestion ? "Question" : isMyTurn ? "Ton tour" : "Attente"}
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
                  {sidebarTab === "players" ? "Joueurs" : "Legende"}
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
                    Joueurs
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
                    Legende
                  </Button>
                </div>
              </div>

              {sidebarTab === "players" ? (
                <div className="mt-3 grid gap-2">
                  {gameState.players.map((p) => (
                    <PlayerCard
                      key={p.id}
                      player={p as any}
                      isActive={currentPlayer?.id === p.id}
                      compact
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid gap-2 text-sm text-cyan-50">
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
          <Card className={cn(neonCard, "border px-2 py-2")}>
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-end gap-3">
                <div className="origin-left shrink-0 scale-[0.88]">
                  <Dice
                    value={gameState.diceValue}
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

                <div className="min-w-0 flex-1 self-end pb-3 text-right">
                  <div
                    className={`mb-1 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}
                  >
                    {gameState.currentQuestion ? "Question" : isMyTurn ? "Ton tour" : "Attente"}
                  </div>
                  <div className="truncate text-sm text-cyan-100/90">{infoTitle}</div>
                  <div className="truncate text-xs text-slate-300">{infoHint}</div>
                </div>
              </div>

              <div className={`grid gap-2 ${onLeave ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button
                  className="h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                  size="sm"
                  variant="secondary"
                  onClick={openPlayers}
                >
                  Joueurs
                </Button>

                <Button
                  className="h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                  size="sm"
                  variant="secondary"
                  onClick={openLegend}
                  aria-label="Afficher la legende"
                >
                  Legende
                </Button>

                {onLeave && (
                  <Button
                    className={cn("h-10 w-full", dangerLeaveBtn)}
                    size="sm"
                    variant="secondary"
                    onClick={requestLeave}
                  >
                    Quitter
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
              <DrawerTitle>Joueurs</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Fermer le panneau joueurs"
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
                player={p as any}
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
              <DrawerTitle>Legende</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Fermer le panneau legende"
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
            <AlertDialogTitle>Quitter la partie ?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Tu vas revenir au lobby en ligne. Cette action est immediate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn(neutralSecondaryBtn, "text-cyan-100")}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction className={dangerLeaveBtn} onClick={confirmLeave}>
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {gameState.currentQuestion?.status === "open" && !isMoveAnimating && !isMinigameActive && (
        <QuestionModal
          question={gameState.currentQuestion}
          players={gameState.players}
          myPlayerId={myPlayerId}
          onVote={onVoteQuestion}
          onValidate={onValidateQuestion}
        />
      )}

      {isTurnIntroActive && !gameState.currentQuestion && !isMinigameActive && (
        <LaunchAnnouncement
          title="A toi de jouer"
          subtitle="Prepares-toi a lancer le de."
          startAt={turnIntroEndsAt ?? undefined}
        />
      )}

      {isBugIntroActive && bugSmashState && (
        <LaunchAnnouncement
          title="Bug Smash"
          subtitle="Mini-jeu rouge imminent."
          startAt={bugIntroEndsAt ?? bugSmashState.startAt}
        />
      )}

      {isBuzzwordIntroActive && buzzwordState && (
        <LaunchAnnouncement
          title="Buzzword Duel"
          subtitle="Duel 1v1 imminent."
          startAt={buzzwordState.nextWordAt ?? undefined}
        />
      )}

      {whoSaidItState?.phase === "idle" && (
        <LaunchAnnouncement
          title="Qui a dit ca ?"
          subtitle="Le mini-jeu de roles Agile va commencer."
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
    </div>
  );
};
