import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tile, Player, AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

interface GameBoardProps {
  tiles: Tile[];
  players: Player[];
  onMoveAnimationEnd?: (playerId: string) => void;
}

const TileIcon: Record<string, string> = {
  blue: "🔵",
  red: "🔴",
  green: "🟢",
  violet: "🟣",
  bonus: "⭐",
  start: "🏁",
};

const TileColors: Record<string, string> = {
  blue: "bg-tile-blue",
  red: "bg-tile-red",
  green: "bg-tile-green",
  violet: "bg-tile-violet",
  bonus: "bg-tile-star",
  start: "bg-slate-700",
};

type Point = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
}

const TILE_SIZE = 64;
const TILE_CENTER = TILE_SIZE / 2;
const BOARD_MARGIN = 96;
const FOLLOW_MOBILE_SCALE = 1.2;
const FOLLOW_DESKTOP_SCALE = 1.05;
const MOVE_STEP_MS = 320;
export const GameBoard: React.FC<GameBoardProps> = ({
  tiles,
  players,
  onMoveAnimationEnd,
}) => {
  const bounds = useMemo(() => {
    if (!tiles.length) return { minX: 0, minY: 0, maxX: 800, maxY: 500 };
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    const minX = Math.min(...xs) - BOARD_MARGIN;
    const minY = Math.min(...ys) - BOARD_MARGIN;
    const maxX = Math.max(...xs) + BOARD_MARGIN + TILE_SIZE;
    const maxY = Math.max(...ys) + BOARD_MARGIN + TILE_SIZE;
    return { minX, minY, maxX, maxY };
  }, [tiles]);

  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);

  const points = useMemo(
    () => tiles.map((t) => ({ x: t.x - bounds.minX, y: t.y - bounds.minY })),
    [tiles, bounds.minX, bounds.minY]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousPositionsRef = useRef<Record<string, number>>({});
  const moveTimeoutsRef = useRef<number[]>([]);
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);

  // Keep latest values for resize callbacks / pointer handlers.
  const scaleRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });

  // Zoom & pan (needed on mobile: we keep tiles readable and allow moving around the board)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    scaleRef.current = scale;
    offsetRef.current = offset;
  }, [scale, offset]);

  // Pointer tracking (drag + pinch)
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

  const computeFitScale = (containerW: number, containerH: number) => {
    const pad = 16;
    const availW = Math.max(0, containerW - pad);
    const availH = Math.max(0, containerH - pad);
    if (width <= 0 || height <= 0) return 1;
    return Math.min(availW / width, availH / height);
  };

  const clampOffset = (nextScale: number, nextOffset: Point, containerW: number, containerH: number) => {
    const pad = 8;
    const contentW = width * nextScale;
    const contentH = height * nextScale;

    // If content is smaller than container, keep it centered.
    const minX = contentW <= containerW ? (containerW - contentW) / 2 : containerW - contentW - pad;
    const maxX = contentW <= containerW ? (containerW - contentW) / 2 : pad;
    const minY = contentH <= containerH ? (containerH - contentH) / 2 : containerH - contentH - pad;
    const maxY = contentH <= containerH ? (containerH - contentH) / 2 : pad;

    return {
      x: clamp(nextOffset.x, minX, maxX),
      y: clamp(nextOffset.y, minY, maxY),
    };
  };

  const focusOnPosition = useCallback(
    (position: number, boostScale: boolean) => {
      const tile = tiles[position];
      const el = containerRef.current;
      if (!tile || !el) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const coarse = isCoarsePointer();
      const fit = computeFitScale(rect.width, rect.height);
      const minScale = coarse ? Math.min(1, fit) : Math.min(0.5, fit);
      const followFloor = coarse ? Math.max(minScale, FOLLOW_MOBILE_SCALE) : Math.max(minScale, FOLLOW_DESKTOP_SCALE);
      const nextScale = boostScale
        ? clamp(Math.max(scaleRef.current, followFloor), minScale, 2.75)
        : scaleRef.current;

      const centerX = tile.x - bounds.minX + TILE_CENTER;
      const centerY = tile.y - bounds.minY + TILE_CENTER;
      const nextOffset = {
        x: rect.width * 0.5 - centerX * nextScale,
        y: rect.height * 0.48 - centerY * nextScale,
      };

      setScale(nextScale);
      setOffset(clampOffset(nextScale, nextOffset, rect.width, rect.height));
    },
    [bounds.minX, bounds.minY, tiles]
  );

  const resetView = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const coarse = isCoarsePointer();
    const fit = computeFitScale(rect.width, rect.height);

    // Desktop: default "fit".
    // Mobile: start slightly zoomed OUT so the whole board is visible immediately.
    // (Players can pinch / use +/- to zoom back in.)
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

    setScale(nextScale);
    setOffset(clampOffset(nextScale, centered, rect.width, rect.height));
  };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // First run: pick a good default. On subsequent resizes, keep the current view as much as possible.
      const fit = computeFitScale(rect.width, rect.height);
      const coarse = isCoarsePointer();

      setScale((prev) => {
        const isFresh = prev === 1 && offsetRef.current.x === 0 && offsetRef.current.y === 0;
        if (!isFresh) return prev;

        const initial = clamp(
          coarse ? Math.min(fit * 0.96, 1.05) : Math.min(fit * 1.04, 2.2),
          0.5,
          2.75
        );
        return initial;
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

  // Keep offset clamped when scale changes.
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

    // Convert anchor point (screen) to content coordinates, then keep it fixed.
    const contentX = (anchor.x - offset.x) / scale;
    const contentY = (anchor.y - offset.y) / scale;

    const nextOffset = {
      x: anchor.x - contentX * clampedScale,
      y: anchor.y - contentY * clampedScale,
    };

    setScale(clampedScale);
    setOffset(clampOffset(clampedScale, nextOffset, rect.width, rect.height));
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const el = containerRef.current;
    if (!el) return;

    // Capture so we keep receiving move events.
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

      // Zoom around current midpoint.
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
      // Switch back to pan with remaining pointer
      const remaining = Array.from(pointers.current.values())[0];
      gesture.current = {
        kind: "pan",
        startOffset: offset,
        startPoint: remaining,
      };
    }
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    // Desktop zoom with Ctrl+wheel / trackpad pinch
    if (!e.ctrlKey) return;
    e.preventDefault();

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const zoomIntensity = 0.0015;
    const next = scale * (1 - e.deltaY * zoomIntensity);
    zoomAt(next, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const showControls = true;

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

    clearMoveTimeouts();
    let hasAnimatedMove = false;
    let followedPlayerId: string | null = null;

    players.forEach((p) => {
      const from = previousPositionsRef.current[p.id];
      const to = p.position;
      if (from == null || from === to) return;

      const path = findPath(from, to);
      const steps = path.slice(1);
      if (!steps.length) return;

      hasAnimatedMove = true;
      if (!followedPlayerId) followedPlayerId = p.id;

      steps.forEach((position, idx) => {
        const timeoutId = window.setTimeout(() => {
          setDisplayPositions((prev) => ({ ...prev, [p.id]: position }));
          if (followedPlayerId === p.id) focusOnPosition(position, true);
          if (idx === steps.length - 1 && followedPlayerId === p.id) {
            setMovingPlayerId(null);
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

    return () => clearMoveTimeouts();
  }, [findPath, focusOnPosition, players]);

  useLayoutEffect(() => {
    return () => {
      moveTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      moveTimeoutsRef.current = [];
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border-4 border-black bg-slate-900"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: "none" }}
    >
      {/* Small padding layer */}
      <div className="absolute inset-0 p-2">
        <div
          className="relative"
          style={{
            width,
            height,
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: "top left",
            transition: movingPlayerId ? "transform 220ms ease-out" : undefined,
          }}
        >
          {/* Path lines */}
          <svg className="absolute inset-0" width={width} height={height}>
            {tiles.flatMap((tile) => {
              const from = points[tile.id];
              const nextIds = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [tile.id + 1];
              return nextIds
                .filter((id) => id >= 0 && id < points.length)
                .map((nextId, idx) => {
                  const to = points[nextId];
                  return (
                    <g key={`l-${tile.id}-${nextId}-${idx}`}>
                      <line
                        x1={from.x + TILE_CENTER}
                        y1={from.y + TILE_CENTER}
                        x2={to.x + TILE_CENTER}
                        y2={to.y + TILE_CENTER}
                        stroke="rgba(15, 23, 42, 0.75)"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      <line
                        x1={from.x + TILE_CENTER}
                        y1={from.y + TILE_CENTER}
                        x2={to.x + TILE_CENTER}
                        y2={to.y + TILE_CENTER}
                        stroke="rgba(125, 211, 252, 0.6)"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                });
            })}
          </svg>

          {/* Tiles */}
          {tiles.map((tile, idx) => {
            const px = tile.x - bounds.minX;
            const py = tile.y - bounds.minY;

            const playersHere = players
              .map((p) => ({ p }))
              .filter(({ p }) => (displayPositions[p.id] ?? p.position) === tile.id);

            return (
              <div
                key={tile.id}
                className={cn(
                  "absolute flex h-16 w-16 items-center justify-center rounded-lg border-4 border-black text-lg font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.65)]",
                  TileColors[tile.type] ?? "bg-slate-800"
                )}
                style={{ left: px, top: py }}
                title={`${idx + 1} — ${tile.type}`}
              >
                <span>{TileIcon[tile.type] ?? "⬜"}</span>

                {/* Players on tile */}
                {playersHere.length > 0 && (
                  <div className="absolute -top-6 left-1/2 z-10 flex -translate-x-1/2 gap-1">
                    {playersHere.slice(0, 3).map(({ p }, k) => (
                      <div
                        key={`${p.id}-${k}`}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-base shadow-[0_0_0_2px_rgba(15,23,42,0.6)]",
                          movingPlayerId === p.id && "animate-bounce ring-2 ring-cyan-300"
                        )}
                        style={{ borderColor: p.color }}
                        title={p.name}
                      >
                        {AVATARS[p.avatar] ?? "🙂"}
                      </div>
                    ))}
                    {playersHere.length > 3 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-xs font-bold shadow-[0_0_0_2px_rgba(15,23,42,0.6)]">
                        +{playersHere.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Zoom controls available on both mobile and desktop */}
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
            className="h-10 w-10 rounded-md border-4 border-black bg-white/90 text-lg font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={() => zoomAt(scale * 1.15, { x: 80, y: 80 })}
            aria-label="Zoom +"
          >
            +
          </button>
          <button
            type="button"
            className="h-10 w-10 rounded-md border-4 border-black bg-white/90 text-lg font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={() => zoomAt(scale / 1.15, { x: 80, y: 80 })}
            aria-label="Zoom -"
          >
            −
          </button>
          <button
            type="button"
            className="h-10 w-10 rounded-md border-4 border-black bg-white/90 text-sm font-extrabold text-black shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]"
            onClick={resetView}
            aria-label="Recentrer"
          >
            ⟳
          </button>
        </div>
      )}
    </div>
  );
};
