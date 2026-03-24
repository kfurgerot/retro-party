import { Container, Graphics, Text, TextStyle } from "pixi.js";

type PokerCardOptions = {
  width: number;
  height: number;
  value: string;
  hidden?: boolean;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
};

const FACE_BG = 0xf8fafc;
const FACE_BORDER = 0x0f172a;
const BACK_BG = 0x0f172a;
const BACK_BORDER = 0x22d3ee;
const SELECTED_BORDER = 0x22d3ee;
const HOVER_BORDER = 0x67e8f9;

export class PokerCard {
  readonly view = new Container();

  private readonly face = new Graphics();

  private readonly titleText: Text;

  private readonly backText: Text;

  private readonly width: number;

  private readonly height: number;

  private isHidden = false;

  private isSelected = false;

  private isHover = false;

  private isInteractive = true;

  private value = "";

  private animationFrame: number | null = null;

  constructor(options: PokerCardOptions) {
    this.width = options.width;
    this.height = options.height;
    this.value = options.value;
    this.isHidden = !!options.hidden;
    this.isSelected = !!options.selected;
    this.isInteractive = options.interactive !== false;

    this.titleText = new Text(this.value, new TextStyle({
      fontFamily: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
      fill: 0x0f172a,
      fontSize: Math.max(16, Math.round(this.height * 0.32)),
      fontWeight: "700",
      stroke: 0xffffff,
      strokeThickness: 1.2,
      lineJoin: "round",
      miterLimit: 2,
    }));
    this.titleText.resolution = 2;
    this.titleText.anchor.set(0.5);

    this.backText = new Text("VOTE", new TextStyle({
      fontFamily: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif",
      fill: 0x67e8f9,
      fontSize: Math.max(10, Math.round(this.height * 0.15)),
      letterSpacing: 1.2,
      fontWeight: "700",
      lineJoin: "round",
      miterLimit: 2,
    }));
    this.backText.resolution = 2;
    this.backText.anchor.set(0.5);

    this.view.addChild(this.face, this.titleText, this.backText);
    this.view.eventMode = "static";
    this.view.cursor = this.isInteractive ? "pointer" : "default";
    this.view.on("pointerover", () => {
      if (!this.isInteractive) return;
      this.isHover = true;
      this.view.scale.set(1.05);
      this.draw();
    });
    this.view.on("pointerout", () => {
      this.isHover = false;
      this.view.scale.set(1);
      this.draw();
    });
    this.view.on("pointertap", () => {
      if (!this.isInteractive) return;
      options.onClick?.();
    });

    this.draw();
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.view.destroy({ children: true });
  }

  setValue(value: string) {
    this.value = value;
    this.titleText.text = value;
    this.draw();
  }

  setSelected(selected: boolean) {
    this.isSelected = selected;
    this.draw();
  }

  setHidden(hidden: boolean) {
    this.isHidden = hidden;
    this.draw();
  }

  setInteractive(interactive: boolean) {
    this.isInteractive = interactive;
    this.view.cursor = interactive ? "pointer" : "default";
    if (!interactive) {
      this.isHover = false;
      this.view.scale.set(1);
    }
    this.draw();
  }

  animateFlip(nextHidden: boolean, delayMs = 0) {
    const run = () => {
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

      const startAt = performance.now();
      const totalDuration = 240;
      const startScaleX = this.view.scale.x;

      const tick = (now: number) => {
        const elapsed = now - startAt;
        const progress = Math.min(1, elapsed / totalDuration);

        if (progress <= 0.5) {
          const p = progress / 0.5;
          const nextScaleX = startScaleX * (1 - p);
          this.view.scale.x = Math.max(0.03, nextScaleX);
        } else {
          if (this.isHidden !== nextHidden) {
            this.isHidden = nextHidden;
            this.draw();
          }
          const p = (progress - 0.5) / 0.5;
          this.view.scale.x = Math.max(0.03, p);
        }

        if (progress < 1) {
          this.animationFrame = requestAnimationFrame(tick);
          return;
        }

        this.view.scale.x = 1;
        this.animationFrame = null;
      };

      this.animationFrame = requestAnimationFrame(tick);
    };

    if (delayMs > 0) {
      window.setTimeout(run, delayMs);
    } else {
      run();
    }
  }

  private draw() {
    this.face.clear();

    const borderColor = this.isSelected
      ? SELECTED_BORDER
      : this.isHover
      ? HOVER_BORDER
      : this.isHidden
      ? BACK_BORDER
      : FACE_BORDER;

    const borderThickness = this.isSelected ? 4 : this.isHover ? 3 : 2;

    this.face.lineStyle(borderThickness, borderColor, 1);
    this.face.beginFill(this.isHidden ? BACK_BG : FACE_BG, 0.98);
    this.face.drawRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 12);
    this.face.endFill();

    if (this.isHover || this.isSelected) {
      this.face.lineStyle(2, borderColor, this.isSelected ? 0.9 : 0.5);
      this.face.drawRoundedRect(-this.width / 2 - 3, -this.height / 2 - 3, this.width + 6, this.height + 6, 14);
    }

    this.titleText.visible = !this.isHidden;
    this.titleText.style.fill = this.isSelected ? 0x0c4a6e : 0x0f172a;
    this.titleText.x = 0;
    this.titleText.y = 0;

    this.backText.visible = this.isHidden;
    this.backText.x = 0;
    this.backText.y = 0;

    this.view.alpha = this.isInteractive ? 1 : 0.92;
  }
}
