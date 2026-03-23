import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { PlanningPokerVoteSystem } from "@/types/planningPoker";
import { POKER_THEME } from "./sceneTheme";

export class CenterInfo {
  readonly view = new Container();

  private readonly panel = new Graphics();

  private readonly title: Text;

  private readonly voteType: Text;

  private readonly status: Text;

  private readonly progress: Text;

  constructor() {
    this.title = new Text("", new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 10,
      fill: POKER_THEME.center.title,
      align: "center",
      wordWrap: true,
      wordWrapWidth: 240,
    }));
    this.title.anchor.set(0.5);

    const bodyStyle = new TextStyle({
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 8,
      fill: POKER_THEME.center.body,
      align: "center",
    });
    this.voteType = new Text("", bodyStyle);
    this.voteType.anchor.set(0.5);

    this.status = new Text("", bodyStyle);
    this.status.anchor.set(0.5);

    this.progress = new Text("", bodyStyle);
    this.progress.anchor.set(0.5);

    this.view.addChild(this.panel, this.title, this.voteType, this.status, this.progress);
  }

  destroy() {
    this.view.destroy({ children: true });
  }

  render(opts: {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    storyTitle: string;
    voteSystem: PlanningPokerVoteSystem;
    status: string;
    voted: number;
    total: number;
  }) {
    const { centerX, centerY, width, height, storyTitle, voteSystem, status, voted, total } = opts;
    this.view.position.set(centerX, centerY);

    this.panel.clear();
    this.panel.lineStyle(2, POKER_THEME.center.border, 0.34);
    this.panel.beginFill(POKER_THEME.center.panel, 0.78);
    this.panel.drawRoundedRect(-width / 2, -height / 2, width, height, 14);
    this.panel.endFill();

    this.title.style.wordWrapWidth = Math.max(120, width - 22);
    this.title.text = storyTitle || "Story";
    this.title.y = -height * 0.23;

    this.voteType.text = `TYPE: ${voteSystem.toUpperCase()}`;
    this.voteType.y = -2;

    this.status.text = `ETAT: ${status}`;
    this.status.y = height * 0.18;

    this.progress.text = `VOTES: ${voted}/${total}`;
    this.progress.y = height * 0.34;
  }
}
