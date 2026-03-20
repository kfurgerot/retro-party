import React, { useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { CTA_NEON_PRIMARY, CTA_NEON_SECONDARY } from "@/lib/uiTokens";
import { Input, LobbyCard, PrimaryButton, SectionHeader } from "@/components/app-shell";

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
  const selectableCounts = Array.from({ length: 20 }, (_, i) => i + 1);

  const handlePlayerCountSelect = (count: number) => {
    setPlayerCount(count);
    setPlayers(
      Array.from({ length: count }, (_, i) => ({
        name: `${fr.terms.player} ${i + 1}`,
        avatar: i % AVATARS.length,
      }))
    );
  };

  const updatePlayer = (idx: number, patch: Partial<PlayerSetup>) => {
    setPlayers(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const start = () => {
    const names = players.map((p) => p.name?.trim() || fr.lobbyLocal.defaultPlayer);
    const avatars = players.map((p) => p.avatar);
    onStartGame(names, avatars);
  };

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <RetroScreenBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5">
        <LobbyCard title={fr.home.title} subtitle={fr.lobbyLocal.choosePlayersHint} className="p-5 text-center sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">{fr.home.title}</div>
          <h1 className="mt-2 text-xl font-bold text-cyan-100 sm:text-3xl">{fr.home.title}</h1>
        </LobbyCard>

        <LobbyCard title={fr.lobbyLocal.playerCount}>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
            {selectableCounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handlePlayerCountSelect(n)}
                className={cn(
                  "h-10 rounded border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                  playerCount === n
                    ? CTA_NEON_PRIMARY
                    : `${CTA_NEON_SECONDARY} text-cyan-100`
                )}
                aria-label={`${fr.lobbyLocal.playerCount} ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        </LobbyCard>

        {playerCount && (
          <LobbyCard title={fr.lobbyLocal.playersTitle}>
            <SectionHeader
              title={fr.lobbyLocal.playersTitle}
              description={fr.lobbyLocal.choosePlayersHint}
              className="mb-2"
            />

            <div className="grid gap-3">
              {players.map((p, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-cyan-300/20 bg-slate-900/40 p-2 sm:gap-3 sm:p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-cyan-300/35 bg-slate-950/55 text-2xl">
                    {AVATARS[p.avatar] ?? ":)"}
                  </div>
                  <Input
                    aria-label={`${fr.terms.player} ${idx + 1}`}
                    value={p.name}
                    maxLength={16}
                    className="h-10 border-cyan-300/20 bg-slate-900/50 text-cyan-50 placeholder:text-slate-400"
                    onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                  />
                  <select
                    aria-label={`${fr.onlineLobby.profileAvatarLabel} ${idx + 1}`}
                    className="h-10 rounded border border-cyan-300/25 bg-slate-900/50 px-2 text-sm text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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

            <div className="mt-5 flex justify-end">
              <PrimaryButton onClick={start} className={cn("h-11 px-6 font-semibold", CTA_NEON_PRIMARY)} disabled={players.length < 1}>
                {fr.lobbyLocal.launchParty}
              </PrimaryButton>
            </div>
          </LobbyCard>
        )}
      </div>
    </div>
  );
};
