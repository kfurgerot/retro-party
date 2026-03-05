// Game Types for Rétro Party (Retro board game for retrospectives)

export interface Player {
  id: string;
  name: string;
  avatar: number;
  position: number;
  positionNodeId?: string;
  lastPosition?: number;
  /** Board points used for Kudobox purchases */
  points: number;
  /** Kudobox / bonus stars */
  stars: number;
  skipNextTurn: boolean;
  color: string;
  isHost?: boolean;
}

export type TileType =
  | 'blue'
  | 'red'
  | 'green'
  | 'purple'
  | 'yellow'
  | 'star'
  | 'start'
  | 'violet'
  | 'bonus';

export interface Tile {
  id: number;
  type: TileType;
  color?: 'blue' | 'green' | 'purple' | 'red' | 'yellow';
  label?: string;
  x: number;
  y: number;
  gridX?: number;
  gridY?: number;
  nextTileIds?: number[];
}

export interface PendingPathChoice {
  playerId: string;
  atTileId: number;
  options: number[];
  remainingSteps: number;
}

export interface PendingKudoPurchase {
  playerId: string;
  atTileId: number;
  remainingSteps: number;
  cost: number;
  canAfford: boolean;
}

export interface MoveTrace {
  id: string;
  playerId: string;
  path: number[];
  pointDeltas: number[];
}

export interface QuestionState {
  id: string;
  type: 'blue' | 'red' | 'green' | 'purple' | 'violet' | 'bonus';
  text: string;
  targetPlayerId: string;
  votes: { up: string[]; down: string[] };
  status: 'pending' | 'open';
  startAt?: number;
  endsAt?: number;
  durationMs?: number;
  nextMinigame?: "BUG_SMASH" | null;
}

export interface QuestionSummary {
  id: string;
  type: 'blue' | 'red' | 'green' | 'purple' | 'violet' | 'bonus';
  text: string;
  upVotes: number;
  downVotes: number;
}

export interface BugSmashState {
  minigameId: "BUG_SMASH";
  targetPlayerId: string;
  startAt: number;
  durationMs: number;
  score: number;
}

export type BuzzwordCategory = "LEGIT" | "BULLSHIT";

export interface BuzzwordDuelTransfer {
  winnerId: string;
  loserId: string;
  amount: number;
  startedAt: number;
}

export interface BuzzwordDuelState {
  minigameId: "BUZZWORD_DUEL";
  duelists: [string, string];
  phase: "word" | "between" | "sudden_death" | "transfer";
  roundType: "main" | "sudden_death";
  totalWords: number;
  currentWordIndex: number;
  suddenDeathRound: number;
  wordText: string;
  isDouble: boolean;
  wordStartedAt: number;
  wordEndsAt: number;
  nextWordAt: number | null;
  scores: Record<string, number>;
  submittedPlayerIds: string[];
  transfer: BuzzwordDuelTransfer | null;
}

export type ActiveMinigameState = BugSmashState | BuzzwordDuelState;

export interface GameState {
  phase: 'lobby' | 'playing' | 'results';
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  maxRounds: number;

  board?: { seed: number; cols: number; rows: number; length: number };
  tiles: Tile[];

  diceValue: number | null;
  isRolling: boolean;

  currentQuestion: QuestionState | null;
  currentMinigame: ActiveMinigameState | null;
  pendingPathChoice: PendingPathChoice | null;
  pendingKudoPurchase: PendingKudoPurchase | null;
  lastMoveTrace: MoveTrace | null;
  questionHistory: QuestionSummary[];
}

export type WhoSaidItRole =
  | "MANAGER"
  | "PO"
  | "DEV"
  | "SCRUM_MASTER"
  | "QA_SUPPORT";

export interface WhoSaidItRoundStartPayload {
  roundIndex: number;
  totalRounds: number;
  quoteId: string;
  text: string;
  endsAtServerTs: number;
}

export interface WhoSaidItRoundRevealPayload {
  roundIndex: number;
  answerRole: WhoSaidItRole;
  distribution: Record<WhoSaidItRole, number>;
  winners: string[];
  pointsDelta: Record<string, number>;
}

export interface WhoSaidItSummaryPayload {
  pointsGained: Record<string, number>;
}

export interface WhoSaidItViewState {
  minigameId: "WHO_SAID_IT";
  totalRounds: number;
  phase: "idle" | "answer" | "reveal" | "done";
  roundIndex: number;
  quoteId: string | null;
  quoteText: string;
  endsAtServerTs: number | null;
  selectedRole: WhoSaidItRole | null;
  answerRole: WhoSaidItRole | null;
  distribution: Record<WhoSaidItRole, number>;
  winners: string[];
  pointsDelta: Record<string, number>;
  summary: WhoSaidItSummaryPayload | null;
}

export const AVATARS = [
  "🧙", "🧝", "🧛", "🧟", "🧞",
  "🧑‍🚀", "🧑‍🎤", "🧑‍🍳", "🧑‍🔧", "🧑‍🎨",
  "🥷", "🤠", "👾", "🤖", "🐉",
  "🦊", "🐼", "🐸",
] as const;
