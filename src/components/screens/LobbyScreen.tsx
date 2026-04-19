import React, { useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
const CTA_NEON_PRIMARY =
  "border-pink-400/40 bg-pink-500 text-white shadow-[0_4px_16px_rgba(236,72,153,0.35)] hover:bg-pink-400";
const CTA_NEON_SECONDARY =
  "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white";
import { Card, Input, LobbyCard, PrimaryButton, SectionHeader } from "@/components/app-shell";

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
  const canStart = players.length > 0;

  const handlePlayerCountSelect = (count: number) => {
    setPlayerCount(count);
    setPlayers(
      Array.from({ length: count }, (_, i) => ({
        name: `${fr.terms.player} ${i + 1}`,
        avatar: i % AVATARS.length,
      })),
    );
  };

  const updatePlayer = (idx: number, patch: Partial<PlayerSetup>) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const start = () => {
    const names = players.map((p) => p.name?.trim() || fr.lobbyLocal.defaultPlayer);
    const avatars = players.map((p) => p.avatar);
    onStartGame(names, avatars);
  };

  return (
    <div
      className={cn(
        "relative min-h-svh w-full overflow-hidden px-4 pt-6 sm:px-6 sm:pt-8",
        playerCount ? "pb-28 sm:pb-32" : "pb-6 sm:pb-8",
      )}
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(236,72,153,0.08) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5">
        <LobbyCard
          title={fr.home.title}
          subtitle={fr.lobbyLocal.choosePlayersHint}
          className="p-5 text-center sm:p-6"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-pink-200/80">
            {fr.home.title}
          </div>
          <h1 className="mt-2 text-xl font-bold text-pink-100 sm:text-3xl">{fr.home.title}</h1>
        </LobbyCard>

        <LobbyCard title={fr.lobbyLocal.playerCount}>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
            {selectableCounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handlePlayerCountSelect(n)}
                className={cn(
                  "h-10 rounded border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                  playerCount === n ? CTA_NEON_PRIMARY : `${CTA_NEON_SECONDARY} text-pink-100`,
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
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-pink-400/20 bg-slate-900/40 p-2 sm:gap-3 sm:p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-pink-400/35 bg-slate-950/55 text-2xl">
                    {AVATARS[p.avatar] ?? ":)"}
                  </div>
                  <Input
                    aria-label={`${fr.terms.player} ${idx + 1}`}
                    value={p.name}
                    maxLength={16}
                    className="h-10 border-pink-400/20 bg-slate-900/50 text-slate-100 placeholder:text-slate-400"
                    onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                  />
                  <select
                    aria-label={`${fr.onlineLobby.profileAvatarLabel} ${idx + 1}`}
                    className="h-10 rounded border border-pink-400/25 bg-slate-900/50 px-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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

            <div className="mt-5 hidden justify-end sm:flex">
              <PrimaryButton
                onClick={start}
                className={cn("h-11 px-6 font-semibold", CTA_NEON_PRIMARY)}
                disabled={!canStart}
              >
                {fr.lobbyLocal.launchParty}
              </PrimaryButton>
            </div>
          </LobbyCard>
        )}
      </div>

      {playerCount && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
          <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-pink-400/35 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(236,72,153,0.15),0_8px_28px_rgba(2,6,23,0.55)]">
            <PrimaryButton
              onClick={start}
              className={cn("h-12 w-full font-semibold", CTA_NEON_PRIMARY)}
              disabled={!canStart}
            >
              {fr.lobbyLocal.launchParty}
            </PrimaryButton>
          </Card>
        </div>
      )}
    </div>
  );
};
