import { Container, Graphics } from "pixi.js";
import { POKER_THEME, seeded } from "./sceneTheme";

export class TableBackground {
  readonly view = new Container();

  private readonly frame = new Graphics();

  private readonly tableShadow = new Graphics();

  private readonly tableRim = new Graphics();

  private readonly felt = new Graphics();

  private readonly feltPattern = new Graphics();

  constructor() {
    this.view.addChild(this.frame, this.tableShadow, this.tableRim, this.felt, this.feltPattern);
  }

  destroy() {
    this.view.destroy({ children: true });
  }

  render(opts: {
    viewportWidth: number;
    viewportHeight: number;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
  }) {
    const { viewportWidth, viewportHeight, centerX, centerY, radiusX, radiusY } = opts;

    this.frame.clear();
    this.frame.beginFill(POKER_THEME.bg.frame, 0.64);
    this.frame.drawRoundedRect(8, 8, Math.max(20, viewportWidth - 16), Math.max(20, viewportHeight - 16), 18);
    this.frame.endFill();
    this.frame.lineStyle(2, POKER_THEME.bg.frameBorder, 0.28);
    this.frame.drawRoundedRect(8, 8, Math.max(20, viewportWidth - 16), Math.max(20, viewportHeight - 16), 18);

    this.tableShadow.clear();
    this.tableShadow.beginFill(POKER_THEME.table.shadow, 0.35);
    this.tableShadow.drawEllipse(centerX, centerY + radiusY * 0.1, radiusX + 40, radiusY + 34);
    this.tableShadow.endFill();

    this.tableRim.clear();
    this.tableRim.beginFill(POKER_THEME.table.rimOuter, 0.95);
    this.tableRim.drawEllipse(centerX, centerY, radiusX + 28, radiusY + 20);
    this.tableRim.endFill();

    this.tableRim.beginFill(POKER_THEME.table.rimInner, 0.9);
    this.tableRim.drawEllipse(centerX, centerY, radiusX + 16, radiusY + 12);
    this.tableRim.endFill();

    this.felt.clear();
    this.felt.beginFill(POKER_THEME.table.felt, 0.92);
    this.felt.drawEllipse(centerX, centerY, radiusX, radiusY);
    this.felt.endFill();

    this.felt.lineStyle(2, POKER_THEME.table.line, 0.22);
    this.felt.drawEllipse(centerX, centerY, radiusX * 0.77, radiusY * 0.77);

    this.feltPattern.clear();
    for (let i = 0; i < 160; i += 1) {
      const ux = seeded(i * 7 + 3) * 2 - 1;
      const uy = seeded(i * 11 + 5) * 2 - 1;
      if (ux * ux + uy * uy > 1) continue;
      const px = centerX + ux * radiusX * 0.9;
      const py = centerY + uy * radiusY * 0.9;
      const dotR = 0.6 + seeded(i * 13 + 9) * 1.2;
      this.feltPattern.beginFill(POKER_THEME.table.feltAccent, 0.14);
      this.feltPattern.drawCircle(px, py, dotR);
      this.feltPattern.endFill();
    }
  }
}
