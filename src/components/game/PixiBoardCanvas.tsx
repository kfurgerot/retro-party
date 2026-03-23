import React, { useEffect, useMemo, useRef } from "react";
import { Application, Container, Graphics, Rectangle, Text, TextStyle } from "pixi.js";
import { AVATARS, Player, Tile } from "@/types/game";
import { fr } from "@/i18n/fr";
import { BoardActionOverlay } from "./gameBoardTypes";
import { createGameButton } from "./pixi-ui/GameButton";
import { createGamePanel } from "./pixi-ui/GamePanel";
import { createDiceResultCard } from "./pixi-ui/DiceResultCard";

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
  tileWidth: number;
  tileHeight: number;
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

const TILE_ELEVATION = 16;
const PAWN_LIFT = 14;
const KUDOBOX_LIFT = 26;
const SHOP_LIFT = 24;
const TILE_VISUAL_INSET_X = 7;
const TILE_VISUAL_INSET_Y = 4;

function shadeColor(hex: number, amount: number) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const apply = (value: number) => {
    if (amount >= 0) return Math.round(value + (255 - value) * amount);
    return Math.round(value * (1 + amount));
  };
  const nr = Math.max(0, Math.min(255, apply(r)));
  const ng = Math.max(0, Math.min(255, apply(g)));
  const nb = Math.max(0, Math.min(255, apply(b)));
  return (nr << 16) | (ng << 8) | nb;
}

function seededUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function isKudoboxTile(type: string) {
  const normalized = String(type ?? "").toLowerCase();
  return normalized === "bonus" || normalized === "yellow" || normalized === "star";
}

function isShopTile(type: string) {
  return String(type ?? "").toLowerCase() === "shop";
}

export const PixiBoardCanvas: React.FC<PixiBoardCanvasProps> = ({
  scale,
  offset,
  tiles,
  points,
  tileWidth,
  tileHeight,
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
  const tileHalfWidth = tileWidth / 2;
  const tileHalfHeight = tileHeight / 2;
  const drawHalfWidth = Math.max(8, tileHalfWidth - TILE_VISUAL_INSET_X);
  const drawHalfHeight = Math.max(6, tileHalfHeight - TILE_VISUAL_INSET_Y);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const uiRef = useRef<Container | null>(null);
  const legendExpandedRef = useRef<boolean | null>(null);

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
      kudobox: new TextStyle({
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fill: 0x0f172a,
        fontSize: 18,
      }),
      shop: new TextStyle({
        fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
        fill: 0x0f172a,
        fontSize: 16,
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
    const app = appRef.current;
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
          const fromX = from.x + tileHalfWidth;
          const fromY = from.y + tileHalfHeight;
          const toX = to.x + tileHalfWidth;
          const toY = to.y + tileHalfHeight;
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
            const fromX = from.x + tileHalfWidth;
            const fromY = from.y + tileHalfHeight;
            const toX = to.x + tileHalfWidth;
            const toY = to.y + tileHalfHeight;
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
    const tileShadows = new Graphics();
    const tileSides = new Graphics();
    const tileTopTexture = new Graphics();
    const tilesInDepthOrder = tiles
      .map((tile) => {
        const p = points[tile.id];
        if (!p) return null;
        const centerX = p.x + tileHalfWidth;
        const centerY = p.y + tileHalfHeight;
        return { tile, p, centerX, centerY };
      })
      .filter((entry): entry is { tile: Tile; p: Point; centerX: number; centerY: number } => !!entry)
      .sort((a, b) => (a.centerY - b.centerY) || (a.centerX - b.centerX));

    tilesInDepthOrder.forEach(({ tile, p, centerX, centerY }) => {
      const tileColor = TILE_HEX_COLORS[tile.type] ?? 0x1e293b;
      const tileColorLeft = shadeColor(tileColor, -0.3);
      const tileColorRight = shadeColor(tileColor, -0.42);
      const isFocused = focusedPosition === tile.id;
      const isPathOrigin = pendingPathChoiceAtTileId === tile.id;
      const isPathOption = pendingPathChoiceOptions.includes(tile.id);
      const showIndex = isPathOrigin || isPathOption;

      const topY = centerY - drawHalfHeight;
      const rightX = centerX + drawHalfWidth;
      const bottomY = centerY + drawHalfHeight;
      const leftX = centerX - drawHalfWidth;

      tileShadows.beginFill(0x020617, isFocused ? 0.34 : 0.24);
      tileShadows.drawEllipse(
        centerX + drawHalfWidth * 0.18,
        bottomY + TILE_ELEVATION + 3,
        drawHalfWidth * 0.86,
        drawHalfHeight * 0.42
      );
      tileShadows.endFill();

      tileSides.lineStyle(1, shadeColor(tileColorLeft, -0.08), 1, 0.5, true);
      tileSides.beginFill(tileColorLeft, 1);
      tileSides.drawPolygon([
        leftX, centerY,
        centerX, bottomY,
        centerX, bottomY + TILE_ELEVATION + 1,
        leftX, centerY + TILE_ELEVATION + 1,
      ]);
      tileSides.endFill();

      tileSides.lineStyle(1, shadeColor(tileColorRight, -0.08), 1, 0.5, true);
      tileSides.beginFill(tileColorRight, 1);
      tileSides.drawPolygon([
        rightX, centerY,
        centerX, bottomY,
        centerX, bottomY + TILE_ELEVATION + 1,
        rightX, centerY + TILE_ELEVATION + 1,
      ]);
      tileSides.endFill();

      const rect = new Graphics();
      if (isFocused) {
        rect.lineStyle(5, 0xfcd34d, 0.85, 0.5, true);
      } else {
        rect.lineStyle(4, 0x020617, 1, 0.5, true);
      }
      rect.beginFill(tileColor, 1);
      rect.moveTo(centerX, topY);
      rect.lineTo(rightX, centerY);
      rect.lineTo(centerX, bottomY);
      rect.lineTo(leftX, centerY);
      rect.lineTo(centerX, topY);
      rect.endFill();
      tilesLayer.addChild(rect);

      const textureColor = shadeColor(tileColor, 0.36);
      for (let i = 0; i < 8; i += 1) {
        const u = seededUnit(tile.id * 101 + i * 17 + 1) * 2 - 1;
        const v = seededUnit(tile.id * 197 + i * 31 + 5) * 2 - 1;
        if (Math.abs(u) + Math.abs(v) > 1) continue;
        tileTopTexture.beginFill(textureColor, 0.2);
        tileTopTexture.drawCircle(
          centerX + u * drawHalfWidth * 0.75,
          centerY + v * drawHalfHeight * 0.75,
          1.4
        );
        tileTopTexture.endFill();
      }

      if (!isKudoboxTile(tile.type) && !isShopTile(tile.type)) {
        const icon = new Text(TILE_ICON[tile.type] ?? "?", sharedStyles.tileIcon);
        icon.anchor.set(0.5);
        icon.x = centerX;
        icon.y = centerY - TILE_ELEVATION * 0.24 + 1;
        tilesLayer.addChild(icon);
      }

      if (showIndex) {
        const badge = new Graphics();
        badge.lineStyle(1, 0xcbd5e1, 0.35, 0.5, true);
        badge.beginFill(0x0f172a, 0.85);
        badge.drawRoundedRect(centerX + drawHalfWidth * 0.52 - 8, topY + drawHalfHeight * 0.5 - 6, 16, 12, 3);
        badge.endFill();
        tilesLayer.addChild(badge);

        const indexText = new Text(String(tile.id + 1), sharedStyles.tileIndex);
        indexText.anchor.set(0.5);
        indexText.x = centerX + drawHalfWidth * 0.52;
        indexText.y = topY + drawHalfHeight * 0.5;
        tilesLayer.addChild(indexText);
      }
    });
    tilesLayer.addChildAt(tileShadows, 0);
    tilesLayer.addChildAt(tileSides, 1);
    tilesLayer.addChild(tileTopTexture);
    world.addChild(tilesLayer);

    const kudoboxLayer = new Container();
    const kudoboxNodes: Array<{
      marker: Graphics;
      icon: Text;
      shadow: Graphics;
      baseMarkerY: number;
      baseIconY: number;
      baseShadowAlpha: number;
    }> = [];
    tilesInDepthOrder.forEach(({ tile, p }) => {
      if (!isKudoboxTile(tile.type)) return;
      const px = p.x + tileHalfWidth;
      const groundY = p.y + tileHalfHeight + 2;
      const py = groundY - KUDOBOX_LIFT;

      const shadow = new Graphics();
      shadow.beginFill(0x020617, 0.24);
      shadow.drawEllipse(px + 1.2, groundY + 10, 8.4, 3.8);
      shadow.endFill();
      kudoboxLayer.addChild(shadow);

      const stem = new Graphics();
      stem.beginFill(0x7c2d12, 0.45);
      stem.drawRoundedRect(px - 1.5, py + 12, 3, KUDOBOX_LIFT - 2, 2);
      stem.endFill();
      kudoboxLayer.addChild(stem);

      const marker = new Graphics();
      marker.lineStyle(2, 0xf59e0b, 1, 0.5, true);
      marker.beginFill(0xfef3c7, 0.98);
      marker.drawCircle(px, py, 12);
      marker.endFill();
      marker.lineStyle(1, 0xffffff, 0.45, 0.5, true);
      marker.drawCircle(px - 3, py - 4, 3.5);
      kudoboxLayer.addChild(marker);

      const icon = new Text("🎁", sharedStyles.kudobox);
      icon.anchor.set(0.5);
      icon.x = px;
      icon.y = py + 0.4;
      kudoboxLayer.addChild(icon);

      kudoboxNodes.push({
        marker,
        icon,
        shadow,
        baseMarkerY: 0,
        baseIconY: py + 0.4,
        baseShadowAlpha: 0.24,
      });
    });
    world.addChild(kudoboxLayer);

    const shopLayer = new Container();
    const shopNodes: Array<{
      marker: Graphics;
      icon: Text;
      shadow: Graphics;
      baseMarkerY: number;
      baseIconY: number;
      baseShadowAlpha: number;
    }> = [];
    tilesInDepthOrder.forEach(({ tile, p }) => {
      if (!isShopTile(tile.type)) return;
      const px = p.x + tileHalfWidth;
      const groundY = p.y + tileHalfHeight + 2;
      const py = groundY - SHOP_LIFT;

      const shadow = new Graphics();
      shadow.beginFill(0x020617, 0.24);
      shadow.drawEllipse(px + 1.1, groundY + 10, 8.2, 3.6);
      shadow.endFill();
      shopLayer.addChild(shadow);

      const stem = new Graphics();
      stem.beginFill(0x9a3412, 0.46);
      stem.drawRoundedRect(px - 1.5, py + 11, 3, SHOP_LIFT - 1, 2);
      stem.endFill();
      shopLayer.addChild(stem);

      const marker = new Graphics();
      marker.lineStyle(2, 0xea580c, 1, 0.5, true);
      marker.beginFill(0xffedd5, 0.98);
      marker.drawCircle(px, py, 11);
      marker.endFill();
      marker.lineStyle(1, 0xffffff, 0.45, 0.5, true);
      marker.drawCircle(px - 3, py - 4, 3);
      shopLayer.addChild(marker);

      const icon = new Text("🛒", sharedStyles.shop);
      icon.anchor.set(0.5);
      icon.x = px;
      icon.y = py + 0.3;
      shopLayer.addChild(icon);

      shopNodes.push({
        marker,
        icon,
        shadow,
        baseMarkerY: 0,
        baseIconY: py + 0.3,
        baseShadowAlpha: 0.24,
      });
    });
    world.addChild(shopLayer);

    const playersLayer = new Container();
    const activeAvatarNodes: Array<{
      chip: Graphics;
      avatar: Text;
      baseChipY: number;
      baseAvatarY: number;
    }> = [];
    tiles.forEach((tile) => {
      const p = points[tile.id];
      if (!p) return;
      const tilePlayers = playersByTile.get(tile.id) ?? [];
      tilePlayers.slice(0, 3).forEach((player, index) => {
        const px = p.x + tileHalfWidth - ((Math.min(tilePlayers.length, 3) - 1) * 10) + index * 20;
        const groundY = p.y + tileHalfHeight + 1;
        const py = groundY - PAWN_LIFT;

        const shadow = new Graphics();
        shadow.beginFill(0x020617, 0.33);
        shadow.drawEllipse(px + 1.5, groundY + 10, 9.5, 4.2);
        shadow.endFill();
        playersLayer.addChild(shadow);

        const stem = new Graphics();
        stem.beginFill(0x0f172a, 0.58);
        stem.drawRoundedRect(px - 2, py + 12, 4, PAWN_LIFT - 1, 2);
        stem.endFill();
        playersLayer.addChild(stem);

        const chip = new Graphics();
        chip.lineStyle(2, Number.parseInt(player.color.replace("#", "0x"), 16) || 0xffffff, 1, 0.5, true);
        chip.beginFill(0xffffff, 1);
        chip.drawCircle(px, py, 14);
        chip.endFill();
        chip.lineStyle(1, 0xffffff, 0.55, 0.5, true);
        chip.drawCircle(px - 4, py - 5, 4);
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

        if (focusPlayerId && player.id === focusPlayerId && movingPlayerId !== player.id) {
          activeAvatarNodes.push({
            chip,
            avatar,
            // Graphics circles are already drawn using world coordinates (px/py),
            // so their container offset baseline must remain 0.
            baseChipY: 0,
            baseAvatarY: py + 0.5,
          });
        }
      });

      if (tilePlayers.length > 3) {
        const overflowX = p.x + tileHalfWidth + 22;
        const overflowGroundY = p.y + tileHalfHeight + 1;
        const overflowY = overflowGroundY - (PAWN_LIFT - 2);
        const overflowShadow = new Graphics();
        overflowShadow.beginFill(0x020617, 0.3);
        overflowShadow.drawEllipse(overflowX + 1.2, overflowGroundY + 10, 9.2, 4);
        overflowShadow.endFill();
        playersLayer.addChild(overflowShadow);

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
      const badge = new Graphics();
      badge.lineStyle(2, 0x0f172a, 0.85, 0.5, true);
      badge.beginFill(delta.positive ? 0x22c55e : 0xef4444, 0.28);
      badge.drawRoundedRect(delta.x - 24, delta.y - 13, 48, 26, 8);
      badge.endFill();
      floatLayer.addChild(badge);

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

    let tickerFn: ((delta: number) => void) | null = null;
    if ((activeAvatarNodes.length > 0 || kudoboxNodes.length > 0 || shopNodes.length > 0) && app?.ticker) {
      let elapsed = 0;
      tickerFn = (delta) => {
        elapsed += delta;
        const bob = Math.sin(elapsed * 0.12) * 2.2;
        activeAvatarNodes.forEach((node) => {
          node.chip.y = node.baseChipY + bob;
          node.avatar.y = node.baseAvatarY + bob;
          const pulse = 0.88 + Math.max(0, Math.sin(elapsed * 0.08)) * 0.12;
          node.chip.alpha = pulse;
        });
        kudoboxNodes.forEach((node, index) => {
          const localBob = Math.sin(elapsed * 0.09 + index * 0.55) * 1.8;
          node.marker.y = node.baseMarkerY + localBob;
          node.icon.y = node.baseIconY + localBob;
          node.shadow.alpha = node.baseShadowAlpha + Math.max(0, -localBob) * 0.01;
        });
        shopNodes.forEach((node, index) => {
          const localBob = Math.sin(elapsed * 0.085 + index * 0.48 + 0.8) * 1.6;
          node.marker.y = node.baseMarkerY + localBob;
          node.icon.y = node.baseIconY + localBob;
          node.shadow.alpha = node.baseShadowAlpha + Math.max(0, -localBob) * 0.012;
        });
      };
      app.ticker.add(tickerFn);
    }

    return () => {
      if (tickerFn && app?.ticker) {
        app.ticker.remove(tickerFn);
      }
    };
  }, [
    canChoosePath,
    floatingDeltas,
    focusPlayerId,
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
    sharedStyles.kudobox,
    sharedStyles.overflow,
    sharedStyles.shop,
    sharedStyles.tileIcon,
    sharedStyles.tileIndex,
    tileHalfHeight,
    tileHalfWidth,
    drawHalfHeight,
    drawHalfWidth,
    tileHeight,
    tileWidth,
    tiles,
  ]);

  useEffect(() => {
    const uiLayer = uiRef.current;
    const app = appRef.current;
    if (!uiLayer) return;

    uiLayer.removeChildren().forEach((child) => {
      child.destroy({ children: true });
    });

    const host = hostRef.current;
    const viewWidth = host?.clientWidth ?? app?.screen.width ?? 1;
    const viewHeight = host?.clientHeight ?? app?.screen.height ?? 1;

    const legendPanel = new Container();
    legendPanel.x = 12;
    legendPanel.y = 10;
    legendPanel.zIndex = 5;
    legendPanel.eventMode = "static";
    legendPanel.cursor = "pointer";

    const legendBackground = new Graphics();
    legendPanel.addChild(legendBackground);

    const compactLegendLabel = (label: string) => {
      const dashIndex = label.indexOf("-");
      return (dashIndex >= 0 ? label.slice(dashIndex + 1) : label).trim();
    };

    const legendItems = [
      {
        icon: "💬",
        label: compactLegendLabel(fr.gameScreen.legendBlue),
        color: TILE_HEX_COLORS.blue,
      },
      {
        icon: "🔧",
        label: compactLegendLabel(fr.gameScreen.legendGreen),
        color: TILE_HEX_COLORS.green,
      },
      {
        icon: "🔥",
        label: compactLegendLabel(fr.gameScreen.legendRed),
        color: TILE_HEX_COLORS.red,
      },
      {
        icon: "🎯",
        label: compactLegendLabel(fr.gameScreen.legendViolet),
        color: TILE_HEX_COLORS.violet,
      },
      {
        icon: "🎁",
        label: compactLegendLabel(fr.gameScreen.legendBonus),
        color: TILE_HEX_COLORS.bonus,
      },
      {
        icon: "🛒",
        label: compactLegendLabel(fr.game.shopLegend),
        color: TILE_HEX_COLORS.shop,
      },
    ];

    const isCompactLegend = viewWidth < 920;
    if (legendExpandedRef.current == null) {
      legendExpandedRef.current = !isCompactLegend;
    } else if (!isCompactLegend && legendExpandedRef.current === false) {
      // Keep mobile collapsed state optional, but default to expanded on large screens.
      legendExpandedRef.current = true;
    }
    let legendExpanded = legendExpandedRef.current;

    const legendTitleStyle = new TextStyle({
      fontFamily: "Press Start 2P, monospace",
      fill: 0xe2e8f0,
      fontSize: 7,
    });
    const legendIconStyle = new TextStyle({
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fill: 0xe2e8f0,
      fontSize: 11,
    });
    const legendLabelStyle = new TextStyle({
      fontFamily: "Press Start 2P, monospace",
      fill: 0xe2e8f0,
      fontSize: 6,
    });

    const legendTitle = new Text("Légende", legendTitleStyle);
    legendTitle.x = 10;
    legendTitle.y = 8;
    legendPanel.addChild(legendTitle);

    const legendRows = new Container();
    legendRows.x = 10;
    legendRows.y = 24;
    legendPanel.addChild(legendRows);

    legendItems.forEach((item, index) => {
      const row = new Container();
      row.y = index * 14;

      const iconBadge = new Graphics();
      iconBadge.lineStyle(1.4, item.color, 0.95, 0.5, true);
      iconBadge.beginFill(0x0f172a, 0.42);
      iconBadge.drawRoundedRect(0, 0, 15, 12, 4);
      iconBadge.endFill();
      row.addChild(iconBadge);

      const icon = new Text(item.icon, legendIconStyle);
      icon.anchor.set(0.5);
      icon.x = 7.5;
      icon.y = 6;
      row.addChild(icon);

      const label = new Text(item.label, legendLabelStyle);
      label.x = 20;
      label.y = 2;
      row.addChild(label);

      legendRows.addChild(row);
    });

    const toggleButton = new Container();
    toggleButton.eventMode = "static";
    toggleButton.cursor = "pointer";
    legendPanel.addChild(toggleButton);

    const toggleBg = new Graphics();
    toggleButton.addChild(toggleBg);
    const toggleText = new Text("i", new TextStyle({
      fontFamily: "Press Start 2P, monospace",
      fill: 0xe2e8f0,
      fontSize: 7,
      align: "center",
    }));
    toggleText.anchor.set(0.5);
    toggleButton.addChild(toggleText);

    const redrawLegend = () => {
      const panelWidth = legendExpanded ? 168 : 102;
      const panelHeight = legendExpanded ? 112 : 28;
      legendBackground.clear();
      legendBackground.lineStyle(1, 0x38bdf8, 0.45, 0.5, true);
      legendBackground.beginFill(0x020617, legendExpanded ? 0.48 : 0.38);
      legendBackground.drawRoundedRect(0, 0, panelWidth, panelHeight, 10);
      legendBackground.endFill();

      legendRows.visible = legendExpanded;
      legendTitle.text = "Légende";
      legendTitle.x = 10;
      legendTitle.y = 8;

      toggleButton.x = panelWidth - 27;
      toggleButton.y = 7;
      toggleBg.clear();
      toggleBg.beginFill(0x0f172a, 0.55);
      toggleBg.drawRoundedRect(0, 0, 18, 14, 4);
      toggleBg.endFill();
      toggleText.x = 9;
      toggleText.y = 7;
      toggleText.text = legendExpanded ? "-" : "+";
      toggleButton.hitArea = new Rectangle(0, 0, 18, 14);
    };

    const toggleLegend = () => {
      legendExpanded = !legendExpanded;
      legendExpandedRef.current = legendExpanded;
      redrawLegend();
    };

    legendPanel.on("pointerdown", toggleLegend);

    redrawLegend();
    uiLayer.addChild(legendPanel);

    const cleanupLegend = () => {
      legendPanel.off("pointerdown", toggleLegend);
    };

    const shouldShowActionPanel =
      !!focusPlayerId &&
      !!actionOverlay &&
      (actionOverlay.canRoll || actionOverlay.canMove || actionOverlay.canOpenQuestionCard || actionOverlay.isRolling);
    if (!shouldShowActionPanel) {
      return cleanupLegend;
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
    if (tileId == null) return cleanupLegend;
    const p = points[tileId];
    if (!p) return cleanupLegend;

    const tilePlayers = playersByTile.get(tileId) ?? [];
    const playerIndex = tilePlayers.findIndex((player) => player.id === focusPlayerId);
    const shownCount = Math.min(tilePlayers.length, 3);

    let avatarX = p.x + tileHalfWidth;
    if (playerIndex >= 0 && playerIndex < 3) {
      avatarX = p.x + tileHalfWidth - ((shownCount - 1) * 10) + playerIndex * 20;
    } else if (playerIndex >= 3) {
      avatarX = p.x + tileHalfWidth + 22;
    }
    const avatarY = p.y + tileHalfHeight + 1;

    const anchorX = viewWidth * 0.5;
    const bottomInset = Math.max(72, Math.min(112, viewHeight * 0.16));
    const anchorY = viewHeight - bottomInset;
    const actionScale = Math.max(0.82, Math.min(1.1, viewWidth / 900));

    const isCardMode = actionOverlay.canOpenQuestionCard;
    const { panel: topPanel, separator } = createGamePanel();

    const modeText = actionOverlay.canOpenQuestionCard
      ? "Ouvrir la carte"
      : actionOverlay.canMove
        ? `Avancer ${actionOverlay.diceValue ?? ""}`.trim()
        : actionOverlay.canRoll
          ? "Lancer de"
          : "Action";
    const resolvedRollValue =
      actionOverlay.rollResult?.total ??
      (actionOverlay.diceValue != null ? actionOverlay.diceValue : null);

    const { face, rollingValueText } = createDiceResultCard({
      isCardMode,
      isRolling: actionOverlay.isRolling,
      resolvedRollValue,
    });

    const actionButton = createGameButton({
      label: modeText,
      labelFontSize: actionOverlay.canOpenQuestionCard || actionOverlay.canRoll ? 11 : 10,
      onPress: () => {
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
      },
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
    if (app?.ticker) {
      let shownValue = 1;
      let switchAccumulator = 0;
      tickerFn = (delta) => {
        elapsed += delta;
        if (actionOverlay.isRolling && !isCardMode) {
          // Dice rolling animation while backend resolves roll.
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
          face.scale.set(1);
          actionButton.innerView.rotation = Math.sin(elapsed * 0.2) * 0.03;
          actionButton.innerView.y = 0;
          return;
        }

        // Subtle prompt animation in idle so players understand the expected action.
        const canPrompt = actionOverlay.canRoll || actionOverlay.canOpenQuestionCard;
        if (!canPrompt) {
          face.rotation = 0;
          face.y = 0;
          face.scale.set(1);
          actionButton.innerView.rotation = 0;
          actionButton.innerView.y = 0;
          return;
        }
        const bob = Math.sin(elapsed * 0.11);
        face.y = bob * 2;
        face.rotation = Math.sin(elapsed * 0.09) * (isCardMode ? 0.06 : 0.04);
        face.scale.set(1 + Math.sin(elapsed * 0.08) * 0.02);
        actionButton.innerView.rotation = Math.sin(elapsed * 0.06) * 0.015;
        actionButton.innerView.y = Math.sin(elapsed * 0.11 + 0.8) * 1.4;
      };
      app.ticker.add(tickerFn);
    }

    return () => {
      cleanupLegend();
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
    tileHalfHeight,
    tileHalfWidth,
  ]);

  return (
    <div className="absolute inset-0 p-2">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
};

