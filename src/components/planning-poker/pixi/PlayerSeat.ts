import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { PlanningPokerPlayer } from "@/types/planningPoker";
import { AVATARS } from "@/types/game";
import { PokerCard } from "./PokerCard";
import { POKER_THEME } from "./sceneTheme";

type SeatOptions = {
  cardWidth: number;
  cardHeight: number;
};

export class PlayerSeat {
  readonly view = new Container();

  readonly card: PokerCard;

  private readonly avatarContainer = new Container();

  private readonly avatarShadow = new Graphics();

  private readonly avatarBadge = new Graphics();

  private readonly pulseRing = new Graphics();

  private readonly avatarText: Text;

  private readonly nameText: Text;

  private readonly badgeText: Text;

  private pulseTimer: number | null = null;

  constructor(options: SeatOptions) {
    this.card = new PokerCard({
      width: options.cardWidth,
      height: options.cardHeight,
      value: "",
      interactive: false,
      hidden: true,
    });

    this.avatarText = new Text("🙂", new TextStyle({
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: 20,
    }));
    this.avatarText.anchor.set(0.5);

    this.nameText = new Text("", new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 8,
      fill: POKER_THEME.seat.text,
      align: "center",
    }));
    this.nameText.anchor.set(0.5);

    this.badgeText = new Text("", new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 7,
      fill: POKER_THEME.seat.badge,
      align: "center",
    }));
    this.badgeText.anchor.set(0.5);

    this.avatarContainer.addChild(this.pulseRing, this.avatarShadow, this.avatarBadge, this.avatarText);
    this.view.addChild(this.card.view, this.avatarContainer, this.nameText, this.badgeText);

    this.avatarContainer.eventMode = "static";
    this.avatarContainer.cursor = "pointer";
    this.avatarContainer.on("pointerover", () => {
      this.avatarContainer.scale.set(1.06);
    });
    this.avatarContainer.on("pointerout", () => {
      this.avatarContainer.scale.set(1);
    });
  }

  destroy() {
    if (this.pulseTimer) {
      window.clearTimeout(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.card.destroy();
    this.view.destroy({ children: true });
  }

  setLayout(opts: {
    avatarX: number;
    avatarY: number;
    cardX: number;
    cardY: number;
    nameX: number;
    nameY: number;
    badgeX: number;
    badgeY: number;
  }) {
    this.avatarContainer.position.set(opts.avatarX, opts.avatarY);
    this.card.view.position.set(opts.cardX, opts.cardY);
    this.nameText.position.set(opts.nameX, opts.nameY);
    this.badgeText.position.set(opts.badgeX, opts.badgeY);
  }

  renderPlayer(player: PlanningPokerPlayer, opts: { isMe: boolean; revealed: boolean }) {
    this.avatarText.text = AVATARS[player.avatar] ?? "🙂";

    this.avatarShadow.clear();
    this.avatarShadow.beginFill(0x020617, 0.34);
    this.avatarShadow.drawEllipse(0, 16, 18, 7);
    this.avatarShadow.endFill();

    this.avatarBadge.clear();
    this.avatarBadge.lineStyle(2, player.connected ? POKER_THEME.seat.online : POKER_THEME.seat.offline, 0.9);
    this.avatarBadge.beginFill(opts.isMe ? POKER_THEME.seat.meFill : POKER_THEME.seat.defaultFill, 0.96);
    this.avatarBadge.drawCircle(0, 0, 16);
    this.avatarBadge.endFill();

    this.nameText.text = player.name;

    const badges: string[] = [];
    if (player.isHost) badges.push("HOST");
    if (player.role === "spectator") badges.push("SPEC");
    if (!player.connected) badges.push("OFF");
    if (!opts.revealed && player.hasVoted) badges.push("A VOTE");
    this.badgeText.text = badges.join(" · ");
    this.badgeText.visible = badges.length > 0;
  }

  setCardState(opts: {
    value: string;
    selected: boolean;
    hidden: boolean;
    animateFlip?: boolean;
    flipDelay?: number;
  }) {
    this.card.setValue(opts.value);
    this.card.setSelected(opts.selected);
    if (opts.animateFlip) {
      this.card.animateFlip(opts.hidden, opts.flipDelay ?? 0);
    } else {
      this.card.setHidden(opts.hidden);
    }
  }

  pulseVoteFeedback() {
    this.pulseRing.clear();
    this.pulseRing.lineStyle(2, 0x67e8f9, 0.75);
    this.pulseRing.drawCircle(0, 0, 20);
    this.pulseRing.alpha = 1;

    const startedAt = performance.now();
    const duration = 420;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const scale = 1 + t * 0.5;
      this.pulseRing.scale.set(scale);
      this.pulseRing.alpha = 1 - t;
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      this.pulseRing.clear();
      this.pulseRing.scale.set(1);
      this.pulseRing.alpha = 1;
    };

    requestAnimationFrame(tick);

    if (this.pulseTimer) {
      window.clearTimeout(this.pulseTimer);
    }
    this.pulseTimer = window.setTimeout(() => {
      this.pulseTimer = null;
      this.pulseRing.clear();
      this.pulseRing.scale.set(1);
      this.pulseRing.alpha = 1;
    }, duration + 32);
  }
}
