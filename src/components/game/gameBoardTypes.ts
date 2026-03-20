import { MoveTrace, PendingPathChoice, Player, RollResult, Tile } from "@/types/game";

export interface BoardActionOverlay {
  canRoll: boolean;
  canMove: boolean;
  canOpenQuestionCard: boolean;
  isRolling: boolean;
  diceValue: number | null;
  rollResult?: RollResult | null;
  pendingDoubleRollFirstDie?: number | null;
  onRoll?: () => void;
  onMove?: (steps: number) => void;
  onOpenQuestionCard?: () => void;
  playerIndex?: number;
}

export interface GameBoardProps {
  tiles: Tile[];
  players: Player[];
  focusPlayerId?: string | null;
  onMoveAnimationEnd?: (playerId: string) => void;
  pendingPathChoice?: PendingPathChoice | null;
  lastMoveTrace?: MoveTrace | null;
  canChoosePath?: boolean;
  onChoosePath?: (nextTileId: number) => void;
  eventOverlayActive?: boolean;
  actionOverlay?: BoardActionOverlay | null;
}
