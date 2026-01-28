import React from 'react';
import { Player, AVATARS } from '@/types/game';
import { PixelCard } from './PixelCard';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  compact?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, isActive, compact = false }) => {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-2 border-2 rounded-md',
          isActive ? 'border-primary bg-primary/20' : 'border-border bg-card'
        )}
        style={{ borderColor: isActive ? player.color : undefined }}
      >
        <span className="text-xl">{AVATARS[player.avatar] ?? '🙂'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{player.name}</div>
          <div className="text-[11px] opacity-90">⭐ {player.stars}</div>
        </div>
      </div>
    );
  }

  return (
    <PixelCard
      glow={isActive ? 'cyan' : 'none'}
      className={cn('transition-all duration-300', isActive && 'scale-105')}
      style={{ borderColor: player.color }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 flex items-center justify-center border-4 border-black rounded-md bg-white"
          style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.6)' }}
        >
          <span className="text-3xl">{AVATARS[player.avatar] ?? '🙂'}</span>
        </div>
        <div className="flex-1">
          <div className="font-pixel text-sm">{player.name}</div>
          <div className="mt-1 text-xs opacity-80">
            {player.isHost ? '👑 Host' : '👥 Player'}
          </div>
        </div>
        <div className="font-pixel text-sm">
          ⭐ {player.stars}
        </div>
      </div>
    </PixelCard>
  );
};
