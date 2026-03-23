import { PlanningPokerPlayer, PlanningPokerVoteSystem } from "@/types/planningPoker";

export const PLANNING_POKER_DECKS: Record<PlanningPokerVoteSystem, string[]> = {
  fibonacci: ["0", "0.5", "1", "2", "3", "5", "8", "13", "21", "34", "55", "?", "?"],
  "man-day": ["0.5", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "?"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "?"],
};

const TSHIRT_SCALE: Record<string, number> = {
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
};

const toNumberVote = (value: string, voteSystem: PlanningPokerVoteSystem): number | null => {
  if (voteSystem === "tshirt") {
    return TSHIRT_SCALE[value] ?? null;
  }

  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const toSortedNumericVotes = (players: PlanningPokerPlayer[], voteSystem: PlanningPokerVoteSystem) => {
  const numbers = players
    .map((player) => (player.vote ? toNumberVote(player.vote, voteSystem) : null))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  return numbers;
};

export const computePlanningPokerStats = (
  players: PlanningPokerPlayer[],
  voteSystem: PlanningPokerVoteSystem
) => {
  const votedPlayers = players.filter((player) => player.role === "player" && player.vote != null);
  const numericVotes = toSortedNumericVotes(votedPlayers, voteSystem);

  const min = numericVotes.length > 0 ? numericVotes[0] : null;
  const max = numericVotes.length > 0 ? numericVotes[numericVotes.length - 1] : null;
  const average =
    numericVotes.length > 0
      ? numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length
      : null;

  const median =
    numericVotes.length === 0
      ? null
      : numericVotes.length % 2 === 1
      ? numericVotes[Math.floor(numericVotes.length / 2)]
      : (numericVotes[numericVotes.length / 2 - 1] + numericVotes[numericVotes.length / 2]) / 2;

  const distribution = votedPlayers.reduce<Record<string, number>>((acc, player) => {
    const value = player.vote ?? "?";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalVotes: votedPlayers.length,
    average,
    median,
    min,
    max,
    distribution,
  };
};

export const formatPlanningValue = (value: number | null) => {
  if (value == null) return "-";
  const fixed = Number(value.toFixed(2));
  return Number.isInteger(fixed) ? String(fixed) : fixed.toString();
};
