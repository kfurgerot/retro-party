import React, { useEffect, useMemo, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { AVATARS } from "@/types/game";
import { PlanningPokerPlayer, PlanningPokerRole } from "@/types/planningPoker";
import { PokerCard } from "./PokerCard";
import { PokerDeck } from "./PokerDeck";

type PokerSceneProps = {
  players: PlanningPokerPlayer[];
  cardValues: string[];
  revealed: boolean;
  myPlayerId: string | null;
  myRole: PlanningPokerRole;
  myVote: string | null;
  onVoteCard: (value: string) => void;
};

type PlayerSnapshot = {
  hasVoted: boolean;
  vote: string | null;
};

const tableTextStyle = new TextStyle({
  fontFamily: "'Press Start 2P', monospace",
  fill: 0xcffafe,
  fontSize: 11,
});

const labelTextStyle = new TextStyle({
  fontFamily: "'Press Start 2P', monospace",
  fill: 0xe2e8f0,
  fontSize: 10,
});

export const PokerScene: React.FC<PokerSceneProps> = ({
  players,
  cardValues,
  revealed,
  myPlayerId,
  myRole,
  myVote,
  onVoteCard,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const rootRef = useRef<Container | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const boardTextLayerRef = useRef<Container | null>(null);
  const boardCardsRef = useRef<Map<string, PokerCard>>(new Map());
  const boardLabelsRef = useRef<Map<string, Text>>(new Map());
  const tableRef = useRef<Graphics | null>(null);
  const deckRef = useRef<PokerDeck | null>(null);
  const deckContainerRef = useRef<Container | null>(null);
  const prevPlayersRef = useRef<Map<string, PlayerSnapshot>>(new Map());
  const prevRevealedRef = useRef(false);

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

    const root = new Container();
    const boardLayer = new Container();
    const boardTextLayer = new Container();
    const deckContainer = new Container();
    const table = new Graphics();

    root.addChild(table, boardLayer, boardTextLayer, deckContainer);
    app.stage.addChild(root);

    rootRef.current = root;
    boardLayerRef.current = boardLayer;
    boardTextLayerRef.current = boardTextLayer;
    deckContainerRef.current = deckContainer;
    tableRef.current = table;

    host.appendChild(app.view as HTMLCanvasElement);

    const ro = new ResizeObserver(() => {
      app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      boardCardsRef.current.forEach((card) => card.destroy());
      boardCardsRef.current.clear();
      boardLabelsRef.current.clear();
      deckRef.current?.destroy();
      deckRef.current = null;
      app.destroy(true, true);
      appRef.current = null;
      rootRef.current = null;
      boardLayerRef.current = null;
      boardTextLayerRef.current = null;
      deckContainerRef.current = null;
      tableRef.current = null;
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const boardLayer = boardLayerRef.current;
    const boardTextLayer = boardTextLayerRef.current;
    const deckContainer = deckContainerRef.current;
    const table = tableRef.current;

    if (!app || !boardLayer || !boardTextLayer || !deckContainer || !table) return;

    const width = app.renderer.width;
    const height = app.renderer.height;

    const deckVisibleForMe = myRole === "player";

    table.clear();
    table.beginFill(0x020617, 0.6);
    table.drawRoundedRect(8, 8, width - 16, height - 16, 20);
    table.endFill();

    table.lineStyle(2, 0x22d3ee, 0.3);
    table.drawRoundedRect(8, 8, width - 16, height - 16, 20);

    table.beginFill(0x0f766e, 0.24);
    table.drawRoundedRect(22, 22, width - 44, Math.max(160, height * 0.6), 18);
    table.endFill();

    const boardTop = 46;
    const boardBottom = Math.max(boardTop + 150, height * 0.62);
    const boardHeight = boardBottom - boardTop;

    const maxPerRow = width < 640 ? 3 : 5;
    const rows = Math.max(1, Math.ceil(sortedPlayers.length / maxPerRow));
    const rowGap = rows > 1 ? Math.max(24, boardHeight / (rows + 1)) : 0;
    const cardWidth = Math.max(66, Math.min(96, Math.floor((width - 80) / Math.max(3, maxPerRow + 0.4))));
    const cardHeight = Math.round(cardWidth * 1.36);

    const activeIds = new Set(sortedPlayers.map((player) => player.socketId));

    for (const [socketId, card] of boardCardsRef.current) {
      if (activeIds.has(socketId)) continue;
      boardLayer.removeChild(card.view);
      card.destroy();
      boardCardsRef.current.delete(socketId);

      const oldLabel = boardLabelsRef.current.get(socketId);
      if (oldLabel) {
        boardTextLayer.removeChild(oldLabel);
        oldLabel.destroy();
        boardLabelsRef.current.delete(socketId);
      }
    }

    const shouldAnimateReveal = revealed && !prevRevealedRef.current;

    sortedPlayers.forEach((player, index) => {
      let card = boardCardsRef.current.get(player.socketId);
      if (!card) {
        card = new PokerCard({
          width: cardWidth,
          height: cardHeight,
          value: "",
          interactive: false,
          hidden: !revealed,
        });
        boardCardsRef.current.set(player.socketId, card);
        boardLayer.addChild(card.view);
      }

      const row = Math.floor(index / maxPerRow);
      const rowItems = sortedPlayers.slice(row * maxPerRow, row * maxPerRow + maxPerRow);
      const col = index % maxPerRow;
      const rowWidth = rowItems.length * cardWidth + Math.max(0, rowItems.length - 1) * 20;
      const startX = width / 2 - rowWidth / 2 + cardWidth / 2;
      const y = boardTop + cardHeight / 2 + row * (cardHeight + (rows > 1 ? rowGap - cardHeight : 0));

      card.view.position.set(startX + col * (cardWidth + 20), y);

      const valueToShow = revealed ? player.vote ?? "-" : player.hasVoted ? "" : "...";
      card.setValue(valueToShow);
      card.setSelected(player.socketId === myPlayerId && !!player.hasVoted && !revealed);

      if (shouldAnimateReveal) {
        card.setHidden(true);
        card.animateFlip(false, index * 90);
      } else {
        const isHidden = !revealed && player.hasVoted;
        const previous = prevPlayersRef.current.get(player.socketId);
        if (!revealed && previous && !previous.hasVoted && player.hasVoted) {
          card.animateFlip(true);
        } else {
          card.setHidden(isHidden);
        }
      }

      let label = boardLabelsRef.current.get(player.socketId);
      if (!label) {
        label = new Text("", labelTextStyle);
        label.anchor.set(0.5, 0);
        boardLabelsRef.current.set(player.socketId, label);
        boardTextLayer.addChild(label);
      }

      const avatar = AVATARS[player.avatar] ?? "??";
      const roleBadge = player.role === "spectator" ? "[Spec]" : "[Player]";
      const hostBadge = player.isHost ? "[Host]" : "";
      const status = player.connected ? "" : "[OFF]";
      const voteBadge = !revealed && player.hasVoted ? "• vote" : "";
      label.text = `${avatar} ${player.name} ${roleBadge} ${hostBadge} ${status} ${voteBadge}`.replace(/\s+/g, " ").trim();
      label.x = card.view.x;
      label.y = card.view.y + cardHeight / 2 + 8;
    });

    let deck = deckRef.current;
    if (!deck) {
      deck = new PokerDeck({
        values: cardValues,
        cardWidth: Math.max(58, Math.floor(cardWidth * 0.82)),
        cardHeight: Math.max(82, Math.floor(cardHeight * 0.82)),
        onSelect: onVoteCard,
      });
      deckRef.current = deck;
      deckContainer.addChild(deck.view);
    }

    deck.setValues(cardValues);
    deck.setSelectedValue(myVote);
    deck.setInteractive(deckVisibleForMe && !revealed);
    deck.resize({ width: width - 40 });

    deck.view.visible = deckVisibleForMe;
    if (deckVisibleForMe) {
      deck.view.position.set(width / 2, height - Math.max(96, (height - boardBottom) * 0.44));
      const titleText = new Text(revealed ? "Votes reveles" : "Choisis ta carte", tableTextStyle);
      titleText.anchor.set(0.5);
      titleText.position.set(width / 2, deck.view.y - 86);
      titleText.name = "deck-title";

      const previousTitle = boardTextLayer.getChildByName("deck-title");
      if (previousTitle) {
        boardTextLayer.removeChild(previousTitle);
        previousTitle.destroy();
      }
      boardTextLayer.addChild(titleText);
    } else {
      const previousTitle = boardTextLayer.getChildByName("deck-title");
      if (previousTitle) {
        boardTextLayer.removeChild(previousTitle);
        previousTitle.destroy();
      }
    }

    prevPlayersRef.current = new Map(
      sortedPlayers.map((player) => [
        player.socketId,
        {
          hasVoted: player.hasVoted,
          vote: player.vote,
        },
      ])
    );
    prevRevealedRef.current = revealed;
  }, [cardValues, myPlayerId, myRole, myVote, onVoteCard, revealed, sortedPlayers]);

  return <div ref={hostRef} className="h-full w-full" />;
};
