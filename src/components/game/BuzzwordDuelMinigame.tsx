import React, { useEffect, useMemo, useState } from "react";
import { BuzzwordCategory, BuzzwordDuelState, Player } from "@/types/game";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

interface BuzzwordDuelMinigameProps {
  state: BuzzwordDuelState;
  players: Player[];
  myPlayerId?: string | null;
  canInteract?: boolean;
  onSubmit: (category: BuzzwordCategory) => void;
}

export const BuzzwordDuelMinigame: React.FC<BuzzwordDuelMinigameProps> = ({
  state,
  players,
  myPlayerId,
  canInteract = false,
  onSubmit,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const [leftId, rightId] = state.duelists;
  const leftPlayer = players.find((p) => p.id === leftId) ?? null;
  const rightPlayer = players.find((p) => p.id === rightId) ?? null;

  const isDuelist = !!myPlayerId && state.duelists.includes(myPlayerId);
  const hasSubmitted = !!myPlayerId && state.submittedPlayerIds.includes(myPlayerId);
  const canAnswer =
    !!myPlayerId &&
    isDuelist &&
    canInteract &&
    !hasSubmitted &&
    (state.phase === "word" || state.phase === "sudden_death") &&
    now < state.wordEndsAt;

  const remainingMs =
    state.phase === "between"
      ? Math.max(0, (state.nextWordAt ?? now) - now)
      : Math.max(0, state.wordEndsAt - now);
  const countdown = Math.max(0, Math.ceil(remainingMs / 1000));

  const leftScore = state.scores[leftId] ?? 0;
  const rightScore = state.scores[rightId] ?? 0;
  const transferWinner = state.transfer
    ? players.find((p) => p.id === state.transfer?.winnerId) ?? null
    : null;
  const transferLoser = state.transfer
    ? players.find((p) => p.id === state.transfer?.loserId) ?? null
    : null;

  const statusLabel = useMemo(() => {
    if (state.phase === "transfer" && state.transfer) {
      const winner = players.find((p) => p.id === state.transfer?.winnerId);
      const loser = players.find((p) => p.id === state.transfer?.loserId);
      return `${winner?.name ?? "?"} vole ${state.transfer.amount} points a ${loser?.name ?? "?"}`;
    }
    if (state.phase === "between") {
      return state.roundType === "sudden_death"
        ? "Sudden death en cours..."
        : `Mot suivant (${state.currentWordIndex}/${state.totalWords})`;
    }
    if (state.phase === "sudden_death") {
      return `SUDDEN DEATH #${state.suddenDeathRound}`;
    }
    return `Mot ${state.currentWordIndex}/${state.totalWords}`;
  }, [players, state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canAnswer) return;
      if (event.key === "1") onSubmit("LEGIT");
      if (event.key === "2") onSubmit("BULLSHIT");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAnswer, onSubmit]);

  return (
    <div className="absolute inset-0 z-50 h-full w-full overflow-hidden bg-slate-950 p-3 text-cyan-50 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card className="border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Score</div>
            <div className="text-lg font-bold">{leftScore}</div>
            <div className="truncate text-xs text-cyan-100/80">
              {leftPlayer ? `${AVATARS[leftPlayer.avatar] ?? "?"} ${leftPlayer.name}` : "-"}
            </div>
          </Card>

          <Card className="border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Score</div>
            <div className="text-lg font-bold">{rightScore}</div>
            <div className="truncate text-xs text-cyan-100/80">
              {rightPlayer ? `${AVATARS[rightPlayer.avatar] ?? "?"} ${rightPlayer.name}` : "-"}
            </div>
          </Card>

          <Card className="border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Compte a rebours</div>
            <div className="text-lg font-bold">{countdown}</div>
          </Card>

          <Card className="border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Statut</div>
            <div className="truncate text-sm font-semibold">{statusLabel}</div>
          </Card>
        </div>

        <Card className="flex flex-1 flex-col items-center justify-center border-cyan-300/35 bg-slate-900/80 px-4 py-6 text-center">
          {state.phase === "transfer" ? (
            <div className="w-full max-w-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Transfert en cours</div>
              <div className="mt-3 text-2xl font-black sm:text-4xl">{state.transfer?.amount ?? 0} POINTS VOLES</div>
              <div className="mt-4 rounded border border-cyan-300/35 bg-slate-950/55 px-4 py-3 text-sm text-cyan-50">
                <div>
                  <span className="font-semibold">{transferWinner?.name ?? "?"}</span>
                  {" "}vole{" "}
                  <span className="font-black text-emerald-300">{state.transfer?.amount ?? 0}</span>
                  {" "}points a{" "}
                  <span className="font-semibold">{transferLoser?.name ?? "?"}</span>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded bg-slate-700/70">
                <div className="h-full w-full animate-[pulse_1s_ease-in-out_infinite] bg-emerald-400" />
              </div>
            </div>
          ) : state.phase === "between" ? (
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Preparation</div>
              <div className="mt-3 text-2xl font-black sm:text-5xl">{countdown}</div>
            </div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Buzzword Duel</div>
              {state.isDouble && state.roundType === "main" && (
                <div className="mt-2 rounded-full border border-amber-300 bg-amber-500/20 px-4 py-1 text-xs font-bold text-amber-100">
                  COMPTE DOUBLE
                </div>
              )}
              <div className="mt-4 break-words text-3xl font-black leading-tight sm:text-5xl">{state.wordText}</div>
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            disabled={!canAnswer}
            className={cn(
              "h-16 w-full border-emerald-300 bg-emerald-500 text-slate-950 text-base font-black hover:bg-emerald-400",
              hasSubmitted && "opacity-70"
            )}
            onClick={() => onSubmit("LEGIT")}
          >
            LEGIT (1)
          </Button>
          <Button
            disabled={!canAnswer}
            className={cn(
              "h-16 w-full border-rose-300 bg-rose-500 text-white text-base font-black hover:bg-rose-400",
              hasSubmitted && "opacity-70"
            )}
            onClick={() => onSubmit("BULLSHIT")}
          >
            BULLSHIT (2)
          </Button>
        </div>

        <div className="text-center text-sm text-cyan-100/85">
          {isDuelist
            ? hasSubmitted
              ? "Reponse envoyee"
              : canAnswer
              ? "Choisis ta reponse avant la fin du chrono"
              : "Attends la resolution du mot"
            : "Mode spectateur: lecture seule"}
        </div>
      </div>
    </div>
  );
};
