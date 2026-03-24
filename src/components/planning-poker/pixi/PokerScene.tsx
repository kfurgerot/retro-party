import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Text, TextStyle } from "pixi.js";
import { PlanningPokerPlayer, PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { CameraContainer } from "./CameraContainer";
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
  const cameraRef = useRef<CameraContainer | null>(null);
  const overlayRef = useRef<Container | null>(null);

  const tableRef = useRef<TableBackground | null>(null);
  const centerRef = useRef<CenterInfo | null>(null);
  const seatsLayerRef = useRef<Container | null>(null);

  const seatMapRef = useRef<Map<string, PlayerSeat>>(new Map());
  const seatModeRef = useRef<"mobile" | "desktop" | null>(null);

  const deckRef = useRef<PokerDeck | null>(null);
  const deckContainerRef = useRef<Container | null>(null);
  const deckTitleRef = useRef<Text | null>(null);

  const prevPlayersRef = useRef<Map<string, PlayerSnapshot>>(new Map());
  const prevRevealedRef = useRef(false);
  const prevMyVoteRef = useRef<string | null>(null);

  const viewportRef = useRef({ width: 1, height: 1 });
  const deckModeRef = useRef<"mobile" | "desktop" | null>(null);
  const cameraResetTimeoutRef = useRef<number | null>(null);

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

    const camera = new CameraContainer();
    const overlay = new Container();
    const seatsLayer = new Container();
    seatsLayer.sortableChildren = true;

    const table = new TableBackground();
    const centerInfo = new CenterInfo();

    camera.world.addChild(table.view, seatsLayer, centerInfo.view);
    app.stage.addChild(camera.view, overlay);

    cameraRef.current = camera;
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

      if (cameraResetTimeoutRef.current) {
        window.clearTimeout(cameraResetTimeoutRef.current);
        cameraResetTimeoutRef.current = null;
      }

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

      camera.destroy();

      app.destroy(true, true);
      appRef.current = null;
      cameraRef.current = null;
      overlayRef.current = null;
      seatsLayerRef.current = null;
      tableRef.current = null;
      centerRef.current = null;
      deckContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const camera = cameraRef.current;
    const overlay = overlayRef.current;
    const seatsLayer = seatsLayerRef.current;
    const table = tableRef.current;
    const center = centerRef.current;
    const deckContainer = deckContainerRef.current;
    if (!app || !camera || !overlay || !seatsLayer || !table || !center || !deckContainer) return;

    const width = viewportRef.current.width;
    const height = viewportRef.current.height;
    const isMobile = width < 760;
    const seats = sortedPlayers.slice(0, 10);

    const seatMode = isMobile ? "mobile" : "desktop";
    if (seatModeRef.current !== seatMode) {
      seatMapRef.current.forEach((seat) => seat.destroy());
      seatMapRef.current.clear();
      seatModeRef.current = seatMode;
    }

    const deckVisibleForMe = myRole === "player";
    const deckSpace = deckVisibleForMe ? (isMobile ? 214 : 194) : isMobile ? 18 : 12;

    camera.setBase({
      viewportWidth: width,
      viewportHeight: height,
      worldWidth: POKER_WORLD.width,
      worldHeight: POKER_WORLD.height,
      topPadding: isMobile ? 8 : 10,
      bottomPadding: deckSpace,
      minScale: isMobile ? 0.5 : 0.52,
      maxScale: 1.32,
    });

    // Desktop rules requested: center and radii directly derived from viewport/world dimensions.
    const centerX = POKER_WORLD.width / 2;
    const centerY = POKER_WORLD.height / 2;
    const radiusX = POKER_WORLD.width * 0.35;
    const radiusY = POKER_WORLD.height * 0.22;

    table.render({
      viewportWidth: POKER_WORLD.width,
      viewportHeight: POKER_WORLD.height,
      centerX,
      centerY,
      radiusX,
      radiusY,
    });

    const activeSeatIds = new Set(seats.map((player) => player.socketId));
    for (const [socketId, seat] of seatMapRef.current) {
      if (activeSeatIds.has(socketId)) continue;
      seatsLayer.removeChild(seat.view);
      seat.destroy();
      seatMapRef.current.delete(socketId);
    }

    const playerCount = players.filter((player) => player.role === "player").length;
    const votedCount = players.filter((player) => player.role === "player" && player.hasVoted).length;
    const shouldAnimateReveal = revealed && !prevRevealedRef.current;
    const status = getSessionStatus({ revealed, voted: votedCount, active: playerCount });

    const seatAnchors = new Map<string, { x: number; y: number }>();

    if (!isMobile) {
      const angleStep = (Math.PI * 2) / Math.max(1, seats.length);

      seats.forEach((player, index) => {
        let seat = seatMapRef.current.get(player.socketId);
        if (!seat) {
          seat = new PlayerSeat({ cardWidth: 76, cardHeight: 102 });
          seatMapRef.current.set(player.socketId, seat);
          seatsLayer.addChild(seat.view);
        }

        const angle = -Math.PI / 2 + angleStep * index;
        const seatX = centerX + Math.cos(angle) * radiusX;
        const seatY = centerY + Math.sin(angle) * radiusY;

        const seatScale = 0.85 + Math.sin(angle) * 0.15;
        const yOffset = Math.sin(angle) * 20;
        const cardRotation = clamp(Math.sin(angle) * 0.28, -0.28, 0.28);

        seat.setIsometricLayout({ seatX, seatY, yOffset, seatScale, cardRotation });
        seat.renderPlayer(player, { isMe: player.socketId === myPlayerId, revealed });

        const valueToShow = revealed ? player.vote ?? "-" : player.hasVoted ? "" : "...";
        const selected = player.socketId === myPlayerId && !!player.hasVoted && !revealed;
        const hidden = !revealed && player.hasVoted;
        const previous = prevPlayersRef.current.get(player.socketId);

        if (shouldAnimateReveal) {
          seat.setCardState({ value: valueToShow, selected, hidden: false, animateFlip: true, flipDelay: index * 95 });
        } else if (!revealed && previous && !previous.hasVoted && player.hasVoted) {
          seat.pulseVoteFeedback();
          seat.setCardState({ value: valueToShow, selected, hidden: true, animateFlip: true });
        } else {
          seat.setCardState({ value: valueToShow, selected, hidden });
        }

        seatAnchors.set(player.socketId, { x: seatX, y: seatY });
      });
    } else {
      const localIndex = seats.findIndex((player) => player.socketId === myPlayerId);
      const localPlayer = localIndex >= 0 ? seats[localIndex] : null;
      const others = seats.filter((player) => player.socketId !== myPlayerId);

      const mobileCenterY = centerY - 56;
      const mobileRadiusX = POKER_WORLD.width * 0.36;
      const mobileRadiusY = POKER_WORLD.height * 0.2;

      others.forEach((player, index) => {
        let seat = seatMapRef.current.get(player.socketId);
        if (!seat) {
          seat = new PlayerSeat({ cardWidth: 60, cardHeight: 84 });
          seatMapRef.current.set(player.socketId, seat);
          seatsLayer.addChild(seat.view);
        }

        const spread = Math.PI * 1.1;
        const start = -Math.PI - spread / 2;
        const angle = start + (spread * index) / Math.max(1, others.length - 1);

        const seatX = centerX + Math.cos(angle) * mobileRadiusX;
        const seatY = mobileCenterY + Math.sin(angle) * mobileRadiusY;
        const seatScale = 0.82 + Math.sin(angle) * 0.08;
        const yOffset = Math.sin(angle) * 12;

        seat.setMobileLayout({
          seatX,
          seatY,
          yOffset,
          seatScale,
          cardRotation: clamp(Math.sin(angle) * 0.2, -0.2, 0.2),
          isLocal: false,
        });
        seat.renderPlayer(player, { isMe: false, revealed });

        const valueToShow = revealed ? player.vote ?? "-" : player.hasVoted ? "" : "...";
        const hidden = !revealed && player.hasVoted;
        const previous = prevPlayersRef.current.get(player.socketId);

        if (shouldAnimateReveal) {
          seat.setCardState({ value: valueToShow, selected: false, hidden: false, animateFlip: true, flipDelay: index * 80 });
        } else if (!revealed && previous && !previous.hasVoted && player.hasVoted) {
          seat.pulseVoteFeedback();
          seat.setCardState({ value: valueToShow, selected: false, hidden: true, animateFlip: true });
        } else {
          seat.setCardState({ value: valueToShow, selected: false, hidden });
        }

        seatAnchors.set(player.socketId, { x: seatX, y: seatY });
      });

      if (localPlayer) {
        let seat = seatMapRef.current.get(localPlayer.socketId);
        if (!seat) {
          seat = new PlayerSeat({ cardWidth: 68, cardHeight: 94 });
          seatMapRef.current.set(localPlayer.socketId, seat);
          seatsLayer.addChild(seat.view);
        }

        const seatX = centerX;
        const seatY = POKER_WORLD.height * 0.82;
        seat.setMobileLayout({
          seatX,
          seatY,
          yOffset: 10,
          seatScale: 1.03,
          cardRotation: 0,
          isLocal: true,
        });
        seat.renderPlayer(localPlayer, { isMe: true, revealed });

        const valueToShow = revealed ? localPlayer.vote ?? "-" : localPlayer.hasVoted ? "" : "...";
        const hidden = !revealed && localPlayer.hasVoted;
        const previous = prevPlayersRef.current.get(localPlayer.socketId);

        if (shouldAnimateReveal) {
          seat.setCardState({ value: valueToShow, selected: !!localPlayer.hasVoted && !revealed, hidden: false, animateFlip: true, flipDelay: others.length * 80 });
        } else if (!revealed && previous && !previous.hasVoted && localPlayer.hasVoted) {
          seat.pulseVoteFeedback();
          seat.setCardState({ value: valueToShow, selected: true, hidden: true, animateFlip: true });
        } else {
          seat.setCardState({ value: valueToShow, selected: !!localPlayer.hasVoted && !revealed, hidden });
        }

        seatAnchors.set(localPlayer.socketId, { x: seatX, y: seatY });
      }
    }

    center.render({
      centerX,
      centerY: isMobile ? centerY - 44 : centerY,
      width: isMobile ? 292 : 340,
      height: isMobile ? 116 : 128,
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
        cardWidth: isMobile ? 38 : 58,
        cardHeight: isMobile ? 54 : 82,
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
      deck.resize({
        width: Math.max(220, width - (isMobile ? 12 : 36)),
        columnsOverride: isMobile ? Math.min(5, cardValues.length) : cardValues.length,
        gapOverride: isMobile ? 6 : 10,
        forceSingleRow: !isMobile,
      });

      if (deckTitleRef.current) {
        deckTitleRef.current.text = revealed ? "Votes reveles" : "Choisis ta carte";
        deckTitleRef.current.position.set(width / 2, height - (isMobile ? 118 : 152));
        deckTitleRef.current.visible = true;
      }
      deck.view.position.set(width / 2, height - (isMobile ? 52 : 88));
    } else if (deckTitleRef.current) {
      deckTitleRef.current.visible = false;
    }

    const myAnchor = myPlayerId ? seatAnchors.get(myPlayerId) : null;

    if (cameraResetTimeoutRef.current) {
      window.clearTimeout(cameraResetTimeoutRef.current);
      cameraResetTimeoutRef.current = null;
    }

    if (shouldAnimateReveal) {
      camera.focus(centerX, centerY, isMobile ? 1.2 : 1.12, 320);
      cameraResetTimeoutRef.current = window.setTimeout(() => {
        camera.reset(560);
        cameraResetTimeoutRef.current = null;
      }, 420);
    } else if (!revealed && myVote && prevMyVoteRef.current !== myVote && myAnchor) {
      camera.focus(myAnchor.x, myAnchor.y, isMobile ? 1.22 : 1.1, 260);
      cameraResetTimeoutRef.current = window.setTimeout(() => {
        camera.reset(420);
        cameraResetTimeoutRef.current = null;
      }, 300);
    } else {
      camera.reset(220);
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
    prevMyVoteRef.current = myVote;
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
