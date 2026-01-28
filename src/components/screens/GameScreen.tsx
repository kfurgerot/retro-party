import React, { useEffect, useMemo, useState } from "react";
import { GameState } from "@/types/game";
import { GameBoard } from "../game/GameBoard";
import { PlayerCard } from "../game/PlayerCard";
import { Dice } from "../game/Dice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionModal } from "../game/QuestionModal";

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
  // Keep the right column compact: one panel with tabs (no scrolling needed)
  const [sidebarTab, setSidebarTab] = useState<"players" | "legend">("players");

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = !!currentPlayer && !!myPlayerId && currentPlayer.id === myPlayerId;

  const myIndex = useMemo(() => {
    const idx = gameState.players.findIndex((p) => !!myPlayerId && p.id === myPlayerId);
    return idx >= 0 ? idx : 0;
  }, [gameState.players, myPlayerId]);

  // Reset local UI when turn changes or a question opens/closes
  useEffect(() => {
    setHasMovedThisTurn(false);
  }, [gameState.currentPlayerIndex, gameState.currentQuestion?.id]);

  const canRoll = gameState.phase === "playing" && isMyTurn && !gameState.currentQuestion && gameState.diceValue == null && !gameState.isRolling;
  const canMove = gameState.phase === "playing" && isMyTurn && !gameState.currentQuestion && !gameState.isRolling && gameState.diceValue != null && !hasMovedThisTurn;

  const legend = useMemo(() => ([
    { k: "blue", label: "BLEU — Comprendre", icon: "🔵" },
    { k: "green", label: "VERT — Améliorer", icon: "🟢" },
    { k: "red", label: "ROUGE — Frictions", icon: "🔴" },
    { k: "violet", label: "VIOLET — Vision", icon: "🟣" },
    { k: "bonus", label: "BONUS — Kudobox ⭐", icon: "⭐" },
  ]), []);

  const handleMove = () => {
    if (gameState.diceValue == null) return;
    setHasMovedThisTurn(true);
    onMovePlayer(gameState.diceValue);
  };

  return (
    <div className="flex h-svh w-full flex-col gap-3 p-3 overflow-hidden scanlines">
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
            {(gameState.players.find(p => p.id === myPlayerId)?.stars ?? 0)}
          </div>
        </Card>
      </div>

    <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Board */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-border/40 bg-card/30 p-1">
            <GameBoard tiles={gameState.tiles} players={gameState.players} />
          </div>

          {/* Controls */}
          <Card className="bg-card/80 backdrop-blur flex flex-wrap items-center justify-between gap-3 px-4 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <Dice value={gameState.diceValue} isRolling={gameState.isRolling} onRoll={onRollDice} disabled={!canRoll} playerIndex={myIndex} />
              <div className="text-sm opacity-80">
                {gameState.currentQuestion
                  ? "Question en cours…"
                  : isMyTurn
                    ? "À toi de jouer"
                    : "En attente…"}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleMove} disabled={!canMove}>
                ➡️ Avancer
              </Button>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex min-h-0 flex-col gap-3 min-w-0">
          <Card className="bg-card/80 backdrop-blur px-3 py-3 flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-bold">{sidebarTab === "players" ? "Joueurs" : "Légende"}</div>
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

            {sidebarTab === "legend" ? (
              <div className="mt-3 grid gap-2 text-sm">
                {legend.map((l) => (
                  <div key={l.k} className="flex items-center gap-2">
                    <span className="text-base">{l.icon}</span>
                    <span className="leading-tight">{l.label}</span>
                  </div>
                ))}
              </div>
            ) : (
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
            )}
          </Card>
        </div>
      </div>

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