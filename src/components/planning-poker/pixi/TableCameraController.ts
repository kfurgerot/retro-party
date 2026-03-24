import { Container } from "pixi.js";
import { CameraContainer } from "./CameraContainer";

type BaseOptions = {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  topPadding: number;
  bottomPadding: number;
  minScale: number;
  maxScale: number;
};

export class TableCameraController {
  readonly camera = new CameraContainer();

  readonly view: Container;

  readonly world: Container;

  private resetTimer: number | null = null;

  constructor() {
    this.view = this.camera.view;
    this.world = this.camera.world;
  }

  destroy() {
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.camera.destroy();
  }

  setBase(options: BaseOptions) {
    this.camera.setBase(options);
  }

  focusReveal(centerX: number, centerY: number, isMobile: boolean) {
    this.clearTimer();
    this.camera.focus(centerX, centerY, isMobile ? 1.2 : 1.12, 320);
    this.resetTimer = window.setTimeout(() => {
      this.camera.reset(560);
      this.resetTimer = null;
    }, 420);
  }

  focusPlayerVote(x: number, y: number, isMobile: boolean) {
    this.clearTimer();
    this.camera.focus(x, y, isMobile ? 1.22 : 1.1, 260);
    this.resetTimer = window.setTimeout(() => {
      this.camera.reset(420);
      this.resetTimer = null;
    }, 300);
  }

  reset(durationMs = 220) {
    this.clearTimer();
    this.camera.reset(durationMs);
  }

  private clearTimer() {
    if (!this.resetTimer) return;
    window.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
}

