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
  inventory: ShopItemInstance[];
  skipNextTurn: boolean;
  color: string;
  isHost?: boolean;
  /** True quand le joueur a soft-leave la room ; le pion est masque
   * sur le plateau et le serveur skip son tour automatiquement. Cleared
   * au reconnect (RECONNECT_ROOM avec le même sessionId). */
  disconnected?: boolean;
  /** True pendant une coupure temporaire (refresh, mobile en veille,
   * perte reseau courte). Le tour n'est pas consomme. */
  reconnecting?: boolean;
}

export type TileType =
  | "blue"
  | "red"
  | "green"
  | "purple"
  | "yellow"
  | "star"
  | "shop"
  | "start"
  | "violet"
  | "bonus";

export type ShopItemType =
  | "double_roll"
  | "swap_position"
  | "plus_two_roll"
  | "go_to_star"
  | "steal_points";

export type ShopItemTiming = "before_roll" | "after_roll" | "instant" | "passive";

export type ShopCatalogItem = {
  type: ShopItemType;
  label: string;
  cost: number;
  description: string;
  timing: ShopItemTiming;
};

export type ShopItemInstance = {
  id: string;
  type: ShopItemType;
  purchasedAtTurn?: number;
};

export type TurnPhase = "pre_roll" | "rolling" | "moving" | "resolving" | "finished";
export type RollEffectType = "normal" | "double_roll" | "plus_two_roll";

export type RollResult = {
  dice: number[];
  bonus: number;
  total: number;
  effectType: RollEffectType;
};

export type PendingDoubleRoll = {
  firstDie: number;
};

export interface Tile {
  id: number;
  type: TileType;
  color?: "blue" | "green" | "purple" | "red" | "yellow";
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
  turnEndsAfterResolve?: boolean;
}

export interface PendingShop {
  playerId: string;
  atTileId: number;
  remainingSteps: number;
}

export interface MoveTrace {
  id: string;
  playerId: string;
  path: number[];
  pointDeltas: number[];
}

export interface QuestionState {
  id: string;
  type: "blue" | "red" | "green" | "purple" | "violet" | "bonus";
  text: string;
  targetPlayerId: string;
  votes: { up: string[]; down: string[] };
  status: "pending" | "open";
  startAt?: number;
  endsAt?: number;
  durationMs?: number;
  nextMinigame?: "BUG_SMASH" | null;
}

export interface QuestionSummary {
  id: string;
  type: "blue" | "red" | "green" | "purple" | "violet" | "bonus";
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

export interface PointDuelState {
  minigameId: "POINT_DUEL";
  phase:
    | "announce"
    | "waiting_attacker_roll"
    | "show_attacker_roll"
    | "waiting_defender_roll"
    | "show_defender_roll"
    | "result";
  attackerId: string;
  defenderId: string;
  attackerRoll: number | null;
  defenderRoll: number | null;
  winnerId: string | null;
  stolenPoints: number;
  startedAt: number;
  nextStepAt: number | null;
}

export type ActiveMinigameState = BugSmashState | BuzzwordDuelState | PointDuelState;

export interface GameState {
  phase: "lobby" | "playing" | "results";
  turnPhase?: TurnPhase;
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  maxRounds: number;

  board?: { seed: number; cols: number; rows: number; length: number };
  tiles: Tile[];

  diceValue: number | null;
  lastRollResult?: RollResult | null;
  isRolling: boolean;

  currentQuestion: QuestionState | null;
  currentMinigame: ActiveMinigameState | null;
  pendingPathChoice: PendingPathChoice | null;
  pendingKudoPurchase: PendingKudoPurchase | null;
  pendingShop?: PendingShop | null;
  preRollActionUsed?: boolean;
  pendingPreRollEffect?: { type: "double_roll" | "plus_two_roll" } | null;
  pendingDoubleRoll?: PendingDoubleRoll | null;
  preRollChoiceResolved?: boolean;
  preRollSelectedItemId?: string | null;
  actionLogs?: string[];
  lastMoveTrace: MoveTrace | null;
  questionHistory: QuestionSummary[];
}

export type WhoSaidItRole = "MANAGER" | "PO" | "DEV" | "SCRUM_MASTER" | "QA_SUPPORT";

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
  "🧙",
  "🧝",
  "🧛",
  "🧟",
  "🧞",
  "🧑‍🚀",
  "🧑‍🎤",
  "🧑‍🍳",
  "🧑‍🔧",
  "🧑‍🎨",
  "🥷",
  "🤠",
  "👾",
  "🤖",
  "🐉",
  "🦊",
  "🐼",
  "🐸",
] as const;
