import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Text, TextStyle } from "pixi.js";
import { PlanningPokerPlayer, PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { CenterInfo } from "./CenterInfo";
import { PlayerSeat } from "./PlayerSeat";
import { PokerDeck } from "./PokerDeck";
import { POKER_WORLD, clamp } from "./sceneTheme";
import { TableBackground } from "./TableBackground";

type PokerSceneProps = {
  players: PlanningPokerPlayer[];
  cardValues: string[];
  revealed: boolean;
  myPlayerId: string | null;
  myRole: PlanningPokerRole;
  myVote: string | null;
  voteSystem: PlanningPokerVoteSystem;
  round: number;
  storyTitle: string;
  onVoteCard: (value: string) => void;
};

type PlayerSnapshot = {
  hasVoted: boolean;
  vote: string | null;
};

function getSessionStatus({ revealed, voted, active }: { revealed: boolean; voted: number; active: number }) {
  if (revealed) return "REVELE";
  if (active > 0 && voted >= active) return "EN ATTENTE DE REVEAL";
  return "VOTE EN COURS";
}

function getSeatAngle(index: number, count: number, isMobile: boolean) {
  if (count <= 1) return -Math.PI / 2;
  if (!isMobile) {
    return -Math.PI / 2 + (Math.PI * 2 * index) / count;
  }

  // Mobile: spread players across upper and side arcs to keep center/deck readable.
  const spread = Math.PI * 1.55;
  const start = -Math.PI / 2 - spread / 2;
  return start + (spread * index) / Math.max(1, count - 1);
}

export const PokerScene: React.FC<PokerSceneProps> = ({
  players,
  cardValues,
  revealed,
  myPlayerId,
  myRole,
  myVote,
  voteSystem,
  round,
  storyTitle,
  onVoteCard,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const overlayRef = useRef<Container | null>(null);

  const tableRef = useRef<TableBackground | null>(null);
  const centerRef = useRef<CenterInfo | null>(null);
  const seatsLayerRef = useRef<Container | null>(null);

  const seatMapRef = useRef<Map<string, PlayerSeat>>(new Map());
  const deckRef = useRef<PokerDeck | null>(null);
  const deckContainerRef = useRef<Container | null>(null);
  const deckTitleRef = useRef<Text | null>(null);

  const prevPlayersRef = useRef<Map<string, PlayerSnapshot>>(new Map());
  const prevRevealedRef = useRef(false);
  const viewportRef = useRef({ width: 1, height: 1 });
  const deckModeRef = useRef<"mobile" | "desktop" | null>(null);

  const [viewportTick, setViewportTick] = useState(0);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.isHost !== b.isHost) return Number(b.isHost) - Number(a.isHost);
        if (a.connected !== b.connected) return Number(b.connected) - Number(a.connected);
        return a.name.localeCompare(b.name, "fr");
      }),
    [players]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application({
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });
    appRef.current = app;

    const world = new Container();
    const overlay = new Container();
    const seatsLayer = new Container();

    const table = new TableBackground();
    const centerInfo = new CenterInfo();

    world.addChild(table.view, seatsLayer, centerInfo.view);
    app.stage.addChild(world, overlay);

    worldRef.current = world;
    overlayRef.current = overlay;
    seatsLayerRef.current = seatsLayer;
    tableRef.current = table;
    centerRef.current = centerInfo;

    const deckContainer = new Container();
    overlay.addChild(deckContainer);
    deckContainerRef.current = deckContainer;

    host.appendChild(app.view as HTMLCanvasElement);

    const updateViewport = () => {
      const nextWidth = Math.max(1, host.clientWidth);
      const nextHeight = Math.max(1, host.clientHeight);
      app.renderer.resize(nextWidth, nextHeight);
      viewportRef.current = { width: nextWidth, height: nextHeight };
      setViewportTick((v) => v + 1);
    };

    updateViewport();
    const ro = new ResizeObserver(() => updateViewport());
    ro.observe(host);

    return () => {
      ro.disconnect();
      seatMapRef.current.forEach((seat) => seat.destroy());
      seatMapRef.current.clear();

      table.destroy();
      centerInfo.destroy();

      deckRef.current?.destroy();
      deckRef.current = null;
      deckModeRef.current = null;

      if (deckTitleRef.current) {
        deckTitleRef.current.destroy();
        deckTitleRef.current = null;
      }

      app.destroy(true, true);
      appRef.current = null;
      worldRef.current = null;
      overlayRef.current = null;
      seatsLayerRef.current = null;
      tableRef.current = null;
      centerRef.current = null;
      deckContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const world = worldRef.current;
    const overlay = overlayRef.current;
    const seatsLayer = seatsLayerRef.current;
    const table = tableRef.current;
    const center = centerRef.current;
    const deckContainer = deckContainerRef.current;
    if (!app || !world || !overlay || !seatsLayer || !table || !center || !deckContainer) return;

    const width = viewportRef.current.width;
    const height = viewportRef.current.height;
    const isMobile = width < 760;
    const seats = sortedPlayers.slice(0, 10);

    const deckVisibleForMe = myRole === "player";
    const deckSpace = deckVisibleForMe ? (isMobile ? 148 : 190) : isMobile ? 20 : 12;

    const worldPaddingX = isMobile ? 6 : 10;
    const worldPaddingTop = isMobile ? 6 : 10;
    const worldAreaW = Math.max(1, width - worldPaddingX * 2);
    const worldAreaH = Math.max(1, height - deckSpace - worldPaddingTop - (isMobile ? 8 : 12));

    const fitScale = Math.min(worldAreaW / POKER_WORLD.width, worldAreaH / POKER_WORLD.height);
    const worldScale = clamp(fitScale, isMobile ? 0.44 : 0.52, 1.3);

    const worldW = POKER_WORLD.width * worldScale;
    const worldH = POKER_WORLD.height * worldScale;
    const worldX = Math.round((width - worldW) / 2);
    const worldY = Math.round(worldPaddingTop + (worldAreaH - worldH) / 2);

    world.scale.set(worldScale);
    world.position.set(worldX, worldY);

    const tableCenterX = POKER_WORLD.width * 0.5;
    const tableCenterY = isMobile ? POKER_WORLD.height * 0.42 : POKER_WORLD.height * 0.46;
    const tableRadiusX = isMobile ? 262 : 304;
    const tableRadiusY = isMobile ? 154 : 176;

    table.render({
      viewportWidth: POKER_WORLD.width,
      viewportHeight: POKER_WORLD.height,
      centerX: tableCenterX,
      centerY: tableCenterY,
      radiusX: tableRadiusX,
      radiusY: tableRadiusY,
    });

    const activeSeatIds = new Set(seats.map((player) => player.socketId));
    for (const [socketId, seat] of seatMapRef.current) {
      if (activeSeatIds.has(socketId)) continue;
      seatsLayer.removeChild(seat.view);
      seat.destroy();
      seatMapRef.current.delete(socketId);
    }

    const shouldAnimateReveal = revealed && !prevRevealedRef.current;

    const seatRadiusX = tableRadiusX + (isMobile ? 114 : 136);
    const seatRadiusY = tableRadiusY + (isMobile ? 82 : 92);

    seats.forEach((player, index) => {
      let seat = seatMapRef.current.get(player.socketId);
      if (!seat) {
        seat = new PlayerSeat({
          cardWidth: isMobile ? 52 : 74,
          cardHeight: isMobile ? 70 : 98,
        });
        seatMapRef.current.set(player.socketId, seat);
        seatsLayer.addChild(seat.view);
      }

      const angle = getSeatAngle(index, seats.length, isMobile);
      const avatarX = tableCenterX + Math.cos(angle) * seatRadiusX;
      const avatarY = tableCenterY + Math.sin(angle) * seatRadiusY;

      const toCenterX = tableCenterX - avatarX;
      const toCenterY = tableCenterY - avatarY;
      const len = Math.hypot(toCenterX, toCenterY) || 1;
      const dirX = toCenterX / len;
      const dirY = toCenterY / len;
      const outwardX = -dirX;
      const outwardY = -dirY;

      const cardX = avatarX + dirX * (isMobile ? 38 : 46);
      const cardY = avatarY + dirY * (isMobile ? 38 : 46);

      seat.setLayout({
        avatarX,
        avatarY,
        cardX,
        cardY,
        nameX: avatarX + outwardX * (isMobile ? 28 : 34),
        nameY: avatarY + outwardY * (isMobile ? 28 : 34),
        badgeX: avatarX + outwardX * (isMobile ? 54 : 64),
        badgeY: avatarY + outwardY * (isMobile ? 52 : 60),
      });

      seat.renderPlayer(player, {
        isMe: player.socketId === myPlayerId,
        revealed,
      });

      const valueToShow = revealed ? player.vote ?? "-" : player.hasVoted ? "" : "...";
      const selected = player.socketId === myPlayerId && !!player.hasVoted && !revealed;
      const hidden = !revealed && player.hasVoted;

      const previous = prevPlayersRef.current.get(player.socketId);
      if (shouldAnimateReveal) {
        seat.setCardState({
          value: valueToShow,
          selected,
          hidden: false,
          animateFlip: true,
          flipDelay: index * 95,
        });
      } else if (!revealed && previous && !previous.hasVoted && player.hasVoted) {
        seat.pulseVoteFeedback();
        seat.setCardState({
          value: valueToShow,
          selected,
          hidden: true,
          animateFlip: true,
        });
      } else {
        seat.setCardState({
          value: valueToShow,
          selected,
          hidden,
        });
      }
    });

    const playerCount = players.filter((player) => player.role === "player").length;
    const votedCount = players.filter((player) => player.role === "player" && player.hasVoted).length;
    const status = getSessionStatus({ revealed, voted: votedCount, active: playerCount });

    center.render({
      centerX: tableCenterX,
      centerY: tableCenterY,
      width: isMobile ? 272 : 330,
      height: isMobile ? 108 : 128,
      storyTitle: storyTitle || `Story #${round}`,
      voteSystem,
      status,
      voted: votedCount,
      total: playerCount,
    });

    const nextDeckMode = isMobile ? "mobile" : "desktop";
    if (!deckRef.current || deckModeRef.current !== nextDeckMode) {
      deckRef.current?.destroy();
      deckRef.current = new PokerDeck({
        values: cardValues,
        cardWidth: isMobile ? 42 : 56,
        cardHeight: isMobile ? 58 : 80,
        onSelect: onVoteCard,
      });
      deckModeRef.current = nextDeckMode;

      deckContainer.removeChildren().forEach((node) => node.destroy({ children: true }));
      deckContainer.addChild(deckRef.current.view);

      if (deckTitleRef.current) {
        deckTitleRef.current.destroy();
        deckTitleRef.current = null;
      }

      const title = new Text("", new TextStyle({
        fontFamily: "'Press Start 2P', monospace",
        fill: 0xcffafe,
        fontSize: isMobile ? 9 : 10,
        align: "center",
      }));
      title.anchor.set(0.5);
      deckTitleRef.current = title;
      overlay.addChild(title);
    }

    const deck = deckRef.current;
    if (!deck) return;

    deck.setValues(cardValues);
    deck.setSelectedValue(myVote);
    deck.setInteractive(deckVisibleForMe && !revealed);
    deck.view.visible = deckVisibleForMe;

    if (deckVisibleForMe) {
      const maxDeckWidth = Math.max(220, width - (isMobile ? 16 : 36));
      deck.resize({
        width: maxDeckWidth,
        columnsOverride: isMobile ? Math.min(5, cardValues.length) : undefined,
        gapOverride: isMobile ? 7 : 10,
      });

      const title = deckTitleRef.current;
      if (title) {
        title.text = revealed ? "Votes reveles" : "Choisis ta carte";
        title.position.set(width / 2, height - (isMobile ? 118 : 154));
        title.visible = true;
      }

      deck.view.position.set(width / 2, height - (isMobile ? 60 : 86));
    } else if (deckTitleRef.current) {
      deckTitleRef.current.visible = false;
    }

    prevPlayersRef.current = new Map(
      seats.map((player) => [
        player.socketId,
        {
          hasVoted: player.hasVoted,
          vote: player.vote,
        },
      ])
    );
    prevRevealedRef.current = revealed;
  }, [
    cardValues,
    myPlayerId,
    myRole,
    myVote,
    onVoteCard,
    players,
    revealed,
    round,
    sortedPlayers,
    storyTitle,
    voteSystem,
    viewportTick,
  ]);

  return <div ref={hostRef} className="h-full w-full" />;
};
