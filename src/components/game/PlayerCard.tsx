import React from "react";
import { Player, AVATARS } from "@/types/game";
import { PixelCard } from "./PixelCard";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  compact?: boolean;
}

const PlayerCardComponent: React.FC<PlayerCardProps> = ({ player, isActive, compact = false }) => {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2.5 transition",
          isActive
            ? "border-pink-400/55 bg-pink-500/18 shadow-[0_0_0_1px_rgba(236,72,153,0.22)]"
            : "border-pink-400/20 bg-slate-900/52"
        )}
        style={{ borderColor: isActive ? player.color : undefined }}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-pink-400/25 bg-slate-950/55 text-xl">
          {AVATARS[player.avatar] ?? "?"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">{player.name}</div>
          <div className="text-[11px] text-pink-100/85">
            PTS {player.points ?? 0} | KUDO {player.stars}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PixelCard
      glow={isActive ? "cyan" : "none"}
      className={cn("transition-all duration-300", isActive && "scale-105")}
      style={{ borderColor: player.color }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 flex items-center justify-center border-4 border-black rounded-md bg-white"
          style={{ boxShadow: "4px 4px 0 rgba(0,0,0,0.6)" }}
        >
          <span className="text-3xl">{AVATARS[player.avatar] ?? "?"}</span>
        </div>
        <div className="flex-1">
          <div className="font-pixel text-sm">{player.name}</div>
          <div className="mt-1 text-xs opacity-80">{player.isHost ? fr.terms.host : fr.terms.player}</div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-xs">PTS {player.points ?? 0}</div>
          <div className="font-pixel text-sm">KUDO {player.stars}</div>
        </div>
      </div>
    </PixelCard>
  );
};

function arePlayerCardsEqual(prev: PlayerCardProps, next: PlayerCardProps) {
  return (
    prev.isActive === next.isActive &&
    prev.compact === next.compact &&
    prev.player.id === next.player.id &&
    prev.player.name === next.player.name &&
    prev.player.avatar === next.player.avatar &&
    prev.player.points === next.player.points &&
    prev.player.stars === next.player.stars &&
    prev.player.isHost === next.player.isHost &&
    prev.player.color === next.player.color
  );
}

export const PlayerCard = React.memo(PlayerCardComponent, arePlayerCardsEqual);
PlayerCard.displayName = "PlayerCard";
