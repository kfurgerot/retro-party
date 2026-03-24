import React, { useMemo, useState } from "react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { AVATARS } from "@/types/game";
import { PlanningPokerRole, PlanningPokerRoundSummary, PlanningPokerState } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { PlanningPokerRoundBoard } from "@/components/planning-poker/PlanningPokerRoundBoard";
import { RetroScreenBackground } from "./RetroScreenBackground";
import {
  CTA_NEON_DANGER,
  CTA_NEON_PRIMARY,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
  GAME_DRAWER_CONTENT,
  GAME_HUD_SURFACE,
  GAME_MOBILE_ACTION_BUTTON,
  GAME_PANEL_SURFACE,
  GAME_SUBPANEL_SURFACE,
  GAME_TAB_BUTTON,
  GAME_TAB_BUTTON_ACTIVE,
} from "@/lib/uiTokens";
import { computePlanningPokerStats, formatPlanningValue, PLANNING_POKER_DECKS } from "@/lib/planningPoker";

type Props = {
  state: PlanningPokerState;
  history: PlanningPokerRoundSummary[];
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

const VOTE_SYSTEM_OPTIONS: Array<{ value: PlanningPokerState["voteSystem"]; label: string }> = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "Jour.homme" },
  { value: "tshirt", label: "T-Shirt" },
];
const displayVoteValue = (value: string) => (value === "☕" ? "Cafe" : value);

export const PlanningPokerGameScreen: React.FC<Props> = ({
  state,
  history,
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
  const [mobileMenuTab, setMobileMenuTab] = useState<"spectators" | "actions">("actions");
  const [sidebarTab, setSidebarTab] = useState<"spectators" | "session" | "history">("spectators");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const votingPlayers = useMemo(() => state.players.filter((player) => player.role === "player"), [state.players]);
  const spectators = useMemo(() => state.players.filter((player) => player.role === "spectator"), [state.players]);
  const activeDeck = PLANNING_POKER_DECKS[state.voteSystem] ?? PLANNING_POKER_DECKS.fibonacci;
  const stats = useMemo(() => computePlanningPokerStats(state.players, state.voteSystem), [state.players, state.voteSystem]);
  const averageLabel = state.revealed ? formatPlanningValue(stats.average) : "-";
  const medianLabel = state.revealed ? formatPlanningValue(stats.median) : "-";
  const desktopLeaveBtn = cn(GAME_TAB_BUTTON, "border-rose-300/45 bg-rose-500/14 text-rose-100 hover:bg-rose-500/22 hover:text-rose-50");

  const requestLeave = () => {
    setMobileActionsOpen(false);
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave();
  };

  return (
    <div className="scanlines relative h-svh w-full overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3">
      <RetroScreenBackground />

      <div className="relative z-10 mx-auto flex h-full w-full flex-col gap-2 sm:gap-3">
        <header className={cn(GAME_HUD_SURFACE, "flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3")}>
          <div className="min-w-0" />

          <div className="mx-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-cyan-300/45 bg-cyan-500/14 px-2.5 py-1.5 sm:px-4 sm:py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-100/85 sm:text-[11px]">Moyenne</div>
              <div className="text-lg font-black leading-none text-cyan-50 sm:text-2xl">{averageLabel}</div>
            </div>
            <div className="rounded-xl border border-amber-300/45 bg-amber-500/14 px-2.5 py-1.5 sm:px-4 sm:py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-amber-100/90 sm:text-[11px]">Mediane</div>
              <div className="text-lg font-black leading-none text-amber-100 sm:text-2xl">{medianLabel}</div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-end gap-2">
            {state.roomCode ? (
              <div className="-mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-cyan-50">
                <span className="uppercase text-cyan-100/85">Code</span>
                <span className="truncate">{state.roomCode}</span>
              </div>
            ) : null}
            <Button className={cn("hidden xl:inline-flex", desktopLeaveBtn)} variant="secondary" onClick={requestLeave}>
              {fr.gameScreen.leaveGame}
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22vw)]">
          <Card className={cn(GAME_PANEL_SURFACE, "grid min-h-0 grid-rows-[minmax(150px,1fr)_auto] gap-2 p-2.5 sm:grid-rows-[minmax(340px,1fr)_auto_auto] sm:gap-3 sm:p-4 lg:gap-4 lg:p-5")}>
            <PlanningPokerRoundBoard players={votingPlayers} revealed={state.revealed} storyTitle={state.storyTitle} round={state.round} />

            <div className="rounded-lg border border-cyan-300/22 bg-slate-950/38 p-2 sm:p-3">
              {myRole === "player" ? (
                <div className="grid grid-cols-5 justify-items-center gap-1.5 sm:flex sm:flex-nowrap sm:justify-center sm:gap-2">
                  {activeDeck.map((value) => {
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
                        {displayVoteValue(value)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-300">Mode spectateur: deck non interactif.</div>
              )}
            </div>

            <div className="hidden min-w-0 flex-wrap items-center justify-between gap-2 sm:flex">
              <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto">
                <SecondaryButton className={cn("h-9 min-w-0 text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}> 
                  {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
                </SecondaryButton>
                {isHost ? (
                  <>
                    <div className="flex min-w-0 items-center gap-1 rounded-md border border-cyan-300/28 bg-slate-900/55 p-1">
                      {VOTE_SYSTEM_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onVoteSystemChange(option.value)}
                          className={cn(
                            "h-7 min-w-0 rounded px-2 text-[11px] transition-colors",
                            state.voteSystem === option.value
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-transparent text-cyan-50 hover:bg-slate-800/70"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <SecondaryButton className={cn("h-9 min-w-0 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_SECONDARY_SUBTLE)} disabled={!isHost} onClick={onResetVotes}>
                  {fr.planningPoker.resetVotes}
                </SecondaryButton>
                <PrimaryButton className={cn("h-9 min-w-0 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_PRIMARY)} disabled={!isHost} onClick={onRevealVotes}>
                  <span className="sm:hidden">{state.revealed ? "Revele" : "Reveal"}</span>
                  <span className="hidden sm:inline">{state.revealed ? fr.planningPoker.revealDone : fr.planningPoker.revealVotes}</span>
                </PrimaryButton>
              </div>
            </div>
          </Card>

          <Card className={cn(GAME_PANEL_SURFACE, "hidden min-h-0 p-3 lg:flex lg:flex-col")}>
            <div className="mb-2 flex items-center justify-start gap-2">
              <div className="grid w-full grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(GAME_TAB_BUTTON, "w-full justify-center", sidebarTab === "spectators" ? GAME_TAB_BUTTON_ACTIVE : "opacity-95")}
                  onClick={() => setSidebarTab("spectators")}
                >
                  Spectateurs
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(GAME_TAB_BUTTON, "w-full justify-center", sidebarTab === "session" ? GAME_TAB_BUTTON_ACTIVE : "opacity-95")}
                  onClick={() => setSidebarTab("session")}
                >
                  Session
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(GAME_TAB_BUTTON, "w-full justify-center", sidebarTab === "history" ? GAME_TAB_BUTTON_ACTIVE : "opacity-95")}
                  onClick={() => setSidebarTab("history")}
                >
                  Historique
                </Button>
              </div>
            </div>

            {sidebarTab === "spectators" ? (
              <div className="grid min-h-0 gap-2 overflow-auto pr-1">
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
            ) : sidebarTab === "session" ? (
              <div className="grid gap-2 text-xs">
                <div className={cn("p-2", GAME_SUBPANEL_SURFACE)}>
                  <div className="text-slate-300">Story</div>
                  <div className="truncate text-cyan-50">{state.storyTitle || "-"}</div>
                </div>
                <div className={cn("p-2", GAME_SUBPANEL_SURFACE)}>
                  <div className="text-slate-300">Statut</div>
                  <div className="text-cyan-50">{state.revealed ? "Revele" : "Vote en cours"}</div>
                </div>
                <div className={cn("grid grid-cols-2 gap-2 p-2", GAME_SUBPANEL_SURFACE)}>
                  <div>
                    <div className="text-slate-300">Moyenne</div>
                    <div className="font-semibold text-cyan-50">{averageLabel}</div>
                  </div>
                  <div>
                    <div className="text-slate-300">Mediane</div>
                    <div className="font-semibold text-cyan-50">{medianLabel}</div>
                  </div>
                </div>
                <div className={cn("grid grid-cols-2 gap-2 p-2", GAME_SUBPANEL_SURFACE)}>
                  <div>
                    <div className="text-slate-300">Min</div>
                    <div className="font-semibold text-cyan-50">{formatPlanningValue(stats.min)}</div>
                  </div>
                  <div>
                    <div className="text-slate-300">Max</div>
                    <div className="font-semibold text-cyan-50">{formatPlanningValue(stats.max)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 gap-2 overflow-auto pr-1 text-xs">
                {history.length > 0 ? (
                  [...history].reverse().map((entry) => (
                    <div key={entry.id} className={cn("grid gap-1.5 p-2", GAME_SUBPANEL_SURFACE)}>
                      <div className="flex items-center justify-between text-cyan-100">
                        <span className="font-semibold">Vote #{entry.round}</span>
                        <span className="text-[11px] text-slate-300">{entry.storyTitle || "-"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>Moy: <span className="font-semibold text-cyan-50">{formatPlanningValue(entry.average)}</span></div>
                        <div>Med: <span className="font-semibold text-cyan-50">{formatPlanningValue(entry.median)}</span></div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {entry.votes.map((vote, index) => (
                          <span key={`${entry.id}-${vote.playerName}-${index}`} className="rounded-md border border-cyan-300/20 bg-slate-950/40 px-1.5 py-0.5 text-[11px] text-cyan-100">
                            {vote.playerName}: {displayVoteValue(vote.value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-300">Aucun vote revele pour le moment.</div>
                )}
              </div>
            )}
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
                    onClick={() => {
                      setMobileMenuTab("actions");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Menu
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => {
                      setMobileMenuTab("spectators");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Spectateurs
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => {
                      setMobileMenuTab("actions");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Actions
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_DANGER, "text-xs")}
                    onClick={requestLeave}
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
            <DrawerTitle>{mobileMenuTab === "spectators" ? "Spectateurs" : "Actions"}</DrawerTitle>
          </DrawerHeader>
          <div className="grid gap-2 px-4 pb-4">
            {mobileMenuTab === "spectators" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-100">Historique des votes</div>
                {history.length > 0 ? (
                  [...history].reverse().map((entry) => (
                    <div key={`mobile-${entry.id}`} className="rounded-md border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5 text-xs text-cyan-50">
                      <div className="font-semibold">Vote #{entry.round} · {entry.storyTitle || "-"}</div>
                      <div className="text-slate-300">Moy: {formatPlanningValue(entry.average)} · Med: {formatPlanningValue(entry.median)}</div>
                      <div className="mt-1 text-slate-300">{entry.votes.map((vote) => `${vote.playerName}:${displayVoteValue(vote.value)}`).join(" · ")}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5 text-xs text-slate-300">Aucun vote revele pour le moment.</div>
                )}
                <SecondaryButton className={cn("h-10 w-full text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}>
                  {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
                </SecondaryButton>
                {isHost ? (
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-cyan-300/28 bg-slate-900/55 p-1">
                    {VOTE_SYSTEM_OPTIONS.map((option) => (
                      <button
                        key={`mobile-${option.value}`}
                        type="button"
                        onClick={() => onVoteSystemChange(option.value)}
                        className={cn(
                          "h-8 rounded px-2 text-[11px] transition-colors",
                          state.voteSystem === option.value
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-transparent text-cyan-50 hover:bg-slate-800/70"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <SecondaryButton className={cn("h-10 w-full text-xs", CTA_NEON_DANGER)} onClick={requestLeave}>
                  {fr.onlineLobby.leaveParty}
                </SecondaryButton>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md")}>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-rose-300/45 bg-rose-500/15 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-rose-100">
              <span>Quitter</span>
            </div>
            <AlertDialogTitle className="text-center text-2xl">{fr.gameScreen.leaveQuestionTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-300">
              {fr.game.backToOnlineLobby}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-cyan-100")}>
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")} onClick={confirmLeave}>
              {fr.gameScreen.leave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
