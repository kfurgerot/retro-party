import { MoveTrace, PendingPathChoice, Player, Tile } from "@/types/game";

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
}
