import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Tile, Player, AVATARS } from '@/types/game';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  tiles: Tile[];
  players: Player[];
}

const TileIcon: Record<string, string> = {
  blue: '🔵',
  red: '🔴',
  green: '🟢',
  violet: '🟣',
  bonus: '⭐',
  start: '🏁',
};

const TileColors: Record<string, string> = {
  blue: 'bg-tile-blue',
  red: 'bg-tile-red',
  green: 'bg-tile-green',
  violet: 'bg-tile-violet',
  bonus: 'bg-tile-star',
  start: 'bg-slate-700',
};

export const GameBoard: React.FC<GameBoardProps> = ({ tiles, players }) => {
  const bounds = useMemo(() => {
    if (!tiles.length) return { minX: 0, minY: 0, maxX: 800, maxY: 500 };
    const xs = tiles.map(t => t.x);
    const ys = tiles.map(t => t.y);
    const minX = Math.min(...xs) - 80;
    const minY = Math.min(...ys) - 80;
    const maxX = Math.max(...xs) + 120;
    const maxY = Math.max(...ys) + 120;
    return { minX, minY, maxX, maxY };
  }, [tiles]);

  const width = Math.max(900, bounds.maxX - bounds.minX);
  const height = Math.max(520, bounds.maxY - bounds.minY);

  const points = tiles.map(t => ({ x: t.x - bounds.minX, y: t.y - bounds.minY }));const containerRef = useRef<HTMLDivElement | null>(null);
const [scale, setScale] = useState(1);

useLayoutEffect(() => {
  const el = containerRef.current;
  if (!el) return;

  const compute = () => {
    const rect = el.getBoundingClientRect();
    // Leave a small margin inside the container
    const availW = Math.max(0, rect.width - 16);
    const availH = Math.max(0, rect.height - 16);
    if (width <= 0 || height <= 0) return;

    const s = Math.min(availW / width, availH / height, 2);
    setScale(Number.isFinite(s) ? s : 1);
  };

  compute();
  const ro = new ResizeObserver(() => compute());
  ro.observe(el);
  window.addEventListener('resize', compute);
  return () => {
    ro.disconnect();
    window.removeEventListener('resize', compute);
  };
}, [width, height]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-lg border-4 border-black bg-slate-900 p-2">
      <div className="relative" style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {/* Path lines */}
        <svg className="absolute inset-0" width={width} height={height}>
          {points.map((p, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            return (
              <line
                key={`l-${i}`}
                x1={prev.x + 28}
                y1={prev.y + 28}
                x2={p.x + 28}
                y2={p.y + 28}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="8"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Tiles */}
        {tiles.map((tile, idx) => {
          const px = tile.x - bounds.minX;
          const py = tile.y - bounds.minY;

          const playersHere = players
            .map((p, pIdx) => ({ p, pIdx }))
            .filter(({ p }) => p.position === tile.id);

          return (
            <div
              key={tile.id}
              className={cn(
                "absolute flex h-14 w-14 items-center justify-center rounded-md border-4 border-black text-base font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.6)]",
                TileColors[tile.type] ?? "bg-slate-800"
              )}
              style={{ left: px, top: py }}
              title={`${idx + 1} — ${tile.type}`}
            >
              <span>{TileIcon[tile.type] ?? "⬜"}</span>

              {/* Players on tile */}
              {playersHere.length > 0 && (
                <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 gap-1">
                  {playersHere.slice(0, 3).map(({ p }, k) => (
                    <div
                      key={`${p.id}-${k}`}
                      className="flex h-7 w-7 items-center justify-center rounded border-2 border-black bg-white text-sm"
                      title={p.name}
                    >
                      {AVATARS[p.avatar] ?? "🙂"}
                    </div>
                  ))}
                  {playersHere.length > 3 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded border-2 border-black bg-white text-sm">
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
  );
};
