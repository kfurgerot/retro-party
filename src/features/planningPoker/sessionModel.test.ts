import { describe, expect, it } from "vitest";
import type { PlanningPokerRoundSummary } from "@/types/planningPoker";
import {
  buildHistoryByStoryTitle,
  buildPlanningPokerHistoryEntries,
  buildPlanningPokerStoryListItems,
} from "./sessionModel";

function summary(
  id: string,
  storyTitle: string,
  round: number,
  revealedAt: number,
): PlanningPokerRoundSummary {
  return {
    id,
    storyTitle,
    round,
    voteSystem: "fibonacci",
    totalVotes: 1,
    average: 3,
    median: 3,
    min: 3,
    max: 3,
    distribution: { "3": 1 },
    votes: [{ playerName: "Ada", avatar: 0, value: "3" }],
    revealedAt,
  };
}

describe("planning poker session model", () => {
  it("keeps the latest vote per story and sorts numbered stories descending", () => {
    const entries = buildPlanningPokerHistoryEntries([
      summary("old", "Story 1", 1, 100),
      summary("latest", "Story 1", 2, 200),
      summary("second", "Story 2", 3, 150),
    ]);

    expect(entries.map((entry) => entry.id)).toEqual(["second", "latest"]);
  });

  it("indexes history entries by normalized story title", () => {
    const entries = buildHistoryByStoryTitle([summary("vote-1", " Story A ", 1, 100)]);

    expect(entries.get("Story A")?.id).toBe("vote-1");
  });

  it("builds prepared story items with current and voted state", () => {
    const items = buildPlanningPokerStoryListItems({
      hasPreparedSession: true,
      preparedStories: [
        { id: "p1", title: "Story A", description: "First" },
        { id: "p2", title: "Story B", description: null },
      ],
      currentStoryIndex: 1,
      storyTitle: "Story B",
      round: 2,
      history: [],
      pendingUnvotedStory: null,
      votedStoryTitles: new Set(["Story A"]),
    });

    expect(items).toEqual([
      {
        id: "p1",
        title: "Story A",
        description: "First",
        preparedIndex: 0,
        isCurrent: false,
        isVoted: true,
      },
      {
        id: "p2",
        title: "Story B",
        description: null,
        preparedIndex: 1,
        isCurrent: true,
        isVoted: false,
      },
    ]);
  });

  it("builds non-prepared story items from history, pending story and current story", () => {
    const items = buildPlanningPokerStoryListItems({
      hasPreparedSession: false,
      preparedStories: [],
      currentStoryIndex: 0,
      storyTitle: "Current",
      round: 3,
      history: [summary("voted", "Voted", 1, 100)],
      pendingUnvotedStory: { title: "Pending", round: 2 },
      votedStoryTitles: new Set(["Voted"]),
    });

    expect(items.map((item) => [item.title, item.isVoted, item.isCurrent])).toEqual([
      ["Voted", true, false],
      ["Pending", false, false],
      ["Current", false, true],
    ]);
  });
});
