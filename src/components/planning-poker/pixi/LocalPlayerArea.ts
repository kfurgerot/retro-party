import { Sprite, Text, TextStyle, Texture, Container } from "pixi.js";
import { AVATARS } from "@/types/game";
import { PlanningPokerPlayer } from "@/types/planningPoker";

export class LocalPlayerArea {
  readonly view = new Container();

  private readonly panel = new Sprite(Texture.WHITE);

  private readonly avatarBubble = new Sprite(Texture.WHITE);

  private readonly avatarText: Text;

  private readonly nameText: Text;

  private readonly voteText: Text;

  constructor() {
    this.panel.anchor.set(0.5);
    this.panel.tint = 0x0f172a;
    this.panel.alpha = 0.68;

    this.avatarBubble.anchor.set(0.5);
    this.avatarBubble.tint = 0x164e63;
    this.avatarBubble.alpha = 0.95;

    this.avatarText = new Text(":)", new TextStyle({
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: 24,
    }));
    this.avatarText.anchor.set(0.5);

    this.nameText = new Text("", new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 8,
      fill: 0xe2e8f0,
      align: "left",
    }));
    this.nameText.anchor.set(0, 0.5);

    this.voteText = new Text("", new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 8,
      fill: 0x99f6e4,
      align: "left",
    }));
    this.voteText.anchor.set(0, 0.5);

    this.view.addChild(this.panel, this.avatarBubble, this.avatarText, this.nameText, this.voteText);
    this.view.visible = false;
  }

  destroy() {
    this.view.destroy({ children: true });
  }

  render(opts: {
    worldWidth: number;
    worldHeight: number;
    isMobile: boolean;
    player: PlanningPokerPlayer | null;
    myVote: string | null;
    revealed: boolean;
  }) {
    const { worldWidth, worldHeight, isMobile, player, myVote, revealed } = opts;
    if (!player) {
      this.view.visible = false;
      return;
    }

    this.view.visible = true;
    this.view.position.set(worldWidth * 0.5, isMobile ? worldHeight * 0.87 : worldHeight * 0.89);

    this.panel.width = isMobile ? 260 : 320;
    this.panel.height = isMobile ? 64 : 70;

    this.avatarBubble.width = isMobile ? 42 : 46;
    this.avatarBubble.height = isMobile ? 42 : 46;
    this.avatarBubble.position.set(-this.panel.width * 0.39, 0);

    this.avatarText.text = AVATARS[player.avatar] ?? ":)";
    this.avatarText.position.copyFrom(this.avatarBubble.position);

    this.nameText.text = player.name;
    this.nameText.position.set(-this.panel.width * 0.29, -8);

    const voteLabel = revealed ? (player.vote ?? "-") : myVote ? "VOTE ENREGISTRE" : "A TOI DE VOTER";
    this.voteText.text = voteLabel;
    this.voteText.position.set(-this.panel.width * 0.29, 10);
  }
}

