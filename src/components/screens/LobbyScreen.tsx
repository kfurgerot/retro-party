import React, { useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
const CTA_NEON_PRIMARY =
  "border-[#163832] bg-[#163832] text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] hover:bg-[#1f4a43]";
const CTA_NEON_SECONDARY =
  "border-[#cbd8cd] bg-white/75 text-[#24443d] hover:border-[#aebcaf] hover:bg-white";
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
        "relative min-h-svh w-full overflow-hidden bg-[#f7f8f3] px-4 pt-6 text-[#18211f] sm:px-6 sm:pt-8",
        playerCount ? "pb-28 sm:pb-32" : "pb-6 sm:pb-8",
      )}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-5">
        <LobbyCard
          title={fr.home.title}
          subtitle={fr.lobbyLocal.choosePlayersHint}
          className="p-5 text-center sm:p-6"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#647067]">
            {fr.home.title}
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight text-[#18211f] sm:text-3xl">
            {fr.home.title}
          </h1>
        </LobbyCard>

        <LobbyCard title={fr.lobbyLocal.playerCount}>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
            {selectableCounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handlePlayerCountSelect(n)}
                className={cn(
                  "h-10 rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]",
                  playerCount === n ? CTA_NEON_PRIMARY : CTA_NEON_SECONDARY,
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
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-[#d8e2d9] bg-white/62 p-2 sm:gap-3 sm:p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8e2d9] bg-white/70 text-2xl">
                    {AVATARS[p.avatar] ?? ":)"}
                  </div>
                  <Input
                    tone="saas"
                    aria-label={`${fr.terms.player} ${idx + 1}`}
                    value={p.name}
                    maxLength={16}
                    className="h-10"
                    onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                  />
                  <select
                    aria-label={`${fr.onlineLobby.profileAvatarLabel} ${idx + 1}`}
                    className="h-10 rounded-xl border border-[#cfd9d1] bg-white/80 px-2 text-sm text-[#18211f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]"
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
          <Card
            tone="saas"
            className="pointer-events-auto mx-auto w-full max-w-4xl bg-[#f7f8f3]/94 p-3 shadow-[0_-12px_38px_rgba(22,56,50,0.14)]"
          >
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
