import React, { useEffect, useMemo, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { AVATARS, Player, Tile } from "@/types/game";

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
  movingPlayerId: string | null;
  focusedPosition: number | null;
  highlightedPathEdges: Set<string>;
  pendingPathChoiceAtTileId?: number;
  pendingPathChoiceOptions: number[];
  canChoosePath: boolean;
  floatingDeltas: PixiFloatingDelta[];
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
  movingPlayerId,
  focusedPosition,
  highlightedPathEdges,
  pendingPathChoiceAtTileId,
  pendingPathChoiceOptions,
  canChoosePath,
  floatingDeltas,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);

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
