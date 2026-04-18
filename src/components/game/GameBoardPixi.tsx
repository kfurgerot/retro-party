import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AVATARS, MoveTrace, PendingPathChoice, Player, Tile } from "@/types/game";
import { cn } from "@/lib/utils";
import { GameBoardProps } from "./gameBoardTypes";
import { PixiBoardCanvas, PixiFloatingDelta } from "./PixiBoardCanvas";
import { ACTION_OVERLAY_HITBOX } from "./pixi-ui/theme";

type Point = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
}

const ISO_TILE_WIDTH = 88;
const ISO_TILE_HEIGHT = 50;
const TILE_CENTER_X = ISO_TILE_WIDTH / 2;
const TILE_CENTER_Y = ISO_TILE_HEIGHT / 2;
const BOARD_MARGIN = 96;
const FOLLOW_MOBILE_SCALE = 1.2;
const FOLLOW_DESKTOP_SCALE = 1.05;
const MOVE_STEP_MS = 320;
const GRID_INFER_CELL_SIZE = 72;

function getTileGridCoords(tile: Tile) {
  if (typeof tile.gridX === "number" && typeof tile.gridY === "number") {
    return { gridX: tile.gridX, gridY: tile.gridY };
  }
  return {
    gridX: Math.round(tile.x / GRID_INFER_CELL_SIZE),
    gridY: Math.round(tile.y / GRID_INFER_CELL_SIZE),
  };
}

const GameBoardPixiComponent: React.FC<GameBoardProps> = ({
  tiles,
  players,
  focusPlayerId = null,
  activePlayerHint = null,
  onMoveAnimationEnd,
  pendingPathChoice,
  lastMoveTrace,
  canChoosePath = false,
  onChoosePath,
  eventOverlayActive = false,
  actionOverlay = null,
}) => {
  const projected = useMemo(() => {
    if (!tiles.length) {
      return {
        width: 800,
        height: 500,
        points: [] as Point[],
      };
    }

    const rawPoints = tiles.map((tile) => {
      const { gridX, gridY } = getTileGridCoords(tile);
      const centerX = (gridX - gridY) * (ISO_TILE_WIDTH / 2);
      const centerY = (gridX + gridY) * (ISO_TILE_HEIGHT / 2);
      return {
        x: centerX - TILE_CENTER_X,
        y: centerY - TILE_CENTER_Y,
      };
    });

    const minX = Math.min(...rawPoints.map((point) => point.x)) - BOARD_MARGIN;
    const minY = Math.min(...rawPoints.map((point) => point.y)) - BOARD_MARGIN;
    const maxX = Math.max(...rawPoints.map((point) => point.x + ISO_TILE_WIDTH)) + BOARD_MARGIN;
    const maxY = Math.max(...rawPoints.map((point) => point.y + ISO_TILE_HEIGHT)) + BOARD_MARGIN;

    return {
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
      points: rawPoints.map((point) => ({ x: point.x - minX, y: point.y - minY })),
    };
  }, [tiles]);

  const width = projected.width;
  const height = projected.height;
  const points = projected.points;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousPositionsRef = useRef<Record<string, number>>({});
  const moveTimeoutsRef = useRef<number[]>([]);
  const floatingTimeoutsRef = useRef<number[]>([]);
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);
  const [isAutoResettingView, setIsAutoResettingView] = useState(false);
  const [floatingDeltas, setFloatingDeltas] = useState<PixiFloatingDelta[]>([]);
  const pendingAutoZoomOutRef = useRef(false);
  const pendingAutoZoomTargetRef = useRef<number | null>(null);
  const autoZoomTimeoutRef = useRef<number | null>(null);
  const previousFocusPlayerIdRef = useRef<string | null>(null);

  const scaleRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    scaleRef.current = scale;
    offsetRef.current = offset;
  }, [scale, offset]);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | null
    | {
        kind: "pan";
        startOffset: Point;
        startPoint: Point;
      }
    | {
        kind: "pinch";
        startScale: number;
        startOffset: Point;
        startDist: number;
        startMid: Point;
      }
  >(null);

  const computeFitScale = useCallback((containerW: number, containerH: number) => {
    const pad = 16;
    const availW = Math.max(0, containerW - pad);
    const availH = Math.max(0, containerH - pad);
    if (width <= 0 || height <= 0) return 1;
    return Math.min(availW / width, availH / height);
  }, [height, width]);

  const clampOffset = useCallback((nextScale: number, nextOffset: Point, containerW: number, containerH: number) => {
    const pad = 8;
    const contentW = width * nextScale;
    const contentH = height * nextScale;

    const minX = contentW <= containerW ? (containerW - contentW) / 2 : containerW - contentW - pad;
    const maxX = contentW <= containerW ? (containerW - contentW) / 2 : pad;
    const minY = contentH <= containerH ? (containerH - contentH) / 2 : containerH - contentH - pad;
    const maxY = contentH <= containerH ? (containerH - contentH) / 2 : pad;

    return {
      x: clamp(nextOffset.x, minX, maxX),
      y: clamp(nextOffset.y, minY, maxY),
    };
  }, [height, width]);

  const focusOnPosition = useCallback(
    (position: number, boostScale: boolean) => {
      const point = points[position];
      const el = containerRef.current;
      if (!point || !el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const coarse = isCoarsePointer();
      const fit = computeFitScale(rect.width, rect.height);
      const minScale = coarse ? Math.min(1, fit) : Math.min(0.5, fit);
      const followFloor = coarse ? Math.max(minScale, FOLLOW_MOBILE_SCALE) : Math.max(minScale, FOLLOW_DESKTOP_SCALE);
      const nextScale = boostScale
        ? clamp(Math.max(scaleRef.current, followFloor), minScale, 2.75)
        : scaleRef.current;

      const centerX = point.x + TILE_CENTER_X;
      const centerY = point.y + TILE_CENTER_Y;
      const nextOffset = {
        x: rect.width * 0.5 - centerX * nextScale,
        y: rect.height * 0.48 - centerY * nextScale,
      };

      setScale(nextScale);
      setOffset(clampOffset(nextScale, nextOffset, rect.width, rect.height));
    },
    [clampOffset, computeFitScale, points]
  );

  const resetView = useCallback((animate = false) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const coarse = isCoarsePointer();
    const fit = computeFitScale(rect.width, rect.height);

    const nextScale = clamp(
      coarse ? Math.min(fit * 0.96, 1.05) : Math.min(fit * 1.04, 2.2),
      0.5,
      2.75
    );

    const contentW = width * nextScale;
    const contentH = height * nextScale;
    const centered = {
      x: (rect.width - contentW) / 2,
      y: (rect.height - contentH) / 2,
    };

    if (animate) {
      setIsAutoResettingView(true);
      if (autoZoomTimeoutRef.current) {
        window.clearTimeout(autoZoomTimeoutRef.current);
      }
      autoZoomTimeoutRef.current = window.setTimeout(() => {
        setIsAutoResettingView(false);
        autoZoomTimeoutRef.current = null;
      }, 650);
    }

    setScale(nextScale);
    setOffset(clampOffset(nextScale, centered, rect.width, rect.height));
  }, [clampOffset, computeFitScale, height, width]);

  const zoomOutKeepingPosition = useCallback(
    (position: number, animate = false) => {
      const el = containerRef.current;
      const point = points[position];
      if (!el || !point) {
        resetView(animate);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        resetView(animate);
        return;
      }

      const coarse = isCoarsePointer();
      const fit = computeFitScale(rect.width, rect.height);
      const nextScale = clamp(
        coarse ? Math.min(fit * 0.96, 1.05) : Math.min(fit * 1.04, 2.2),
        0.5,
        2.75
      );

      const centerX = point.x + TILE_CENTER_X;
      const centerY = point.y + TILE_CENTER_Y;
      const wanted = {
        x: rect.width * 0.5 - centerX * nextScale,
        y: rect.height * 0.5 - centerY * nextScale,
      };

      if (animate) {
        setIsAutoResettingView(true);
        if (autoZoomTimeoutRef.current) {
          window.clearTimeout(autoZoomTimeoutRef.current);
        }
        autoZoomTimeoutRef.current = window.setTimeout(() => {
          setIsAutoResettingView(false);
          autoZoomTimeoutRef.current = null;
        }, 650);
      }

      setScale(nextScale);
      setOffset(clampOffset(nextScale, wanted, rect.width, rect.height));
    },
    [clampOffset, computeFitScale, points, resetView]
  );

  const tryAutoZoomOut = useCallback(() => {
    if (!pendingAutoZoomOutRef.current) return;
    if (eventOverlayActive) return;
    pendingAutoZoomOutRef.current = false;
    const target = pendingAutoZoomTargetRef.current;
    pendingAutoZoomTargetRef.current = null;
    if (target != null) {
      zoomOutKeepingPosition(target, true);
      return;
    }
    resetView(true);
  }, [eventOverlayActive, resetView, zoomOutKeepingPosition]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const fit = computeFitScale(rect.width, rect.height);
      const coarse = isCoarsePointer();

      setScale((prev) => {
        const isFresh = prev === 1 && offsetRef.current.x === 0 && offsetRef.current.y === 0;
        if (!isFresh) return prev;

        return clamp(
          coarse ? Math.min(fit * 0.96, 1.05) : Math.min(fit * 1.04, 2.2),
          0.5,
          2.75
        );
      });

      setOffset((prev) => clampOffset(scaleRef.current, prev, rect.width, rect.height));
    };

    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setOffset((prev) => clampOffset(scale, prev, rect.width, rect.height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const zoomAt = (nextScale: number, anchor: Point) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const coarse = isCoarsePointer();
    const fit = computeFitScale(rect.width, rect.height);
    const minScale = coarse ? Math.min(1, fit) : Math.min(0.5, fit);
    const clampedScale = clamp(nextScale, minScale, 2.75);

    const contentX = (anchor.x - offset.x) / scale;
    const contentY = (anchor.y - offset.y) / scale;

    const nextOffset = {
      x: anchor.x - contentX * clampedScale,
      y: anchor.y - contentY * clampedScale,
    };

    setScale(clampedScale);
    setOffset(clampOffset(clampedScale, nextOffset, rect.width, rect.height));
  };

  const isPointerOverActionOverlay = useCallback((clientX: number, clientY: number) => {
    if (!focusPlayerId || !actionOverlay) return false;
    if (!actionOverlay.canRoll && !actionOverlay.canMove && !actionOverlay.canOpenQuestionCard && !actionOverlay.isRolling) {
      return false;
    }

    const el = containerRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();

    // Matches PixiBoardCanvas action panel placement (bottom centered).
    const anchorX = rect.width * 0.5;
    const hostHeight = Math.max(1, rect.height - 16);
    const bottomInset = Math.max(72, Math.min(112, hostHeight * 0.16));
    const anchorY = 8 + hostHeight - bottomInset;
    const hostWidth = Math.max(1, rect.width - 16);
    const actionScale = Math.max(0.82, Math.min(1.1, hostWidth / 900));

    const halfWidth = ACTION_OVERLAY_HITBOX.halfWidth * actionScale;
    const topY = ACTION_OVERLAY_HITBOX.topY * actionScale;
    const bottomY = ACTION_OVERLAY_HITBOX.bottomY * actionScale;
    const safePad = ACTION_OVERLAY_HITBOX.safePadding;

    const localX = clientX - rect.left - anchorX;
    const localY = clientY - rect.top - anchorY;
    return (
      localX >= -halfWidth - safePad &&
      localX <= halfWidth + safePad &&
      localY >= topY - safePad &&
      localY <= bottomY + safePad
    );
  }, [
    actionOverlay,
    focusPlayerId,
  ]);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (isPointerOverActionOverlay(e.clientX, e.clientY)) {
      // Let Pixi overlay handle click/tap without board gesture capture.
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      gesture.current = {
        kind: "pan",
        startOffset: offset,
        startPoint: { x: e.clientX, y: e.clientY },
      };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current = {
        kind: "pinch",
        startScale: scale,
        startOffset: offset,
        startDist: dist || 1,
        startMid: mid,
      };
    }
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const el = containerRef.current;
    if (!el) return;

    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const rect = el.getBoundingClientRect();

    if (gesture.current?.kind === "pan") {
      const dx = e.clientX - gesture.current.startPoint.x;
      const dy = e.clientY - gesture.current.startPoint.y;
      const next = { x: gesture.current.startOffset.x + dx, y: gesture.current.startOffset.y + dy };
      setOffset(clampOffset(scale, next, rect.width, rect.height));
      return;
    }

    if (gesture.current?.kind === "pinch" && pointers.current.size >= 2) {
      const pts = Array.from(pointers.current.values());
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const ratio = dist / gesture.current.startDist;
      const desired = gesture.current.startScale * ratio;

      const contentX = (gesture.current.startMid.x - gesture.current.startOffset.x) / gesture.current.startScale;
      const contentY = (gesture.current.startMid.y - gesture.current.startOffset.y) / gesture.current.startScale;

      const coarse = isCoarsePointer();
      const fit = computeFitScale(rect.width, rect.height);
      const minScale = coarse ? Math.min(1, fit) : Math.min(0.5, fit);
      const nextScale = clamp(desired, minScale, 2.75);

      const nextOffset = {
        x: mid.x - contentX * nextScale,
        y: mid.y - contentY * nextScale,
      };

      setScale(nextScale);
      setOffset(clampOffset(nextScale, nextOffset, rect.width, rect.height));
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      const remaining = Array.from(pointers.current.values())[0];
      gesture.current = {
        kind: "pan",
        startOffset: offset,
        startPoint: remaining,
      };
    }
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const zoomIntensity = 0.0015;
    const next = scale * (1 - e.deltaY * zoomIntensity);
    zoomAt(next, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const showControls = true;

  const tilePointDelta = useCallback((tileType: string) => {
    const normalized = String(tileType ?? "").toLowerCase();
    if (normalized === "red") return -2;
    if (normalized === "blue" || normalized === "green" || normalized === "violet" || normalized === "purple") return 2;
    return 0;
  }, []);

  const pushFloatingDelta = useCallback((tileId: number, delta: number) => {
    if (!delta) return;
    const pt = points[tileId];
    if (!pt) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const text = delta > 0 ? `+${delta}` : `${delta}`;
    const next: PixiFloatingDelta = {
      id,
      x: pt.x + TILE_CENTER_X,
      y: pt.y + TILE_CENTER_Y - 10,
      text,
      positive: delta > 0,
    };
    setFloatingDeltas((prev) => [...prev, next]);
    const timeoutId = window.setTimeout(() => {
      setFloatingDeltas((prev) => prev.filter((entry) => entry.id !== id));
    }, 900);
    floatingTimeoutsRef.current.push(timeoutId);
  }, [points]);

  const getNextIds = useCallback(
    (tileId: number) => {
      const tile = tiles[tileId];
      if (!tile) return [] as number[];
      const next = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [tileId + 1];
      return next.filter((id) => id >= 0 && id < tiles.length);
    },
    [tiles]
  );

  const findPath = useCallback(
    (from: number, to: number) => {
      if (from === to) return [from];
      if (from < 0 || to < 0 || from >= tiles.length || to >= tiles.length) return [to];

      const q: number[] = [from];
      const visited = new Set<number>([from]);
      const parent = new Map<number, number>();

      while (q.length > 0) {
        const cur = q.shift() as number;
        const nextIds = getNextIds(cur);
        for (const nxt of nextIds) {
          if (visited.has(nxt)) continue;
          visited.add(nxt);
          parent.set(nxt, cur);
          if (nxt === to) {
            const path: number[] = [to];
            let node = to;
            while (parent.has(node)) {
              node = parent.get(node) as number;
              path.push(node);
            }
            path.reverse();
            return path;
          }
          q.push(nxt);
        }
      }

      return [to];
    },
    [getNextIds, tiles.length]
  );

  useLayoutEffect(() => {
    const clearMoveTimeouts = () => {
      moveTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      moveTimeoutsRef.current = [];
    };

    const nextActual = Object.fromEntries(players.map((p) => [p.id, p.position]));
    if (Object.keys(previousPositionsRef.current).length === 0) {
      previousPositionsRef.current = nextActual;
      setDisplayPositions(nextActual);
      setMovingPlayerId(null);
      return;
    }

    const hasPositionDelta = players.some((p) => {
      const from = previousPositionsRef.current[p.id];
      const to = p.position;
      return from != null && from !== to;
    });

    if (!hasPositionDelta) {
      previousPositionsRef.current = nextActual;
      if (!movingPlayerId) {
        setDisplayPositions(nextActual);
        setMovingPlayerId(null);
      }
      return;
    }

    clearMoveTimeouts();
    let hasAnimatedMove = false;
    let followedPlayerId: string | null = null;

    players.forEach((p) => {
      const from = previousPositionsRef.current[p.id];
      const to = p.position;
      if (from == null || from === to) return;

      const traceMatchesPlayer =
        !!lastMoveTrace &&
        lastMoveTrace.playerId === p.id &&
        lastMoveTrace.path[0] === from &&
        lastMoveTrace.path[lastMoveTrace.path.length - 1] === to;
      const path = traceMatchesPlayer ? lastMoveTrace.path : findPath(from, to);
      const stepDeltas = traceMatchesPlayer
        ? lastMoveTrace.pointDeltas
        : path.slice(1).map((_tileId, idx) => (idx === path.length - 2 ? tilePointDelta(tiles[to]?.type ?? "") : 0));
      const steps = path.slice(1);
      if (!steps.length) return;

      hasAnimatedMove = true;
      if (!followedPlayerId) followedPlayerId = p.id;

      steps.forEach((position, idx) => {
        const timeoutId = window.setTimeout(() => {
          const delta = stepDeltas[idx] ?? 0;
          setDisplayPositions((prev) => ({ ...prev, [p.id]: position }));
          pushFloatingDelta(position, delta);
          if (followedPlayerId === p.id) focusOnPosition(position, true);
          if (idx === steps.length - 1 && followedPlayerId === p.id) {
            setMovingPlayerId(null);
            pendingAutoZoomOutRef.current = true;
            pendingAutoZoomTargetRef.current = position;
            if (!eventOverlayActive) {
              const timeoutId = window.setTimeout(() => {
                tryAutoZoomOut();
              }, 260);
              moveTimeoutsRef.current.push(timeoutId);
            }
          }
          if (idx === steps.length - 1) {
            onMoveAnimationEnd?.(p.id);
          }
        }, MOVE_STEP_MS * (idx + 1));
        moveTimeoutsRef.current.push(timeoutId);
      });
    });

    if (hasAnimatedMove) {
      setMovingPlayerId(followedPlayerId);
    } else {
      setDisplayPositions(nextActual);
      setMovingPlayerId(null);
    }
    previousPositionsRef.current = nextActual;
  }, [eventOverlayActive, findPath, focusOnPosition, lastMoveTrace, movingPlayerId, onMoveAnimationEnd, players, pushFloatingDelta, tilePointDelta, tiles, tryAutoZoomOut]);

  useLayoutEffect(() => {
    if (!eventOverlayActive) {
      tryAutoZoomOut();
    }
  }, [eventOverlayActive, tryAutoZoomOut]);

  useLayoutEffect(() => {
    return () => {
      moveTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      moveTimeoutsRef.current = [];
      floatingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      floatingTimeoutsRef.current = [];
      if (autoZoomTimeoutRef.current) {
        window.clearTimeout(autoZoomTimeoutRef.current);
        autoZoomTimeoutRef.current = null;
      }
    };
  }, []);

  const playersByTile = useMemo(() => {
    const byTile = new Map<number, Player[]>();
    for (const player of players) {
      const tileId = displayPositions[player.id] ?? player.position;
      const list = byTile.get(tileId);
      if (list) {
        list.push(player);
      } else {
        byTile.set(tileId, [player]);
      }
    }
    return byTile;
  }, [displayPositions, players]);

  const focusedPlayer = useMemo(
    () => players.find((player) => player.id === focusPlayerId) ?? null,
    [focusPlayerId, players]
  );
  const focusedPosition = focusedPlayer
    ? (displayPositions[focusedPlayer.id] ?? focusedPlayer.position)
    : null;
  const optionSet = useMemo(
    () => new Set(pendingPathChoice?.options ?? []),
    [pendingPathChoice?.options]
  );
  const highlightedPathEdges = useMemo(() => {
    const edges = new Set<string>();
    const path = lastMoveTrace?.path ?? [];
    for (let i = 0; i < path.length - 1; i += 1) {
      edges.add(`${path[i]}-${path[i + 1]}`);
    }
    return edges;
  }, [lastMoveTrace?.path]);

  useLayoutEffect(() => {
    if (!focusPlayerId || movingPlayerId) return;
    if (previousFocusPlayerIdRef.current === focusPlayerId) return;
    const focused = players.find((player) => player.id === focusPlayerId);
    if (!focused) return;
    const position = displayPositions[focused.id] ?? focused.position;
    previousFocusPlayerIdRef.current = focusPlayerId;
    focusOnPosition(position, true);
  }, [displayPositions, focusOnPosition, focusPlayerId, movingPlayerId, players]);

  const worldToScreen = useCallback(
    (worldPoint: Point) => ({
      x: worldPoint.x * scale + offset.x + 8,
      y: worldPoint.y * scale + offset.y + 8,
    }),
    [offset.x, offset.y, scale]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border-4 border-black bg-slate-950"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: "none" }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(120% 90% at 50% 8%, rgba(236,72,153,0.24) 0%, rgba(15,23,42,0.06) 48%, rgba(2,6,23,0.72) 100%)",
            "radial-gradient(55% 38% at 12% 78%, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0) 100%)",
            "radial-gradient(48% 32% at 88% 22%, rgba(250,204,21,0.14) 0%, rgba(250,204,21,0) 100%)",
          ].join(","),
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-35"
        style={{
          backgroundImage: [
            "linear-gradient(0deg, rgba(56,189,248,0.12) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(56,189,248,0.1) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "24px 24px, 24px 24px",
          maskImage: "radial-gradient(120% 90% at 50% 52%, black 42%, transparent 100%)",
        }}
      />

      <PixiBoardCanvas
        width={width}
        height={height}
        scale={scale}
        offset={offset}
        tiles={tiles}
        points={points}
        tileWidth={ISO_TILE_WIDTH}
        tileHeight={ISO_TILE_HEIGHT}
        playersByTile={playersByTile}
        playerDisplayPositions={displayPositions}
        focusPlayerId={focusPlayerId}
        activePlayerHint={activePlayerHint}
        movingPlayerId={movingPlayerId}
        focusedPosition={focusedPosition}
        highlightedPathEdges={highlightedPathEdges}
        pendingPathChoiceAtTileId={pendingPathChoice?.atTileId}
        pendingPathChoiceOptions={pendingPathChoice?.options ?? []}
        canChoosePath={canChoosePath}
        floatingDeltas={floatingDeltas}
        actionOverlay={actionOverlay}
      />

      {pendingPathChoice && (() => {
        const from = points[pendingPathChoice.atTileId];
        if (!from) return null;
        return pendingPathChoice.options
          .filter((id) => id >= 0 && id < points.length)
          .map((nextId) => {
            const to = points[nextId];
            if (!to) return null;
            const fromX = from.x + TILE_CENTER_X;
            const fromY = from.y + TILE_CENTER_Y;
            const toX = to.x + TILE_CENTER_X;
            const toY = to.y + TILE_CENTER_Y;
            const x = fromX + (toX - fromX) * 0.52;
            const y = fromY + (toY - fromY) * 0.52;
            const angleDeg = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
            const screen = worldToScreen({ x, y });
            return (
              <button
                key={`choose-${pendingPathChoice.atTileId}-${nextId}`}
                type="button"
                disabled={!canChoosePath}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!canChoosePath) return;
                  onChoosePath?.(nextId);
                }}
                className={cn(
                  "absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]",
                  canChoosePath
                    ? "border-amber-200 bg-amber-400 text-slate-900 hover:bg-amber-300"
                    : "cursor-not-allowed border-slate-300 bg-slate-400 text-slate-700"
                )}
                style={{ left: screen.x, top: screen.y }}
                title={canChoosePath ? "Choisir cette direction" : "Direction indisponible"}
              >
                <span className="block" style={{ transform: `rotate(${angleDeg}deg)` }}>
                  {">"}
                </span>
              </button>
            );
          });
      })()}

      {showControls && (
        <div
          className="absolute right-2 top-2 z-20 flex flex-col gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="h-11 w-11 rounded-md border-4 border-black bg-white/90 text-lg font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={() => zoomAt(scale * 1.15, { x: 80, y: 80 })}
            aria-label="Zoom +"
          >
            +
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-md border-4 border-black bg-white/90 text-lg font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={() => zoomAt(scale / 1.15, { x: 80, y: 80 })}
            aria-label="Zoom -"
          >
            -
          </button>
          <button
            type="button"
            className="h-11 w-11 rounded-md border-4 border-black bg-white/90 text-sm font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={resetView}
            aria-label="Recentrer"
          >
            C
          </button>
          {focusedPosition != null && (
            <button
              type="button"
              className="h-11 w-11 rounded-md border-4 border-black bg-amber-300 text-sm font-extrabold text-slate-900 shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
              onClick={() => focusOnPosition(focusedPosition, true)}
              aria-label="Centrer joueur actif"
            >
              T
            </button>
          )}
        </div>
      )}

      {focusedPlayer && focusedPosition != null && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded border border-pink-400/35 bg-slate-900/75 px-2 py-1 text-[11px] text-pink-100">
          {focusedPlayer.name} {AVATARS[focusedPlayer.avatar] ?? ""}
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{ transition: movingPlayerId || isAutoResettingView ? "opacity 360ms ease-out" : undefined }}
      />
    </div>
  );
};

function areTilesEqual(prevTiles: Tile[], nextTiles: Tile[]) {
  if (prevTiles === nextTiles) return true;
  if (prevTiles.length !== nextTiles.length) return false;
  for (let i = 0; i < prevTiles.length; i += 1) {
    const a = prevTiles[i];
    const b = nextTiles[i];
    if (
      a.id !== b.id ||
      a.type !== b.type ||
      a.x !== b.x ||
      a.y !== b.y
    ) {
      return false;
    }
    const aNext = a.nextTileIds ?? [];
    const bNext = b.nextTileIds ?? [];
    if (aNext.length !== bNext.length) return false;
    for (let j = 0; j < aNext.length; j += 1) {
      if (aNext[j] !== bNext[j]) return false;
    }
  }
  return true;
}

function arePlayersEqualForBoard(prevPlayers: Player[], nextPlayers: Player[]) {
  if (prevPlayers === nextPlayers) return true;
  if (prevPlayers.length !== nextPlayers.length) return false;
  for (let i = 0; i < prevPlayers.length; i += 1) {
    const a = prevPlayers[i];
    const b = nextPlayers[i];
    if (
      a.id !== b.id ||
      a.position !== b.position ||
      a.avatar !== b.avatar ||
      a.color !== b.color ||
      a.name !== b.name
    ) {
      return false;
    }
  }
  return true;
}

function arePendingChoicesEqual(
  prevChoice: PendingPathChoice | null | undefined,
  nextChoice: PendingPathChoice | null | undefined
) {
  if (prevChoice === nextChoice) return true;
  if (!prevChoice || !nextChoice) return false;
  if (
    prevChoice.playerId !== nextChoice.playerId ||
    prevChoice.atTileId !== nextChoice.atTileId ||
    prevChoice.remainingSteps !== nextChoice.remainingSteps ||
    prevChoice.options.length !== nextChoice.options.length
  ) {
    return false;
  }
  for (let i = 0; i < prevChoice.options.length; i += 1) {
    if (prevChoice.options[i] !== nextChoice.options[i]) return false;
  }
  return true;
}

function areMoveTracesEqual(prevTrace: MoveTrace | null | undefined, nextTrace: MoveTrace | null | undefined) {
  if (prevTrace === nextTrace) return true;
  if (!prevTrace || !nextTrace) return false;
  if (
    prevTrace.id !== nextTrace.id ||
    prevTrace.playerId !== nextTrace.playerId ||
    prevTrace.path.length !== nextTrace.path.length ||
    prevTrace.pointDeltas.length !== nextTrace.pointDeltas.length
  ) {
    return false;
  }
  for (let i = 0; i < prevTrace.path.length; i += 1) {
    if (prevTrace.path[i] !== nextTrace.path[i]) return false;
  }
  for (let i = 0; i < prevTrace.pointDeltas.length; i += 1) {
    if (prevTrace.pointDeltas[i] !== nextTrace.pointDeltas[i]) return false;
  }
  return true;
}

function areBoardActionsEqual(prevAction: GameBoardProps["actionOverlay"], nextAction: GameBoardProps["actionOverlay"]) {
  if (prevAction === nextAction) return true;
  if (!prevAction || !nextAction) return false;
  const prevDice = prevAction.rollResult?.dice ?? [];
  const nextDice = nextAction.rollResult?.dice ?? [];
  if (prevDice.length !== nextDice.length) return false;
  for (let i = 0; i < prevDice.length; i += 1) {
    if (prevDice[i] !== nextDice[i]) return false;
  }
  return (
    prevAction.canRoll === nextAction.canRoll &&
    prevAction.canMove === nextAction.canMove &&
    prevAction.canOpenQuestionCard === nextAction.canOpenQuestionCard &&
    prevAction.isRolling === nextAction.isRolling &&
    prevAction.diceValue === nextAction.diceValue &&
    prevAction.pendingDoubleRollFirstDie === nextAction.pendingDoubleRollFirstDie &&
    prevAction.playerIndex === nextAction.playerIndex &&
    prevAction.onRoll === nextAction.onRoll &&
    prevAction.onMove === nextAction.onMove &&
    prevAction.onOpenQuestionCard === nextAction.onOpenQuestionCard &&
    (prevAction.rollResult?.bonus ?? null) === (nextAction.rollResult?.bonus ?? null) &&
    (prevAction.rollResult?.total ?? null) === (nextAction.rollResult?.total ?? null) &&
    (prevAction.rollResult?.effectType ?? null) === (nextAction.rollResult?.effectType ?? null)
  );
}

function areGameBoardPropsEqual(prev: GameBoardProps, next: GameBoardProps) {
  return (
    areTilesEqual(prev.tiles, next.tiles) &&
    arePlayersEqualForBoard(prev.players, next.players) &&
    prev.focusPlayerId === next.focusPlayerId &&
    prev.activePlayerHint === next.activePlayerHint &&
    arePendingChoicesEqual(prev.pendingPathChoice, next.pendingPathChoice) &&
    areMoveTracesEqual(prev.lastMoveTrace, next.lastMoveTrace) &&
    prev.canChoosePath === next.canChoosePath &&
    prev.eventOverlayActive === next.eventOverlayActive &&
    areBoardActionsEqual(prev.actionOverlay, next.actionOverlay) &&
    prev.onChoosePath === next.onChoosePath &&
    prev.onMoveAnimationEnd === next.onMoveAnimationEnd
  );
}

export const GameBoardPixi = React.memo(GameBoardPixiComponent, areGameBoardPropsEqual);
GameBoardPixi.displayName = "GameBoardPixi";
