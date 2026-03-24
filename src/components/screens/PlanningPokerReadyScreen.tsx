import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { fr } from "@/i18n/fr";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { cn } from "@/lib/utils";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { PLANNING_POKER_DECKS } from "@/lib/planningPoker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CTA_NEON_DANGER,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
} from "@/lib/uiTokens";

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

const VOTE_SYSTEM_OPTIONS: Array<{ value: PlanningPokerVoteSystem; label: string }> = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "JH" },
  { value: "tshirt", label: "T-Shirt" },
];

const displayDeckValue = (value: string) => (value === "☕" ? "Cafe" : value);

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
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
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
  const hostPlayerName =
    sortedPlayers.find((player) => player.isHost)?.name ?? fr.terms.host;
  const subtitle = `${fr.onlineLobby.roomActive} : ${roomCode}`;

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

  const requestCancelParty = () => {
    setLeaveDialogOpen(true);
  };

  const confirmCancelParty = () => {
    setLeaveDialogOpen(false);
    onLeave();
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pt-4 pb-28 sm:pb-32 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.onlineLobby.brand}</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {fr.onlineLobby.roomReady}
        </h1>
        <p className="mt-4 text-center text-xs text-slate-300 sm:text-sm">{subtitle}</p>

        <section className="mx-auto mt-6 grid w-full max-w-4xl gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <Card className="grid gap-2 p-4 sm:p-5">
            {isHost ? (
              <p className="rounded-md border border-cyan-300/25 bg-slate-900/40 px-3 py-3 text-xs text-slate-300">
                {fr.onlineLobby.hostLaunchHint}
              </p>
            ) : (
              <div className="rounded-md border border-cyan-300/20 bg-slate-900/40 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                  {fr.onlineLobby.waitingHostTitle}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
                </p>
              </div>
            )}

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
                  <div className={cn("grid grid-cols-3 gap-1 rounded border border-cyan-300/25 bg-slate-900/50 p-1", !isHost && "opacity-50")}>
                    {VOTE_SYSTEM_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!isHost}
                        onClick={() => onVoteSystemChange(option.value)}
                        className={cn(
                          "h-8 rounded px-2 text-xs transition-colors",
                          voteSystem === option.value
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-transparent text-cyan-50 hover:bg-slate-800/70"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PLANNING_POKER_DECKS[voteSystem].map((value) => (
                      <span key={`ready-${value}`} className="rounded border border-cyan-300/20 bg-slate-900/55 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {displayDeckValue(value)}
                      </span>
                    ))}
                  </div>
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
          </Card>
        </section>

        <Card className="mt-6 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
              {fr.onlineLobby.playersTitle}
            </h2>
            <span className="text-xs text-slate-300">{sortedPlayers.length}</span>
          </div>

          <div className="grid max-h-[38vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
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
                  {player.connected ? (
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                      {fr.onlineLobby.online}
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                      {fr.onlineLobby.offline}
                    </span>
                  )}
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
        </Card>
      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton onClick={requestCancelParty} className={cn("h-11", CTA_NEON_DANGER)}>
              {fr.onlineLobby.cancelParty}
            </SecondaryButton>
            <PrimaryButton onClick={onStart} disabled={!isHost} className="h-11">
              {fr.onlineLobby.hostPrimaryAction}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={requestCancelParty} className={cn("h-12", CTA_NEON_DANGER)}>
              {fr.onlineLobby.cancelParty}
            </SecondaryButton>
            <PrimaryButton onClick={onStart} disabled={!isHost} className="h-12">
              {fr.onlineLobby.hostPrimaryAction}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md rounded-2xl border-cyan-300/40 p-5 sm:p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_14px_40px_rgba(2,6,23,0.6)]")}>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base uppercase tracking-[0.08em] text-cyan-100">
              {fr.onlineLobby.cancelPartyQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              {fr.onlineLobby.disconnectAll}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-cyan-100")}>
              {fr.onlineLobby.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")}
              onClick={confirmCancelParty}
            >
              {fr.onlineLobby.cancelParty}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

