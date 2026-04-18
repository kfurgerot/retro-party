import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { fr } from "@/i18n/fr";
import { PageShell, StickyFooter, RoomCodeDisplay, PlayerList } from "@/components/app-shell";
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

const ACCENT = "#6366f1";

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
  brandLabel?: string;
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

const displayDeckValue = (value: string) => (value === "☕" ? "Café" : value);

export const PlanningPokerReadyScreen: React.FC<Props> = ({
  connected,
  roomCode,
  lobbyPlayers,
  brandLabel,
  voteSystem,
  myRole,
  isHost,
  onLeave,
  onStart,
  onVoteSystemChange,
  onRoleChange,
}) => {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  const sortedPlayers = useMemo(
    () =>
      [...lobbyPlayers].sort((a, b) => {
        const hostGap = Number(b.isHost) - Number(a.isHost);
        if (hostGap !== 0) return hostGap;
        return Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name, "fr");
      }),
    [lobbyPlayers],
  );
  const hostPlayerName = sortedPlayers.find((p) => p.isHost)?.name ?? fr.terms.host;

  return (
    <PageShell
      accentColor="rgba(99,102,241,0.1)"
      accentGlow="rgba(99,102,241,0.04)"
      maxWidth="5xl"
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
          {brandLabel ?? fr.planningPoker.brand}
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: "#10b981",
            background: "rgba(16,185,129,0.1)",
            borderColor: "rgba(16,185,129,0.25)",
          }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Session active · {roomCode}
        </span>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
        {fr.onlineLobby.roomReady}
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        {isHost ? fr.onlineLobby.hostLaunchHint : fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Config */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="mb-4 text-sm font-semibold text-slate-200">{fr.planningPoker.myConfigTitle}</p>

            {/* Role */}
            <div className="mb-4">
              <p className="mb-2 text-xs text-slate-500">{fr.planningPoker.roleTitle}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["player", "spectator"] as PlanningPokerRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onRoleChange(r)}
                    className={cn(
                      "h-10 rounded-xl border text-sm font-semibold transition-all",
                      myRole === r
                        ? "border-white/20 text-white"
                        : "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]",
                    )}
                    style={
                      myRole === r
                        ? { background: `${ACCENT}25`, boxShadow: `0 0 0 1px ${ACCENT}40`, color: ACCENT }
                        : undefined
                    }
                  >
                    {r === "player" ? fr.planningPoker.rolePlayer : fr.planningPoker.roleSpectator}
                  </button>
                ))}
              </div>
            </div>

            {/* Vote system */}
            <div>
              <p className="mb-2 text-xs text-slate-500">{fr.planningPoker.voteSystem}</p>
              <div className={cn("grid grid-cols-3 gap-1.5", !isHost && "opacity-50 pointer-events-none")}>
                {VOTE_SYSTEM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!isHost}
                    onClick={() => onVoteSystemChange(opt.value)}
                    className={cn(
                      "h-9 rounded-xl border text-sm font-semibold transition-all",
                      voteSystem === opt.value
                        ? "border-white/20 text-white"
                        : "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]",
                    )}
                    style={
                      voteSystem === opt.value
                        ? { background: `${ACCENT}25`, boxShadow: `0 0 0 1px ${ACCENT}40`, color: ACCENT }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PLANNING_POKER_DECKS[voteSystem].map((value) => (
                  <span
                    key={`ready-${value}`}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[11px] text-slate-500"
                  >
                    {displayDeckValue(value)}
                  </span>
                ))}
              </div>
            </div>

            {!connected && (
              <p className="mt-3 text-xs text-amber-400">{fr.onlineOnboarding.connecting}</p>
            )}
          </div>
        </div>

        {/* Right: code + players */}
        <div className="space-y-4">
          <RoomCodeDisplay
            code={roomCode}
            accentColor={ACCENT}
            hint={fr.onlineLobby.inviteHint}
          />
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">{fr.onlineLobby.playersTitle}</h2>
              <span className="text-xs text-slate-500">{sortedPlayers.length}</span>
            </div>
            <PlayerList
              players={sortedPlayers}
              accentColor={ACCENT}
              roleLabel={(role) =>
                role === "player" ? fr.planningPoker.rolePlayer : fr.planningPoker.roleSpectator
              }
            />
          </div>
        </div>
      </div>

      <StickyFooter maxWidth="5xl">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLeaveDialogOpen(true)}
            className="h-11 rounded-xl border border-red-500/30 bg-red-500/10 px-5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
          >
            {fr.onlineLobby.cancelParty}
          </button>
          <button
            type="button"
            onClick={onStart}
            disabled={!isHost}
            className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
              boxShadow: isHost ? `0 4px 16px ${ACCENT}40` : "none",
            }}
          >
            {fr.planningPoker.startSession}
          </button>
        </div>
      </StickyFooter>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl border border-white/[0.08] bg-[#0f0f1c] p-6 text-slate-100 shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-slate-50">
              {fr.onlineLobby.cancelPartyQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-400">
              {fr.onlineLobby.disconnectAll}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white">
              {fr.onlineLobby.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300"
              onClick={() => { setLeaveDialogOpen(false); onLeave(); }}
            >
              {fr.onlineLobby.cancelParty}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};
