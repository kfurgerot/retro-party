import { FancyButton } from "@pixi/ui";
import { Graphics, Text, TextStyle } from "pixi.js";
import { PIXI_GAME_THEME } from "./theme";

interface GameButtonOptions {
  label: string;
  onPress: () => void;
}

export function createGameButton({ label, onPress }: GameButtonOptions) {
  const compactLabel = label.length > 11;
  const defaultView = new Graphics();
  defaultView.lineStyle(2, PIXI_GAME_THEME.panel.border, 0.55, 0.5, true);
  defaultView.beginFill(PIXI_GAME_THEME.colors.cyan, 0.92);
  defaultView.drawRoundedRect(
    0,
    0,
    PIXI_GAME_THEME.button.width,
    PIXI_GAME_THEME.button.height,
    PIXI_GAME_THEME.button.radius
  );
  defaultView.endFill();

  const hoverView = new Graphics();
  hoverView.lineStyle(2, 0xa5f3fc, 0.75, 0.5, true);
  hoverView.beginFill(PIXI_GAME_THEME.colors.cyanHover, 1);
  hoverView.drawRoundedRect(
    0,
    0,
    PIXI_GAME_THEME.button.width,
    PIXI_GAME_THEME.button.height,
    PIXI_GAME_THEME.button.radius
  );
  hoverView.endFill();

  const pressedView = new Graphics();
  pressedView.lineStyle(2, PIXI_GAME_THEME.panel.border, 0.7, 0.5, true);
  pressedView.beginFill(PIXI_GAME_THEME.colors.cyanPressed, 0.95);
  pressedView.drawRoundedRect(
    0,
    0,
    PIXI_GAME_THEME.button.width,
    PIXI_GAME_THEME.button.height,
    PIXI_GAME_THEME.button.radius
  );
  pressedView.endFill();

  const button = new FancyButton({
    defaultView,
    hoverView,
    pressedView,
    text: new Text(
      label,
      new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: PIXI_GAME_THEME.colors.ink,
        fontSize: compactLabel ? Math.max(6, PIXI_GAME_THEME.text.actionSize - 1) : PIXI_GAME_THEME.text.actionSize,
        align: "center",
        padding: 2,
      })
    ),
    anchor: 0.5,
    animations: {
      hover: { props: { scale: { x: 1.03, y: 1.03 } }, duration: 90 },
      pressed: { props: { scale: { x: 0.98, y: 0.98 } }, duration: 70 },
    },
  });

  button.x = 0;
  button.y = PIXI_GAME_THEME.button.y;
  button.onPress.connect(onPress);
  return button;
}
