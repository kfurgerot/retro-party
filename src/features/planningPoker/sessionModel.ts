import type { PlanningPokerRoundSummary, PlanningPokerState } from "@/types/planningPoker";

export type PendingUnvotedStory = {
  title: string;
  round: number;
};

export type StoryListItem = {
  id: string;
  title: string;
  description: string | null;
  preparedIndex: number | null;
  isCurrent: boolean;
  isVoted: boolean;
};

function parseStoryIndex(title: string) {
  const match = title.match(/(\d+)\s*$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function buildPlanningPokerHistoryEntries(history: PlanningPokerRoundSummary[]) {
  const byStory = new Map<string, PlanningPokerRoundSummary>();
  for (const entry of history) {
    const key = entry.storyTitle?.trim() || `Vote #${entry.round}`;
    byStory.set(key, entry);
  }

  return [...byStory.values()].sort((a, b) => {
    const indexA = parseStoryIndex(a.storyTitle || "");
    const indexB = parseStoryIndex(b.storyTitle || "");
    if (indexA !== indexB) return indexB - indexA;
    return (b.revealedAt ?? 0) - (a.revealedAt ?? 0);
  });
}

export function buildHistoryByStoryTitle(historyEntries: PlanningPokerRoundSummary[]) {
  const byStory = new Map<string, PlanningPokerRoundSummary>();
  for (const entry of historyEntries) {
    const key = entry.storyTitle?.trim();
    if (key) byStory.set(key, entry);
  }
  return byStory;
}

export function buildPlanningPokerStoryListItems({
  hasPreparedSession,
  preparedStories,
  currentStoryIndex,
  storyTitle,
  round,
  history,
  pendingUnvotedStory,
  votedStoryTitles,
}: {
  hasPreparedSession: boolean;
  preparedStories: PlanningPokerState["preparedStories"];
  currentStoryIndex: number;
  storyTitle: string;
  round: number;
  history: PlanningPokerRoundSummary[];
  pendingUnvotedStory: PendingUnvotedStory | null;
  votedStoryTitles: Set<string>;
}): StoryListItem[] {
  const currentTitle = storyTitle.trim();

  if (hasPreparedSession) {
    return preparedStories.map((story, index) => {
      const normalizedStoryTitle = story.title.trim();
      const isVoted = normalizedStoryTitle ? votedStoryTitles.has(normalizedStoryTitle) : false;
      return {
        id: story.id,
        title: story.title,
        description: story.description,
        preparedIndex: index,
        isCurrent: index === currentStoryIndex,
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
      id: `current-story-${round}-${currentTitle}`,
      title: storyTitle,
      normalizedTitle: currentTitle,
      firstRound: round,
      firstSeenOrder: firstSeenOrder++,
      isVoted: false,
    });
  }

  const orderedStories = [...byStoryTitle.values()].sort((a, b) => {
    if (a.firstRound !== b.firstRound) return a.firstRound - b.firstRound;
    return a.firstSeenOrder - b.firstSeenOrder;
  });

  return orderedStories.map((story) => ({
    id: story.id,
    title: story.title,
    description: null,
    preparedIndex: null,
    isCurrent: !!currentTitle && currentTitle === story.normalizedTitle,
    isVoted: story.isVoted,
  }));
}
