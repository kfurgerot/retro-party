import React, { useEffect, useMemo, useRef, useState } from "react";
import { GameState } from "@/types/game";
import { GameBoard, GameBoardHandle } from "../game/GameBoard";
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
  onRollDice: () => void;
  onMovePlayer: (steps: number) => void;
  onVoteQuestion: (vote: "up" | "down") => void;
  onValidateQuestion: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  myPlayerId,
  onRollDice,
  onMovePlayer,
  onVoteQuestion,
  onValidateQuestion,
}) => {
  const [hasMovedThisTurn, setHasMovedThisTurn] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"players" | "legend">("players");

  const [playersOpen, setPlayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const boardRef = useRef<GameBoardHandle | null>(null);

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
  }, [gameState.currentPlayerIndex, gameState.currentQuestion?.id]);

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
      { k: "blue", label: "BLEU — Comprendre", icon: "🔵" },
      { k: "green", label: "VERT — Améliorer", icon: "🟢" },
      { k: "red", label: "ROUGE — Frictions", icon: "🔴" },
      { k: "violet", label: "VIOLET — Vision", icon: "🟣" },
      { k: "bonus", label: "BONUS — Kudobox ⭐", icon: "⭐" },
    ],
    []
  );

  const handleMove = (steps: number) => {
    setHasMovedThisTurn(true);
    onMovePlayer(steps);
  };

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
    ? "Question en cours…"
    : isMyTurn
    ? "À toi de jouer"
    : "En attente…";

  const infoHint = canRoll
    ? "Lance le dé"
    : canMove
    ? "Puis avance"
    : isMyTurn
    ? "…"
    : "Tour adverse";

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden p-2 sm:p-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="bg-card/80 backdrop-blur px-4 py-3">
          <div className="text-sm opacity-80">Manche</div>
          <div className="text-xl font-bold">
            {gameState.currentRound} / {gameState.maxRounds}
          </div>
        </Card>

        <Card className="bg-card/80 backdrop-blur px-4 py-3">
          <div className="text-sm opacity-80">Tour de</div>
          <div className="text-xl font-bold">{currentPlayer?.name ?? "-"}</div>
        </Card>

        <Card className="bg-card/80 backdrop-blur px-4 py-3">
          <div className="text-sm opacity-80">Kudobox ⭐</div>
          <div className="text-xl font-bold">
            {gameState.players.find((p) => p.id === myPlayerId)?.stars ?? 0}
          </div>
        </Card>
      </div>

      {/* Main layout */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] mt-2 sm:mt-3">
        {/* Board */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border/40 bg-card/30 p-1">
            <GameBoard
              ref={boardRef}
              tiles={gameState.tiles}
              players={gameState.players}
            />
          </div>

          {/* Desktop controls */}
          <Card className="hidden lg:block bg-card/80 backdrop-blur px-4 py-3 shrink-0">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
              <div />
              <div className="flex justify-center">
                <Dice
                  value={gameState.diceValue}
                  isRolling={gameState.isRolling}
                  canRoll={canRoll}
                  canMove={canMove}
                  onRoll={onRollDice}
                  onMove={handleMove}
                  playerIndex={myIndex}
                />
              </div>

              <div className="text-right justify-self-end max-w-[360px]">
                <div className="text-sm opacity-80 truncate">{infoTitle}</div>
                <div className="text-xs opacity-60 truncate">{infoHint}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar desktop */}
        <div className="hidden lg:flex min-h-0 flex-col gap-3 min-w-0">
          <Card className="bg-card/80 backdrop-blur px-3 py-3 flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-bold">
                {sidebarTab === "players" ? "Joueurs" : "Légende"}
              </div>
              <div className="flex gap-2">
                <Button
                  variant={sidebarTab === "players" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setSidebarTab("players")}
                >
                  Joueurs
                </Button>
                <Button
                  variant={sidebarTab === "legend" ? "default" : "secondary"}
                  size="sm"
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
      <div className="lg:hidden sticky bottom-0 z-30 mt-2 pb-[env(safe-area-inset-bottom)]">
        <Card className="bg-card/95 backdrop-blur border px-2 py-2">
          <div className="flex items-stretch gap-2">
            {/* Left: Dice + info (aligned bottom with the dice action button) */}
            <div className="flex flex-1 items-end gap-3 min-w-0">
              <div className="shrink-0 scale-[0.85] origin-left">
                <Dice
                  value={gameState.diceValue}
                  isRolling={gameState.isRolling}
                  canRoll={canRoll}
                  canMove={canMove}
                  onRoll={onRollDice}
                  onMove={handleMove}
                  playerIndex={myIndex}
                />
              </div>

              {/* ✅ moved down: align with the dice button */}
              <div className="flex-1 text-right min-w-0 self-end pb-3">
                <div className="text-xs opacity-80 truncate">{infoTitle}</div>
                <div className="text-[11px] opacity-60 truncate">{infoHint}</div>
              </div>
            </div>

            {/* Right rail */}
            <div className="flex w-[28%] min-w-[92px] flex-col gap-2">
              <Button className="w-full" size="sm" onClick={openPlayers}>
                👥 Joueurs
              </Button>

              <Button
                className="w-full h-8 px-0"
                size="sm"
                variant="secondary"
                onClick={openLegend}
                title="Légende"
              >
                🗺️
              </Button>
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
                <Button variant="ghost" size="sm">
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
                <Button variant="ghost" size="sm">
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

      {gameState.currentQuestion && (
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
