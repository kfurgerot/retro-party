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
}

export const AVATARS = [
  "🧙", "🧝", "🧛", "🧟", "🧞",
  "🧑‍🚀", "🧑‍🎤", "🧑‍🍳", "🧑‍🔧", "🧑‍🎨",
  "🥷", "🤠", "👾", "🤖", "🐉",
  "🦊", "🐼", "🐸",
] as const;
