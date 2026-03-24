import React, { useMemo, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AVATARS } from "@/types/game";
import { PlanningPokerRole, PlanningPokerState } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { PlanningPokerRoundBoard } from "@/components/planning-poker/PlanningPokerRoundBoard";
import { RetroScreenBackground } from "./RetroScreenBackground";
import {
  CTA_NEON_DANGER,
  CTA_NEON_PRIMARY,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DRAWER_CONTENT,
  GAME_HUD_SURFACE,
  GAME_MOBILE_ACTION_BUTTON,
  GAME_PANEL_SURFACE,
} from "@/lib/uiTokens";

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

const SIMPLE_DECK = ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"];

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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
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
    <div className="scanlines relative h-svh w-full overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-10 sm:pt-3">
      <RetroScreenBackground />

      <div className="relative z-10 mx-auto flex h-full w-full flex-col gap-2 sm:h-[calc(100svh-5.5rem)] sm:gap-4">
        <header className={cn(GAME_HUD_SURFACE, "flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3")}>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-cyan-50">{roomName}</div>
            <div className="text-xs text-slate-300">
              {state.voteSystem} · {votedCount}/{votingPlayers.length}
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="outline"
              className="h-8 border-cyan-300/35 bg-slate-900/40 px-2 text-xs text-cyan-100 hover:bg-slate-900/70 sm:px-3"
              onClick={copyInvite}
            >
              <span className="sm:hidden">{copied ? "Copie" : "Inviter"}</span>
              <span className="hidden sm:inline">{copied ? "Copie" : "Inviter des joueurs"}</span>
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/35 bg-slate-900/75 text-lg">
              {myPlayer ? AVATARS[myPlayer.avatar] ?? ":)" : ":)"}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22vw)]">
          <Card className={cn(GAME_PANEL_SURFACE, "grid min-h-0 grid-rows-[minmax(150px,1fr)_auto] gap-2 p-2.5 sm:grid-rows-[minmax(280px,1fr)_auto_auto] sm:gap-3 sm:p-4 lg:gap-4 lg:p-5")}>
            <PlanningPokerRoundBoard players={votingPlayers} revealed={state.revealed} />

            <div className="rounded-lg border border-cyan-300/22 bg-slate-950/38 p-2 sm:p-3">
              {myRole === "player" ? (
                <div className="grid grid-cols-5 justify-items-center gap-1.5 sm:flex sm:flex-nowrap sm:justify-center sm:gap-2">
                  {SIMPLE_DECK.map((value) => {
                    const selected = myVote === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onVoteCard(value)}
                        disabled={state.revealed}
                        className={cn(
                          "h-[68px] w-full max-w-[64px] rounded-xl border text-lg font-semibold transition-all duration-150 sm:h-[94px] sm:w-[62px] sm:max-w-none sm:text-xl",
                          "bg-gradient-to-b from-slate-900/82 to-slate-950/82",
                          "shadow-[0_2px_8px_rgba(2,6,23,0.35)]",
                          "disabled:cursor-not-allowed disabled:opacity-50",
                          selected
                            ? "-translate-y-2 border-cyan-200 bg-cyan-500/24 text-cyan-50 ring-2 ring-cyan-300/60 shadow-[0_10px_24px_rgba(34,211,238,0.35)]"
                            : "border-cyan-300/28 text-cyan-100 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900/92"
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-300">Mode spectateur: deck non interactif.</div>
              )}
            </div>

            <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
              <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                <SecondaryButton className={cn("h-9 text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}> 
                  {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
                </SecondaryButton>
                {isHost ? (
                  <>
                    <input
                      value={state.storyTitle}
                      onChange={(event) => onStoryTitleChange(event.target.value)}
                      className="h-9 rounded-md border border-cyan-300/28 bg-slate-900/55 px-2 text-xs text-cyan-50"
                      placeholder={fr.planningPoker.storyLabel}
                      maxLength={64}
                    />
                    <select
                      value={state.voteSystem}
                      onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerState["voteSystem"])}
                      className="h-9 rounded-md border border-cyan-300/28 bg-slate-900/55 px-2 text-xs text-cyan-50"
                    >
                      <option value="fibonacci">Fibonacci</option>
                      <option value="man-day">Jour.homme</option>
                      <option value="tshirt">T-Shirt</option>
                    </select>
                  </>
                ) : null}
              </div>

              <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:items-center">
                <SecondaryButton className={cn("h-9 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_DANGER)} onClick={onLeave}>
                  {fr.onlineLobby.leaveParty}
                </SecondaryButton>
                <SecondaryButton className={cn("h-9 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_SECONDARY_SUBTLE)} disabled={!isHost} onClick={onResetVotes}>
                  {fr.planningPoker.resetVotes}
                </SecondaryButton>
                <PrimaryButton className={cn("h-9 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_PRIMARY)} disabled={!isHost} onClick={onRevealVotes}>
                  <span className="sm:hidden">{state.revealed ? "Revele" : "Reveal"}</span>
                  <span className="hidden sm:inline">{state.revealed ? fr.planningPoker.revealDone : fr.planningPoker.revealVotes}</span>
                </PrimaryButton>
              </div>
            </div>
          </Card>

          <Card className={cn(GAME_PANEL_SURFACE, "hidden p-3 lg:block")}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-100">Spectateurs</div>
            <div className="grid gap-2">
              {spectators.length > 0 ? (
                spectators.map((player) => (
                  <div key={player.socketId} className="flex items-center gap-2 rounded-md border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5">
                    <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                    <span className="truncate text-xs text-cyan-50">{player.name}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-300">Aucun spectateur.</div>
              )}
            </div>
          </Card>
        </div>

        <div className="sticky bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+4px)] sm:hidden">
          <Card className={cn(GAME_HUD_SURFACE, "px-2 py-2 shadow-[0_-8px_24px_rgba(2,6,23,0.35)]")}>
            <div className="grid grid-cols-3 gap-2">
              {isHost ? (
                <>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={onResetVotes}
                  >
                    {fr.planningPoker.resetVotes}
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_PRIMARY, "text-xs")}
                    onClick={onRevealVotes}
                  >
                    {state.revealed ? "Revele" : "Reveal"}
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => setMobileActionsOpen(true)}
                  >
                    Menu
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => setMobileActionsOpen(true)}
                  >
                    Spectateurs
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => setMobileActionsOpen(true)}
                  >
                    Actions
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_DANGER, "text-xs")}
                    onClick={onLeave}
                  >
                    {fr.onlineLobby.leaveParty}
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Drawer open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
        <DrawerContent className={GAME_DRAWER_CONTENT}>
          <DrawerHeader>
            <DrawerTitle>Menu</DrawerTitle>
          </DrawerHeader>
          <div className="grid gap-2 px-4 pb-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-100">Spectateurs</div>
            {spectators.length > 0 ? (
              spectators.map((player) => (
                <div key={player.socketId} className="flex items-center gap-2 rounded-md border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5">
                  <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                  <span className="truncate text-xs text-cyan-50">{player.name}</span>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5 text-xs text-slate-300">Aucun spectateur.</div>
            )}
            <SecondaryButton className={cn("h-10 w-full text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}>
              {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
            </SecondaryButton>
            {isHost ? (
              <>
                <input
                  value={state.storyTitle}
                  onChange={(event) => onStoryTitleChange(event.target.value)}
                  className="h-10 w-full rounded-md border border-cyan-300/28 bg-slate-900/55 px-2 text-xs text-cyan-50"
                  placeholder={fr.planningPoker.storyLabel}
                  maxLength={64}
                />
                <select
                  value={state.voteSystem}
                  onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerState["voteSystem"])}
                  className="h-10 w-full rounded-md border border-cyan-300/28 bg-slate-900/55 px-2 text-xs text-cyan-50"
                >
                  <option value="fibonacci">Fibonacci</option>
                  <option value="man-day">Jour.homme</option>
                  <option value="tshirt">T-Shirt</option>
                </select>
              </>
            ) : null}
            <SecondaryButton className={cn("h-10 w-full text-xs", CTA_NEON_DANGER)} onClick={onLeave}>
              {fr.onlineLobby.leaveParty}
            </SecondaryButton>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
