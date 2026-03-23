import React, { useMemo } from "react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { PokerScene } from "@/components/planning-poker/pixi/PokerScene";
import { computePlanningPokerStats, formatPlanningValue, PLANNING_POKER_DECKS } from "@/lib/planningPoker";
import { PlanningPokerRole, PlanningPokerState, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";

type Props = {
  state: PlanningPokerState;
  myPlayerId: string | null;
  myRole: PlanningPokerRole;
  myVote: string | null;
  isHost: boolean;
  onVoteCard: (value: string) => void;
  onRevealVotes: () => void;
  onResetVotes: () => void;
  onLeave: () => void;
  onRoleChange: (role: PlanningPokerRole) => void;
  onVoteSystemChange: (voteSystem: PlanningPokerVoteSystem) => void;
};

export const PlanningPokerGameScreen: React.FC<Props> = ({
  state,
  myPlayerId,
  myRole,
  myVote,
  isHost,
  onVoteCard,
  onRevealVotes,
  onResetVotes,
  onLeave,
  onRoleChange,
  onVoteSystemChange,
}) => {
  const stats = useMemo(() => computePlanningPokerStats(state.players, state.voteSystem), [state.players, state.voteSystem]);
  const voteProgress = useMemo(() => {
    const activePlayers = state.players.filter((player) => player.role === "player");
    const votedPlayers = activePlayers.filter((player) => player.hasVoted);
    return {
      active: activePlayers.length,
      voted: votedPlayers.length,
    };
  }, [state.players]);

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden px-3 pb-24 pt-3 sm:px-4 sm:pb-24 sm:pt-4">
      <RetroScreenBackground />

      <div className="relative z-10 mx-auto flex h-[calc(100svh-8rem)] w-full max-w-7xl flex-col gap-3 sm:gap-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">{fr.planningPoker.brand}</div>
            <h1 className="mt-1 text-lg text-cyan-100 sm:text-2xl">{fr.planningPoker.gameTitle}</h1>
            <p className="text-xs text-slate-300">
              {fr.planningPoker.roundLabel} {state.round} · {fr.planningPoker.voteSystem}: {state.voteSystem}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              className="h-9 text-xs"
              onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}
            >
              {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
            </SecondaryButton>

            {isHost && (
              <select
                value={state.voteSystem}
                onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerVoteSystem)}
                className="h-9 rounded border border-cyan-300/25 bg-slate-900/70 px-2 text-xs text-cyan-50"
              >
                <option value="fibonacci">Fibonacci</option>
                <option value="man-day">Jour.homme</option>
                <option value="tshirt">T-Shirt</option>
              </select>
            )}
          </div>
        </Card>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="min-h-0 overflow-hidden p-2 sm:p-3">
            <PokerScene
              players={state.players}
              cardValues={PLANNING_POKER_DECKS[state.voteSystem]}
              revealed={state.revealed}
              myPlayerId={myPlayerId}
              myRole={myRole}
              myVote={myVote}
              onVoteCard={onVoteCard}
            />
          </Card>

          <Card className="grid content-start gap-3 p-3 sm:p-4">
            <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.planningPoker.voteProgress}</p>
              <p className="mt-1 text-xl font-semibold text-cyan-100">{voteProgress.voted}/{voteProgress.active}</p>
              <p className="mt-1 text-xs text-slate-300">{state.revealed ? fr.planningPoker.revealed : fr.planningPoker.hidden}</p>
            </div>

            <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.planningPoker.resultsTitle}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1">
                  <div className="text-slate-300">{fr.planningPoker.avg}</div>
                  <div className="text-cyan-100">{formatPlanningValue(stats.average)}</div>
                </div>
                <div className="rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1">
                  <div className="text-slate-300">{fr.planningPoker.median}</div>
                  <div className="text-cyan-100">{formatPlanningValue(stats.median)}</div>
                </div>
                <div className="rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1">
                  <div className="text-slate-300">{fr.planningPoker.min}</div>
                  <div className="text-cyan-100">{formatPlanningValue(stats.min)}</div>
                </div>
                <div className="rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1">
                  <div className="text-slate-300">{fr.planningPoker.max}</div>
                  <div className="text-cyan-100">{formatPlanningValue(stats.max)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
              <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.planningPoker.distribution}</p>
              <div className="mt-2 grid gap-1 text-xs">
                {Object.entries(stats.distribution).length > 0 ? (
                  Object.entries(stats.distribution)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([value, count]) => (
                      <div key={value} className="flex items-center justify-between rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1 text-cyan-50">
                        <span>{value}</span>
                        <span>{count}</span>
                      </div>
                    ))
                ) : (
                  <div className="rounded border border-cyan-300/20 bg-slate-950/50 px-2 py-1 text-slate-300">{fr.planningPoker.noVotes}</div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Card className="pointer-events-auto mx-auto w-full max-w-7xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <SecondaryButton className="h-11" onClick={onLeave}>{fr.onlineLobby.leaveParty}</SecondaryButton>

            <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex sm:w-auto">
              <SecondaryButton className="h-11" disabled={!isHost} onClick={onResetVotes}>{fr.planningPoker.resetVotes}</SecondaryButton>
              <PrimaryButton className="h-11" disabled={!isHost} onClick={onRevealVotes}>
                {state.revealed ? fr.planningPoker.revealDone : fr.planningPoker.revealVotes}
              </PrimaryButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
