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
  onLeave?: () => void;
  onRoleChange: (role: PlanningPokerRole) => void;
  onVoteSystemChange: (voteSystem: PlanningPokerState["voteSystem"]) => void;
  onStoryTitleChange: (storyTitle: string) => void;
  onSelectPokerStory?: (index: number) => void;
  onSelectPokerStoryByTitle?: (storyTitle: string) => void;
  onUpdatePreparedStoryTitle?: (index: number, storyTitle: string) => void;
  onAddPreparedStory?: (storyTitle: string) => void;
  onEndSession?: () => void;
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

type SummaryRow = {
  id: string;
  roundLabel: string;
  title: string;
  totalVotes: number;
  average: string;
  median: string;
  consensus: string;
  votes: PlanningPokerRoundSummary["votes"];
};

type StoryListItem = {
  id: string;
  title: string;
  description: string | null;
  preparedIndex: number | null;
  isCurrent: boolean;
  isVoted: boolean;
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
  onSelectPokerStoryByTitle,
  onUpdatePreparedStoryTitle,
  onAddPreparedStory,
  onEndSession,
}) => {
  const hasPreparedSession = state.isPreparedSession || state.preparedStories.length > 0;
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<"stories" | "spectators" | "summary">(
    hasPreparedSession ? "stories" : "summary",
  );
  const [sidebarTab, setSidebarTab] = useState<"spectators" | "summary" | "stories">(
    hasPreparedSession ? "stories" : "summary",
  );
  const [sessionCursor, setSessionCursor] = useState(0);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false);
  const [isExportingSummaryPdf, setIsExportingSummaryPdf] = useState(false);
  const [sessionEndedAt, setSessionEndedAt] = useState<number | null>(null);
  const [storyDraft, setStoryDraft] = useState(state.storyTitle);
  const [mobileStoryEditorOpen, setMobileStoryEditorOpen] = useState(false);
  const [mobileStoryEditorDraft, setMobileStoryEditorDraft] = useState(state.storyTitle);
  const [mobileStoryEditorMode, setMobileStoryEditorMode] = useState<
    "current" | "prepared" | "history" | "new-prepared"
  >("current");
  const [mobileStoryEditorIndex, setMobileStoryEditorIndex] = useState(-1);
  const [mobileStoryEditorSourceTitle, setMobileStoryEditorSourceTitle] = useState("");
  const mobileStoryEditorInputRef = React.useRef<HTMLInputElement | null>(null);

  const votingPlayers = useMemo(
    // Exclut les joueurs hors-ligne (soft-leave / disconnect) du compteur
    // de votants : la table de vote ne les attend pas.
    () => state.players.filter((player) => player.role === "player" && player.connected !== false),
    [state.players],
  );
  const spectators = useMemo(
    () =>
      state.players.filter((player) => player.role === "spectator" && player.connected !== false),
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
  const historyByStoryTitle = useMemo(() => {
    const byStory = new Map<string, PlanningPokerRoundSummary>();
    for (const entry of historyEntries) {
      const key = entry.storyTitle?.trim();
      if (key) byStory.set(key, entry);
    }
    return byStory;
  }, [historyEntries]);
  const votedStoryTitles = useMemo(
    () => new Set(historyByStoryTitle.keys()),
    [historyByStoryTitle],
  );
  const [pendingUnvotedStory, setPendingUnvotedStory] = useState<{
    title: string;
    round: number;
  } | null>(null);
  React.useEffect(() => {
    if (hasPreparedSession) {
      setPendingUnvotedStory(null);
      return;
    }

    const normalizedCurrentTitle = state.storyTitle.trim();
    if (normalizedCurrentTitle && !votedStoryTitles.has(normalizedCurrentTitle)) {
      setPendingUnvotedStory({
        title: state.storyTitle,
        round: state.round,
      });
      return;
    }

    setPendingUnvotedStory((previous) => {
      if (!previous) return null;
      const normalizedPendingTitle = previous.title.trim();
      if (!normalizedPendingTitle) return null;
      return votedStoryTitles.has(normalizedPendingTitle) ? null : previous;
    });
  }, [hasPreparedSession, state.round, state.storyTitle, votedStoryTitles]);

  const storyListItems = useMemo<StoryListItem[]>(() => {
    const currentTitle = state.storyTitle.trim();

    if (hasPreparedSession) {
      return state.preparedStories.map((story, idx) => {
        const normalizedStoryTitle = story.title.trim();
        const isVoted = normalizedStoryTitle ? votedStoryTitles.has(normalizedStoryTitle) : false;
        return {
          id: story.id,
          title: story.title,
          description: story.description,
          preparedIndex: idx,
          isCurrent: idx === state.currentStoryIndex,
          isVoted,
        };
      });
    }

    type NonPreparedStoryItem = {
      id: string;
      title: string;
      normalizedTitle: string;
      firstRound: number;
      firstSeenOrder: number;
      isVoted: boolean;
    };

    const byStoryTitle = new Map<string, NonPreparedStoryItem>();
    let firstSeenOrder = 0;

    for (const entry of history) {
      const normalizedStoryTitle = entry.storyTitle.trim();
      if (!normalizedStoryTitle) continue;

      const existing = byStoryTitle.get(normalizedStoryTitle);
      if (!existing) {
        byStoryTitle.set(normalizedStoryTitle, {
          id: entry.id,
          title: entry.storyTitle,
          normalizedTitle: normalizedStoryTitle,
          firstRound: entry.round,
          firstSeenOrder: firstSeenOrder++,
          isVoted: true,
        });
        continue;
      }

      existing.id = entry.id;
      existing.title = entry.storyTitle;
      existing.firstRound = Math.min(existing.firstRound, entry.round);
      existing.isVoted = true;
    }

    if (pendingUnvotedStory) {
      const normalizedPendingTitle = pendingUnvotedStory.title.trim();
      if (normalizedPendingTitle && !byStoryTitle.has(normalizedPendingTitle)) {
        byStoryTitle.set(normalizedPendingTitle, {
          id: `pending-story-${pendingUnvotedStory.round}-${normalizedPendingTitle}`,
          title: pendingUnvotedStory.title,
          normalizedTitle: normalizedPendingTitle,
          firstRound: pendingUnvotedStory.round,
          firstSeenOrder: firstSeenOrder++,
          isVoted: false,
        });
      }
    }

    if (currentTitle && !byStoryTitle.has(currentTitle)) {
      byStoryTitle.set(currentTitle, {
        id: `current-story-${state.round}-${currentTitle}`,
        title: state.storyTitle,
        normalizedTitle: currentTitle,
        firstRound: state.round,
        firstSeenOrder: firstSeenOrder++,
        isVoted: false,
      });
    }

    const orderedStories = [...byStoryTitle.values()].sort((a, b) => {
      if (a.firstRound !== b.firstRound) return a.firstRound - b.firstRound;
      return a.firstSeenOrder - b.firstSeenOrder;
    });

    return orderedStories.map((story) => {
      return {
        id: story.id,
        title: story.title,
        description: null,
        preparedIndex: null,
        isCurrent: !!currentTitle && currentTitle === story.normalizedTitle,
        isVoted: story.isVoted,
      };
    });
  }, [
    hasPreparedSession,
    history,
    pendingUnvotedStory,
    state.currentStoryIndex,
    state.preparedStories,
    state.round,
    state.storyTitle,
    votedStoryTitles,
  ]);
  const archivedStorySnapshot = useMemo(() => {
    if (state.votesOpen || state.revealed) return null;
    const key = state.storyTitle.trim();
    if (!key) return null;
    return historyByStoryTitle.get(key) ?? null;
  }, [historyByStoryTitle, state.revealed, state.storyTitle, state.votesOpen]);
  const displayedVoteSystem = archivedStorySnapshot?.voteSystem ?? state.voteSystem;
  const displayedVoteStats = useMemo(
    () =>
      archivedStorySnapshot
        ? {
            totalVotes: archivedStorySnapshot.totalVotes,
            average: archivedStorySnapshot.average,
            median: archivedStorySnapshot.median,
            min: archivedStorySnapshot.min,
            max: archivedStorySnapshot.max,
            distribution: archivedStorySnapshot.distribution,
          }
        : stats,
    [archivedStorySnapshot, stats],
  );
  const displayedVotedCount = archivedStorySnapshot ? displayedVoteStats.totalVotes : votedCount;
  const displayedTotalVoters = archivedStorySnapshot
    ? Math.max(totalVoters, displayedVoteStats.totalVotes, 1)
    : totalVoters;
  const voteProgressLabel = `${displayedVotedCount}/${displayedTotalVoters}`;
  const voteProgressPct =
    displayedTotalVoters > 0 ? Math.round((displayedVotedCount / displayedTotalVoters) * 100) : 0;
  const voteEntries = useMemo(
    () => Object.entries(displayedVoteStats.distribution).sort(([, a], [, b]) => b - a),
    [displayedVoteStats.distribution],
  );
  const leadVote = voteEntries[0] ?? null;
  const consensusPct =
    leadVote && displayedVoteStats.totalVotes > 0
      ? Math.round((leadVote[1] / displayedVoteStats.totalVotes) * 100)
      : 0;
  const consensusLabel = archivedStorySnapshot
    ? "Vote deja revele"
    : state.sessionEnded
      ? "Session terminee"
      : !state.votesOpen
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
  const averageLabel = archivedStorySnapshot
    ? formatPlanningValueForSystem(displayedVoteStats.average, displayedVoteSystem)
    : state.revealed
      ? formatPlanningValueForSystem(stats.average, state.voteSystem)
      : "-";
  const medianLabel = archivedStorySnapshot
    ? formatPlanningValueForSystem(displayedVoteStats.median, displayedVoteSystem)
    : state.revealed
      ? formatPlanningValueForSystem(stats.median, state.voteSystem)
      : "-";
  const displayedRevealed = archivedStorySnapshot ? true : state.revealed;
  const displayedVotesOpen = archivedStorySnapshot ? false : state.votesOpen;
  const displayedRound = archivedStorySnapshot?.round ?? state.round;
  const tablePlayers = useMemo(() => {
    if (!archivedStorySnapshot) return votingPlayers;
    if (!Array.isArray(archivedStorySnapshot.votes) || archivedStorySnapshot.votes.length === 0) {
      return votingPlayers;
    }
    return archivedStorySnapshot.votes.map((vote, index) => ({
      socketId: `archived-${archivedStorySnapshot.id}-${index}`,
      name: vote.playerName,
      avatar: vote.avatar,
      isHost: false,
      connected: true,
      role: "player" as const,
      hasVoted: true,
      vote: vote.value || null,
    }));
  }, [archivedStorySnapshot, votingPlayers]);
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
  const summaryRows = useMemo<SummaryRow[]>(() => {
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
        votes: entry.votes ?? [],
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
      votes: votingPlayers
        .filter((player) => player.vote != null)
        .map((player) => ({
          playerName: player.name,
          avatar: player.avatar,
          value: player.vote ?? "-",
        })),
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
    votingPlayers,
  ]);

  const hostCanEndSession = isHost && !state.sessionEnded && typeof onEndSession === "function";
  const canExportSessionSummary = summaryRows.length > 0 && !isExportingSummaryPdf;

  const exportSessionSummaryPdf = React.useCallback(async () => {
    if (!summaryRows.length || isExportingSummaryPdf) return;
    setIsExportingSummaryPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const hostName = state.players.find((player) => player.isHost)?.name ?? "Hote";
      const sessionCode = state.roomCode || "-";
      const generatedAt = new Date().toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const storiesCount = summaryRows.length;
      const totalVotes =
        globalSummary?.totalVotes ?? summaryRows.reduce((acc, row) => acc + row.totalVotes, 0);
      const overallConsensus = globalSummary?.leadVote
        ? `${displayVoteValue(globalSummary.leadVote[0])} (${globalSummary.consensusPct}%)`
        : "-";
      const voteTypes = globalSummary?.voteSystemsLabel || state.voteSystem;

      const addPageBackground = (subtitle: string) => {
        pdf.setFillColor(2, 6, 23);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setDrawColor(34, 211, 238);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 3, 3, "S");

        pdf.setFillColor(8, 145, 178);
        pdf.roundedRect(margin, margin, contentWidth, 21, 3, 3, "F");
        pdf.setTextColor(236, 254, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Retro Party - Planning Party", margin + 4, margin + 8);
        pdf.setFontSize(9);
        pdf.setTextColor(186, 230, 253);
        pdf.text(subtitle, margin + 4, margin + 14);
      };

      const drawWrappedParagraph = (text: string, x: number, y: number, width: number) => {
        const lines = pdf.splitTextToSize(text, width);
        pdf.text(lines, x, y);
        return y + lines.length * 4.8;
      };

      const drawMetaCard = (
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        value: string,
        color: [number, number, number],
      ) => {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "F");
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "S");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(7.8);
        pdf.text(label, x + 3, y + 4.2);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(236, 254, 255);
        pdf.setFontSize(11.2);
        const valueLines = pdf.splitTextToSize(value, width - 6);
        pdf.text(valueLines, x + 3, y + height - 4.1);
      };

      const drawBulletSection = (
        title: string,
        items: string[],
        tone: [number, number, number],
        cursorY: number,
      ) => {
        const sectionWidth = contentWidth;
        const estimatedHeight =
          12 +
          items.reduce(
            (acc, item) =>
              acc + Math.max(1, pdf.splitTextToSize(`- ${item}`, sectionWidth - 8).length),
            0,
          ) *
            4.8;
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, cursorY, sectionWidth, estimatedHeight, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(tone[0], tone[1], tone[2]);
        pdf.text(title, margin + 4, cursorY + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(226, 232, 240);
        let itemY = cursorY + 12;
        items.forEach((item) => {
          itemY = drawWrappedParagraph(`- ${item}`, margin + 4, itemY, sectionWidth - 8);
        });
        return itemY + 2;
      };

      const drawStoryPageHeader = (cursorY: number) => {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(236, 254, 255);
        pdf.setFontSize(11);
        pdf.text("Synthese par story", margin, cursorY);
        return cursorY + 5;
      };

      const normalizePdfText = (value: string) => {
        const normalized = value
          .replace(/\r\n|\n|\r/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return normalized || "-";
      };

      const splitTextToSizeStrict = (text: string, maxWidth: number): string[] => {
        const sourceLines = pdf.splitTextToSize(text, maxWidth) as string[];
        const resolvedLines: string[] = [];

        sourceLines.forEach((rawLine) => {
          const line = `${rawLine ?? ""}`.trim();
          if (!line) {
            resolvedLines.push("-");
            return;
          }

          if (pdf.getTextWidth(line) <= maxWidth) {
            resolvedLines.push(line);
            return;
          }

          let remaining = line;
          while (remaining.length > 0) {
            let cut = remaining.length;
            while (cut > 1 && pdf.getTextWidth(remaining.slice(0, cut)) > maxWidth) {
              cut -= 1;
            }
            if (cut <= 1) {
              resolvedLines.push(remaining.slice(0, 1));
              remaining = remaining.slice(1);
              continue;
            }
            resolvedLines.push(remaining.slice(0, cut).trimEnd());
            remaining = remaining.slice(cut).trimStart();
          }
        });

        return resolvedLines.length > 0 ? resolvedLines : ["-"];
      };

      type MeasuredStoryCard = {
        cardHeight: number;
        titleLines: string[];
        statsLines: string[];
        perPersonLines: string[];
      };

      const measureStoryCard = (row: SummaryRow): MeasuredStoryCard => {
        const innerWidth = contentWidth - 8;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.2);
        const titleLines = splitTextToSizeStrict(normalizePdfText(row.title || "-"), innerWidth);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.4);
        const statsLines = splitTextToSizeStrict(
          `Moy: ${row.average}   |   Med: ${row.median}   |   Consensus: ${row.consensus}`,
          innerWidth,
        );

        const perPersonVotes = (row.votes ?? [])
          .map((vote) => {
            const player = normalizePdfText(vote.playerName || "Participant");
            return `${player}: ${displayVoteValue(vote.value || "-")}`;
          })
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.3);
        const perPersonLines = (
          perPersonVotes.length > 0
            ? perPersonVotes.flatMap((entry) => splitTextToSizeStrict(`- ${entry}`, innerWidth))
            : ["- Aucune estimation individuelle."]
        ) as string[];

        const cardHeight =
          14 +
          Math.max(1, titleLines.length) * 4.3 +
          Math.max(1, statsLines.length) * 3.9 +
          3.8 +
          Math.max(1, perPersonLines.length) * 3.9 +
          4;

        return {
          cardHeight,
          titleLines,
          statsLines,
          perPersonLines,
        };
      };

      addPageBackground("Synthese session - export atelier");
      let cursorY = margin + 26;

      const cardGap = 4;
      const halfCardWidth = (contentWidth - cardGap) / 2;
      drawMetaCard(margin, cursorY, halfCardWidth, 16, "CODE SESSION", sessionCode, [56, 189, 248]);
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "HOTE",
        hostName,
        [34, 197, 94],
      );
      cursorY += 18;
      drawMetaCard(
        margin,
        cursorY,
        halfCardWidth,
        16,
        "STORIES VOTEES",
        `${storiesCount}`,
        [14, 165, 233],
      );
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "VOTES EXPRIMES",
        `${totalVotes}`,
        [250, 204, 21],
      );
      cursorY += 18;
      drawMetaCard(
        margin,
        cursorY,
        halfCardWidth,
        16,
        "CONSENSUS GLOBAL",
        overallConsensus,
        [125, 211, 252],
      );
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "TYPE DE VOTE",
        voteTypes,
        [167, 139, 250],
      );
      cursorY += 18;
      drawMetaCard(margin, cursorY, contentWidth, 13.5, "GENERE LE", generatedAt, [125, 211, 252]);
      cursorY += 17;

      cursorY = drawBulletSection(
        "Resume session",
        [
          `Stories votees: ${storiesCount}`,
          `Votes exprimes: ${totalVotes}`,
          `Consensus global: ${overallConsensus}`,
          `Types de vote utilises: ${voteTypes}`,
          state.sessionEnded
            ? "Session cloturee (lecture seule active)."
            : "Session toujours en cours.",
        ],
        [56, 189, 248],
        cursorY,
      );

      cursorY += 2;
      cursorY = drawStoryPageHeader(cursorY);

      const drawStoryCard = (row: SummaryRow, y: number, measured: MeasuredStoryCard) => {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, y, contentWidth, measured.cardHeight, 3, 3, "F");
        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, y, contentWidth, measured.cardHeight, 3, 3, "S");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(row.roundLabel, margin + 3, y + 4.8);
        pdf.text(`${row.totalVotes} votes`, margin + contentWidth - 3, y + 4.8, { align: "right" });

        let rowCursorY = y + 9.2;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.2);
        pdf.setTextColor(236, 254, 255);
        pdf.text(measured.titleLines, margin + 3, rowCursorY);
        rowCursorY += Math.max(1, measured.titleLines.length) * 4.3 + 0.7;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.4);
        pdf.setTextColor(186, 230, 253);
        pdf.text(measured.statsLines, margin + 3, rowCursorY);
        rowCursorY += Math.max(1, measured.statsLines.length) * 3.9 + 1.1;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.2);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Estimations par personne", margin + 3, rowCursorY);
        rowCursorY += 3.6;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.3);
        pdf.setTextColor(226, 232, 240);
        pdf.text(measured.perPersonLines, margin + 3, rowCursorY);

        return measured.cardHeight;
      };

      for (const row of summaryRows) {
        const measured = measureStoryCard(row);
        if (cursorY + measured.cardHeight > pageHeight - margin) {
          pdf.addPage();
          addPageBackground("Details stories");
          cursorY = drawStoryPageHeader(margin + 27);
        }
        cursorY += drawStoryCard(row, cursorY, measured) + 2;
      }

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `planning-party-synthese-${(state.roomCode || "session").toLowerCase()}-${stamp}.pdf`;
      pdf.save(filename);
    } catch (error) {
      // Keep silent in UI and log for debugging.
      console.error("planning-poker summary pdf export failed", error);
    } finally {
      setIsExportingSummaryPdf(false);
    }
  }, [
    globalSummary,
    isExportingSummaryPdf,
    state.players,
    state.roomCode,
    state.sessionEnded,
    state.voteSystem,
    summaryRows,
  ]);

  const requestEndSession = () => {
    if (!hostCanEndSession) return;
    setEndSessionDialogOpen(true);
  };

  const confirmEndSession = () => {
    if (!hostCanEndSession) return;
    onEndSession?.();
    setEndSessionDialogOpen(false);
  };

  const requestLeave = () => {
    if (!onLeave) return;
    setMobileActionsOpen(false);
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave?.();
  };

  const requestResetVotes = () => {
    if (!isHost || state.sessionEnded) return;
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

  const hostMainActionLabel = state.sessionEnded
    ? "Session terminee"
    : state.revealed
      ? "Vote suivant"
      : !state.votesOpen
        ? "Lancer les votes"
        : fr.planningPoker.revealVotes;
  const hostMainActionShortLabel = state.sessionEnded
    ? "Terminee"
    : state.revealed
      ? "Suivant"
      : !state.votesOpen
        ? "Lancer"
        : "Reveler";
  const handleHostMainAction = state.sessionEnded
    ? () => {}
    : state.revealed
      ? requestResetVotes
      : state.votesOpen
        ? onRevealVotes
        : onOpenVotes;

  const submitStoryTitle = React.useCallback(() => {
    if (!isHost || state.sessionEnded) return;
    const normalized = storyDraft.trim();
    if (!normalized || normalized === state.storyTitle) return;
    onStoryTitleChange(normalized);
  }, [isHost, onStoryTitleChange, state.sessionEnded, state.storyTitle, storyDraft]);

  const canEditPreparedStories =
    isHost && !state.sessionEnded && typeof onUpdatePreparedStoryTitle === "function";
  const canAddPreparedStories =
    isHost && !state.sessionEnded && hasPreparedSession && typeof onAddPreparedStory === "function";

  const openPreparedStoryEditor = React.useCallback(
    (index: number) => {
      if (!canEditPreparedStories) return;
      const story = state.preparedStories[index];
      if (!story) return;
      setMobileStoryEditorMode("prepared");
      setMobileStoryEditorIndex(index);
      setMobileStoryEditorSourceTitle(story.title);
      setMobileStoryEditorDraft(story.title);
      setMobileStoryEditorOpen(true);
    },
    [canEditPreparedStories, state.preparedStories],
  );

  const openNewPreparedStoryEditor = React.useCallback(() => {
    if (!canAddPreparedStories) return;
    setMobileStoryEditorMode("new-prepared");
    setMobileStoryEditorIndex(-1);
    setMobileStoryEditorSourceTitle("");
    setMobileStoryEditorDraft("");
    setMobileStoryEditorOpen(true);
  }, [canAddPreparedStories]);

  const canEditHistoryStories =
    isHost &&
    !state.sessionEnded &&
    typeof onStoryTitleChange === "function" &&
    typeof onSelectPokerStoryByTitle === "function";

  const openHistoryStoryEditor = React.useCallback(
    (storyTitle: string) => {
      if (!canEditHistoryStories) return;
      const normalized = typeof storyTitle === "string" ? storyTitle.trim() : "";
      if (!normalized) return;
      setMobileStoryEditorMode("history");
      setMobileStoryEditorIndex(-1);
      setMobileStoryEditorSourceTitle(normalized);
      setMobileStoryEditorDraft(normalized);
      setMobileStoryEditorOpen(true);
    },
    [canEditHistoryStories],
  );

  const saveMobileStoryEditor = React.useCallback(() => {
    if (!isHost || state.sessionEnded) return;
    const normalized = mobileStoryEditorDraft.trim();
    if (!normalized) {
      setMobileStoryEditorOpen(false);
      setMobileActionsOpen(false);
      return;
    }
    if (mobileStoryEditorMode === "prepared") {
      const targetStory = state.preparedStories[mobileStoryEditorIndex];
      if (targetStory && normalized !== targetStory.title) {
        onUpdatePreparedStoryTitle?.(mobileStoryEditorIndex, normalized);
      }
      if (state.currentStoryIndex === mobileStoryEditorIndex) {
        setStoryDraft(normalized);
      }
    } else if (mobileStoryEditorMode === "new-prepared") {
      onAddPreparedStory?.(normalized);
    } else if (mobileStoryEditorMode === "history") {
      const sourceTitle = mobileStoryEditorSourceTitle.trim();
      if (sourceTitle && normalized !== sourceTitle) {
        if (sourceTitle !== state.storyTitle.trim()) {
          onSelectPokerStoryByTitle?.(sourceTitle);
        }
        onStoryTitleChange(normalized);
        setStoryDraft(normalized);
      }
    } else if (normalized !== state.storyTitle) {
      onStoryTitleChange(normalized);
      setStoryDraft(normalized);
    }
    setMobileStoryEditorOpen(false);
    setMobileActionsOpen(false);
  }, [
    isHost,
    mobileStoryEditorDraft,
    mobileStoryEditorIndex,
    mobileStoryEditorMode,
    mobileStoryEditorSourceTitle,
    onAddPreparedStory,
    onSelectPokerStoryByTitle,
    onStoryTitleChange,
    onUpdatePreparedStoryTitle,
    state.currentStoryIndex,
    state.preparedStories,
    state.sessionEnded,
    state.storyTitle,
  ]);

  const handleDeckVote = React.useCallback(
    (value: string) => {
      if (state.sessionEnded || state.revealed || !state.votesOpen) return;
      onVoteCard(myVote === value ? "" : value);
    },
    [myVote, onVoteCard, state.revealed, state.sessionEnded, state.votesOpen],
  );

  React.useEffect(() => {
    setStoryDraft(state.storyTitle);
  }, [state.storyTitle]);

  React.useEffect(() => {
    setSessionCursor(0);
  }, [state.round, state.storyTitle]);

  React.useEffect(() => {
    if (!state.sessionEnded) return;
    setSidebarTab("summary");
    setMobileMenuTab("summary");
    setSessionSummaryOpen(true);
    setSessionEndedAt((previous) => previous ?? state.updatedAt);
  }, [state.sessionEnded, state.updatedAt]);

  React.useEffect(() => {
    if (state.sessionEnded) return;
    setSessionEndedAt(null);
  }, [state.sessionEnded]);

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

      if (myRole === "player" && !state.sessionEnded && !state.revealed && state.votesOpen) {
        const voteIndex = DECK_SHORTCUT_KEYS.indexOf(event.key);
        if (voteIndex >= 0 && voteIndex < activeDeck.length) {
          event.preventDefault();
          handleDeckVote(activeDeck[voteIndex]);
          return;
        }
      }

      if (!isHost) return;
      if (state.sessionEnded) return;
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
    state.sessionEnded,
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
              {onLeave ? (
                <Button
                  className={cn(
                    "hidden xl:inline-flex h-9 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-200",
                  )}
                  variant="secondary"
                  onClick={requestLeave}
                >
                  {fr.gameScreen.leaveGame}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {state.sessionEnded ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 sm:text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-[0.08em] text-emerald-200">
                Session terminee
              </span>
              <span className="text-[11px] text-emerald-200/80">
                Cloture le {new Date(sessionEndedAt ?? state.updatedAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-200/85 sm:text-xs">
              Les votes sont figes. Consulte la synthese et exporte-la en PDF.
            </div>
          </div>
        ) : null}

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
              players={tablePlayers}
              revealed={displayedRevealed}
              votesOpen={displayedVotesOpen}
              storyTitle={state.storyTitle}
              round={displayedRound}
              voteSystem={displayedVoteSystem}
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
                              disabled={state.sessionEnded || state.revealed || !state.votesOpen}
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
                          disabled={state.sessionEnded || state.revealed || !state.votesOpen}
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
                {isHost && !state.sessionEnded ? (
                  <div className="flex min-w-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-slate-900/55 p-1">
                    {VOTE_SYSTEM_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={state.sessionEnded}
                        onClick={() => onVoteSystemChange(option.value)}
                        className={cn(
                          "h-7 min-w-0 rounded px-2 text-[11px] transition-colors",
                          state.voteSystem === option.value
                            ? "bg-indigo-500 text-white"
                            : "bg-transparent text-slate-300 hover:bg-white/[0.06]",
                          state.sessionEnded
                            ? "cursor-not-allowed opacity-50 hover:bg-transparent"
                            : "",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                {isHost && state.revealed && !state.sessionEnded ? (
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
                  disabled={!isHost || state.sessionEnded}
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
            <div className={cn("mb-2 grid w-full gap-1.5", "grid-cols-3")}>
              {(["stories", "spectators", "summary"] as const).map((tab) => (
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
                    : tab === "stories"
                      ? `Stories (${storyListItems.length})`
                      : "Synthese"}
                </button>
              ))}
            </div>

            {sidebarTab === "stories" ? (
              <div className="grid min-h-0 gap-1.5 overflow-auto pr-1">
                {canAddPreparedStories ? (
                  <button
                    type="button"
                    onClick={openNewPreparedStoryEditor}
                    className="flex h-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-[11px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
                  >
                    + Ajouter une story
                  </button>
                ) : null}
                {storyListItems.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                    {hasPreparedSession
                      ? "Aucune story pour le moment."
                      : "Aucune story votée pour le moment."}
                  </div>
                ) : (
                  storyListItems.map((story, idx) => {
                    const isCurrent = story.isCurrent;
                    const isDone = !isCurrent && story.isVoted;
                    const canSelectStory =
                      isHost &&
                      !state.sessionEnded &&
                      (story.preparedIndex !== null
                        ? typeof onSelectPokerStory === "function"
                        : typeof onSelectPokerStoryByTitle === "function");
                    const canEditStory =
                      !state.sessionEnded &&
                      (story.preparedIndex !== null
                        ? canEditPreparedStories
                        : canEditHistoryStories);
                    return (
                      <div
                        key={story.id}
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
                        <button
                          type="button"
                          disabled={!canSelectStory || isCurrent}
                          onClick={() => {
                            if (story.preparedIndex != null) {
                              onSelectPokerStory?.(story.preparedIndex);
                              return;
                            }
                            onSelectPokerStoryByTitle?.(story.title);
                          }}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed"
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
                        </button>
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          {canEditStory ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (story.preparedIndex !== null) {
                                  openPreparedStoryEditor(story.preparedIndex);
                                  return;
                                }
                                openHistoryStoryEditor(story.title);
                              }}
                              className="h-6 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 text-[10px] font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
                            >
                              Renommer
                            </button>
                          ) : null}
                          {isCurrent && (
                            <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                              En cours
                            </span>
                          )}
                          {story.isVoted && (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                              Voté
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
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
                <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className={cn("h-8 rounded-xl border text-[11px] font-semibold", CTA_SUBTLE)}
                    disabled={!canExportSessionSummary}
                    onClick={exportSessionSummaryPdf}
                  >
                    {isExportingSummaryPdf ? "Export PDF..." : "Exporter la synthese (PDF)"}
                  </Button>
                  {hostCanEndSession ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className={cn("h-8 rounded-xl border text-[11px] font-semibold", CTA_DANGER)}
                      onClick={requestEndSession}
                    >
                      Terminer la session
                    </Button>
                  ) : state.sessionEnded ? (
                    <div className="inline-flex h-8 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      Session terminee
                    </div>
                  ) : null}
                </div>
                {summaryRows.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-400">
                    Aucune story votee pour le moment.
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
                {!selectedSession?.isCurrent && isHost && !state.sessionEnded ? (
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
            <div className={cn("grid gap-2", isHost ? "grid-cols-3" : "grid-cols-2")}>
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
                      setMobileMenuTab("stories");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Menu
                  </Button>
                  <Button
                    variant="secondary"
                    className={cn(MOBILE_BTN, "rounded-xl border text-xs font-bold", CTA_PRIMARY)}
                    disabled={state.sessionEnded}
                    onClick={handleHostMainAction}
                  >
                    {hostMainActionLabel}
                  </Button>
                  {onLeave ? (
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
                  ) : null}
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
                      setMobileMenuTab("stories");
                      setMobileActionsOpen(true);
                    }}
                  >
                    Menu
                  </Button>
                  {onLeave ? (
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
                  ) : null}
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
            <DrawerTitle className="text-slate-100">Menu</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-slate-900/55 p-1">
              {(["stories", "spectators", "summary"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMobileMenuTab(tab)}
                  className={cn(
                    "h-8 rounded px-2 text-[11px] transition-colors",
                    mobileMenuTab === tab
                      ? tab === "stories"
                        ? "bg-violet-500 text-white"
                        : "bg-indigo-500 text-white"
                      : "bg-transparent text-slate-300 hover:bg-white/[0.06]",
                  )}
                >
                  {tab === "stories"
                    ? "Stories"
                    : tab === "spectators"
                      ? "Spectateurs"
                      : "Synthese"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid max-h-[72vh] gap-2 overflow-y-auto px-4 pb-4">
            {mobileMenuTab === "stories" ? (
              <div className="grid gap-1.5">
                {canAddPreparedStories ? (
                  <button
                    type="button"
                    onClick={openNewPreparedStoryEditor}
                    className="flex h-8 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-[11px] font-semibold text-violet-200"
                  >
                    + Ajouter une story
                  </button>
                ) : null}
                {storyListItems.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                    {hasPreparedSession
                      ? "Aucune story pour le moment."
                      : "Aucune story votée pour le moment."}
                  </div>
                ) : (
                  storyListItems.map((story, idx) => {
                    const isCurrent = story.isCurrent;
                    const isDone = !isCurrent && story.isVoted;
                    const canSelectStory =
                      isHost &&
                      !state.sessionEnded &&
                      (story.preparedIndex !== null
                        ? typeof onSelectPokerStory === "function"
                        : typeof onSelectPokerStoryByTitle === "function");
                    const canEditStory =
                      !state.sessionEnded &&
                      (story.preparedIndex !== null
                        ? canEditPreparedStories
                        : canEditHistoryStories);
                    return (
                      <div
                        key={story.id}
                        className={cn(
                          "flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs",
                          isCurrent
                            ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                            : isDone
                              ? "border-white/[0.04] bg-white/[0.01] text-slate-600 line-through"
                              : "border-white/[0.06] bg-white/[0.02] text-slate-300",
                        )}
                      >
                        <button
                          type="button"
                          disabled={!canSelectStory || isCurrent}
                          onClick={() => {
                            if (story.preparedIndex != null) {
                              onSelectPokerStory?.(story.preparedIndex);
                            } else {
                              onSelectPokerStoryByTitle?.(story.title);
                            }
                            setMobileActionsOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed"
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
                        </button>
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          {canEditStory ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (story.preparedIndex !== null) {
                                  openPreparedStoryEditor(story.preparedIndex);
                                  return;
                                }
                                openHistoryStoryEditor(story.title);
                              }}
                              className="h-6 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 text-[10px] font-semibold text-violet-200"
                            >
                              Renommer
                            </button>
                          ) : null}
                          {isCurrent && (
                            <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-300">
                              En cours
                            </span>
                          )}
                          {story.isVoted && (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                              Voté
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

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
            ) : null}

            {mobileMenuTab === "summary" ? (
              <div className={cn("grid gap-2 rounded-xl p-2 text-xs", SUBPANEL)}>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Synthese des votes</span>
                  <span className="text-[11px] text-slate-500">{summaryRows.length} lignes</span>
                </div>
                <div className="grid gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className={cn("h-8 rounded-xl border text-[11px] font-semibold", CTA_SUBTLE)}
                    disabled={!canExportSessionSummary}
                    onClick={exportSessionSummaryPdf}
                  >
                    {isExportingSummaryPdf ? "Export PDF..." : "Exporter la synthese (PDF)"}
                  </Button>
                  {hostCanEndSession ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className={cn("h-8 rounded-xl border text-[11px] font-semibold", CTA_DANGER)}
                      onClick={requestEndSession}
                    >
                      Terminer la session
                    </Button>
                  ) : state.sessionEnded ? (
                    <div className="inline-flex h-8 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      Session terminee
                    </div>
                  ) : null}
                </div>
                {summaryRows.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2 py-1.5 text-xs text-slate-400">
                    Aucune story votee pour le moment.
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
                          <span className="text-[10px] text-slate-400">{row.totalVotes} votes</span>
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
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Session summary dialog ── */}
      <AlertDialog
        open={sessionSummaryOpen && state.sessionEnded}
        onOpenChange={setSessionSummaryOpen}
      >
        <AlertDialogContent className={cn(DIALOG_CLS, "max-w-2xl")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-lg text-slate-100">
              Synthese de session
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-slate-400">
              Session terminee. Les votes sont figes et la synthese est disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid max-h-[60vh] gap-2 overflow-auto rounded-xl border border-white/[0.06] bg-slate-950/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Stories estimees: {summaryRows.length}</span>
              {globalSummary ? (
                <span className="text-xs text-slate-400">
                  Votes exprimes: {globalSummary.totalVotes}
                </span>
              ) : null}
            </div>
            {summaryRows.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2 text-xs text-slate-400">
                Aucune story votee pour le moment.
              </div>
            ) : (
              summaryRows.map((row) => (
                <div
                  key={`session-summary-dialog-${row.id}`}
                  className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">{row.roundLabel}</span>
                    <span className="text-[10px] text-slate-400">{row.totalVotes} votes</span>
                  </div>
                  <div className="truncate text-sm font-semibold text-slate-100">{row.title}</div>
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
              ))
            )}
          </div>
          <AlertDialogFooter className="mt-0 grid grid-cols-2 gap-2 sm:space-x-0">
            <Button
              variant="secondary"
              className={cn(MOBILE_BTN, "rounded-xl border text-xs font-semibold", CTA_SUBTLE)}
              onClick={() => setSessionSummaryOpen(false)}
            >
              Fermer
            </Button>
            <Button
              variant="secondary"
              className={cn(MOBILE_BTN, "rounded-xl border text-xs font-bold", CTA_PRIMARY)}
              disabled={!canExportSessionSummary}
              onClick={exportSessionSummaryPdf}
            >
              {isExportingSummaryPdf ? "Export PDF..." : "Exporter la synthese (PDF)"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── End session dialog ── */}
      <AlertDialog open={endSessionDialogOpen} onOpenChange={setEndSessionDialogOpen}>
        <AlertDialogContent className={cn(DIALOG_CLS, "max-w-md")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl text-slate-100">
              Terminer cette session de vote ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-400">
              Les votes seront figes. Vous pourrez consulter la synthese et l&apos;exporter en PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_SUBTLE)}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn("h-11 w-full rounded-xl border text-sm font-semibold", CTA_DANGER)}
              onClick={confirmEndSession}
            >
              Oui, terminer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Story editor dialog ── */}
      <AlertDialog open={mobileStoryEditorOpen} onOpenChange={setMobileStoryEditorOpen}>
        <AlertDialogContent
          className={cn(DIALOG_CLS, "max-w-md")}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            mobileStoryEditorInputRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-300/90">
              {mobileStoryEditorMode === "prepared"
                ? "Modification d'une story"
                : mobileStoryEditorMode === "new-prepared"
                  ? "Ajout d'une story"
                  : mobileStoryEditorMode === "history"
                    ? "Modification d'une story de la liste"
                    : "Configuration du vote en cours"}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              {mobileStoryEditorMode === "prepared"
                ? "Edition du nom d'une story preparee"
                : mobileStoryEditorMode === "new-prepared"
                  ? "Ajout d'une story dans la liste preparee"
                  : mobileStoryEditorMode === "history"
                    ? "Edition du nom d'une story de la liste"
                    : "Edition du nom de la story en cours"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950 p-3">
            <div className="text-sm font-semibold text-slate-100">
              {mobileStoryEditorMode === "prepared"
                ? "Renommer la story de la liste"
                : mobileStoryEditorMode === "new-prepared"
                  ? "Ajouter une story a la liste"
                  : mobileStoryEditorMode === "history"
                    ? "Renommer la story de la liste"
                    : "Renommer la story en cours"}
            </div>
            <input
              ref={mobileStoryEditorInputRef}
              type="text"
              value={mobileStoryEditorDraft}
              onChange={(event) => setMobileStoryEditorDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveMobileStoryEditor();
              }}
              className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-indigo-400/50 transition"
              placeholder="Nom de la story"
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
