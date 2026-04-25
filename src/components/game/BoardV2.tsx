import React, { useMemo } from "react";
import { AVATARS, MoveTrace, PendingPathChoice, Player, Tile } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

interface BoardV2Props {
  tiles: Tile[];
  players: Player[];
  pendingPathChoice?: PendingPathChoice | null;
  lastMoveTrace?: MoveTrace | null;
  canChoosePath?: boolean;
  onChoosePath?: (nextTileId: number) => void;
  eventOverlayActive?: boolean;
}

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

const TILE_BADGE_CLASS: Record<string, string> = {
  blue: "border-sky-300/70 bg-sky-50 text-sky-800",
  red: "border-rose-300/70 bg-rose-50 text-rose-800",
  green: "border-emerald-300/70 bg-emerald-50 text-emerald-800",
  purple: "border-violet-300/70 bg-violet-50 text-violet-800",
  violet: "border-violet-300/70 bg-violet-50 text-violet-800",
  star: "border-amber-300/80 bg-amber-50 text-amber-900",
  yellow: "border-amber-300/80 bg-amber-50 text-amber-900",
  bonus: "border-amber-300/80 bg-amber-50 text-amber-900",
  shop: "border-orange-300/70 bg-orange-50 text-orange-800",
  start: "border-slate-300/45 bg-slate-500/15 text-[#18211f]",
};

function computeDepths(tiles: Tile[]) {
  const depths = new Map<number, number>();
  if (!tiles.length) return depths;

  const q: number[] = [0];
  depths.set(0, 0);

  while (q.length > 0) {
    const id = q.shift() as number;
    const tile = tiles[id];
    if (!tile) continue;
    const curDepth = depths.get(id) ?? 0;
    const nextIds = Array.isArray(tile.nextTileIds) ? tile.nextTileIds : [id + 1];
    for (const nextId of nextIds) {
      if (nextId < 0 || nextId >= tiles.length) continue;
      if (depths.has(nextId)) continue;
      depths.set(nextId, curDepth + 1);
      q.push(nextId);
    }
  }

  let fallbackDepth = Math.max(0, ...depths.values());
  for (const tile of tiles) {
    if (depths.has(tile.id)) continue;
    fallbackDepth += 1;
    depths.set(tile.id, fallbackDepth);
  }
  return depths;
}

const BoardV2Component: React.FC<BoardV2Props> = ({
  tiles,
  players,
  pendingPathChoice,
  canChoosePath = false,
  onChoosePath,
  eventOverlayActive = false,
}) => {
  const depths = useMemo(() => computeDepths(tiles), [tiles]);
  const stages = useMemo(() => {
    const grouped = new Map<number, Tile[]>();
    for (const tile of tiles) {
      const depth = depths.get(tile.id) ?? 0;
      const list = grouped.get(depth);
      if (list) list.push(tile);
      else grouped.set(depth, [tile]);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([depth, stageTiles]) => ({
        depth,
        tiles: stageTiles.sort((a, b) => a.id - b.id),
      }));
  }, [depths, tiles]);

  const playersByTile = useMemo(() => {
    const byTile = new Map<number, Player[]>();
    for (const player of players) {
      const current = byTile.get(player.position) ?? [];
      current.push(player);
      byTile.set(player.position, current);
    }
    return byTile;
  }, [players]);

  const optionSet = useMemo(
    () => new Set(pendingPathChoice?.options ?? []),
    [pendingPathChoice?.options],
  );

  return (
    <div
      className={cn(
        "h-full w-full overflow-auto rounded-lg border border-[#d8e2d9] bg-white/62 p-2 sm:p-3",
        eventOverlayActive && "ring-2 ring-pink-400/25",
      )}
    >
      <div className="grid gap-2">
        {stages.map((stage) => (
          <section key={stage.depth} className="rounded-md border border-[#d8e2d9] bg-white/62 p-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[#647067]">
              {fr.gameScreen.boardV2Stage.replace("{index}", String(stage.depth + 1))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {stage.tiles.map((tile) => {
                const tilePlayers = playersByTile.get(tile.id) ?? [];
                const isPathOrigin = pendingPathChoice?.atTileId === tile.id;
                const isPathOption = optionSet.has(tile.id);
                return (
                  <div
                    key={tile.id}
                    className={cn(
                      "rounded border px-2 py-2",
                      isPathOrigin
                        ? "border-amber-300/55 bg-amber-500/10"
                        : "border-[#d8e2d9] bg-white/58",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#647067]">
                          {isPathOrigin || isPathOption
                            ? fr.gameScreen.boardV2Node.replace("{index}", String(tile.id + 1))
                            : fr.gameScreen.boardV2NodeSimple}
                        </div>
                        <div className="text-sm font-semibold text-[#18211f]">
                          {fr.gameScreen.boardV2Type.replace("{type}", tile.type)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded border text-xs font-bold",
                          TILE_BADGE_CLASS[tile.type] ??
                            "border-[#163832]/35 bg-[#edf5ef] text-[#24443d]",
                        )}
                      >
                        {TILE_ICON[tile.type] ?? "?"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tilePlayers.length === 0 ? (
                        <span className="text-[11px] text-[#647067]">
                          {fr.gameScreen.boardV2NoPlayer}
                        </span>
                      ) : (
                        tilePlayers.map((player) => (
                          <span
                            key={player.id}
                            className="inline-flex items-center gap-1 rounded border border-[#d8e2d9] bg-white/68 px-1.5 py-0.5 text-[11px] text-[#24443d]"
                          >
                            <span>{AVATARS[player.avatar] ?? "?"}</span>
                            <span className="max-w-[80px] truncate">{player.name}</span>
                          </span>
                        ))
                      )}
                    </div>

                    {isPathOrigin && (
                      <div className="mt-2 text-[11px] text-amber-900">
                        {fr.gameScreen.boardV2PathOrigin}
                      </div>
                    )}

                    {isPathOption && (
                      <button
                        type="button"
                        disabled={!canChoosePath}
                        onClick={() => {
                          if (!canChoosePath) return;
                          onChoosePath?.(tile.id);
                        }}
                        className={cn(
                          "mt-2 inline-flex h-8 items-center rounded border px-3 text-xs font-semibold",
                          canChoosePath
                            ? "border-[#163832] bg-[#163832] text-white hover:bg-[#1f4a43]"
                            : "cursor-not-allowed border-[#d8e2d9] bg-white/62 text-[#647067]",
                        )}
                      >
                        {fr.gameScreen.boardV2ChoosePath}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export const BoardV2 = React.memo(BoardV2Component);
BoardV2.displayName = "BoardV2";
