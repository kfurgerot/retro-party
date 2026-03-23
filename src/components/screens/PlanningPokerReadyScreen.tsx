import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { fr } from "@/i18n/fr";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { cn } from "@/lib/utils";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { PLANNING_POKER_DECKS } from "@/lib/planningPoker";

type LobbyPlayer = {
  socketId: string;
  name: string;
  avatar: number;
  isHost: boolean;
  connected: boolean;
  role: PlanningPokerRole;
  hasVoted: boolean;
  vote: string | null;
};

type Props = {
  connected: boolean;
  roomCode: string;
  lobbyPlayers: LobbyPlayer[];
  voteSystem: PlanningPokerVoteSystem;
  myRole: PlanningPokerRole;
  isHost: boolean;
  onLeave: () => void;
  onStart: () => void;
  onVoteSystemChange: (voteSystem: PlanningPokerVoteSystem) => void;
  onRoleChange: (role: PlanningPokerRole) => void;
};

export const PlanningPokerReadyScreen: React.FC<Props> = ({
  connected,
  roomCode,
  lobbyPlayers,
  voteSystem,
  myRole,
  isHost,
  onLeave,
  onStart,
  onVoteSystemChange,
  onRoleChange,
}) => {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const sortedPlayers = useMemo(
    () =>
      [...lobbyPlayers].sort((a, b) => {
        const hostGap = Number(b.isHost) - Number(a.isHost);
        if (hostGap !== 0) return hostGap;
        const connectedGap = Number(b.connected) - Number(a.connected);
        if (connectedGap !== 0) return connectedGap;
        return a.name.localeCompare(b.name, "fr");
      }),
    [lobbyPlayers]
  );

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pt-4 sm:pt-6 pb-28 sm:pb-32">
      <RetroScreenBackground />

      <div className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col rounded border border-cyan-300/60 bg-[linear-gradient(180deg,rgba(8,18,38,0.88)_0%,rgba(8,12,24,0.9)_100%)] p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>{fr.planningPoker.brand}</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-1">{fr.planningPoker.readyBadge}</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {fr.planningPoker.readyTitle}
        </h1>

        <section className="mx-auto mt-6 grid w-full max-w-4xl gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <Card className="grid gap-3 p-4 sm:p-5">
            <div className="rounded-md border border-cyan-300/25 bg-slate-900/40 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                {fr.planningPoker.myConfigTitle}
              </p>

              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton
                    type="button"
                    className={cn("h-10 text-xs", myRole === "player" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400")}
                    onClick={() => onRoleChange("player")}
                  >
                    {fr.planningPoker.rolePlayer}
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    className={cn("h-10 text-xs", myRole === "spectator" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400")}
                    onClick={() => onRoleChange("spectator")}
                  >
                    {fr.planningPoker.roleSpectator}
                  </SecondaryButton>
                </div>

                <div>
                  <p className="mb-1 text-xs text-slate-300">{fr.planningPoker.voteSystem}</p>
                  <select
                    value={voteSystem}
                    disabled={!isHost}
                    onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerVoteSystem)}
                    className="h-10 w-full rounded border border-cyan-300/25 bg-slate-900/50 px-2 text-sm text-cyan-50 disabled:opacity-50"
                  >
                    <option value="fibonacci">Fibonacci</option>
                    <option value="man-day">Jour.homme</option>
                    <option value="tshirt">T-Shirt</option>
                  </select>
                  <p className="mt-2 text-xs text-slate-400">{PLANNING_POKER_DECKS[voteSystem].join(" · ")}</p>
                </div>
              </div>
            </div>

            {!connected ? <p className="text-xs text-amber-300">{fr.onlineOnboarding.connecting}</p> : null}
          </Card>

          <Card className="grid gap-3 p-4 sm:p-5">
            <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.onlineLobby.codeLabel}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-cyan-500/15 px-2 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-200">
                  {roomCode}
                </span>
                <SecondaryButton onClick={copyRoom} className="h-9 min-h-0 px-3 text-xs">
                  {copied ? fr.onlineLobby.copied : fr.onlineLobby.copy}
                </SecondaryButton>
              </div>
              <p className="mt-2 text-xs text-slate-300">{fr.onlineLobby.inviteHint}</p>
            </div>

            <div className="rounded-md border border-cyan-300/25 bg-slate-900/40 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.onlineLobby.playersTitle}</p>
              <div className="mt-2 grid max-h-[26vh] gap-2 overflow-auto pr-1">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between rounded-md border border-cyan-300/20 bg-slate-900/55 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-cyan-300/25 bg-slate-950/50">
                        {AVATARS[player.avatar] ?? "?"}
                      </span>
                      <span className="text-sm font-medium text-cyan-50">{player.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        {player.role === "player" ? fr.planningPoker.rolePlayer : fr.planningPoker.roleSpectator}
                      </span>
                      {player.isHost ? (
                        <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                          {fr.terms.host.toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton onClick={onLeave} className="h-11">
              {fr.onlineLobby.leaveParty}
            </SecondaryButton>
            <PrimaryButton onClick={onStart} disabled={!isHost} className="h-11">
              {fr.planningPoker.startSession}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={onLeave} className="h-12">
              {fr.onlineLobby.leaveParty}
            </SecondaryButton>
            <PrimaryButton onClick={onStart} disabled={!isHost} className="h-12">
              {fr.planningPoker.startSession}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
};
