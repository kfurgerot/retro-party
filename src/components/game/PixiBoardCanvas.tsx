import React, { useEffect, useMemo, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { AVATARS, Player, Tile } from "@/types/game";
import { FancyButton } from "@pixi/ui";
import { BoardActionOverlay } from "./gameBoardTypes";

type Point = { x: number; y: number };

export type PixiFloatingDelta = {
  id: string;
  x: number;
  y: number;
  text: string;
  positive: boolean;
};

interface PixiBoardCanvasProps {
  width: number;
  height: number;
  scale: number;
  offset: Point;
  tiles: Tile[];
  points: Point[];
  tileCenter: number;
  tileSize: number;
  playersByTile: Map<number, Player[]>;
  playerDisplayPositions: Record<string, number>;
  focusPlayerId?: string | null;
  movingPlayerId: string | null;
  focusedPosition: number | null;
  highlightedPathEdges: Set<string>;
  pendingPathChoiceAtTileId?: number;
  pendingPathChoiceOptions: number[];
  canChoosePath: boolean;
  floatingDeltas: PixiFloatingDelta[];
  actionOverlay?: BoardActionOverlay | null;
}

const TILE_HEX_COLORS: Record<string, number> = {
  blue: 0x38bdf8,
  red: 0xfb7185,
  green: 0x34d399,
  purple: 0xa78bfa,
  violet: 0xa78bfa,
  star: 0xfbbf24,
  yellow: 0xfbbf24,
  bonus: 0xfbbf24,
  shop: 0xfb923c,
  start: 0x334155,
};

const TILE_ICON: Record<string, string> = {
  blue: "💬",
  red: "🔥",
  green: "🔧",
  purple: "🎯",
  violet: "🎯",
  star: "🎁",
  yellow: "🎁",
  bonus: "🎁",
  shop: "🛒",
  start: "▶",
};

export const PixiBoardCanvas: React.FC<PixiBoardCanvasProps> = ({
  width,
  height,
  scale,
  offset,
  tiles,
  points,
  tileCenter,
  tileSize,
  playersByTile,
  playerDisplayPositions,
  focusPlayerId = null,
  movingPlayerId,
  focusedPosition,
  highlightedPathEdges,
  pendingPathChoiceAtTileId,
  pendingPathChoiceOptions,
  canChoosePath,
  floatingDeltas,
  actionOverlay = null,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const uiRef = useRef<Container | null>(null);

  const sharedStyles = useMemo(
    () => ({
      tileIcon: new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0x0f172a,
        fontSize: 14,
      }),
      tileIndex: new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0xe2e8f0,
        fontSize: 9,
      }),
      avatar: new TextStyle({
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fill: 0x0f172a,
        fontSize: 16,
      }),
      overflow: new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0x0f172a,
        fontSize: 10,
      }),
      floatingDeltaPositive: new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0x86efac,
        fontSize: 18,
        stroke: 0x0f172a,
        strokeThickness: 2,
      }),
      floatingDeltaNegative: new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0xfda4af,
        fontSize: 18,
        stroke: 0x0f172a,
        strokeThickness: 2,
      }),
    }),
    []
  );

  useEffect(() => {
    let isDisposed = false;
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
    worldRef.current = world;
    app.stage.addChild(world);

    const uiLayer = new Container();
    uiRef.current = uiLayer;
    app.stage.addChild(uiLayer);

    host.appendChild(app.view as HTMLCanvasElement);

    const resizeObserver = new ResizeObserver(() => {
      const nextW = Math.max(1, host.clientWidth);
      const nextH = Math.max(1, host.clientHeight);
      app.renderer.resize(nextW, nextH);
    });
    resizeObserver.observe(host);

    return () => {
      if (isDisposed) return;
      isDisposed = true;
      resizeObserver.disconnect();
      app.destroy(true, true);
      appRef.current = null;
      worldRef.current = null;
      uiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.position.set(offset.x, offset.y);
    world.scale.set(scale, scale);
  }, [offset.x, offset.y, scale]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    world.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });

    const edges = new Graphics();
    tiles.forEach((tile) => {
      const from = points[tile.id];
      if (!from) return;
      const nextIds = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [tile.id + 1];
      nextIds
        .filter((id) => id >= 0 && id < points.length)
        .forEach((nextId) => {
          const to = points[nextId];
          const isHighlighted = highlightedPathEdges.has(`${tile.id}-${nextId}`);
          const fromX = from.x + tileCenter;
          const fromY = from.y + tileCenter;
          const toX = to.x + tileCenter;
          const toY = to.y + tileCenter;
          edges.lineStyle(12, 0x0f172a, 0.75, 0.5, true);
          edges.moveTo(fromX, fromY);
          edges.lineTo(toX, toY);
          edges.lineStyle(isHighlighted ? 7 : 5, isHighlighted ? 0xfacc15 : 0x7dd3fc, isHighlighted ? 0.95 : 0.6, 0.5, true);
          edges.moveTo(fromX, fromY);
          edges.lineTo(toX, toY);
        });
    });
    world.addChild(edges);

    if (pendingPathChoiceAtTileId != null) {
      const from = points[pendingPathChoiceAtTileId];
      if (from) {
        const hints = new Graphics();
        pendingPathChoiceOptions
          .filter((id) => id >= 0 && id < points.length)
          .forEach((nextId) => {
            const to = points[nextId];
            if (!to) return;
            const fromX = from.x + tileCenter;
            const fromY = from.y + tileCenter;
            const toX = to.x + tileCenter;
            const toY = to.y + tileCenter;
            const dx = toX - fromX;
            const dy = toY - fromY;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const tailX = fromX + ux * 20;
            const tailY = fromY + uy * 20;
            const headX = toX - ux * 22;
            const headY = toY - uy * 22;
            const leftX = headX - ux * 10 + -uy * 7;
            const leftY = headY - uy * 10 + ux * 7;
            const rightX = headX - ux * 10 - -uy * 7;
            const rightY = headY - uy * 10 - ux * 7;
            const color = canChoosePath ? 0xfbbf24 : 0x94a3b8;
            hints.lineStyle(6, color, canChoosePath ? 0.95 : 0.9, 0.5, true);
            hints.moveTo(tailX, tailY);
            hints.lineTo(headX, headY);
            hints.beginFill(color, canChoosePath ? 0.98 : 0.95);
            hints.drawPolygon([headX, headY, leftX, leftY, rightX, rightY]);
            hints.endFill();
          });
        world.addChild(hints);
      }
    }

    const tilesLayer = new Container();
    tiles.forEach((tile) => {
      const p = points[tile.id];
      if (!p) return;
      const tileColor = TILE_HEX_COLORS[tile.type] ?? 0x1e293b;
      const isFocused = focusedPosition === tile.id;
      const isPathOrigin = pendingPathChoiceAtTileId === tile.id;
      const isPathOption = pendingPathChoiceOptions.includes(tile.id);
      const showIndex = isPathOrigin || isPathOption;

      const rect = new Graphics();
      if (isFocused) {
        rect.lineStyle(5, 0xfcd34d, 0.85, 0.5, true);
      } else {
        rect.lineStyle(4, 0x020617, 1, 0.5, true);
      }
      rect.beginFill(tileColor, 1);
      rect.drawRoundedRect(p.x, p.y, tileSize, tileSize, 8);
      rect.endFill();
      tilesLayer.addChild(rect);

      const icon = new Text(TILE_ICON[tile.type] ?? "?", sharedStyles.tileIcon);
      icon.anchor.set(0.5);
      icon.x = p.x + tileCenter;
      icon.y = p.y + tileCenter + 1;
      tilesLayer.addChild(icon);

      if (showIndex) {
        const badge = new Graphics();
        badge.lineStyle(1, 0xcbd5e1, 0.35, 0.5, true);
        badge.beginFill(0x0f172a, 0.85);
        badge.drawRoundedRect(p.x + tileSize - 17, p.y - 7, 16, 12, 3);
        badge.endFill();
        tilesLayer.addChild(badge);

        const indexText = new Text(String(tile.id + 1), sharedStyles.tileIndex);
        indexText.anchor.set(0.5);
        indexText.x = p.x + tileSize - 9;
        indexText.y = p.y - 1;
        tilesLayer.addChild(indexText);
      }
    });
    world.addChild(tilesLayer);

    const playersLayer = new Container();
    tiles.forEach((tile) => {
      const p = points[tile.id];
      if (!p) return;
      const tilePlayers = playersByTile.get(tile.id) ?? [];
      tilePlayers.slice(0, 3).forEach((player, index) => {
        const px = p.x + tileCenter - ((Math.min(tilePlayers.length, 3) - 1) * 10) + index * 20;
        const py = p.y - 18;
        const chip = new Graphics();
        chip.lineStyle(2, Number.parseInt(player.color.replace("#", "0x"), 16) || 0xffffff, 1, 0.5, true);
        chip.beginFill(0xffffff, 1);
        chip.drawCircle(px, py, 14);
        chip.endFill();
        if (movingPlayerId === player.id) {
          chip.lineStyle(2, 0x67e8f9, 1, 0.5, true);
          chip.drawCircle(px, py, 16);
        }
        playersLayer.addChild(chip);

        const avatar = new Text(AVATARS[player.avatar] ?? ":)", sharedStyles.avatar);
        avatar.anchor.set(0.5);
        avatar.x = px;
        avatar.y = py + 0.5;
        playersLayer.addChild(avatar);
      });

      if (tilePlayers.length > 3) {
        const overflowX = p.x + tileCenter + 22;
        const overflowY = p.y - 18;
        const overflow = new Graphics();
        overflow.lineStyle(2, 0x020617, 1, 0.5, true);
        overflow.beginFill(0xffffff, 1);
        overflow.drawCircle(overflowX, overflowY, 14);
        overflow.endFill();
        playersLayer.addChild(overflow);

        const overflowText = new Text(`+${tilePlayers.length - 3}`, sharedStyles.overflow);
        overflowText.anchor.set(0.5);
        overflowText.x = overflowX;
        overflowText.y = overflowY;
        playersLayer.addChild(overflowText);
      }
    });
    world.addChild(playersLayer);

    const floatLayer = new Container();
    floatingDeltas.forEach((delta) => {
      const text = new Text(
        delta.text,
        delta.positive ? sharedStyles.floatingDeltaPositive : sharedStyles.floatingDeltaNegative
      );
      text.anchor.set(0.5);
      text.x = delta.x;
      text.y = delta.y;
      floatLayer.addChild(text);
    });
    world.addChild(floatLayer);
  }, [
    canChoosePath,
    floatingDeltas,
    focusedPosition,
    highlightedPathEdges,
    movingPlayerId,
    pendingPathChoiceAtTileId,
    pendingPathChoiceOptions,
    playersByTile,
    points,
    sharedStyles.avatar,
    sharedStyles.floatingDeltaNegative,
    sharedStyles.floatingDeltaPositive,
    sharedStyles.overflow,
    sharedStyles.tileIcon,
    sharedStyles.tileIndex,
    tileCenter,
    tileSize,
    tiles,
  ]);

  useEffect(() => {
    const uiLayer = uiRef.current;
    const app = appRef.current;
    if (!uiLayer) return;

    uiLayer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });

    if (!focusPlayerId || !actionOverlay) return;
    if (!actionOverlay.canRoll && !actionOverlay.canMove && !actionOverlay.canOpenQuestionCard && !actionOverlay.isRolling) {
      return;
    }

    let tileId = playerDisplayPositions[focusPlayerId];
    if (tileId == null) {
      for (const [candidateTileId, tilePlayers] of playersByTile.entries()) {
        if (tilePlayers.some((player) => player.id === focusPlayerId)) {
          tileId = candidateTileId;
          break;
        }
      }
    }
    if (tileId == null) return;
    const p = points[tileId];
    if (!p) return;

    const tilePlayers = playersByTile.get(tileId) ?? [];
    const playerIndex = tilePlayers.findIndex((player) => player.id === focusPlayerId);
    const shownCount = Math.min(tilePlayers.length, 3);

    let avatarX = p.x + tileCenter;
    if (playerIndex >= 0 && playerIndex < 3) {
      avatarX = p.x + tileCenter - ((shownCount - 1) * 10) + playerIndex * 20;
    } else if (playerIndex >= 3) {
      avatarX = p.x + tileCenter + 22;
    }
    const avatarY = p.y - 18;

    const anchorX = avatarX * scale + offset.x;
    const anchorY = avatarY * scale + offset.y;
    const actionScale = Math.max(0.72, Math.min(1.08, 0.8 + (scale - 0.7) * 0.2));

    const buttonWidth = 154;
    const buttonHeight = 42;
    const isCardMode = actionOverlay.canOpenQuestionCard;
    const topPanel = new Graphics();
    topPanel.lineStyle(2, 0x67e8f9, 0.45, 0.5, true);
    topPanel.beginFill(0x0f172a, 0.9);
    topPanel.drawRoundedRect(-94, -118, 188, 124, 12);
    topPanel.endFill();
    const separator = new Graphics();
    separator.lineStyle(2, 0x67e8f9, 0.3, 0.5, true);
    separator.moveTo(-76, -26);
    separator.lineTo(76, -26);

    const modeText = actionOverlay.canOpenQuestionCard
      ? "Ouvrir carte"
      : actionOverlay.canMove
        ? `Avancer ${actionOverlay.diceValue ?? ""}`.trim()
        : actionOverlay.canRoll
          ? "Lancer de"
          : "Action";
    const resolvedRollValue =
      actionOverlay.rollResult?.total ??
      (actionOverlay.diceValue != null ? actionOverlay.diceValue : null);

    const face = new Graphics();
    face.lineStyle(2, 0x0f172a, 0.95, 0.5, true);
    face.beginFill(0xf8fafc, 1);
    face.drawRoundedRect(-32, -95, 64, 64, 8);
    face.endFill();
    if (!isCardMode) {
      const rollLabel = actionOverlay.isRolling ? "?" : String(resolvedRollValue ?? "?");
      const valueFontSize = rollLabel.length > 1 ? 16 : 20;
      const valueText = new Text(
        rollLabel,
        new TextStyle({
          fontFamily: "Press Start 2P, monospace",
          fill: 0x0f172a,
          fontSize: valueFontSize,
        })
      );
      valueText.anchor.set(0.5);
      valueText.x = 0;
      valueText.y = -64;
      face.addChild(valueText);
    } else {
      // Small card icon to clearly distinguish "open card" from dice action.
      const backCard = new Graphics();
      backCard.lineStyle(2, 0x64748b, 0.7, 0.5, true);
      backCard.beginFill(0xe2e8f0, 1);
      backCard.drawRoundedRect(-10, -84, 26, 34, 5);
      backCard.endFill();
      face.addChild(backCard);

      const frontCard = new Graphics();
      frontCard.lineStyle(2, 0x0f172a, 0.95, 0.5, true);
      frontCard.beginFill(0xffffff, 1);
      frontCard.drawRoundedRect(-18, -78, 28, 38, 5);
      frontCard.endFill();
      face.addChild(frontCard);

      const cardContent = new Graphics();
      cardContent.beginFill(0x0f172a, 0.95);
      cardContent.drawCircle(-12, -72, 2);
      cardContent.drawCircle(4, -46, 2);
      cardContent.drawRect(-12, -65, 12, 2);
      cardContent.drawRect(-12, -60, 16, 2);
      cardContent.drawRect(-12, -55, 10, 2);
      cardContent.endFill();
      face.addChild(cardContent);
    }

    const defaultView = new Graphics();
    defaultView.lineStyle(2, 0x67e8f9, 0.55, 0.5, true);
    defaultView.beginFill(0x06b6d4, 0.92);
    defaultView.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
    defaultView.endFill();

    const hoverView = new Graphics();
    hoverView.lineStyle(2, 0xa5f3fc, 0.75, 0.5, true);
    hoverView.beginFill(0x22d3ee, 1);
    hoverView.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
    hoverView.endFill();

    const pressedView = new Graphics();
    pressedView.lineStyle(2, 0x67e8f9, 0.7, 0.5, true);
    pressedView.beginFill(0x0891b2, 0.95);
    pressedView.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
    pressedView.endFill();

    const actionButton = new FancyButton({
      defaultView,
      hoverView,
      pressedView,
      text: new Text(modeText, new TextStyle({
        fontFamily: "Press Start 2P, monospace",
        fill: 0x0f172a,
        fontSize: 9,
      })),
      anchor: 0.5,
      animations: {
        hover: { props: { scale: { x: 1.03, y: 1.03 } }, duration: 90 },
        pressed: { props: { scale: { x: 0.98, y: 0.98 } }, duration: 70 },
      },
    });
    actionButton.x = 0;
    actionButton.y = -2;
    actionButton.onPress.connect(() => {
      if (actionOverlay.canRoll) {
        actionOverlay.onRoll?.();
        return;
      }
      if (actionOverlay.canMove && actionOverlay.diceValue != null) {
        actionOverlay.onMove?.(actionOverlay.diceValue);
        return;
      }
      if (actionOverlay.canOpenQuestionCard) {
        actionOverlay.onOpenQuestionCard?.();
      }
    });

    const panelContainer = new Container();
    panelContainer.x = anchorX;
    panelContainer.y = anchorY;
    panelContainer.scale.set(actionScale);
    panelContainer.addChild(topPanel);
    panelContainer.addChild(face);
    panelContainer.addChild(separator);
    panelContainer.addChild(actionButton);
    panelContainer.eventMode = "static";

    uiLayer.addChild(panelContainer);
    let elapsed = 0;
    let tickerFn: ((delta: number) => void) | null = null;
    if (actionOverlay.isRolling && !isCardMode && app?.ticker) {
      // Dice rolling animation while backend resolves roll.
      let shownValue = 1;
      let switchAccumulator = 0;
      const rollingValueText = face.children.find((child) => child instanceof Text) as Text | undefined;
      tickerFn = (delta) => {
        elapsed += delta;
        switchAccumulator += delta;
        if (switchAccumulator >= 5) {
          shownValue = shownValue >= 6 ? 1 : shownValue + 1;
          if (rollingValueText) {
            rollingValueText.text = String(shownValue);
          }
          switchAccumulator = 0;
        }
        face.rotation = Math.sin(elapsed * 0.38) * 0.22;
        face.y = Math.sin(elapsed * 0.62) * 2.2;
        actionButton.innerView.rotation = Math.sin(elapsed * 0.2) * 0.03;
      };
      app.ticker.add(tickerFn);
    }

    return () => {
      if (tickerFn && app?.ticker) {
        app.ticker.remove(tickerFn);
      }
    };
  }, [
    actionOverlay,
    focusPlayerId,
    offset.x,
    offset.y,
    playerDisplayPositions,
    playersByTile,
    points,
    scale,
    tileCenter,
  ]);

  return (
    <div className="absolute inset-0 p-2">
      <div
        ref={hostRef}
        className="h-full w-full"
        style={{
          minWidth: Math.max(width, 1),
          minHeight: Math.max(height, 1),
        }}
      />
    </div>
  );
};

