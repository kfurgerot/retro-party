import React, { useState } from 'react';
import { AVATARS } from '@/types/game';
import { PixelCard } from '../game/PixelCard';
import { PixelButton } from '../game/PixelButton';
import { cn } from '@/lib/utils';

interface LobbyScreenProps {
  onStartGame: (names: string[], avatars: number[]) => void;
}

interface PlayerSetup {
  name: string;
  avatar: number;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onStartGame }) => {
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerSetup[]>([]);

  const handlePlayerCountSelect = (count: number) => {
    setPlayerCount(count);
    setPlayers(
      Array.from({ length: count }, (_, i) => ({
        name: `Player ${i + 1}`,
        avatar: i % AVATARS.length,
      }))
    );
  };

  const updatePlayer = (idx: number, patch: Partial<PlayerSetup>) => {
    setPlayers(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const start = () => {
    const names = players.map(p => p.name?.trim() || 'Player');
    const avatars = players.map(p => p.avatar);
    onStartGame(names, avatars);
  };

  return (
    <div className="scanlines flex w-full flex-col items-center gap-6 p-6">
      <PixelCard className="w-full max-w-3xl p-6 text-center">
        <div className="font-pixel text-2xl">Rétro Party 🎮</div>
        <div className="mt-2 text-sm opacity-80">
          Choisis le nombre de joueurs, puis lance la partie.
        </div>
      </PixelCard>

      <PixelCard className="w-full max-w-3xl p-6">
        <div className="font-pixel text-lg mb-4">Nombre de joueurs</div>
        <div className="flex flex-wrap gap-2">
          {[2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              onClick={() => handlePlayerCountSelect(n)}
              className={cn(
                "px-4 py-2 border-4 border-black rounded bg-white font-pixel",
                playerCount === n && "bg-primary text-primary-foreground"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </PixelCard>

      {playerCount && (
        <PixelCard className="w-full max-w-3xl p-6">
          <div className="font-pixel text-lg mb-4">Joueurs</div>

          <div className="flex flex-col gap-3">
            {players.map((p, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="text-3xl">{AVATARS[p.avatar] ?? '🙂'}</div>
                <input
                  className="flex-1 border-4 border-black rounded px-3 py-2 font-pixel text-sm bg-white"
                  value={p.name}
                  onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                />
                <select
                  className="border-4 border-black rounded px-2 py-2 font-pixel text-sm bg-white"
                  value={p.avatar}
                  onChange={(e) => updatePlayer(idx, { avatar: Number(e.target.value) })}
                >
                  {AVATARS.map((a, i) => (
                    <option key={i} value={i}>
                      {a} #{i + 1}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <PixelButton onClick={start} variant="primary" disabled={players.length < 2}>
              🚀 Lancer la partie
            </PixelButton>
          </div>
        </PixelCard>
      )}
    </div>
  );
};
