import { Container } from "pixi.js";
import { clamp } from "./sceneTheme";

type CameraConfig = {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  topPadding: number;
  bottomPadding: number;
  minScale: number;
  maxScale: number;
};

export class CameraContainer {
  readonly view = new Container();

  readonly world = new Container();

  private config: CameraConfig = {
    viewportWidth: 1,
    viewportHeight: 1,
    worldWidth: 1,
    worldHeight: 1,
    topPadding: 0,
    bottomPadding: 0,
    minScale: 0.4,
    maxScale: 1.5,
  };

  private baseScale = 1;

  private baseX = 0;

  private baseY = 0;

  private animationFrame: number | null = null;

  private animationToken = 0;

  constructor() {
    this.view.addChild(this.world);
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.view.destroy({ children: true });
  }

  setBase(config: CameraConfig) {
    this.config = config;

    const fitScale = Math.min(
      (config.viewportWidth - 12) / Math.max(1, config.worldWidth),
      (config.viewportHeight - config.topPadding - config.bottomPadding - 12) / Math.max(1, config.worldHeight)
    );

    this.baseScale = clamp(fitScale, config.minScale, config.maxScale);

    const renderedW = config.worldWidth * this.baseScale;
    const renderedH = config.worldHeight * this.baseScale;
    const usableH = config.viewportHeight - config.topPadding - config.bottomPadding;

    this.baseX = Math.round((config.viewportWidth - renderedW) / 2);
    this.baseY = Math.round(config.topPadding + (usableH - renderedH) / 2);

    this.apply(this.baseScale, this.baseX, this.baseY);
  }

  focus(worldX: number, worldY: number, zoomMultiplier: number, durationMs = 320) {
    const targetScale = clamp(this.baseScale * zoomMultiplier, this.config.minScale, this.config.maxScale * 1.2);
    const targetX = this.config.viewportWidth * 0.5 - worldX * targetScale;
    const usableH = this.config.viewportHeight - this.config.bottomPadding;
    const targetY = this.config.topPadding + usableH * 0.48 - worldY * targetScale;

    this.animateTo(targetScale, targetX, targetY, durationMs);
  }

  reset(durationMs = 420) {
    this.animateTo(this.baseScale, this.baseX, this.baseY, durationMs);
  }

  private animateTo(targetScale: number, targetX: number, targetY: number, durationMs: number) {
    const token = ++this.animationToken;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    const startScale = this.world.scale.x;
    const startX = this.world.x;
    const startY = this.world.y;
    const startedAt = performance.now();

    const tick = (now: number) => {
      if (token !== this.animationToken) return;
      const t = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
      const eased = 1 - Math.pow(1 - t, 3);

      const scale = startScale + (targetScale - startScale) * eased;
      const x = startX + (targetX - startX) * eased;
      const y = startY + (targetY - startY) * eased;

      this.apply(scale, x, y);

      if (t < 1) {
        this.animationFrame = requestAnimationFrame(tick);
        return;
      }

      this.animationFrame = null;
    };

    this.animationFrame = requestAnimationFrame(tick);
  }

  private apply(scale: number, x: number, y: number) {
    this.world.scale.set(scale);
    this.world.position.set(x, y);
  }
}
