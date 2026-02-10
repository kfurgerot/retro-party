// Game Types for Rétro Party (Retro board game for retrospectives)

export interface Player {
  id: string;
  name: string;
  avatar: number;
  position: number;
  /** Kudobox / bonus stars */
  stars: number;
  skipNextTurn: boolean;
  color: string;
  isHost?: boolean;
}

export type TileType = 'blue' | 'red' | 'green' | 'violet' | 'bonus' | 'start';

export interface Tile {
  id: number;
  type: TileType;
  x: number;
  y: number;
  gridX?: number;
  gridY?: number;
}

export interface QuestionState {
  id: string;
  type: 'blue' | 'red' | 'green' | 'violet' | 'bonus';
  text: string;
  targetPlayerId: string;
  votes: { up: string[]; down: string[] };
  status: 'pending' | 'open';
}

export interface QuestionSummary {
  id: string;
  type: 'blue' | 'red' | 'green' | 'violet' | 'bonus';
  text: string;
  upVotes: number;
  downVotes: number;
}

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
