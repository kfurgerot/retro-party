import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { Card, Input, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
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
  roomCode: string | null;
  lobbyPlayers: LobbyPlayer[];
  voteSystem: PlanningPokerVoteSystem;
  onHost: (name: string, avatar: number, role: PlanningPokerRole, voteSystem: PlanningPokerVoteSystem) => void;
  onJoin: (code: string, name: string, avatar: number, role: PlanningPokerRole) => void;
  onLeave: () => void;
  onStart: () => void;
  onEditProfile?: () => void;
  onVoteSystemChange: (voteSystem: PlanningPokerVoteSystem) => void;
  canStart: boolean;
  initialName?: string;
  initialAvatar?: number;
  initialMode?: "host" | "join";
  initialCode?: string;
  autoSubmitKey?: number;
};

const cleanName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export const PlanningPokerLobbyScreen: React.FC<Props> = ({
  connected,
  roomCode,
  lobbyPlayers,
  voteSystem,
  onHost,
  onJoin,
  onLeave,
  onStart,
  onEditProfile,
  onVoteSystemChange,
  canStart,
  initialName,
  initialAvatar,
  initialMode,
  initialCode,
  autoSubmitKey,
}) => {
  const [mode, setMode] = useState<"host" | "join">(initialMode ?? "host");
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => Math.max(0, Math.min(AVATARS.length - 1, initialAvatar ?? 0)));
  const [role, setRole] = useState<PlanningPokerRole>("player");
  const [code, setCode] = useState(() => cleanCode(initialCode ?? ""));
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const lastAutoSubmittedRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const validName = name.length >= 2;
  const validCode = cleanCode(code).length >= 4;

  const canCreate = connected && !roomCode && mode === "host" && validName;
  const canJoin = connected && !roomCode && mode === "join" && validName && validCode;

  useEffect(() => {
    if (!autoSubmitKey || roomCode) return;
    if (lastAutoSubmittedRef.current === autoSubmitKey) return;
    if (mode === "host" && canCreate) {
      lastAutoSubmittedRef.current = autoSubmitKey;
      onHost(name.trim(), avatar, role, voteSystem);
      return;
    }
    if (mode === "join" && canJoin) {
      lastAutoSubmittedRef.current = autoSubmitKey;
      onJoin(cleanCode(code), name.trim(), avatar, role);
    }
  }, [autoSubmitKey, roomCode, mode, canCreate, canJoin, onHost, onJoin, name, avatar, role, voteSystem, code]);

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1100);
    } catch {
      // ignore
    }
  };

  const sortedPlayers = useMemo(
    () =>
      [...lobbyPlayers].sort((a, b) => {
        if (a.isHost !== b.isHost) return Number(b.isHost) - Number(a.isHost);
        if (a.connected !== b.connected) return Number(b.connected) - Number(a.connected);
        return a.name.localeCompare(b.name, "fr");
      }),
    [lobbyPlayers]
  );

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-28 pt-4 sm:pb-28 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-5xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.planningPoker.brand}</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">{fr.planningPoker.lobbyBadge}</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {roomCode ? fr.planningPoker.lobbyReady : fr.planningPoker.lobbyTitle}
        </h1>

        {!roomCode && (
          <Card className="mx-auto mt-6 grid w-full max-w-xl gap-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                type="button"
                className={cn("h-11", mode === "host" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400")}
                onClick={() => setMode("host")}
              >
                {fr.onlineLobby.hostAction}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className={cn("h-11", mode === "join" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400")}
                onClick={() => setMode("join")}
              >
                {fr.onlineLobby.joinAction}
              </SecondaryButton>
            </div>

            <Input
              value={name}
              onChange={(event) => setName(cleanName(event.target.value))}
              placeholder={fr.onlineOnboarding.displayNamePlaceholder}
              className="h-11 border-cyan-300/20 bg-slate-900/50 text-cyan-50 placeholder:text-slate-400"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-slate-300">{fr.onlineOnboarding.avatarTitle}</p>
                <div className="grid grid-cols-6 gap-1 rounded-md border border-cyan-300/20 bg-slate-900/50 p-2">
                  {AVATARS.slice(0, 12).map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setAvatar(index)}
                      className={cn(
                        "h-8 w-8 rounded border border-cyan-300/20 text-lg",
                        avatar === index ? "bg-cyan-500/25 ring-2 ring-cyan-300" : "bg-slate-950/40"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div>
                  <p className="mb-1 text-xs text-slate-300">{fr.planningPoker.roleTitle}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <SecondaryButton
                      type="button"
                      className={cn("h-10 text-xs", role === "player" && "border-cyan-300 bg-cyan-500 text-slate-950")}
                      onClick={() => setRole("player")}
                    >
                      {fr.planningPoker.rolePlayer}
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className={cn("h-10 text-xs", role === "spectator" && "border-cyan-300 bg-cyan-500 text-slate-950")}
                      onClick={() => setRole("spectator")}
                    >
                      {fr.planningPoker.roleSpectator}
                    </SecondaryButton>
                  </div>
                </div>

                {mode === "host" ? (
                  <div>
                    <p className="mb-1 text-xs text-slate-300">{fr.planningPoker.voteSystem}</p>
                    <select
                      value={voteSystem}
                      onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerVoteSystem)}
                      className="h-10 w-full rounded border border-cyan-300/25 bg-slate-900/50 px-2 text-sm text-cyan-50"
                    >
                      <option value="fibonacci">Fibonacci</option>
                      <option value="man-day">Jour.homme</option>
                      <option value="tshirt">T-Shirt</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs text-slate-300">{fr.onlineLobby.roomCodePlaceholder}</p>
                    <Input
                      value={code}
                      onChange={(event) => setCode(cleanCode(event.target.value))}
                      className="h-10 border-cyan-300/20 bg-slate-900/50 text-cyan-50"
                      placeholder={fr.onlineLobby.roomCodePlaceholder}
                    />
                  </div>
                )}
              </div>
            </div>

            {!connected && <p className="text-xs text-amber-300">{fr.onlineOnboarding.connecting}</p>}
            {mode === "join" && !validCode && code.length > 0 && <p className="text-xs text-amber-300">{fr.onlineLobby.minCodeHint}</p>}
            {!validName && name.length > 0 && <p className="text-xs text-amber-300">{fr.onlineOnboarding.minName}</p>}
          </Card>
        )}

        {roomCode && (
          <section className="mx-auto mt-6 grid w-full max-w-5xl gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/80">{fr.onlineLobby.playersTitle}</h2>
                <span className="text-xs text-slate-300">{sortedPlayers.length}</span>
              </div>

              <div className="grid max-h-[45vh] gap-2 overflow-auto pr-1">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between rounded-md border border-cyan-300/20 bg-slate-900/55 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-cyan-300/30 bg-slate-950/60 text-xl">
                        {AVATARS[player.avatar] ?? "??"}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-cyan-50">{player.name}</div>
                        <div className="text-[11px] text-slate-300">
                          {player.role === "player" ? fr.planningPoker.rolePlayer : fr.planningPoker.roleSpectator}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] uppercase">
                      {player.connected ? (
                        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">{fr.onlineLobby.online}</span>
                      ) : (
                        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-200">{fr.onlineLobby.offline}</span>
                      )}
                      {player.isHost && (
                        <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">{fr.terms.host}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="grid gap-3 p-4 sm:p-5">
              <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.1em] text-cyan-100/90">{fr.onlineLobby.codeLabel}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-cyan-500/15 px-2 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-200">{roomCode}</span>
                  <SecondaryButton className="h-9 min-h-0 px-3 text-xs" onClick={copyCode}>
                    {copied ? fr.onlineLobby.copied : fr.onlineLobby.copy}
                  </SecondaryButton>
                </div>
              </div>

              <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
                <p className="text-xs text-slate-300">{fr.planningPoker.voteSystem}</p>
                <select
                  disabled={!canStart}
                  value={voteSystem}
                  onChange={(event) => onVoteSystemChange(event.target.value as PlanningPokerVoteSystem)}
                  className="mt-2 h-10 w-full rounded border border-cyan-300/25 bg-slate-900/50 px-2 text-sm text-cyan-50 disabled:opacity-50"
                >
                  <option value="fibonacci">Fibonacci</option>
                  <option value="man-day">Jour.homme</option>
                  <option value="tshirt">T-Shirt</option>
                </select>
                <p className="mt-2 text-xs text-slate-400">{PLANNING_POKER_DECKS[voteSystem].join(" · ")}</p>
              </div>

              {onEditProfile && (
                <SecondaryButton className="h-10" onClick={onEditProfile}>
                  {fr.onlineLobby.editProfile}
                </SecondaryButton>
              )}
            </Card>
          </section>
        )}
      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Card className="pointer-events-auto mx-auto w-full max-w-5xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <SecondaryButton className="h-11" onClick={onLeave}>
              {roomCode ? fr.onlineLobby.leaveParty : fr.onlineOnboarding.back}
            </SecondaryButton>

            {!roomCode ? (
              <PrimaryButton
                className="h-11"
                disabled={mode === "host" ? !canCreate : !canJoin}
                onClick={() => {
                  if (mode === "host") {
                    onHost(name.trim(), avatar, role, voteSystem);
                    return;
                  }
                  onJoin(cleanCode(code), name.trim(), avatar, role);
                }}
              >
                {fr.onlineOnboarding.next}
              </PrimaryButton>
            ) : (
              <PrimaryButton className="h-11" disabled={!canStart} onClick={onStart}>
                {fr.planningPoker.startSession}
              </PrimaryButton>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
