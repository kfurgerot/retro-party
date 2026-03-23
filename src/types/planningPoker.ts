export type PlanningPokerVoteSystem = "fibonacci" | "man-day" | "tshirt";

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
  voteSystem: PlanningPokerVoteSystem;
  players: PlanningPokerPlayer[];
  revealed: boolean;
  round: number;
  updatedAt: number;
};
