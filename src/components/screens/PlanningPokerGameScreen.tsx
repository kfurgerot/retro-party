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
import { computePlanningPokerStats, formatPlanningValueForSystem, PLANNING_POKER_DECKS } from "@/lib/planningPoker";

type Props = {
  state: PlanningPokerState;
  history: PlanningPokerRoundSummary[];
  myPlayerId: string | null;
  myRole: PlanningPokerRole;
  myVote: string | null;
  isHost: boolean;
  onVoteCard: (value: string) => void;
  onOpenVotes: () => void;
  onReopenStoryVote: (storyTitle: string, returnStoryTitle: string) => void;
  onRevealVotes: () => void;
  onResetVotes: () => void;
  onRevoteCurrentStory: () => void;
  onLeave: () => void;
  onRoleChange: (role: PlanningPokerRole) => void;
  onVoteSystemChange: (voteSystem: PlanningPokerState["voteSystem"]) => void;
  onStoryTitleChange: (storyTitle: string) => void;
};

type SessionEntry = {
  id: string;
  storyTitle: string;
  voteSystem: PlanningPokerState["voteSystem"];
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  totalVotes: number;
  distribution: Record<string, number>;
  votes: PlanningPokerRoundSummary["votes"];
  roundLabel: string;
  isCurrent: boolean;
};

const VOTE_SYSTEM_OPTIONS: Array<{ value: PlanningPokerState["voteSystem"]; label: string }> = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "JH" },
  { value: "tshirt", label: "T-Shirt" },
];
const displayVoteValue = (value: string) => (value === "☕" ? "☕" : value);
const DECK_SHORTCUT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

const isInteractiveElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
};

const getDeckCardStyle = (
  index: number,
  total: number,
  selected: boolean
): React.CSSProperties => {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const hue = 198 - ratio * 190;
  const border = `hsl(${hue} 92% 64%)`;
  const glow = `hsla(${hue} 95% 60% / ${selected ? 0.52 : 0.26})`;
  return {
    borderColor: border,
    boxShadow: selected
      ? `0 0 0 2px hsla(${hue} 95% 70% / 0.5), 0 10px 24px ${glow}`
      : `0 2px 8px rgba(2,6,23,0.35), 0 0 0 1px ${glow}`,
  };
};

export const PlanningPokerGameScreen: React.FC<Props> = ({
  state,
  history,
  myPlayerId,
  myRole,
  myVote,
  isHost,
  onVoteCard,
  onOpenVotes,
  onReopenStoryVote,
  onRevealVotes,
  onResetVotes,
  onRevoteCurrentStory,
  onLeave,
  onRoleChange,
  onVoteSystemChange,
  onStoryTitleChange,
}) => {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<"spectators" | "session">("session");
  const [sidebarTab, setSidebarTab] = useState<"spectators" | "session">("spectators");
  const [sessionCursor, setSessionCursor] = useState(0);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState(state.storyTitle);
  const [mobileStoryEditorOpen, setMobileStoryEditorOpen] = useState(false);
  const [mobileStoryEditorDraft, setMobileStoryEditorDraft] = useState(state.storyTitle);
  const mobileStoryEditorInputRef = React.useRef<HTMLInputElement | null>(null);

  const votingPlayers = useMemo(() => state.players.filter((player) => player.role === "player"), [state.players]);
  const spectators = useMemo(() => state.players.filter((player) => player.role === "spectator"), [state.players]);
  const activeDeck = PLANNING_POKER_DECKS[state.voteSystem] ?? PLANNING_POKER_DECKS.fibonacci;
  const stats = useMemo(() => computePlanningPokerStats(state.players, state.voteSystem), [state.players, state.voteSystem]);
  const votedCount = useMemo(
    () => votingPlayers.filter((player) => player.hasVoted).length,
    [votingPlayers]
  );
  const totalVoters = votingPlayers.length;
  const voteProgressLabel = `${votedCount}/${totalVoters}`;
  const voteProgressPct = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;
  const voteEntries = useMemo(
    () => Object.entries(stats.distribution).sort(([, a], [, b]) => b - a),
    [stats.distribution]
  );
  const leadVote = voteEntries[0] ?? null;
  const consensusPct = leadVote && stats.totalVotes > 0 ? Math.round((leadVote[1] / stats.totalVotes) * 100) : 0;
  const consensusLabel = !state.votesOpen
    ? "Votes non lances"
    : !state.revealed
    ? "En attente de revelation"
    : !leadVote
    ? "Pas de vote"
    : consensusPct >= 80
    ? "Consensus fort"
    : consensusPct >= 60
    ? "Consensus modere"
    : "Consensus faible";
  const averageLabel = state.revealed ? formatPlanningValueForSystem(stats.average, state.voteSystem) : "-";
  const medianLabel = state.revealed ? formatPlanningValueForSystem(stats.median, state.voteSystem) : "-";
  const historyEntries = useMemo(() => {
    const byStory = new Map<string, PlanningPokerRoundSummary>();
    for (const entry of history) {
      const key = entry.storyTitle?.trim() || `Vote #${entry.round}`;
      byStory.set(key, entry);
    }

    const parseStoryIndex = (title: string) => {
      const match = title.match(/(\d+)\s*$/);
      if (!match) return Number.POSITIVE_INFINITY;
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
    };

    return [...byStory.values()].sort((a, b) => {
      const indexA = parseStoryIndex(a.storyTitle || "");
      const indexB = parseStoryIndex(b.storyTitle || "");
      if (indexA !== indexB) return indexB - indexA;
      return (b.revealedAt ?? 0) - (a.revealedAt ?? 0);
    });
  }, [history]);
  const sessionEntries = useMemo<SessionEntry[]>(
    () => [
      {
        id: "current",
        storyTitle: state.storyTitle || "-",
        voteSystem: state.voteSystem,
        average: stats.average,
        median: stats.median,
        min: stats.min,
        max: stats.max,
        totalVotes: stats.totalVotes,
        distribution: stats.distribution,
        votes: votingPlayers
          .filter((player) => player.vote != null)
          .map((player) => ({
            playerName: player.name,
            avatar: player.avatar,
            value: player.vote ?? "-",
          })),
        roundLabel: `Tour en cours #${state.round}`,
        isCurrent: true,
      },
      ...historyEntries.map((entry) => ({
        id: entry.id,
        storyTitle: entry.storyTitle || "-",
        voteSystem: entry.voteSystem,
        average: entry.average,
        median: entry.median,
        min: entry.min,
        max: entry.max,
        totalVotes: entry.totalVotes,
        distribution: entry.distribution,
        votes: entry.votes,
        roundLabel: `Vote #${entry.round}`,
        isCurrent: false,
      })),
    ],
    [historyEntries, state.round, state.storyTitle, state.voteSystem, stats, votingPlayers]
  );
  const selectedSession = sessionEntries[Math.min(sessionCursor, Math.max(0, sessionEntries.length - 1))] ?? sessionEntries[0];
  const selectedVoteEntries = useMemo(
    () => Object.entries(selectedSession?.distribution ?? {}).sort(([, a], [, b]) => b - a),
    [selectedSession]
  );
  const selectedLeadVote = selectedVoteEntries[0] ?? null;
  const selectedConsensusPct =
    selectedLeadVote && (selectedSession?.totalVotes ?? 0) > 0
      ? Math.round((selectedLeadVote[1] / (selectedSession?.totalVotes ?? 1)) * 100)
      : 0;
  const selectedStatusLabel = selectedSession?.isCurrent
    ? state.revealed
      ? "Revele"
      : state.votesOpen
      ? "Vote en cours"
      : "Votes non lances"
    : "Question archivee";
  const selectedProgressLabel = selectedSession?.isCurrent ? voteProgressLabel : `${selectedSession?.totalVotes ?? 0} votes`;
  const mobileSessionActionLabel = selectedSession?.isCurrent ? "🔓 Revoter" : "🔓 Réouvrir";
  const mobileSessionActionDisabled = !isHost || (selectedSession?.isCurrent ? !state.revealed : false);
  const desktopLeaveBtn = cn(GAME_TAB_BUTTON, "border-rose-300/45 bg-rose-500/14 text-rose-100 hover:bg-rose-500/22 hover:text-rose-50");

  const requestLeave = () => {
    setMobileActionsOpen(false);
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave();
  };

  const requestResetVotes = () => {
    if (!isHost) return;
    if (!state.revealed && votedCount > 0) {
      setResetDialogOpen(true);
      return;
    }
    onResetVotes();
  };

  const confirmResetVotes = () => {
    setResetDialogOpen(false);
    onResetVotes();
  };

  const reopenPastQuestion = React.useCallback(() => {
    if (!isHost || !selectedSession || selectedSession.isCurrent) return;
    const titleToReopen = selectedSession.storyTitle.trim();
    const returnTitle = state.storyTitle.trim() || `Story #${state.round}`;
    if (!titleToReopen) return;
    onReopenStoryVote(titleToReopen, returnTitle);
    setSessionCursor(0);
    setMobileActionsOpen(false);
  }, [isHost, onReopenStoryVote, selectedSession, state.round, state.storyTitle]);

  const handleMobileSessionAction = React.useCallback(() => {
    if (!isHost || !selectedSession) return;
    if (selectedSession.isCurrent) {
      onRevoteCurrentStory();
      return;
    }
    reopenPastQuestion();
  }, [isHost, onRevoteCurrentStory, reopenPastQuestion, selectedSession]);

  const hostMainActionLabel = state.revealed
    ? "Vote suivant"
    : !state.votesOpen
    ? "Lancer les votes"
    : fr.planningPoker.revealVotes;
  const hostMainActionShortLabel = state.revealed
    ? "Suivant"
    : !state.votesOpen
    ? "Lancer"
    : "Reveler";
  const handleHostMainAction = state.revealed ? requestResetVotes : state.votesOpen ? onRevealVotes : onOpenVotes;

  const submitStoryTitle = React.useCallback(() => {
    if (!isHost) return;
    const normalized = storyDraft.trim();
    if (!normalized || normalized === state.storyTitle) return;
    onStoryTitleChange(normalized);
  }, [isHost, onStoryTitleChange, state.storyTitle, storyDraft]);

  const openMobileStoryEditor = React.useCallback(() => {
    setMobileStoryEditorDraft(storyDraft);
    setMobileStoryEditorOpen(true);
  }, [storyDraft]);

  const saveMobileStoryEditor = React.useCallback(() => {
    if (!isHost) return;
    const normalized = mobileStoryEditorDraft.trim();
    if (!normalized) {
      setMobileStoryEditorOpen(false);
      return;
    }
    if (normalized !== state.storyTitle) {
      onStoryTitleChange(normalized);
      setStoryDraft(normalized);
    }
    setMobileStoryEditorOpen(false);
  }, [isHost, mobileStoryEditorDraft, onStoryTitleChange, state.storyTitle]);

  const handleDeckVote = React.useCallback(
    (value: string) => {
      if (state.revealed || !state.votesOpen) return;
      onVoteCard(myVote === value ? "" : value);
    },
    [myVote, onVoteCard, state.revealed, state.votesOpen]
  );

  React.useEffect(() => {
    setStoryDraft(state.storyTitle);
  }, [state.storyTitle]);

  React.useEffect(() => {
    setSessionCursor(0);
  }, [state.round, state.storyTitle]);

  React.useEffect(() => {
    if (!mobileStoryEditorOpen) return;
    window.setTimeout(() => {
      mobileStoryEditorInputRef.current?.focus();
      mobileStoryEditorInputRef.current?.select();
    }, 40);
  }, [mobileStoryEditorOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveElement(event.target)) return;
      if (event.repeat) return;

      if (myRole === "player" && !state.revealed && state.votesOpen) {
        const voteIndex = DECK_SHORTCUT_KEYS.indexOf(event.key);
        if (voteIndex >= 0 && voteIndex < activeDeck.length) {
          event.preventDefault();
          handleDeckVote(activeDeck[voteIndex]);
          return;
        }
      }

      if (!isHost) return;
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        onRevealVotes();
        return;
      }
      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        onResetVotes();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDeck, handleDeckVote, isHost, myRole, onResetVotes, onRevealVotes, state.revealed, state.votesOpen]);

  return (
    <div className="scanlines relative h-svh w-full overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3">
      <RetroScreenBackground />

      <div className="relative z-10 mx-auto flex h-full w-full flex-col gap-2 sm:gap-3">
        <header className={cn(GAME_HUD_SURFACE, "px-2.5 py-2 sm:px-4 sm:py-3")}>
          <div className="grid gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100">
                {consensusLabel}
              </div>
              {state.roomCode ? (
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-500/12 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-cyan-50">
                  <span className="uppercase text-cyan-100/85">Code</span>
                  <span className="truncate">{state.roomCode}</span>
                </div>
              ) : (
                <span />
              )}
            </div>
            <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em]">
                <span className="text-cyan-100/85">Votes {voteProgressLabel}</span>
                <div className="inline-flex items-center gap-1">
                  <div className="rounded-xl border border-cyan-300/45 bg-cyan-500/14 px-1.5 py-0.5 text-[10px] text-cyan-100">
                    Moy {averageLabel}
                  </div>
                  <div className="rounded-xl border border-amber-300/45 bg-amber-500/14 px-1.5 py-0.5 text-[10px] text-amber-100">
                    Med {medianLabel}
                  </div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-900/60">
                <div className="h-full rounded bg-cyan-400/90 transition-all duration-300" style={{ width: `${voteProgressPct}%` }} />
              </div>
            </div>
          </div>

          <div className="hidden items-center justify-between gap-2 sm:flex">
            <div className="min-w-0 flex-1">
              <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em]">
                  <span className="text-cyan-100/85">Votes {voteProgressLabel}</span>
                  <span className="text-amber-100/90">{consensusLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-900/60">
                  <div
                    className="h-full rounded bg-cyan-400/90 transition-all duration-300"
                    style={{ width: `${voteProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="ml-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-cyan-300/45 bg-cyan-500/14 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/85">Moyenne</div>
                <div className="text-2xl font-black leading-none text-cyan-50">{averageLabel}</div>
              </div>
              <div className="rounded-xl border border-amber-300/45 bg-amber-500/14 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-amber-100/90">Mediane</div>
                <div className="text-2xl font-black leading-none text-amber-100">{medianLabel}</div>
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
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22vw)]">
          <Card className={cn(GAME_PANEL_SURFACE, "grid min-h-0 grid-rows-[minmax(150px,1fr)_auto] gap-2 p-2.5 sm:grid-rows-[minmax(340px,1fr)_auto_auto] sm:gap-3 sm:p-4 lg:gap-4 lg:p-5")}>
            <PlanningPokerRoundBoard
              players={votingPlayers}
              revealed={state.revealed}
              votesOpen={state.votesOpen}
              storyTitle={state.storyTitle}
              round={state.round}
              voteSystem={state.voteSystem}
            />

            <div className="rounded-xl border border-cyan-300/22 bg-slate-950/38 p-2 sm:p-3">
              {myRole === "player" ? (
                <>
                  <div className="grid gap-2 sm:hidden">
                    <div className="min-w-0 pt-2">
                      <div
                        className="flex min-w-0 w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-visible scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {activeDeck.map((value, index) => {
                          const selected = myVote === value;
                          const cardStyle = getDeckCardStyle(index, activeDeck.length, selected);
                          return (
                            <button
                              key={`mini-${value}`}
                              type="button"
                              onClick={() => handleDeckVote(value)}
                              disabled={state.revealed || !state.votesOpen}
                              style={cardStyle}
                              className={cn(
                                "mt-2 h-[58px] w-[38px] shrink-0 snap-start rounded-xl border text-sm font-semibold transition-all duration-150",
                                "bg-gradient-to-b from-slate-900/82 to-slate-950/82",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                                selected
                                  ? "mt-0 bg-cyan-500/24 text-cyan-50"
                                  : "text-cyan-100"
                              )}
                            >
                              {displayVoteValue(value)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:flex sm:flex-nowrap sm:justify-center sm:gap-2">
                    {activeDeck.map((value, index) => {
                      const selected = myVote === value;
                      const cardStyle = getDeckCardStyle(index, activeDeck.length, selected);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleDeckVote(value)}
                          disabled={state.revealed || !state.votesOpen}
                          style={cardStyle}
                          className={cn(
                            "h-[94px] w-[62px] rounded-xl border text-xl font-semibold transition-all duration-150",
                            "bg-gradient-to-b from-slate-900/82 to-slate-950/82",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            selected
                              ? "-translate-y-2 bg-cyan-500/24 text-cyan-50"
                              : "text-cyan-100 hover:-translate-y-0.5 hover:bg-slate-900/92"
                          )}
                        >
                          {displayVoteValue(value)}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-1">
                  <div className="relative h-[58px] w-[38px] rounded-xl border border-cyan-300/35 bg-gradient-to-b from-slate-900/82 to-slate-950/82 shadow-[0_8px_20px_rgba(2,6,23,0.45)] sm:h-[94px] sm:w-[62px]">
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-300/85 sm:text-xs sm:tracking-[0.08em]">
                      Spectateur
                    </div>
                    <div className="pointer-events-none absolute left-[-14%] top-1/2 h-[2px] w-[128%] -translate-y-1/2 rotate-[-36deg] rounded bg-rose-500/95 shadow-[0_0_10px_rgba(244,63,94,0.65)] sm:h-[3px]" />
                  </div>
                </div>
              )}
            </div>

            <div className="hidden min-w-0 flex-wrap items-center justify-between gap-2 sm:flex">
              <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto">
                <SecondaryButton className={cn("h-9 min-w-0 text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}> 
                  {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
                </SecondaryButton>
                {isHost ? (
                  <>
                    <div className="flex min-w-0 items-center gap-1 rounded-xl border border-cyan-300/28 bg-slate-900/55 p-1">
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
                {isHost && state.revealed ? (
                  <SecondaryButton className={cn("h-9 min-w-0 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_SECONDARY_SUBTLE)} onClick={onRevoteCurrentStory}>
                    Revoter cette story
                  </SecondaryButton>
                ) : null}
                <PrimaryButton className={cn("h-9 min-w-0 w-full text-[11px] sm:w-auto sm:text-xs", CTA_NEON_PRIMARY)} disabled={!isHost} onClick={handleHostMainAction}>
                  <span className="sm:hidden">{hostMainActionShortLabel}</span>
                  <span className="hidden sm:inline">{hostMainActionLabel}</span>
                </PrimaryButton>
              </div>
            </div>
          </Card>

          <Card className={cn(GAME_PANEL_SURFACE, "hidden min-h-0 p-3 lg:flex lg:flex-col")}>
            <div className="mb-2 flex items-center justify-start gap-2">
              <div className="grid w-full grid-cols-2 gap-2">
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
            ) : (
              <div className="grid gap-2 text-xs">
                <div className={cn("p-2", GAME_SUBPANEL_SURFACE)}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-slate-300">Question</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          GAME_TAB_BUTTON,
                          "h-8 w-8 border-cyan-300/30 bg-slate-900/65 px-0 text-base font-semibold text-cyan-100 hover:bg-slate-800/80 disabled:opacity-45"
                        )}
                        disabled={sessionCursor >= sessionEntries.length - 1}
                        onClick={() => setSessionCursor((value) => Math.min(value + 1, sessionEntries.length - 1))}
                      >
                        ‹
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          GAME_TAB_BUTTON,
                          "h-8 w-8 border-cyan-300/30 bg-slate-900/65 px-0 text-base font-semibold text-cyan-100 hover:bg-slate-800/80 disabled:opacity-45"
                        )}
                        disabled={sessionCursor <= 0}
                        onClick={() => setSessionCursor((value) => Math.max(value - 1, 0))}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                  <div className="truncate text-cyan-50">{selectedSession?.storyTitle || "-"}</div>
                  <div className="text-[11px] text-slate-300">{selectedSession?.roundLabel ?? "-"}</div>
                  <div className="mt-1 text-slate-300">Statut</div>
                  <div className="text-cyan-50">
                    {selectedSession?.isCurrent
                      ? state.revealed
                        ? "Revele"
                        : state.votesOpen
                        ? "Vote en cours"
                        : "Votes non lances"
                      : "Question archivee"}
                  </div>
                </div>
                {isHost ? (
                  <div className={cn("grid gap-2 p-2", GAME_SUBPANEL_SURFACE)}>
                    <input
                      type="text"
                      value={storyDraft}
                      onChange={(event) => setStoryDraft(event.target.value)}
                      onBlur={submitStoryTitle}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitStoryTitle();
                      }}
                      className="h-8 w-full rounded-md border border-cyan-300/28 bg-slate-950/55 px-2 text-xs text-cyan-50 outline-none focus:border-cyan-300/65"
                      placeholder="Story en cours"
                    />
                  </div>
                ) : null}
                <div className={cn("grid grid-cols-2 gap-2 p-2", GAME_SUBPANEL_SURFACE)}>
                  <div>
                    <div className="text-slate-300">Moyenne</div>
                    <div className="font-semibold text-cyan-50">
                      {selectedSession?.isCurrent
                        ? averageLabel
                        : formatPlanningValueForSystem(selectedSession?.average ?? null, selectedSession?.voteSystem ?? state.voteSystem)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-300">Mediane</div>
                    <div className="font-semibold text-cyan-50">
                      {selectedSession?.isCurrent
                        ? medianLabel
                        : formatPlanningValueForSystem(selectedSession?.median ?? null, selectedSession?.voteSystem ?? state.voteSystem)}
                    </div>
                  </div>
                </div>
                <div className={cn("grid grid-cols-2 gap-2 p-2", GAME_SUBPANEL_SURFACE)}>
                  <div>
                    <div className="text-slate-300">Min</div>
                    <div className="font-semibold text-cyan-50">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.min : selectedSession?.min ?? null,
                        selectedSession?.voteSystem ?? state.voteSystem
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-300">Max</div>
                    <div className="font-semibold text-cyan-50">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.max : selectedSession?.max ?? null,
                        selectedSession?.voteSystem ?? state.voteSystem
                      )}
                    </div>
                  </div>
                </div>
                {selectedSession?.totalVotes ? (
                  <div className={cn("grid gap-1.5 p-2", GAME_SUBPANEL_SURFACE)}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Consensus</span>
                      <span className="font-semibold text-cyan-50">
                        {selectedLeadVote ? `${displayVoteValue(selectedLeadVote[0])} (${selectedConsensusPct}%)` : "-"}
                      </span>
                    </div>
                    {selectedVoteEntries.map(([value, count]) => {
                      const totalVotes = selectedSession?.totalVotes ?? 0;
                      const barPct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <div key={value} className="grid gap-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-cyan-100">{displayVoteValue(value)}</span>
                            <span className="text-slate-300">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-slate-900/55">
                            <div className="h-full rounded bg-cyan-300/85" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {!selectedSession?.isCurrent && isHost ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-8 text-xs")}
                    onClick={reopenPastQuestion}
                  >
                    Reouvrir au vote
                  </Button>
                ) : null}
              </div>
            )}
          </Card>
        </div>

        <div className="sticky bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+4px)] sm:hidden">
          <Card className={cn(GAME_HUD_SURFACE, "px-2 py-2 shadow-[0_-8px_24px_rgba(2,6,23,0.35)]")}>
            <div className="mb-2">
              <Button
                variant="secondary"
                className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "h-9 w-full text-xs")}
                onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}
              >
                {myRole === "player" ? fr.planningPoker.switchSpectator : fr.planningPoker.switchPlayer}
              </Button>
            </div>
            <div className={cn("grid gap-2", "grid-cols-3")}>
              {isHost ? (
                <>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "text-xs")}
                    onClick={() => {
                      setMobileMenuTab("session");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Menu
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_PRIMARY, "text-xs")}
                    onClick={handleHostMainAction}
                  >
                    {hostMainActionLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_DANGER, "text-xs")}
                    onClick={requestLeave}
                  >
                    {fr.onlineLobby.leaveParty}
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
                      setMobileMenuTab("session");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Session
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
            <DrawerTitle>{mobileMenuTab === "spectators" ? "Spectateurs" : "Session"}</DrawerTitle>
          </DrawerHeader>
          {mobileMenuTab === "session" && isHost ? (
            <div className="px-4 pb-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100/90">
                Configuration du vote en cours
              </div>
              <div className={cn("mt-2 rounded-xl p-2 text-xs", GAME_SUBPANEL_SURFACE)}>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-cyan-300/28 bg-slate-900/55 p-1">
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
                <button
                  type="button"
                  onClick={openMobileStoryEditor}
                  className="mt-2 w-full rounded-xl border border-cyan-300/28 bg-slate-950/55 px-2 py-2 text-left transition-colors hover:bg-slate-900/70"
                >
                  <div className="text-[10px] uppercase tracking-[0.08em] text-slate-300">Nom de la story</div>
                  <div className="truncate text-xs text-cyan-50">{state.storyTitle || storyDraft || "Story en cours"}</div>
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid max-h-[72vh] gap-2 overflow-y-auto px-4 pb-4">
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
                <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100/90">
                  Historique des votes
                </div>
                <div className="rounded-xl border border-cyan-300/20 bg-slate-950/42 px-2 py-1.5 text-xs text-cyan-50">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold">{selectedSession?.roundLabel ?? "Session"}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          GAME_TAB_BUTTON,
                          "h-8 w-8 border-cyan-300/30 bg-slate-900/65 px-0 text-base font-semibold text-cyan-100 hover:bg-slate-800/80 disabled:opacity-45"
                        )}
                        disabled={sessionCursor >= sessionEntries.length - 1}
                        onClick={() => setSessionCursor((value) => Math.min(value + 1, sessionEntries.length - 1))}
                      >
                        ‹
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          GAME_TAB_BUTTON,
                          "h-8 w-8 border-cyan-300/30 bg-slate-900/65 px-0 text-base font-semibold text-cyan-100 hover:bg-slate-800/80 disabled:opacity-45"
                        )}
                        disabled={sessionCursor <= 0}
                        onClick={() => setSessionCursor((value) => Math.max(value - 1, 0))}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                  <div className="truncate text-sm font-semibold">{selectedSession?.storyTitle || "-"}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-cyan-300/18 bg-slate-950/45 px-2 py-1">
                      <div className="text-[10px] text-slate-300">Statut</div>
                      <div className="font-semibold text-cyan-50">{selectedStatusLabel}</div>
                    </div>
                    <div className="rounded-xl border border-cyan-300/18 bg-slate-950/45 px-2 py-1">
                      <div className="text-[10px] text-slate-300">Nombre de votes</div>
                      <div className="font-semibold text-cyan-50">{selectedProgressLabel}</div>
                    </div>
                  </div>
                  {isHost ? (
                    <div className="mt-1 flex justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          GAME_TAB_BUTTON,
                          "h-7 min-w-[92px] border-cyan-300/28 bg-slate-900/62 px-2 text-[11px] text-cyan-100 hover:bg-slate-800/80 disabled:opacity-45"
                        )}
                        disabled={mobileSessionActionDisabled}
                        onClick={handleMobileSessionAction}
                      >
                        {mobileSessionActionLabel}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="grid max-h-[44vh] gap-2 overflow-y-auto pr-1">
                <div className={cn("grid grid-cols-2 gap-2 rounded-xl p-2 text-xs", GAME_SUBPANEL_SURFACE)}>
                  <div className="col-span-2 text-slate-300">Statistiques</div>
                  <div>
                    <div className="text-slate-300">Moyenne</div>
                    <div className="font-semibold text-cyan-50">
                      {selectedSession?.isCurrent
                        ? averageLabel
                        : formatPlanningValueForSystem(selectedSession?.average ?? null, selectedSession?.voteSystem ?? state.voteSystem)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-300">Mediane</div>
                    <div className="font-semibold text-cyan-50">
                      {selectedSession?.isCurrent
                        ? medianLabel
                        : formatPlanningValueForSystem(selectedSession?.median ?? null, selectedSession?.voteSystem ?? state.voteSystem)}
                    </div>
                  </div>
                </div>
                <div className={cn("grid grid-cols-2 gap-2 rounded-xl p-2 text-xs", GAME_SUBPANEL_SURFACE)}>
                  <div>
                    <div className="text-slate-300">Min</div>
                    <div className="font-semibold text-cyan-50">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.min : selectedSession?.min ?? null,
                        selectedSession?.voteSystem ?? state.voteSystem
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-300">Max</div>
                    <div className="font-semibold text-cyan-50">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.max : selectedSession?.max ?? null,
                        selectedSession?.voteSystem ?? state.voteSystem
                      )}
                    </div>
                  </div>
                </div>
                {selectedSession?.totalVotes ? (
                  <div className={cn("grid gap-1.5 rounded-xl p-2 text-xs", GAME_SUBPANEL_SURFACE)}>
                    <div className="text-slate-300">Repartition</div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Consensus</span>
                      <span className="font-semibold text-cyan-50">
                        {selectedLeadVote ? `${displayVoteValue(selectedLeadVote[0])} (${selectedConsensusPct}%)` : "-"}
                      </span>
                    </div>
                    {selectedVoteEntries.map(([value, count]) => {
                      const totalVotes = selectedSession?.totalVotes ?? 0;
                      const barPct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <div key={`mobile-session-distribution-${value}`} className="grid gap-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-cyan-100">{displayVoteValue(value)}</span>
                            <span className="text-slate-300">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-slate-900/55">
                            <div className="h-full rounded bg-cyan-300/85" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={mobileStoryEditorOpen} onOpenChange={setMobileStoryEditorOpen}>
        <AlertDialogContent
          className={cn(GAME_DIALOG_CONTENT, "max-w-md border-cyan-300/35 bg-slate-900 p-3 shadow-[0_24px_56px_rgba(2,6,23,0.85)] sm:hidden")}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            mobileStoryEditorInputRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-100/90">
              Configuration du vote en cours
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">Edition du nom de la story</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-cyan-300/20 bg-slate-950 p-3">
            <div className="text-sm font-semibold text-cyan-50">Renommer la story</div>
            <input
              ref={mobileStoryEditorInputRef}
              type="text"
              value={mobileStoryEditorDraft}
              onChange={(event) => setMobileStoryEditorDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveMobileStoryEditor();
              }}
              className="mt-2 h-10 w-full rounded-xl border border-cyan-300/28 bg-slate-950 px-3 text-sm text-cyan-50 outline-none focus:border-cyan-300/65"
              placeholder="Story en cours"
            />
          </div>
          <AlertDialogFooter className="mt-0 grid grid-cols-2 gap-2 sm:space-x-0">
            <Button
              variant="secondary"
              className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_SECONDARY_SUBTLE, "h-10 text-xs")}
              onClick={() => setMobileStoryEditorOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="secondary"
              className={cn(GAME_MOBILE_ACTION_BUTTON, CTA_NEON_PRIMARY, "h-10 text-xs")}
              onClick={saveMobileStoryEditor}
            >
              Enregistrer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl">Reset des votes ?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-300">
              Des joueurs ont deja vote. Cette action effacera les votes en cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-cyan-100")}>
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")} onClick={confirmResetVotes}>
              {fr.planningPoker.resetVotes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
