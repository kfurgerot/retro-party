import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";
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
  onHost: (
    name: string,
    avatar: number,
    role: PlanningPokerRole,
    voteSystem: PlanningPokerVoteSystem,
  ) => void;
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

const VOTE_SYSTEM_OPTIONS: Array<{ value: PlanningPokerVoteSystem; label: string }> = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "JH" },
  { value: "tshirt", label: "T-Shirt" },
];

const displayDeckValue = (value: string) => (value === "☕" ? "Cafe" : value);

const cleanName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

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
  const [avatar, setAvatar] = useState(() =>
    Math.max(0, Math.min(AVATARS.length - 1, initialAvatar ?? 0)),
  );
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
  }, [
    autoSubmitKey,
    roomCode,
    mode,
    canCreate,
    canJoin,
    onHost,
    onJoin,
    name,
    avatar,
    role,
    voteSystem,
    code,
  ]);

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
    [lobbyPlayers],
  );

  return (
    <div className="relative flex min-h-svh w-full items-start justify-center overflow-hidden bg-[#f7f8f3] px-4 pb-28 pt-4 text-[#18211f] sm:pb-28 sm:pt-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

      <Card
        tone="saas"
        className="relative z-10 flex min-h-[82svh] w-full max-w-5xl flex-col p-5 sm:p-8"
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#647067]">
          <span>{fr.planningPoker.brand}</span>
          <span className="rounded-full border border-[#d8e2d9] bg-white/62 px-2 py-0.5">
            {fr.planningPoker.lobbyBadge}
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl font-black tracking-tight text-[#18211f] sm:text-3xl">
          {roomCode ? fr.planningPoker.lobbyReady : fr.planningPoker.lobbyTitle}
        </h1>

        {!roomCode && (
          <Card tone="saas" className="mx-auto mt-6 grid w-full max-w-xl gap-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2">
              <SecondaryButton
                tone="saas"
                type="button"
                className={cn(
                  "h-11",
                  mode === "host" && "border-[#163832] bg-[#163832] text-white hover:bg-[#1f4a43]",
                )}
                onClick={() => setMode("host")}
              >
                {fr.onlineLobby.hostAction}
              </SecondaryButton>
              <SecondaryButton
                tone="saas"
                type="button"
                className={cn(
                  "h-11",
                  mode === "join" && "border-[#163832] bg-[#163832] text-white hover:bg-[#1f4a43]",
                )}
                onClick={() => setMode("join")}
              >
                {fr.onlineLobby.joinAction}
              </SecondaryButton>
            </div>

            <Input
              tone="saas"
              value={name}
              onChange={(event) => setName(cleanName(event.target.value))}
              placeholder={fr.onlineOnboarding.displayNamePlaceholder}
              className="h-11"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-[#647067]">{fr.onlineOnboarding.avatarTitle}</p>
                <div className="grid grid-cols-6 gap-1 rounded-md border border-[#d8e2d9] bg-white/62 p-2">
                  {AVATARS.slice(0, 12).map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setAvatar(index)}
                      className={cn(
                        "h-8 w-8 rounded border border-[#d8e2d9] text-lg",
                        avatar === index ? "bg-[#edf5ef] ring-2 ring-[#163832]/30" : "bg-white/62",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div>
                  <p className="mb-1 text-xs text-[#647067]">{fr.planningPoker.roleTitle}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <SecondaryButton
                      tone="saas"
                      type="button"
                      className={cn(
                        "h-10 text-xs",
                        role === "player" && "border-[#163832] bg-[#163832] text-white",
                      )}
                      onClick={() => setRole("player")}
                    >
                      {fr.planningPoker.rolePlayer}
                    </SecondaryButton>
                    <SecondaryButton
                      tone="saas"
                      type="button"
                      className={cn(
                        "h-10 text-xs",
                        role === "spectator" && "border-[#163832] bg-[#163832] text-white",
                      )}
                      onClick={() => setRole("spectator")}
                    >
                      {fr.planningPoker.roleSpectator}
                    </SecondaryButton>
                  </div>
                </div>

                {mode === "host" ? (
                  <div>
                    <p className="mb-1 text-xs text-[#647067]">{fr.planningPoker.voteSystem}</p>
                    <div className="grid grid-cols-3 gap-1 rounded border border-[#d8e2d9] bg-white/62 p-1">
                      {VOTE_SYSTEM_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onVoteSystemChange(option.value)}
                          className={cn(
                            "h-8 rounded px-2 text-xs transition-colors",
                            voteSystem === option.value
                              ? "bg-[#163832] text-white"
                              : "bg-transparent text-[#24443d] hover:bg-[#edf5ef]",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs text-[#647067]">
                      {fr.onlineLobby.roomCodePlaceholder}
                    </p>
                    <Input
                      tone="saas"
                      value={code}
                      onChange={(event) => setCode(cleanCode(event.target.value))}
                      className="h-10 border-[#d8e2d9] bg-white/62 text-[#18211f]"
                      placeholder={fr.onlineLobby.roomCodePlaceholder}
                    />
                  </div>
                )}
              </div>
            </div>

            {!connected && (
              <p className="text-xs text-amber-300">{fr.onlineOnboarding.connecting}</p>
            )}
            {mode === "join" && !validCode && code.length > 0 && (
              <p className="text-xs text-amber-300">{fr.onlineLobby.minCodeHint}</p>
            )}
            {!validName && name.length > 0 && (
              <p className="text-xs text-amber-300">{fr.onlineOnboarding.minName}</p>
            )}
          </Card>
        )}

        {roomCode && (
          <section className="mx-auto mt-6 grid w-full max-w-5xl gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card tone="saas" className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#647067]">
                  {fr.onlineLobby.playersTitle}
                </h2>
                <span className="text-xs text-[#647067]">{sortedPlayers.length}</span>
              </div>

              <div className="grid max-h-[45vh] gap-2 overflow-auto pr-1">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between rounded-md border border-[#d8e2d9] bg-white/62 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#d8e2d9] bg-white/70 text-xl">
                        {AVATARS[player.avatar] ?? "??"}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-[#18211f]">{player.name}</div>
                        <div className="text-[11px] text-[#647067]">
                          {player.role === "player"
                            ? fr.planningPoker.rolePlayer
                            : fr.planningPoker.roleSpectator}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] uppercase">
                      {player.connected ? (
                        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                          {fr.onlineLobby.online}
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                          {fr.onlineLobby.offline}
                        </span>
                      )}
                      {player.isHost && (
                        <span className="rounded-full border border-[#163832]/25 bg-[#edf5ef] px-2 py-0.5 text-[#24443d]">
                          {fr.terms.host}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card tone="saas" className="grid gap-3 p-4 sm:p-5">
              <div className="rounded-md border border-[#d8e2d9] bg-white/62 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.1em] text-[#647067]">
                  {fr.onlineLobby.codeLabel}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-[#edf5ef] px-2 py-1 text-sm font-semibold tracking-[0.12em] text-[#24443d]">
                    {roomCode}
                  </span>
                  <SecondaryButton
                    tone="saas"
                    className="h-9 min-h-0 px-3 text-xs"
                    onClick={copyCode}
                  >
                    {copied ? fr.onlineLobby.copied : fr.onlineLobby.copy}
                  </SecondaryButton>
                </div>
              </div>

              <div className="rounded-md border border-[#d8e2d9] bg-white/62 p-3">
                <p className="text-xs text-[#647067]">{fr.planningPoker.voteSystem}</p>
                <div
                  className={cn(
                    "mt-2 grid grid-cols-3 gap-1 rounded border border-[#d8e2d9] bg-white/62 p-1",
                    !canStart && "opacity-50",
                  )}
                >
                  {VOTE_SYSTEM_OPTIONS.map((option) => (
                    <button
                      key={`room-${option.value}`}
                      type="button"
                      disabled={!canStart}
                      onClick={() => onVoteSystemChange(option.value)}
                      className={cn(
                        "h-8 rounded px-2 text-xs transition-colors",
                        voteSystem === option.value
                          ? "bg-[#163832] text-white"
                          : "bg-transparent text-[#24443d] hover:bg-[#edf5ef]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {PLANNING_POKER_DECKS[voteSystem].map((value) => (
                    <span
                      key={`lobby-${value}`}
                      className="rounded border border-[#d8e2d9] bg-white/62 px-1.5 py-0.5 text-[10px] text-[#647067]"
                    >
                      {displayDeckValue(value)}
                    </span>
                  ))}
                </div>
              </div>

              {onEditProfile && (
                <SecondaryButton tone="saas" className="h-10" onClick={onEditProfile}>
                  {fr.onlineLobby.editProfile}
                </SecondaryButton>
              )}
            </Card>
          </section>
        )}
      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Card
          tone="saas"
          className="pointer-events-auto mx-auto w-full max-w-5xl bg-[#f7f8f3]/94 p-3 shadow-[0_-12px_38px_rgba(22,56,50,0.14)]"
        >
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
            <SecondaryButton tone="saas" className="h-11" onClick={onLeave}>
              {roomCode ? fr.onlineLobby.leaveParty : fr.onlineOnboarding.back}
            </SecondaryButton>

            {!roomCode ? (
              <PrimaryButton
                tone="saas"
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
              <PrimaryButton tone="saas" className="h-11" disabled={!canStart} onClick={onStart}>
                {fr.planningPoker.startSession}
              </PrimaryButton>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
