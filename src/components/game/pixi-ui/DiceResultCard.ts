import { Graphics, Text, TextStyle } from "pixi.js";
import { PIXI_GAME_THEME } from "./theme";

interface DiceResultCardOptions {
  isCardMode: boolean;
  isRolling: boolean;
  resolvedRollValue: number | string | null;
}

export function createDiceResultCard({
  isCardMode,
  isRolling,
  resolvedRollValue,
}: DiceResultCardOptions) {
  const face = new Graphics();
  face.lineStyle(2, PIXI_GAME_THEME.colors.ink, 0.95, 0.5, true);
  face.beginFill(0xf8fafc, 1);
  face.drawRoundedRect(
    PIXI_GAME_THEME.face.x,
    PIXI_GAME_THEME.face.y,
    PIXI_GAME_THEME.face.width,
    PIXI_GAME_THEME.face.height,
    PIXI_GAME_THEME.face.radius,
  );
  face.endFill();

  if (!isCardMode) {
    const rollLabel = isRolling ? "?" : String(resolvedRollValue ?? "?");
    const baseFontSize =
      rollLabel.length > 1
        ? PIXI_GAME_THEME.text.diceSizeDouble
        : PIXI_GAME_THEME.text.diceSizeSingle;
    const fontSize = baseFontSize + 2;
    const valueText = new Text(
      rollLabel,
      new TextStyle({
        // Use a smoother bold sans-serif for dice values to improve readability.
        fontFamily: "Segoe UI, Arial, sans-serif",
        fontWeight: "900",
        fill: PIXI_GAME_THEME.colors.ink,
        stroke: 0xe2e8f0,
        strokeThickness: 1.4,
        lineJoin: "round",
        fontSize,
        align: "center",
        padding: 2,
      }),
    );
    valueText.resolution = 2;
    valueText.anchor.set(0.5);
    valueText.x = 0;
    valueText.y = -64;
    face.addChild(valueText);
    return { face, rollingValueText: valueText };
  }

  const backCard = new Graphics();
  backCard.lineStyle(2, PIXI_GAME_THEME.colors.slateMedium, 0.7, 0.5, true);
  backCard.beginFill(PIXI_GAME_THEME.colors.slateLight, 1);
  backCard.drawRoundedRect(-10, -84, 26, 34, 5);
  backCard.endFill();
  face.addChild(backCard);

  const frontCard = new Graphics();
  frontCard.lineStyle(2, PIXI_GAME_THEME.colors.ink, 0.95, 0.5, true);
  frontCard.beginFill(PIXI_GAME_THEME.colors.white, 1);
  frontCard.drawRoundedRect(-18, -78, 28, 38, 5);
  frontCard.endFill();
  face.addChild(frontCard);

  const cardContent = new Graphics();
  cardContent.beginFill(PIXI_GAME_THEME.colors.ink, 0.95);
  cardContent.drawCircle(-12, -72, 2);
  cardContent.drawCircle(4, -46, 2);
  cardContent.drawRect(-12, -65, 12, 2);
  cardContent.drawRect(-12, -60, 16, 2);
  cardContent.drawRect(-12, -55, 10, 2);
  cardContent.endFill();
  face.addChild(cardContent);

  return { face, rollingValueText: null };
}
