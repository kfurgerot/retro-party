import React, { useMemo, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AVATARS } from "@/types/game";
import { PlanningPokerRole, PlanningPokerState } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { PlanningPokerRoundBoard } from "@/components/planning-poker/PlanningPokerRoundBoard";

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
  onVoteSystemChange: (voteSystem: PlanningPokerState["voteSystem"]) => void;
  onStoryTitleChange: (storyTitle: string) => void;
};

const SIMPLE_DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?"];

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
  onStoryTitleChange,
}) => {
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const roomName = state.roomCode ? `Room ${state.roomCode}` : "Death Star Team";
  const votingPlayers = useMemo(() => state.players.filter((player) => player.role === "player"), [state.players]);
  const spectators = useMemo(() => state.players.filter((player) => player.role === "spectator"), [state.players]);
  const myPlayer = useMemo(() => state.players.find((player) => player.socketId === myPlayerId) ?? null, [state.players, myPlayerId]);

  const votedCount = votingPlayers.filter((player) => player.hasVoted).length;

  const copyInvite = async () => {
    if (!state.roomCode) return;
    await navigator.clipboard.writeText(state.roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div className="min-h-svh bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto flex h-[calc(100svh-1.5rem)] max-w-7xl flex-col gap-3 sm:h-[calc(100svh-2rem)] sm:gap-4">
        <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-800">{roomName}</div>
            <div className="text-xs text-slate-500">
              {state.voteSystem} · {votedCount}/{votingPlayers.length}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-8 text-xs" onClick={copyInvite}>
              {copied ? "Copie" : "Inviter des joueurs"}
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg">
              {myPlayer ? AVATARS[myPlayer.avatar] ?? ":)" : ":)"}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Card className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] gap-3 border-slate-200 bg-white p-3 sm:p-4">
            <PlanningPokerRoundBoard players={votingPlayers} revealed={state.revealed} />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:p-3">
              {myRole === "player" ? (
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                  {SIMPLE_DECK.map((value) => {
                    const selected = myVote === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onVoteCard(value)}
                        disabled={state.revealed}
                        className={cn(
                          "h-10 rounded-md border text-sm font-semibold transition",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          selected ? "border-blue-500 bg-blue-100 text-blue-700" : "border-slate-300 bg-white text-slate-700"
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-500">Mode spectateur: deck non interactif.</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton className="h-9 text-xs" onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}> 
                  {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
                </SecondaryButton>
                {isHost ? (
                  <>
                    <input
                      value={state.storyTitle}
                      onChange={(event) => onStoryTitleChange(event.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                      placeholder={fr.planningPoker.storyLabel}
                      maxLength={64}
                    />
                    <select
                      value={state.voteSystem}
                      onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerState["voteSystem"])}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
                    >
                      <option value="fibonacci">Fibonacci</option>
                      <option value="man-day">Jour.homme</option>
                      <option value="tshirt">T-Shirt</option>
                    </select>
                  </>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <SecondaryButton className="h-9 text-xs" onClick={onLeave}>{fr.onlineLobby.leaveParty}</SecondaryButton>
                <SecondaryButton className="h-9 text-xs" disabled={!isHost} onClick={onResetVotes}>{fr.planningPoker.resetVotes}</SecondaryButton>
                <PrimaryButton className="h-9 text-xs" disabled={!isHost} onClick={onRevealVotes}>
                  {state.revealed ? fr.planningPoker.revealDone : fr.planningPoker.revealVotes}
                </PrimaryButton>
              </div>
            </div>
          </Card>

          <Card className="hidden border-slate-200 bg-white p-3 lg:block">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Spectateurs</div>
            <div className="grid gap-2">
              {spectators.length > 0 ? (
                spectators.map((player) => (
                  <div key={player.socketId} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                    <span className="truncate text-xs text-slate-700">{player.name}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500">Aucun spectateur.</div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:hidden">
          <Button variant="outline" className="h-9 w-full text-xs" onClick={() => setMobileInfoOpen(true)}>
            Voir les spectateurs
          </Button>
        </div>
      </div>

      <Drawer open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Spectateurs</DrawerTitle>
          </DrawerHeader>
          <div className="grid gap-2 px-4 pb-4">
            {spectators.length > 0 ? (
              spectators.map((player) => (
                <div key={player.socketId} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                  <span className="truncate text-xs text-slate-700">{player.name}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Aucun spectateur.</div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
