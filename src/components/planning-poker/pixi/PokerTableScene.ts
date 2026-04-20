import { Container } from "pixi.js";
import { PlanningPokerPlayer, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { CenterInfo } from "./CenterInfo";
import { LocalPlayerArea } from "./LocalPlayerArea";
import { PlayerSeat } from "./PlayerSeat";
import { TableBackground } from "./TableBackground";

export class PokerTableScene {
  readonly view = new Container();

  readonly seatsLayer = new Container();

  readonly table = new TableBackground();

  readonly center = new CenterInfo();

  readonly localArea = new LocalPlayerArea();

  readonly seats = new Map<string, PlayerSeat>();

  private mode: "mobile" | "desktop" | null = null;

  constructor() {
    this.seatsLayer.sortableChildren = true;
    this.view.addChild(this.table.view, this.seatsLayer, this.center.view, this.localArea.view);
  }

  destroy() {
    this.seats.forEach((seat) => seat.destroy());
    this.seats.clear();
    this.table.destroy();
    this.center.destroy();
    this.localArea.destroy();
    this.view.destroy({ children: true });
  }

  setLayoutMode(isMobile: boolean) {
    const next = isMobile ? "mobile" : "desktop";
    if (this.mode !== next) {
      this.seats.forEach((seat) => seat.destroy());
      this.seats.clear();
      this.mode = next;
    }

    // Premium top-down composition: keep the geometry clean and readable.
    this.table.view.skew.set(0, 0);
    this.table.view.scale.set(1, 1);
    this.table.view.y = 0;

    this.seatsLayer.skew.set(0, 0);
    this.seatsLayer.scale.set(1, 1);
    this.seatsLayer.y = 0;
  }

  ensureSeat(player: PlanningPokerPlayer, isMobile: boolean, isLocal: boolean) {
    let seat = this.seats.get(player.socketId);
    if (!seat) {
      seat = new PlayerSeat({
        cardWidth: isMobile ? (isLocal ? 66 : 56) : isLocal ? 84 : 74,
        cardHeight: isMobile ? (isLocal ? 92 : 78) : isLocal ? 112 : 98,
      });
      this.seats.set(player.socketId, seat);
      this.seatsLayer.addChild(seat.view);
    }
    return seat;
  }

  cleanupSeats(activeIds: Set<string>) {
    for (const [socketId, seat] of this.seats) {
      if (activeIds.has(socketId)) continue;
      this.seatsLayer.removeChild(seat.view);
      seat.destroy();
      this.seats.delete(socketId);
    }
  }

  renderTable(opts: {
    worldWidth: number;
    worldHeight: number;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
  }) {
    this.table.render({
      viewportWidth: opts.worldWidth,
      viewportHeight: opts.worldHeight,
      centerX: opts.centerX,
      centerY: opts.centerY,
      radiusX: opts.radiusX,
      radiusY: opts.radiusY,
    });
  }

  renderCenter(opts: {
    centerX: number;
    centerY: number;
    isMobile: boolean;
    storyTitle: string;
    round: number;
    voteSystem: PlanningPokerVoteSystem;
    status: string;
    voted: number;
    total: number;
  }) {
    this.center.render({
      centerX: opts.centerX,
      centerY: opts.isMobile ? opts.centerY - 44 : opts.centerY,
      width: opts.isMobile ? 292 : 340,
      height: opts.isMobile ? 116 : 128,
      storyTitle: opts.storyTitle || `Story #${opts.round}`,
      voteSystem: opts.voteSystem,
      status: opts.status,
      voted: opts.voted,
      total: opts.total,
    });
  }
}
