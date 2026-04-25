import React from "react";
import { Player, PointDuelState } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { ActionBadge, GameModal, PlayerBadge } from "./hud";

interface PointDuelMinigameProps {
  state: PointDuelState;
  players: Player[];
  myPlayerId?: string | null;
  onRoll?: () => void;
}

export const PointDuelMinigame: React.FC<PointDuelMinigameProps> = ({
  state,
  players,
  myPlayerId,
  onRoll,
}) => {
  const tr = (template: string, params: Record<string, string | number>) =>
    Object.entries(params).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
      template,
    );

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
  const canRollNow =
    !!onRoll && !!rollingPlayerId && !!myPlayerId && rollingPlayerId === myPlayerId;

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
      return tr(fr.pointDuel.turnToRoll, {
        name: rollingPlayerName ?? fr.pointDuel.playerFallback,
      });
    }
    if (state.phase === "show_attacker_roll")
      return tr(fr.pointDuel.rolledValue, {
        name: attacker?.name ?? fr.pointDuel.attackerFallback,
        value: state.attackerRoll ?? "?",
      });
    if (state.phase === "show_defender_roll")
      return tr(fr.pointDuel.rolledValue, {
        name: defender?.name ?? fr.pointDuel.defenderFallback,
        value: state.defenderRoll ?? "?",
      });
    if (!winner) return fr.pointDuel.tieNoSteal;
    return tr(fr.pointDuel.winsDuel, { name: winner.name });
  })();

  return (
    <GameModal title={title} subtitle={subtitle} contentClassName="max-w-xl">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PlayerBadge
          roleLabel={fr.pointDuel.attacker}
          name={attacker?.name ?? "-"}
          highlighted={rollingPlayerId === state.attackerId}
          rightSlot={
            <div className="text-2xl font-bold text-[#24443d]">{state.attackerRoll ?? "?"}</div>
          }
        />
        <PlayerBadge
          roleLabel={fr.pointDuel.defender}
          name={defender?.name ?? "-"}
          highlighted={rollingPlayerId === state.defenderId}
          rightSlot={
            <div className="text-2xl font-bold text-[#24443d]">{state.defenderRoll ?? "?"}</div>
          }
        />
      </div>

      {rollingPlayerId ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onRoll?.()}
            disabled={!canRollNow}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]",
              canRollNow
                ? "border-[#163832] bg-[#163832] text-white hover:bg-[#1f4a43]"
                : "cursor-not-allowed border-[#d8e2d9] bg-white/62 text-[#647067]",
            )}
          >
            {fr.pointDuel.rollDice}
          </button>
        </div>
      ) : null}

      {state.phase === "result" ? (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-2">
            <ActionBadge tone="decision" label={fr.pointDuel.duelResult} />
          </div>
          {winner
            ? tr(fr.pointDuel.stealsPoints, { name: winner.name, points: state.stolenPoints })
            : fr.pointDuel.noPointSteal}
        </div>
      ) : null}
    </GameModal>
  );
};
