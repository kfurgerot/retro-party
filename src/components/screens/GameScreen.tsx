import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameState } from "@/types/game";
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

interface GameScreenProps {
  gameState: GameState;
  myPlayerId?: string | null;
  onLeave?: () => void;
  onRollDice: () => void;
  onMovePlayer: (steps: number) => void;
  onOpenQuestionCard: () => void;
  onVoteQuestion: (vote: "up" | "down") => void;
  onValidateQuestion: () => void;
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
}) => {
  const [hasMovedThisTurn, setHasMovedThisTurn] = useState(false);
  const [isMoveAnimating, setIsMoveAnimating] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"players" | "legend">("players");

  const [playersOpen, setPlayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const autoMoveKeyRef = useRef<string | null>(null);
  const moveAnimationFallbackRef = useRef<number | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn =
    !!currentPlayer && !!myPlayerId && currentPlayer.id === myPlayerId;

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
    isMyTurn &&
    !gameState.currentQuestion &&
    gameState.diceValue == null &&
    !gameState.isRolling;

  const canMove =
    gameState.phase === "playing" &&
    isMyTurn &&
    !gameState.currentQuestion &&
    !gameState.isRolling &&
    gameState.diceValue != null &&
    !hasMovedThisTurn;

  const legend = useMemo(
    () => [
      { k: "blue", label: "BLEU - Comprendre", icon: "🔵" },
      { k: "green", label: "VERT - Améliorer", icon: "🟢" },
      { k: "red", label: "ROUGE - Frictions", icon: "🔴" },
      { k: "violet", label: "VIOLET - Vision", icon: "🟣" },
      { k: "bonus", label: "BONUS - Kudobox ⭐", icon: "⭐" },
    ],
    []
  );

  const handleMove = useCallback((steps: number) => {
    setHasMovedThisTurn(true);
    setIsMoveAnimating(true);
    onMovePlayer(steps);
  }, [onMovePlayer]);

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
      ? "Question prête"
      : "Question en cours..."
    : isMyTurn
    ? "A toi de jouer"
    : "En attente...";

  const infoHint = canRoll
    ? "Lance le dé"
    : isMoveAnimating
    ? "Deplacement en cours..."
    : canMove
    ? "Avance auto..."
    : isMyTurn
    ? "..."
    : "Tour adverse";

  const handleLeave = () => {
    if (!onLeave) return;
    if (!window.confirm("Quitter la partie en ligne ?")) return;
    onLeave();
  };

  const turnStatusClass = gameState.currentQuestion
    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : isMyTurn
    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
    : "border-border/70 bg-background/40 text-muted-foreground";

  const neutralSecondaryBtn =
    "border-border/70 bg-background/50 text-foreground hover:bg-background/70";
  const activeCyanBtn =
    "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400";

  const canOpenQuestionCard =
    !!gameState.currentQuestion &&
    gameState.currentQuestion.status === "pending" &&
    !isMoveAnimating &&
    !!currentPlayer &&
    !!myPlayerId &&
    currentPlayer.id === myPlayerId &&
    gameState.currentQuestion.targetPlayerId === myPlayerId;

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden p-2 sm:p-3">
      {/* Header */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
        <Card className="border-border/70 bg-card/80 px-3 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-3">
          <div className="text-sm opacity-80">Manche</div>
          <div className="text-xl font-bold">
            {gameState.currentRound} / {gameState.maxRounds}
          </div>
        </Card>

        <Card className="border-border/70 bg-card/80 px-3 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-3">
          <div className="text-sm opacity-80">Tour de</div>
          <div className="truncate text-xl font-bold">{currentPlayer?.name ?? "-"}</div>
        </Card>

        <Card className="border-border/70 bg-card/80 px-3 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-3">
          <div className="text-sm opacity-80">Kudobox ⭐</div>
          <div className="text-xl font-bold">
            {gameState.players.find((p) => p.id === myPlayerId)?.stars ?? 0}
          </div>
        </Card>

        {onLeave && (
          <Button
            className={`hidden lg:inline-flex ${neutralSecondaryBtn}`}
            variant="secondary"
            onClick={handleLeave}
          >
            Quitter
          </Button>
        )}
      </div>

      {/* Main layout */}
      <div className="mt-2 grid flex-1 min-h-0 grid-cols-1 gap-3 sm:mt-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Board */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border/40 bg-card/30 p-1 shadow-sm">
            <GameBoard
              tiles={gameState.tiles}
              players={gameState.players}
              onMoveAnimationEnd={(playerId) => {
                if (playerId === currentPlayer?.id) setIsMoveAnimating(false);
              }}
            />
          </div>

          {/* Desktop controls */}
          <Card className="hidden shrink-0 border-border/70 bg-card/80 px-4 py-3 shadow-sm backdrop-blur lg:block">
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

              <div className="text-right justify-self-end max-w-[360px]">
                <div className={`mb-2 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}>
                  {gameState.currentQuestion ? "Question" : isMyTurn ? "Ton tour" : "Attente"}
                </div>
                <div className="text-sm opacity-80 truncate">{infoTitle}</div>
                <div className="text-xs opacity-60 truncate">{infoHint}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar desktop */}
        <div className="hidden min-w-0 min-h-0 flex-col gap-3 lg:flex">
          <Card className="flex min-h-0 flex-col border-border/70 bg-card/80 px-3 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-bold">
                {sidebarTab === "players" ? "Joueurs" : "Légende"}
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
                  Légende
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
              <div className="mt-3 grid gap-2 text-sm">
                {legend.map((l) => (
                  <div key={l.k} className="flex items-center gap-2">
                    <span className="text-base">{l.icon}</span>
                    <span className="leading-tight">{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* MOBILE TOOLBAR */}
      <div className="sticky bottom-0 z-30 mt-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Card className="border border-border/70 bg-card/95 px-2 py-2 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-end gap-3">
              <div className="shrink-0 scale-[0.88] origin-left">
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
                <div className={`mb-1 inline-flex rounded-full border px-2 py-1 text-[11px] ${turnStatusClass}`}>
                  {gameState.currentQuestion ? "Question" : isMyTurn ? "Ton tour" : "Attente"}
                </div>
                <div className="truncate text-sm opacity-80">{infoTitle}</div>
                <div className="truncate text-xs opacity-60">{infoHint}</div>
              </div>
            </div>

            <div className={`grid gap-2 ${onLeave ? "grid-cols-3" : "grid-cols-2"}`}>
              <Button
                className={`h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-sm shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400`}
                size="sm"
                variant="secondary"
                onClick={openPlayers}
              >
                Joueurs
              </Button>

              <Button
                className={`h-10 w-full border-cyan-300 bg-cyan-500 text-slate-950 shadow-sm shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400`}
                size="sm"
                variant="secondary"
                onClick={openLegend}
                aria-label="Afficher la legende"
              >
                Legende
              </Button>

              {onLeave && (
                <Button
                  className="h-10 w-full shadow-sm"
                  size="sm"
                  variant="destructive"
                  onClick={handleLeave}
                >
                  Quitter
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Drawer Players */}
      <Drawer open={playersOpen} onOpenChange={setPlayersOpen}>
        <DrawerContent className="lg:hidden">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>Joueurs</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" aria-label="Fermer le panneau joueurs">
                  ✕
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 grid gap-2 max-h-[60svh] overflow-auto">
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

      {/* Drawer Legend */}
      <Drawer open={legendOpen} onOpenChange={setLegendOpen}>
        <DrawerContent className="lg:hidden">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>Légende</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm" aria-label="Fermer le panneau legende">
                  ✕
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 grid gap-2 text-sm">
            {legend.map((l) => (
              <div key={l.k} className="flex items-center gap-2">
                <span className="text-base">{l.icon}</span>
                <span className="leading-tight">{l.label}</span>
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {gameState.currentQuestion?.status === "open" && !isMoveAnimating && (
        <QuestionModal
          question={gameState.currentQuestion}
          players={gameState.players}
          myPlayerId={myPlayerId}
          onVote={onVoteQuestion}
          onValidate={onValidateQuestion}
        />
      )}
    </div>
  );
};
