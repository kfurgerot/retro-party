import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { POKER_THEME, seeded } from "./sceneTheme";

export class TableBackground {
  readonly view = new Container();

  private readonly frame = new Graphics();

  private readonly tableShadow = new Graphics();

  private readonly tableRim = new Graphics();

  private readonly tableGlow = new Graphics();

  private readonly felt = new Graphics();

  private readonly centerGlow = new Graphics();

  private readonly feltPattern = new Graphics();

  private readonly topVignette = new Sprite(Texture.WHITE);

  private readonly bottomVignette = new Sprite(Texture.WHITE);

  constructor() {
    this.topVignette.anchor.set(0.5);
    this.topVignette.tint = 0xffffff;
    this.topVignette.alpha = 0.06;

    this.bottomVignette.anchor.set(0.5);
    this.bottomVignette.tint = 0x020617;
    this.bottomVignette.alpha = 0.2;

    this.view.addChild(
      this.frame,
      this.tableShadow,
      this.tableRim,
      this.tableGlow,
      this.felt,
      this.centerGlow,
      this.topVignette,
      this.bottomVignette,
      this.feltPattern
    );
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
    this.frame.beginFill(POKER_THEME.bg.frame, 0.7);
    this.frame.drawRoundedRect(8, 8, Math.max(20, viewportWidth - 16), Math.max(20, viewportHeight - 16), 18);
    this.frame.endFill();
    this.frame.lineStyle(2, POKER_THEME.bg.frameBorder, 0.28);
    this.frame.drawRoundedRect(8, 8, Math.max(20, viewportWidth - 16), Math.max(20, viewportHeight - 16), 18);

    this.tableShadow.clear();
    this.tableShadow.beginFill(POKER_THEME.table.shadow, 0.38);
    this.tableShadow.drawEllipse(centerX + 6, centerY + radiusY * 0.2, radiusX + 56, radiusY + 42);
    this.tableShadow.endFill();

    this.tableRim.clear();
    this.tableRim.beginFill(POKER_THEME.table.rimOuter, 0.95);
    this.tableRim.drawEllipse(centerX, centerY, radiusX + 32, radiusY + 24);
    this.tableRim.endFill();

    this.tableRim.beginFill(POKER_THEME.table.rimInner, 0.92);
    this.tableRim.drawEllipse(centerX, centerY, radiusX + 18, radiusY + 14);
    this.tableRim.endFill();

    this.tableGlow.clear();
    this.tableGlow.lineStyle(10, 0x67e8f9, 0.09);
    this.tableGlow.drawEllipse(centerX, centerY, radiusX + 14, radiusY + 10);
    this.tableGlow.lineStyle(4, 0xa5f3fc, 0.12);
    this.tableGlow.drawEllipse(centerX, centerY, radiusX + 4, radiusY + 2);

    this.felt.clear();
    this.felt.beginFill(POKER_THEME.table.felt, 0.95);
    this.felt.drawEllipse(centerX, centerY, radiusX, radiusY);
    this.felt.endFill();

    this.felt.lineStyle(2, POKER_THEME.table.line, 0.24);
    this.felt.drawEllipse(centerX, centerY, radiusX * 0.78, radiusY * 0.78);

    this.centerGlow.clear();
    this.centerGlow.beginFill(0x99f6e4, 0.05);
    this.centerGlow.drawEllipse(centerX, centerY, radiusX * 0.42, radiusY * 0.32);
    this.centerGlow.endFill();

    this.topVignette.position.set(centerX, centerY - radiusY * 0.28);
    this.topVignette.width = radiusX * 1.6;
    this.topVignette.height = radiusY * 0.56;

    this.bottomVignette.position.set(centerX, centerY + radiusY * 0.34);
    this.bottomVignette.width = radiusX * 1.75;
    this.bottomVignette.height = radiusY * 0.66;

    this.feltPattern.clear();
    for (let i = 0; i < 170; i += 1) {
      const ux = seeded(i * 7 + 3) * 2 - 1;
      const uy = seeded(i * 11 + 5) * 2 - 1;
      if (ux * ux + uy * uy > 1) continue;
      const px = centerX + ux * radiusX * 0.9;
      const py = centerY + uy * radiusY * 0.9;
      const dotR = 0.5 + seeded(i * 13 + 9) * 1.3;
      this.feltPattern.beginFill(POKER_THEME.table.feltAccent, 0.12);
      this.feltPattern.drawCircle(px, py, dotR);
      this.feltPattern.endFill();
    }
  }
}
