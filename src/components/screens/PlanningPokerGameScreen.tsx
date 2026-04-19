import React, { useMemo, useState } from "react";
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
import {
  PlanningPokerRole,
  PlanningPokerRoundSummary,
  PlanningPokerState,
} from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { PlanningPokerRoundBoard } from "@/components/planning-poker/PlanningPokerRoundBoard";
import {
  computePlanningPokerStats,
  formatPlanningValueForSystem,
  PLANNING_POKER_DECKS,
} from "@/lib/planningPoker";

// Portal-aligned local tokens
const HUD = "rounded-2xl border border-white/[0.06] bg-[#0d0d1a]/90 backdrop-blur";
const PANEL = "rounded-2xl border border-white/[0.06] bg-white/[0.02]";
const SUBPANEL = "rounded-xl border border-white/[0.05] bg-white/[0.015]";
const TAB_BTN =
  "h-8 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 transition-colors";
const TAB_ACTIVE = "bg-indigo-500/20 border-indigo-400/40 text-indigo-200";
const MOBILE_BTN = "h-11 w-full rounded-xl";
const DRAWER_CLS =
  "bg-[#0d0d1a] border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)] text-slate-100 lg:hidden";
const DIALOG_CLS =
  "rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.65)] sm:p-6";
const CTA_PRIMARY =
  "border-indigo-400/40 bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] hover:bg-indigo-400";
const CTA_SUBTLE =
  "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white";
const CTA_DANGER = "border-rose-400/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25";

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
  onSelectPokerStory?: (index: number) => void;
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
  _index: number,
  _total: number,
  selected: boolean,
): React.CSSProperties => {
  if (selected) {
    return {
      borderColor: "rgba(99,102,241,0.65)",
      background: "rgba(99,102,241,0.15)",
      boxShadow: "0 0 0 2px rgba(99,102,241,0.35), 0 8px 20px rgba(99,102,241,0.2)",
    };
  }
  return {};
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
  onSelectPokerStory,
}) => {
  const hasPreparedStories = state.preparedStories.length > 0;
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<"spectators" | "session">("session");
  const [mobileSessionTab, setMobileSessionTab] = useState<
    "current" | "history" | "summary" | "stories"
  >("current");
  const [sidebarTab, setSidebarTab] = useState<"spectators" | "session" | "summary" | "stories">(
    "session",
  );
  const [sessionCursor, setSessionCursor] = useState(0);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState(state.storyTitle);
  const [mobileStoryEditorOpen, setMobileStoryEditorOpen] = useState(false);
  const [mobileStoryEditorDraft, setMobileStoryEditorDraft] = useState(state.storyTitle);
  const mobileStoryEditorInputRef = React.useRef<HTMLInputElement | null>(null);

  const votingPlayers = useMemo(
    () => state.players.filter((player) => player.role === "player"),
    [state.players],
  );
  const spectators = useMemo(
    () => state.players.filter((player) => player.role === "spectator"),
    [state.players],
  );
  const activeDeck = PLANNING_POKER_DECKS[state.voteSystem] ?? PLANNING_POKER_DECKS.fibonacci;
  const stats = useMemo(
    () => computePlanningPokerStats(state.players, state.voteSystem),
    [state.players, state.voteSystem],
  );
  const votedCount = useMemo(
    () => votingPlayers.filter((player) => player.hasVoted).length,
    [votingPlayers],
  );
  const totalVoters = votingPlayers.length;
  const voteProgressLabel = `${votedCount}/${totalVoters}`;
  const voteProgressPct = totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0;
  const voteEntries = useMemo(
    () => Object.entries(stats.distribution).sort(([, a], [, b]) => b - a),
    [stats.distribution],
  );
  const leadVote = voteEntries[0] ?? null;
  const consensusPct =
    leadVote && stats.totalVotes > 0 ? Math.round((leadVote[1] / stats.totalVotes) * 100) : 0;
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
  const averageLabel = state.revealed
    ? formatPlanningValueForSystem(stats.average, state.voteSystem)
    : "-";
  const medianLabel = state.revealed
    ? formatPlanningValueForSystem(stats.median, state.voteSystem)
    : "-";
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
    [historyEntries, state.round, state.storyTitle, state.voteSystem, stats, votingPlayers],
  );
  const selectedSession =
    sessionEntries[Math.min(sessionCursor, Math.max(0, sessionEntries.length - 1))] ??
    sessionEntries[0];
  const selectedVoteEntries = useMemo(
    () => Object.entries(selectedSession?.distribution ?? {}).sort(([, a], [, b]) => b - a),
    [selectedSession],
  );
  const selectedLeadVote = selectedVoteEntries[0] ?? null;
  const selectedConsensusPct =
    selectedLeadVote && (selectedSession?.totalVotes ?? 0) > 0
      ? Math.round((selectedLeadVote[1] / (selectedSession?.totalVotes ?? 1)) * 100)
      : 0;
  const globalSummary = useMemo(() => {
    if (!historyEntries.length) return null;

    const distribution: Record<string, number> = {};
    const voteSystems: Record<string, number> = {};
    let totalVotes = 0;

    for (const entry of historyEntries) {
      totalVotes += entry.totalVotes ?? 0;
      voteSystems[entry.voteSystem] = (voteSystems[entry.voteSystem] ?? 0) + 1;

      for (const [value, count] of Object.entries(entry.distribution ?? {})) {
        distribution[value] = (distribution[value] ?? 0) + count;
      }
    }

    const distributionEntries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
    const leadVote = distributionEntries[0] ?? null;
    const consensusPct =
      leadVote && totalVotes > 0 ? Math.round((leadVote[1] / totalVotes) * 100) : 0;
    const voteSystemsLabel = Object.entries(voteSystems)
      .sort(([, a], [, b]) => b - a)
      .map(([system, count]) => `${system} (${count})`)
      .join(", ");

    return {
      storiesCount: historyEntries.length,
      totalVotes,
      distributionEntries,
      leadVote,
      consensusPct,
      voteSystemsLabel,
    };
  }, [historyEntries]);
  const selectedStatusLabel = selectedSession?.isCurrent
    ? state.revealed
      ? "Revele"
      : state.votesOpen
        ? "Vote en cours"
        : "Votes non lances"
    : "Question archivee";
  const selectedProgressLabel = selectedSession?.isCurrent
    ? voteProgressLabel
    : `${selectedSession?.totalVotes ?? 0} votes`;
  const mobileSessionActionLabel = selectedSession?.isCurrent ? "🔓 Revoter" : "🔓 Réouvrir";
  const mobileSessionActionDisabled =
    !isHost || (selectedSession?.isCurrent ? !state.revealed : false);
  const summaryRows = useMemo(() => {
    const orderedHistory = [...historyEntries].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return (a.revealedAt ?? 0) - (b.revealedAt ?? 0);
    });

    const archivedRows = orderedHistory.map((entry) => {
      const voteEntriesForRow = Object.entries(entry.distribution ?? {}).sort(
        ([, a], [, b]) => b - a,
      );
      const lead = voteEntriesForRow[0] ?? null;
      const consensus =
        lead && entry.totalVotes > 0 ? Math.round((lead[1] / entry.totalVotes) * 100) : 0;
      return {
        id: entry.id,
        roundLabel: `Vote #${entry.round}`,
        title: entry.storyTitle || "-",
        totalVotes: entry.totalVotes,
        average: formatPlanningValueForSystem(entry.average, entry.voteSystem),
        median: formatPlanningValueForSystem(entry.median, entry.voteSystem),
        consensus: lead ? `${displayVoteValue(lead[0])} (${consensus}%)` : "-",
      };
    });

    if (!state.revealed) return archivedRows;

    const currentConsensus = leadVote ? `${displayVoteValue(leadVote[0])} (${consensusPct}%)` : "-";
    const currentRow = {
      id: "summary-current",
      roundLabel: `Tour #${state.round}`,
      title: state.storyTitle || "-",
      totalVotes: stats.totalVotes,
      average: averageLabel,
      median: medianLabel,
      consensus: currentConsensus,
    };

    return [...archivedRows, currentRow];
  }, [
    averageLabel,
    consensusPct,
    historyEntries,
    leadVote,
    medianLabel,
    state.revealed,
    state.round,
    state.storyTitle,
    stats.totalVotes,
  ]);

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
  const handleHostMainAction = state.revealed
    ? requestResetVotes
    : state.votesOpen
      ? onRevealVotes
      : onOpenVotes;

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
      setMobileActionsOpen(false);
      return;
    }
    if (normalized !== state.storyTitle) {
      onStoryTitleChange(normalized);
      setStoryDraft(normalized);
    }
    setMobileStoryEditorOpen(false);
    setMobileActionsOpen(false);
  }, [isHost, mobileStoryEditorDraft, onStoryTitleChange, state.storyTitle]);

  const handleDeckVote = React.useCallback(
    (value: string) => {
      if (state.revealed || !state.votesOpen) return;
      onVoteCard(myVote === value ? "" : value);
    },
    [myVote, onVoteCard, state.revealed, state.votesOpen],
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
  }, [
    activeDeck,
    handleDeckVote,
    isHost,
    myRole,
    onResetVotes,
    onRevealVotes,
    state.revealed,
    state.votesOpen,
  ]);

  return (
    <div
      className="relative h-svh w-full overflow-hidden px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3"
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(99,102,241,0.09) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto flex h-full w-full flex-col gap-2 sm:gap-3">
        {/* ── Header HUD ── */}
        <header className={cn(HUD, "px-2.5 py-2 sm:px-4 sm:py-3")}>
          {/* Mobile header */}
          <div className="grid gap-2 sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/8 px-2 py-1 text-[10px] text-indigo-300">
                {consensusLabel}
              </div>
              {state.roomCode ? (
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-indigo-100">
                  <span className="uppercase text-indigo-200/85">Code</span>
                  <span className="truncate">{state.roomCode}</span>
                </div>
              ) : (
                <span />
              )}
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.1em]">
                <span className="text-slate-400">Votes {voteProgressLabel}</span>
                <div className="inline-flex items-center gap-1">
                  <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-200">
                    Moy {averageLabel}
                  </div>
                  <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-200">
                    Med {medianLabel}
                  </div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-slate-900/60">
                <div
                  className="h-full rounded bg-indigo-400/90 transition-all duration-300"
                  style={{ width: `${voteProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden items-center justify-between gap-2 sm:flex">
            <div className="min-w-0 flex-1">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.1em]">
                  <span className="text-slate-400">Votes {voteProgressLabel}</span>
                  <span className="text-indigo-300/90">{consensusLabel}</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-900/60">
                  <div
                    className="h-full rounded bg-indigo-400/90 transition-all duration-300"
                    style={{ width: `${voteProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="ml-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-indigo-300/85">
                  Moyenne
                </div>
                <div className="text-2xl font-black leading-none text-slate-100">
                  {averageLabel}
                </div>
              </div>
              <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-indigo-300/85">
                  Mediane
                </div>
                <div className="text-2xl font-black leading-none text-slate-100">{medianLabel}</div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-end gap-2">
              {state.roomCode ? (
                <div className="-mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-300/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-indigo-100">
                  <span className="uppercase text-indigo-200/85">Code</span>
                  <span className="truncate">{state.roomCode}</span>
                </div>
              ) : null}
              <Button
                className={cn(
                  "hidden xl:inline-flex h-9 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-200",
                )}
                variant="secondary"
                onClick={requestLeave}
              >
                {fr.gameScreen.leaveGame}
              </Button>
            </div>
          </div>
        </header>

        {/* ── Main content grid ── */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,22vw)]">
          {/* ── Game panel ── */}
          <div
            className={cn(
              PANEL,
              "grid min-h-0 grid-rows-[minmax(150px,1fr)_auto] gap-2 p-2.5 sm:grid-rows-[minmax(340px,1fr)_auto_auto] sm:gap-3 sm:p-4 lg:gap-4 lg:p-5",
            )}
          >
            <PlanningPokerRoundBoard
              players={votingPlayers}
              revealed={state.revealed}
              votesOpen={state.votesOpen}
              storyTitle={state.storyTitle}
              round={state.round}
              voteSystem={state.voteSystem}
            />

            {/* ── Vote deck ── */}
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-2 sm:p-3">
              {myRole === "player" ? (
                <>
                  {/* Mobile deck (horizontal scroll) */}
                  <div className="grid gap-2 sm:hidden">
                    <div className="min-w-0 pt-2">
                      <div className="flex min-w-0 w-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-visible scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                                  ? "mt-0 text-indigo-100"
                                  : "border-white/[0.08] text-slate-300",
                              )}
                            >
                              {displayVoteValue(value)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Desktop deck */}
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
                              ? "-translate-y-3 text-indigo-100"
                              : "border-white/[0.08] text-slate-300 hover:-translate-y-0.5 hover:bg-slate-900/92",
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
                  <div className="relative h-[58px] w-[38px] rounded-xl border border-white/[0.08] bg-gradient-to-b from-slate-900/82 to-slate-950/82 shadow-[0_8px_20px_rgba(2,6,23,0.45)] sm:h-[94px] sm:w-[62px]">
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400 sm:text-xs sm:tracking-[0.08em]">
                      Spectateur
                    </div>
                    <div className="pointer-events-none absolute left-[-14%] top-1/2 h-[2px] w-[128%] -translate-y-1/2 rotate-[-36deg] rounded bg-rose-500/95 shadow-[0_0_10px_rgba(244,63,94,0.65)] sm:h-[3px]" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Desktop controls ── */}
            <div className="hidden min-w-0 flex-wrap items-center justify-between gap-2 sm:flex">
              <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button
                  variant="secondary"
                  className={cn("h-9 min-w-0 rounded-xl border text-xs font-semibold", CTA_SUBTLE)}
                  onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}
                >
                  {myRole === "player"
                    ? fr.planningPoker.switchSpectator
                    : fr.planningPoker.switchPlayer}
                </Button>
                {isHost ? (
                  <div className="flex min-w-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-slate-900/55 p-1">
                    {VOTE_SYSTEM_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onVoteSystemChange(option.value)}
                        className={cn(
                          "h-7 min-w-0 rounded px-2 text-[11px] transition-colors",
                          state.voteSystem === option.value
                            ? "bg-indigo-500 text-white"
                            : "bg-transparent text-slate-300 hover:bg-white/[0.06]",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                {isHost && state.revealed ? (
                  <Button
                    variant="secondary"
                    className={cn(
                      "h-9 min-w-0 w-full rounded-xl border text-[11px] font-semibold sm:w-auto sm:text-xs",
                      CTA_SUBTLE,
                    )}
                    onClick={onRevoteCurrentStory}
                  >
                    Revoter cette story
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  className={cn(
                    "h-9 min-w-0 w-full rounded-xl border text-[11px] font-semibold sm:w-auto sm:text-xs",
                    CTA_PRIMARY,
                  )}
                  disabled={!isHost}
                  onClick={handleHostMainAction}
                >
                  <span className="sm:hidden">{hostMainActionShortLabel}</span>
                  <span className="hidden sm:inline">{hostMainActionLabel}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* ── Desktop sidebar ── */}
          <div className={cn(PANEL, "hidden min-h-0 p-3 lg:flex lg:flex-col")}>
            {/* Sidebar tab bar */}
            <div
              className={cn(
                "mb-2 grid w-full gap-1.5",
                hasPreparedStories ? "grid-cols-4" : "grid-cols-3",
              )}
            >
              {(
                [
                  ...(hasPreparedStories ? ["stories"] : []),
                  "spectators",
                  "session",
                  "summary",
                ] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    TAB_BTN,
                    "w-full justify-center",
                    sidebarTab === tab ? TAB_ACTIVE : "",
                    tab === "stories" ? "border-violet-400/30 text-violet-300" : "",
                    tab === "stories" && sidebarTab === tab
                      ? "bg-violet-500/20 border-violet-400/40 text-violet-200"
                      : "",
                  )}
                >
                  {tab === "spectators"
                    ? "Spectateurs"
                    : tab === "session"
                      ? "Session"
                      : tab === "stories"
                        ? `Stories (${state.preparedStories.length})`
                        : "Synthese"}
                </button>
              ))}
            </div>

            {sidebarTab === "stories" ? (
              <div className="grid min-h-0 gap-1.5 overflow-auto pr-1">
                {state.preparedStories.map((story, idx) => {
                  const isCurrent = idx === state.currentStoryIndex;
                  const isDone = state.currentStoryIndex >= 0 && idx < state.currentStoryIndex;
                  return (
                    <button
                      key={story.id}
                      type="button"
                      disabled={!isHost || isCurrent}
                      onClick={() => onSelectPokerStory?.(idx)}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all",
                        isCurrent
                          ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                          : isDone
                            ? "border-white/[0.04] bg-white/[0.01] text-slate-600 line-through"
                            : isHost
                              ? "border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-violet-200"
                              : "border-white/[0.06] bg-white/[0.02] text-slate-300",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 text-[10px] font-bold",
                          isCurrent
                            ? "text-violet-400"
                            : isDone
                              ? "text-slate-600"
                              : "text-slate-500",
                        )}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold leading-snug">{story.title}</div>
                        {story.description && (
                          <div className="mt-0.5 text-[10px] text-slate-500 line-clamp-2">
                            {story.description}
                          </div>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="ml-auto shrink-0 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                          En cours
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : sidebarTab === "spectators" ? (
              <div className="grid min-h-0 gap-2 overflow-auto pr-1">
                {spectators.length > 0 ? (
                  spectators.map((player) => (
                    <div
                      key={player.socketId}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5"
                    >
                      <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                      <span className="truncate text-xs text-slate-200">{player.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">Aucun spectateur.</div>
                )}
              </div>
            ) : sidebarTab === "summary" ? (
              <div className={cn("grid min-h-0 gap-2 p-2 text-xs", SUBPANEL)}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Synthese des votes</span>
                  <span className="text-[11px] text-slate-500">{summaryRows.length} lignes</span>
                </div>
                {summaryRows.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-400">
                    Aucune story revelee pour le moment.
                  </div>
                ) : (
                  <div className="grid min-h-0 gap-1 overflow-auto pr-1">
                    <div className="grid grid-cols-[1.2fr_2fr_1fr_1fr_1.1fr] gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      <span>Vote</span>
                      <span>Nom</span>
                      <span>Moy.</span>
                      <span>Med.</span>
                      <span>Consensus</span>
                    </div>
                    {summaryRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1.2fr_2fr_1fr_1fr_1.1fr] gap-2 rounded-xl border border-white/[0.04] bg-white/[0.01] px-2 py-1.5 text-[11px]"
                      >
                        <span className="text-slate-400">{row.roundLabel}</span>
                        <span className="truncate text-slate-100">{row.title}</span>
                        <span className="text-indigo-300">{row.average}</span>
                        <span className="text-indigo-300">{row.median}</span>
                        <span className="text-indigo-300">{row.consensus}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2 text-xs">
                <div className={cn("p-2", SUBPANEL)}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-slate-400">Question</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          TAB_BTN,
                          "h-8 w-8 px-0 text-base font-semibold disabled:opacity-45",
                        )}
                        disabled={sessionCursor >= sessionEntries.length - 1}
                        onClick={() =>
                          setSessionCursor((value) =>
                            Math.min(value + 1, sessionEntries.length - 1),
                          )
                        }
                      >
                        ‹
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={cn(
                          TAB_BTN,
                          "h-8 w-8 px-0 text-base font-semibold disabled:opacity-45",
                        )}
                        disabled={sessionCursor <= 0}
                        onClick={() => setSessionCursor((value) => Math.max(value - 1, 0))}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                  <div className="truncate text-slate-100">
                    {selectedSession?.storyTitle || "-"}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedSession?.roundLabel ?? "-"}
                  </div>
                  <div className="mt-1 text-slate-400">Statut</div>
                  <div className="text-slate-100">
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
                  <div className={cn("grid gap-2 p-2", SUBPANEL)}>
                    <input
                      type="text"
                      value={storyDraft}
                      onChange={(event) => setStoryDraft(event.target.value)}
                      onBlur={submitStoryTitle}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitStoryTitle();
                      }}
                      className="h-8 w-full rounded-lg border border-white/[0.08] bg-slate-950/55 px-2 text-xs text-slate-100 outline-none focus:border-indigo-400/50 transition"
                      placeholder="Story en cours"
                    />
                  </div>
                ) : null}
                <div className={cn("grid grid-cols-2 gap-2 p-2", SUBPANEL)}>
                  <div>
                    <div className="text-slate-400">Moyenne</div>
                    <div className="font-semibold text-slate-100">
                      {selectedSession?.isCurrent
                        ? averageLabel
                        : formatPlanningValueForSystem(
                            selectedSession?.average ?? null,
                            selectedSession?.voteSystem ?? state.voteSystem,
                          )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Mediane</div>
                    <div className="font-semibold text-slate-100">
                      {selectedSession?.isCurrent
                        ? medianLabel
                        : formatPlanningValueForSystem(
                            selectedSession?.median ?? null,
                            selectedSession?.voteSystem ?? state.voteSystem,
                          )}
                    </div>
                  </div>
                </div>
                <div className={cn("grid grid-cols-2 gap-2 p-2", SUBPANEL)}>
                  <div>
                    <div className="text-slate-400">Min</div>
                    <div className="font-semibold text-slate-100">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.min : (selectedSession?.min ?? null),
                        selectedSession?.voteSystem ?? state.voteSystem,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Max</div>
                    <div className="font-semibold text-slate-100">
                      {formatPlanningValueForSystem(
                        selectedSession?.isCurrent ? stats.max : (selectedSession?.max ?? null),
                        selectedSession?.voteSystem ?? state.voteSystem,
                      )}
                    </div>
                  </div>
                </div>
                {selectedSession?.totalVotes ? (
                  <div className={cn("grid gap-1.5 p-2", SUBPANEL)}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Consensus</span>
                      <span className="font-semibold text-slate-100">
                        {selectedLeadVote
                          ? `${displayVoteValue(selectedLeadVote[0])} (${selectedConsensusPct}%)`
                          : "-"}
                      </span>
                    </div>
                    {selectedVoteEntries.map(([value, count]) => {
                      const totalVotes = selectedSession?.totalVotes ?? 0;
                      const barPct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <div key={value} className="grid gap-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-200">{displayVoteValue(value)}</span>
                            <span className="text-slate-400">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-slate-900/55">
                            <div
                              className="h-full rounded bg-indigo-400/80"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {globalSummary ? (
                  <div className={cn("grid gap-1.5 p-2", SUBPANEL)}>
                    <div className="text-slate-400">Synthese globale</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-slate-400">Stories estimees</div>
                        <div className="font-semibold text-slate-100">
                          {globalSummary.storiesCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Votes exprimes</div>
                        <div className="font-semibold text-slate-100">
                          {globalSummary.totalVotes}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Consensus global</span>
                      <span className="font-semibold text-slate-100">
                        {globalSummary.leadVote
                          ? `${displayVoteValue(globalSummary.leadVote[0])} (${globalSummary.consensusPct}%)`
                          : "-"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Types de vote: {globalSummary.voteSystemsLabel || "-"}
                    </div>
                    {globalSummary.distributionEntries.slice(0, 5).map(([value, count]) => {
                      const barPct =
                        globalSummary.totalVotes > 0
                          ? Math.round((count / globalSummary.totalVotes) * 100)
                          : 0;
                      return (
                        <div key={`desktop-global-distribution-${value}`} className="grid gap-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-200">{displayVoteValue(value)}</span>
                            <span className="text-slate-400">{count}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-slate-900/55">
                            <div
                              className="h-full rounded bg-indigo-400/80"
                              style={{ width: `${barPct}%` }}
                            />
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
                    className={cn("h-8 rounded-xl border text-xs font-semibold", CTA_SUBTLE)}
                    onClick={reopenPastQuestion}
                  >
                    Reouvrir au vote
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile sticky bottom bar ── */}
        <div className="sticky bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+4px)] sm:hidden">
          <div className={cn(HUD, "px-2 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.45)]")}>
            <div className="mb-2">
              <Button
                variant="secondary"
                className={cn(MOBILE_BTN, "rounded-xl border text-xs font-semibold", CTA_SUBTLE)}
                onClick={() => onRoleChange(myRole === "player" ? "spectator" : "player")}
              >
                {myRole === "player"
                  ? fr.planningPoker.switchSpectator
                  : fr.planningPoker.switchPlayer}
              </Button>
            </div>
            <div className={cn("grid gap-2", "grid-cols-3")}>
              {isHost ? (
                <>
                  <Button
                    variant="secondary"
                    className={cn(
                      MOBILE_BTN,
                      "rounded-xl border text-xs font-semibold",
                      CTA_SUBTLE,
                    )}
                    onClick={() => {
                      setMobileMenuTab("session");
                      setMobileSessionTab("current");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Menu
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(MOBILE_BTN, "rounded-xl border text-xs font-bold", CTA_PRIMARY)}
                    onClick={handleHostMainAction}
                  >
                    {hostMainActionLabel}
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(
                      MOBILE_BTN,
                      "rounded-xl border text-xs font-semibold",
                      CTA_DANGER,
                    )}
                    onClick={requestLeave}
                  >
                    {fr.onlineLobby.leaveParty}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className={cn(
                      MOBILE_BTN,
                      "rounded-xl border text-xs font-semibold",
                      CTA_SUBTLE,
                    )}
                    onClick={() => {
                      setMobileMenuTab("spectators");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Spectateurs
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(
                      MOBILE_BTN,
                      "rounded-xl border text-xs font-semibold",
                      CTA_SUBTLE,
                    )}
                    onClick={() => {
                      setMobileMenuTab("session");
                      setMobileSessionTab("current");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Session
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(
                      MOBILE_BTN,
                      "rounded-xl border text-xs font-semibold",
                      CTA_DANGER,
                    )}
                    onClick={requestLeave}
                  >
                    {fr.onlineLobby.leaveParty}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile actions drawer ── */}
      <Drawer open={mobileActionsOpen} onOpenChange={setMobileActionsOpen}>
        <DrawerContent className={DRAWER_CLS}>
          <DrawerHeader>
            <DrawerTitle className="text-slate-100">
              {mobileMenuTab === "spectators" ? "Spectateurs" : "Session"}
            </DrawerTitle>
          </DrawerHeader>
          {mobileMenuTab === "session" ? (
            <div className="px-4 pb-2">
              <div
                className={cn(
                  "grid gap-1 rounded-xl border border-white/[0.06] bg-slate-900/55 p-1",
                  hasPreparedStories ? "grid-cols-4" : "grid-cols-3",
                )}
              >
                {(
                  [
                    ...(hasPreparedStories ? ["stories"] : []),
                    "current",
                    "history",
                    "summary",
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMobileSessionTab(tab)}
                    className={cn(
                      "h-8 rounded px-2 text-[11px] transition-colors",
                      mobileSessionTab === tab
                        ? tab === "stories"
                          ? "bg-violet-500 text-white"
                          : "bg-indigo-500 text-white"
                        : "bg-transparent text-slate-300 hover:bg-white/[0.06]",
                    )}
                  >
                    {tab === "current"
                      ? "Vote en cours"
                      : tab === "history"
                        ? "Historique"
                        : tab === "stories"
                          ? "Stories"
                          : "Synthese"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid max-h-[72vh] gap-2 overflow-y-auto px-4 pb-4">
            {mobileMenuTab === "spectators" ? (
              <>
                {spectators.length > 0 ? (
                  spectators.map((player) => (
                    <div
                      key={player.socketId}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5"
                    >
                      <span className="text-base">{AVATARS[player.avatar] ?? ":)"}</span>
                      <span className="truncate text-xs text-slate-200">{player.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-400">
                    Aucun spectateur.
                  </div>
                )}
              </>
            ) : (
              <>
                {mobileSessionTab === "stories" ? (
                  <div className="grid gap-1.5">
                    {state.preparedStories.map((story, idx) => {
                      const isCurrent = idx === state.currentStoryIndex;
                      const isDone = state.currentStoryIndex >= 0 && idx < state.currentStoryIndex;
                      return (
                        <button
                          key={story.id}
                          type="button"
                          disabled={!isHost || isCurrent}
                          onClick={() => {
                            onSelectPokerStory?.(idx);
                            setMobileActionsOpen(false);
                          }}
                          className={cn(
                            "flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs",
                            isCurrent
                              ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                              : isDone
                                ? "border-white/[0.04] bg-white/[0.01] text-slate-600 line-through"
                                : "border-white/[0.06] bg-white/[0.02] text-slate-300",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 shrink-0 text-[10px] font-bold",
                              isCurrent ? "text-violet-400" : "text-slate-500",
                            )}
                          >
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{story.title}</div>
                            {story.description && (
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {story.description}
                              </div>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="ml-auto shrink-0 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-300">
                              En cours
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {mobileSessionTab === "current" ? (
                  <div className={cn("rounded-xl p-2 text-xs", SUBPANEL)}>
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-300/90">
                      Vote en cours
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-slate-900/55 p-1">
                      {VOTE_SYSTEM_OPTIONS.map((option) => (
                        <button
                          key={`mobile-current-${option.value}`}
                          type="button"
                          onClick={() => isHost && onVoteSystemChange(option.value)}
                          disabled={!isHost}
                          className={cn(
                            "h-8 rounded px-2 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                            state.voteSystem === option.value
                              ? "bg-indigo-500 text-white"
                              : "bg-transparent text-slate-300 hover:bg-white/[0.06]",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {isHost ? (
                      <button
                        type="button"
                        onClick={openMobileStoryEditor}
                        className="mt-2 w-full rounded-xl border border-white/[0.06] bg-slate-950/55 px-2 py-2 text-left transition-colors hover:bg-slate-900/70"
                      >
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          Nom de la story
                        </div>
                        <div className="truncate text-xs text-slate-100">
                          {state.storyTitle || storyDraft || "Story en cours"}
                        </div>
                      </button>
                    ) : (
                      <div className="mt-2 rounded-xl border border-white/[0.06] bg-slate-950/55 px-2 py-2 text-left">
                        <div className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                          Nom de la story
                        </div>
                        <div className="truncate text-xs text-slate-100">
                          {state.storyTitle || "Story en cours"}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {mobileSessionTab === "history" ? (
                  <>
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-300/90">
                      Historique des votes
                    </div>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-100">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {selectedSession?.roundLabel ?? "Session"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            className={cn(
                              TAB_BTN,
                              "h-8 w-8 px-0 text-base font-semibold disabled:opacity-45",
                            )}
                            disabled={sessionCursor >= sessionEntries.length - 1}
                            onClick={() =>
                              setSessionCursor((value) =>
                                Math.min(value + 1, sessionEntries.length - 1),
                              )
                            }
                          >
                            ‹
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className={cn(
                              TAB_BTN,
                              "h-8 w-8 px-0 text-base font-semibold disabled:opacity-45",
                            )}
                            disabled={sessionCursor <= 0}
                            onClick={() => setSessionCursor((value) => Math.max(value - 1, 0))}
                          >
                            ›
                          </Button>
                        </div>
                      </div>
                      <div className="truncate text-sm font-semibold">
                        {selectedSession?.storyTitle || "-"}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1">
                          <div className="text-[10px] text-slate-400">Statut</div>
                          <div className="font-semibold text-slate-100">{selectedStatusLabel}</div>
                        </div>
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1">
                          <div className="text-[10px] text-slate-400">Nombre de votes</div>
                          <div className="font-semibold text-slate-100">
                            {selectedProgressLabel}
                          </div>
                        </div>
                      </div>
                      {isHost ? (
                        <div className="mt-1 flex justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            className={cn(
                              TAB_BTN,
                              "h-7 min-w-[92px] px-2 text-[11px] disabled:opacity-45",
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
                      <div
                        className={cn("grid grid-cols-2 gap-2 rounded-xl p-2 text-xs", SUBPANEL)}
                      >
                        <div className="col-span-2 text-slate-400">Statistiques</div>
                        <div>
                          <div className="text-slate-400">Moyenne</div>
                          <div className="font-semibold text-slate-100">
                            {selectedSession?.isCurrent
                              ? averageLabel
                              : formatPlanningValueForSystem(
                                  selectedSession?.average ?? null,
                                  selectedSession?.voteSystem ?? state.voteSystem,
                                )}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Mediane</div>
                          <div className="font-semibold text-slate-100">
                            {selectedSession?.isCurrent
                              ? medianLabel
                              : formatPlanningValueForSystem(
                                  selectedSession?.median ?? null,
                                  selectedSession?.voteSystem ?? state.voteSystem,
                                )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn("grid grid-cols-2 gap-2 rounded-xl p-2 text-xs", SUBPANEL)}
                      >
                        <div>
                          <div className="text-slate-400">Min</div>
                          <div className="font-semibold text-slate-100">
                            {formatPlanningValueForSystem(
                              selectedSession?.isCurrent
                                ? stats.min
                                : (selectedSession?.min ?? null),
                              selectedSession?.voteSystem ?? state.voteSystem,
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Max</div>
                          <div className="font-semibold text-slate-100">
                            {formatPlanningValueForSystem(
                              selectedSession?.isCurrent
                                ? stats.max
                                : (selectedSession?.max ?? null),
                              selectedSession?.voteSystem ?? state.voteSystem,
                            )}
                          </div>
                        </div>
                      </div>
                      {selectedSession?.totalVotes ? (
                        <div className={cn("grid gap-1.5 rounded-xl p-2 text-xs", SUBPANEL)}>
                          <div className="text-slate-400">Repartition</div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Consensus</span>
                            <span className="font-semibold text-slate-100">
                              {selectedLeadVote
                                ? `${displayVoteValue(selectedLeadVote[0])} (${selectedConsensusPct}%)`
                                : "-"}
                            </span>
                          </div>
                          {selectedVoteEntries.map(([value, count]) => {
                            const totalVotes = selectedSession?.totalVotes ?? 0;
                            const barPct =
                              totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                            return (
                              <div
                                key={`mobile-session-distribution-${value}`}
                                className="grid gap-1"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-200">{displayVoteValue(value)}</span>
                                  <span className="text-slate-400">{count}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded bg-slate-900/55">
                                  <div
                                    className="h-full rounded bg-indigo-400/80"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {mobileSessionTab === "summary" ? (
                  <div className={cn("grid gap-2 rounded-xl p-2 text-xs", SUBPANEL)}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Synthese des votes</span>
                      <span className="text-[11px] text-slate-500">
                        {summaryRows.length} lignes
                      </span>
                    </div>
                    {summaryRows.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-400">
                        Aucune story revelee pour le moment.
                      </div>
                    ) : (
                      <div className="grid max-h-[52vh] gap-1 overflow-y-auto pr-1">
                        {summaryRows.map((row) => (
                          <div
                            key={`mobile-summary-row-${row.id}`}
                            className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-2 py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400">{row.roundLabel}</span>
                              <span className="text-[10px] text-slate-400">
                                {row.totalVotes} votes
                              </span>
                            </div>
                            <div className="truncate text-sm font-semibold text-slate-100">
                              {row.title}
                            </div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <div className="text-slate-400">Moy.</div>
                                <div className="text-indigo-300">{row.average}</div>
                              </div>
                              <div>
                                <div className="text-slate-400">Med.</div>
                                <div className="text-indigo-300">{row.median}</div>
                              </div>
                              <div>
                                <div className="text-slate-400">Consensus</div>
                                <div className="text-indigo-300">{row.consensus}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Mobile story editor dialog ── */}
      <AlertDialog open={mobileStoryEditorOpen} onOpenChange={setMobileStoryEditorOpen}>
        <AlertDialogContent
          className={cn(DIALOG_CLS, "max-w-md sm:hidden")}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            mobileStoryEditorInputRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-300/90">
              Configuration du vote en cours
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Edition du nom de la story
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950 p-3">
            <div className="text-sm font-semibold text-slate-100">Renommer la story</div>
            <input
              ref={mobileStoryEditorInputRef}
              type="text"
              value={mobileStoryEditorDraft}
              onChange={(event) => setMobileStoryEditorDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveMobileStoryEditor();
              }}
              className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50 transition"
              placeholder="Story en cours"
            />
          </div>
          <AlertDialogFooter className="mt-0 grid grid-cols-2 gap-2 sm:space-x-0">
            <Button
              variant="secondary"
              className={cn(MOBILE_BTN, "rounded-xl border text-xs font-semibold", CTA_SUBTLE)}
              onClick={() => setMobileStoryEditorOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="secondary"
              className={cn(MOBILE_BTN, "rounded-xl border text-xs font-bold", CTA_PRIMARY)}
              onClick={saveMobileStoryEditor}
            >
              Enregistrer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Leave dialog ── */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(DIALOG_CLS, "max-w-md")}>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-rose-300">
              <span>Quitter</span>
            </div>
            <AlertDialogTitle className="text-center text-2xl text-slate-100">
              {fr.gameScreen.leaveQuestionTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-400">
              {fr.game.backToOnlineLobby}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_SUBTLE)}
            >
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_DANGER)}
              onClick={confirmLeave}
            >
              {fr.gameScreen.leave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset votes dialog ── */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className={cn(DIALOG_CLS, "max-w-md")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl text-slate-100">
              Reset des votes ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-400">
              Des joueurs ont deja vote. Cette action effacera les votes en cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_SUBTLE)}
            >
              {fr.gameScreen.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_DANGER)}
              onClick={confirmResetVotes}
            >
              {fr.planningPoker.resetVotes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
