import { Graphics } from "pixi.js";
import { PIXI_GAME_THEME } from "./theme";

export function createGamePanel() {
  const panel = new Graphics();
  panel.lineStyle(2, PIXI_GAME_THEME.panel.border, PIXI_GAME_THEME.panel.borderAlpha, 0.5, true);
  panel.beginFill(PIXI_GAME_THEME.panel.fill, PIXI_GAME_THEME.panel.fillAlpha);
  panel.drawRoundedRect(
    PIXI_GAME_THEME.panel.x,
    PIXI_GAME_THEME.panel.y,
    PIXI_GAME_THEME.panel.width,
    PIXI_GAME_THEME.panel.height,
    PIXI_GAME_THEME.panel.radius,
  );
  panel.endFill();

  const separator = new Graphics();
  separator.lineStyle(2, PIXI_GAME_THEME.panel.border, 0.3, 0.5, true);
  separator.moveTo(-PIXI_GAME_THEME.panel.separatorHalfWidth, PIXI_GAME_THEME.panel.separatorY);
  separator.lineTo(PIXI_GAME_THEME.panel.separatorHalfWidth, PIXI_GAME_THEME.panel.separatorY);

  return { panel, separator };
}
