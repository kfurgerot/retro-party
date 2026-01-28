import React from 'react';
import { Player, AVATARS } from '@/types/game';
import { PixelCard } from '../game/PixelCard';
import { PixelButton } from '../game/PixelButton';
import { cn } from '@/lib/utils';

interface ResultsScreenProps {
  players: Player[];
  onPlayAgain: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ players, onPlayAgain }) => {
  const sorted = [...players].sort((a, b) => b.stars - a.stars);
  const totalStars = players.reduce((sum, p) => sum + p.stars, 0);

  return (
    <div className="scanlines flex w-full flex-col items-center gap-6 p-6">
      <PixelCard className="w-full max-w-3xl p-6 text-center">
        <div className="font-pixel text-2xl">Fin de partie 🎉</div>
        <div className="mt-2 text-sm opacity-80">Total kudobox ⭐ : {totalStars}</div>
      </PixelCard>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        {sorted.map((p, idx) => (
          <PixelCard
            key={p.id}
            className={cn("p-4", idx === 0 && "border-4 border-yellow-400")}
            style={{ borderColor: idx === 0 ? "#facc15" : p.color }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded border-4 border-black bg-white">
                <span className="text-3xl">{AVATARS[p.avatar] ?? "🙂"}</span>
              </div>
              <div className="flex-1">
                <div className="font-pixel text-lg">{p.name}</div>
                <div className="text-sm opacity-80">⭐ {p.stars}</div>
              </div>
              {idx === 0 && <div className="text-xl">🏆</div>}
            </div>
          </PixelCard>
        ))}
      </div>

      <PixelButton onClick={onPlayAgain} variant="primary">
        🔁 Rejouer
      </PixelButton>
    </div>
  );
};
