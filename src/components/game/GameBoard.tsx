import React from "react";
import { ENABLE_BOARD_PIXI } from "@/lib/uiMode";
import { GameBoardLegacy } from "./GameBoardLegacy";
import { GameBoardPixi } from "./GameBoardPixi";
import { GameBoardProps } from "./gameBoardTypes";

export const GameBoard: React.FC<GameBoardProps> = (props) => {
  if (ENABLE_BOARD_PIXI) {
    return <GameBoardPixi {...props} />;
  }
  return <GameBoardLegacy {...props} />;
};
