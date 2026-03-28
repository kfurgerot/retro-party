import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Text, TextStyle } from "pixi.js";
import { PlanningPokerPlayer, PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { PokerDeck } from "./PokerDeck";
import { PokerTableScene } from "./PokerTableScene";
import { POKER_WORLD, clamp } from "./sceneTheme";
import { TableCameraController } from "./TableCameraController";

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
  const cameraRef = useRef<TableCameraController | null>(null);
  const tableSceneRef = useRef<PokerTableScene | null>(null);
  const overlayRef = useRef<Container | null>(null);

  const deckRef = useRef<PokerDeck | null>(null);
  const deckContainerRef = useRef<Container | null>(null);
  const deckTitleRef = useRef<Text | null>(null);

  const prevPlayersRef = useRef<Map<string, PlayerSnapshot>>(new Map());
  const prevRevealedRef = useRef(false);
  const prevMyVoteRef = useRef<string | null>(null);

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

    const camera = new TableCameraController();
    const tableScene = new PokerTableScene();
    const overlay = new Container();

    camera.world.addChild(tableScene.view);
    app.stage.addChild(camera.view, overlay);

    cameraRef.current = camera;
    tableSceneRef.current = tableScene;
    overlayRef.current = overlay;

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
      deckRef.current?.destroy();
      deckRef.current = null;
      if (deckTitleRef.current) {
        deckTitleRef.current.destroy();
        deckTitleRef.current = null;
      }
      tableScene.destroy();
      camera.destroy();
      app.destroy(true, true);

      appRef.current = null;
      cameraRef.current = null;
      tableSceneRef.current = null;
      overlayRef.current = null;
      deckContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    const tableScene = tableSceneRef.current;
    const overlay = overlayRef.current;
    const deckContainer = deckContainerRef.current;
    if (!camera || !tableScene || !overlay || !deckContainer) return;

    const width = viewportRef.current.width;
    const height = viewportRef.current.height;
    const isMobile = width < 760;

    const votingPlayers = sortedPlayers.filter((player) => player.role === "player").slice(0, 8);
    const localPlayer = myPlayerId ? votingPlayers.find((player) => player.socketId === myPlayerId) ?? null : null;
    const aroundPlayers = localPlayer
      ? votingPlayers.filter((player) => player.socketId !== localPlayer.socketId)
      : votingPlayers;

    const deckVisibleForMe = myRole === "player";
    const deckSpace = deckVisibleForMe ? (isMobile ? 186 : 196) : isMobile ? 22 : 14;

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

    tableScene.setLayoutMode(isMobile);

    const centerX = POKER_WORLD.width / 2;
    const centerY = isMobile ? POKER_WORLD.height * 0.44 : POKER_WORLD.height * 0.47;
    const radiusX = isMobile ? POKER_WORLD.width * 0.36 : POKER_WORLD.width * 0.39;
    const radiusY = isMobile ? POKER_WORLD.height * 0.2 : POKER_WORLD.height * 0.27;

    tableScene.renderTable({
      worldWidth: POKER_WORLD.width,
      worldHeight: POKER_WORLD.height,
      centerX,
      centerY,
      radiusX,
      radiusY,
    });

    const activeIds = new Set(votingPlayers.map((player) => player.socketId));
    tableScene.cleanupSeats(activeIds);

    const playerCount = players.filter((player) => player.role === "player").length;
    const votedCount = players.filter((player) => player.role === "player" && player.hasVoted).length;
    const shouldAnimateReveal = revealed && !prevRevealedRef.current;
    const status = getSessionStatus({ revealed, voted: votedCount, active: playerCount });

    const seatAnchors = new Map<string, { x: number; y: number }>();

    if (aroundPlayers.length > 0) {
      const start = isMobile ? -Math.PI * 0.94 : -Math.PI * 0.9;
      const end = isMobile ? -Math.PI * 0.06 : -Math.PI * 0.1;
      const span = end - start;

      aroundPlayers.forEach((player, index) => {
        const seat = tableScene.ensureSeat(player, isMobile, false);
        const angle = aroundPlayers.length <= 1 ? -Math.PI / 2 : start + (span * index) / (aroundPlayers.length - 1);

        const seatX = centerX + Math.cos(angle) * radiusX;
        const seatY = centerY + Math.sin(angle) * radiusY;
        const depth = (seatY - centerY) / Math.max(1, radiusY);
        const seatScale = isMobile ? 0.9 + depth * 0.07 : 0.92 + depth * 0.11;
        const yOffset = depth * (isMobile ? 8 : 12);
        const cardRotation = clamp(Math.cos(angle) * 0.16, -0.16, 0.16);

        if (isMobile) {
          seat.setMobileLayout({
            seatX,
            seatY,
            yOffset,
            seatScale,
            cardRotation,
            isLocal: false,
          });
        } else {
          seat.setIsometricLayout({
            seatX,
            seatY,
            yOffset,
            seatScale,
            cardRotation,
          });
        }

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
    }

    if (localPlayer) {
      const seat = tableScene.ensureSeat(localPlayer, isMobile, true);
      const localX = centerX;
      const localY = isMobile ? POKER_WORLD.height * 0.82 : POKER_WORLD.height * 0.83;

      if (isMobile) {
        seat.setMobileLayout({
          seatX: localX,
          seatY: localY,
          yOffset: 10,
          seatScale: 1.03,
          cardRotation: 0,
          isLocal: true,
        });
      } else {
        seat.setIsometricLayout({
          seatX: localX,
          seatY: localY,
          yOffset: 8,
          seatScale: 1.06,
          cardRotation: 0,
        });
      }
      seat.renderPlayer(localPlayer, { isMe: true, revealed });

      const valueToShow = revealed ? localPlayer.vote ?? "-" : localPlayer.hasVoted ? "" : "...";
      const hidden = !revealed && localPlayer.hasVoted;
      const previous = prevPlayersRef.current.get(localPlayer.socketId);

      if (shouldAnimateReveal) {
        seat.setCardState({
          value: valueToShow,
          selected: !!localPlayer.hasVoted && !revealed,
          hidden: false,
          animateFlip: true,
          flipDelay: aroundPlayers.length * 80,
        });
      } else if (!revealed && previous && !previous.hasVoted && localPlayer.hasVoted) {
        seat.pulseVoteFeedback();
        seat.setCardState({ value: valueToShow, selected: true, hidden: true, animateFlip: true });
      } else {
        seat.setCardState({ value: valueToShow, selected: !!localPlayer.hasVoted && !revealed, hidden });
      }

      seatAnchors.set(localPlayer.socketId, { x: localX, y: localY });
    }

    tableScene.renderCenter({
      centerX,
      centerY,
      isMobile,
      storyTitle,
      round,
      voteSystem,
      status,
      voted: votedCount,
      total: playerCount,
    });

    tableScene.localArea.render({
      worldWidth: POKER_WORLD.width,
      worldHeight: POKER_WORLD.height,
      isMobile,
      player: localPlayer,
      myVote,
      revealed,
    });

    const nextDeckMode = isMobile ? "mobile" : "desktop";
    if (!deckRef.current || deckModeRef.current !== nextDeckMode) {
      deckRef.current?.destroy();
      deckRef.current = new PokerDeck({
        values: cardValues,
        cardWidth: isMobile ? 34 : 58,
        cardHeight: isMobile ? 48 : 82,
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
      const mobileColumns = Math.max(1, Math.ceil(cardValues.length / 2));
      deck.resize({
        width: Math.max(220, width - (isMobile ? 12 : 36)),
        columnsOverride: isMobile ? mobileColumns : cardValues.length,
        gapOverride: isMobile ? 5 : 10,
        forceSingleRow: !isMobile,
      });

      if (deckTitleRef.current) {
        deckTitleRef.current.text = revealed ? "Votes reveles" : "Choisis ta carte";
        deckTitleRef.current.position.set(width / 2, height - (isMobile ? 108 : 152));
        deckTitleRef.current.visible = true;
      }
      deck.view.position.set(width / 2, height - (isMobile ? 44 : 88));
    } else if (deckTitleRef.current) {
      deckTitleRef.current.visible = false;
    }

    const myAnchor = myPlayerId ? seatAnchors.get(myPlayerId) : null;

    if (shouldAnimateReveal) {
      camera.focusReveal(centerX, centerY, isMobile);
    } else if (!revealed && myVote && prevMyVoteRef.current !== myVote && myAnchor) {
      camera.focusPlayerVote(myAnchor.x, myAnchor.y, isMobile);
    } else {
      camera.reset(220);
    }

    prevPlayersRef.current = new Map(
      votingPlayers.map((player) => [
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

