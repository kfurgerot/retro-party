import React from "react";
import { Player, PointDuelState } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

interface PointDuelMinigameProps {
  state: PointDuelState;
  players: Player[];
  myPlayerId?: string | null;
  onRoll?: () => void;
}

export const PointDuelMinigame: React.FC<PointDuelMinigameProps> = ({ state, players, myPlayerId, onRoll }) => {
  const tr = (template: string, params: Record<string, string | number>) =>
    Object.entries(params).reduce((acc, [key, value]) => acc.replace(`{${key}}`, String(value)), template);

  const attacker = players.find((p) => p.id === state.attackerId);
  const defender = players.find((p) => p.id === state.defenderId);
  const winner = state.winnerId ? players.find((p) => p.id === state.winnerId) : null;

  const rollingPlayerId =
    state.phase === "waiting_attacker_roll"
      ? state.attackerId
      : state.phase === "waiting_defender_roll"
      ? state.defenderId
      : null;
  const rollingPlayerName = players.find((p) => p.id === rollingPlayerId)?.name ?? null;
  const canRollNow = !!onRoll && !!rollingPlayerId && !!myPlayerId && rollingPlayerId === myPlayerId;

  const title =
    state.phase === "announce"
      ? fr.pointDuel.duelTitle
      : state.phase === "waiting_attacker_roll" || state.phase === "show_attacker_roll"
      ? fr.pointDuel.roll1
      : state.phase === "waiting_defender_roll" || state.phase === "show_defender_roll"
      ? fr.pointDuel.roll2
      : fr.pointDuel.duelResult;

  const subtitle = (() => {
    if (state.phase === "announce") return fr.pointDuel.collisionDetected;
    if (state.phase === "waiting_attacker_roll" || state.phase === "waiting_defender_roll") {
      return tr(fr.pointDuel.turnToRoll, { name: rollingPlayerName ?? fr.pointDuel.playerFallback });
    }
    if (state.phase === "show_attacker_roll") return tr(fr.pointDuel.rolledValue, { name: attacker?.name ?? fr.pointDuel.attackerFallback, value: state.attackerRoll ?? "?" });
    if (state.phase === "show_defender_roll") return tr(fr.pointDuel.rolledValue, { name: defender?.name ?? fr.pointDuel.defenderFallback, value: state.defenderRoll ?? "?" });
    if (!winner) return fr.pointDuel.tieNoSteal;
    return tr(fr.pointDuel.winsDuel, { name: winner.name });
  })();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-xl border border-cyan-300/35 bg-slate-950/95 p-5 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
        <div className="text-center">
          <div className="text-xl font-bold">{title}</div>
          <div className="mt-1 text-sm text-slate-300">{subtitle}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={cn("rounded-md border p-3", rollingPlayerId === state.attackerId ? "border-cyan-300/60 bg-cyan-500/10" : "border-cyan-300/25 bg-slate-900/60")}>
            <div className="text-xs uppercase tracking-[0.08em] text-cyan-200/80">{fr.pointDuel.attacker}</div>
            <div className="mt-1 text-sm font-semibold">{attacker?.name ?? "-"}</div>
            <div className="mt-2 text-2xl font-bold">{state.attackerRoll ?? "?"}</div>
          </div>
          <div className={cn("rounded-md border p-3", rollingPlayerId === state.defenderId ? "border-cyan-300/60 bg-cyan-500/10" : "border-cyan-300/25 bg-slate-900/60")}>
            <div className="text-xs uppercase tracking-[0.08em] text-cyan-200/80">{fr.pointDuel.defender}</div>
            <div className="mt-1 text-sm font-semibold">{defender?.name ?? "-"}</div>
            <div className="mt-2 text-2xl font-bold">{state.defenderRoll ?? "?"}</div>
          </div>
        </div>

        {rollingPlayerId && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => onRoll?.()}
              disabled={!canRollNow}
              className={cn(
                "rounded border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                canRollNow
                  ? "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  : "border-slate-500 bg-slate-700/60 text-slate-300 cursor-not-allowed"
              )}
            >
              {fr.pointDuel.rollDice}
            </button>
          </div>
        )}

        {state.phase === "result" && (
          <div className="mt-4 rounded-md border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            {winner ? tr(fr.pointDuel.stealsPoints, { name: winner.name, points: state.stolenPoints }) : fr.pointDuel.noPointSteal}
          </div>
        )}
      </div>
    </div>
  );
};
