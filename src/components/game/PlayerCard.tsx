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
            ? "border-[#163832]/35 bg-[#edf5ef] shadow-[0_0_0_1px_rgba(22,56,50,0.14)]"
            : "border-[#d8e2d9] bg-white/62",
        )}
        style={{ borderColor: isActive ? player.color : undefined }}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e2d9] bg-white/70 text-xl">
          {AVATARS[player.avatar] ?? "?"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-semibold text-[#18211f]">{player.name}</div>
          <div className="text-[11px] text-[#647067]">
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
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#d8e2d9] bg-white"
          style={{ boxShadow: "0 8px 18px rgba(22,56,50,0.10)" }}
        >
          <span className="text-3xl">{AVATARS[player.avatar] ?? "?"}</span>
        </div>
        <div className="flex-1">
          <div className="font-pixel text-sm">{player.name}</div>
          <div className="mt-1 text-xs opacity-80">
            {player.isHost ? fr.terms.host : fr.terms.player}
          </div>
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
