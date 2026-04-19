export type PlanningPokerVoteSystem = "fibonacci" | "man-day" | "tshirt";

export type PokerPreparedStory = {
  id: string;
  title: string;
  description: string | null;
};

export type PlanningPokerRole = "player" | "spectator";

export type PlanningPokerPlayer = {
  socketId: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  role: PlanningPokerRole;
  hasVoted: boolean;
  vote: string | null;
};

export type PlanningPokerState = {
  phase: "lobby" | "playing";
  roomCode: string | null;
  storyTitle: string;
  voteSystem: PlanningPokerVoteSystem;
  votesOpen: boolean;
  players: PlanningPokerPlayer[];
  revealed: boolean;
  round: number;
  updatedAt: number;
  preparedStories: PokerPreparedStory[];
  currentStoryIndex: number;
};

export type PlanningPokerRoundVote = {
  playerName: string;
  avatar: number;
  value: string;
};

export type PlanningPokerRoundSummary = {
  id: string;
  round: number;
  storyTitle: string;
  voteSystem: PlanningPokerVoteSystem;
  totalVotes: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  distribution: Record<string, number>;
  votes: PlanningPokerRoundVote[];
  revealedAt: number;
};
