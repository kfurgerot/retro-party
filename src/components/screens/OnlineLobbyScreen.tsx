import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { fr } from "@/i18n/fr";
import { Card, Input, PrimaryButton, SecondaryButton, SectionHeader } from "@/components/app-shell";
import {
  CTA_NEON_DANGER,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
} from "@/lib/uiTokens";
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
import { useAnimatedProgress } from "@/hooks/useAnimatedProgress";
import { Slider } from "@/components/ui/slider";

type LobbyPlayer = {
  name: string;
  avatar: number;
  isHost: boolean;
  connected?: boolean;
};

interface OnlineLobbyScreenProps {
  connected: boolean;
  roomCode: string | null;
  lobbyPlayers: LobbyPlayer[];
  onHost: (name: string, avatar: number) => void;
  onJoin: (code: string, name: string, avatar: number) => void;
  onLeave: () => void;
  onStartGame: (maxRounds: number) => void;
  onEditProfile?: () => void;
  canStart: boolean;
  initialName?: string;
  initialAvatar?: number;
  initialMode?: "host" | "join";
  initialCode?: string;
  autoSubmitKey?: number;
  stepLabel?: string;
  stepCurrent?: number;
  stepTotal?: number;
  titleWhenNoRoomOverride?: string;
  shellStyle?: "default" | "transparent";
}

type Pending = "idle" | "hosting" | "joining" | "starting";
const MAX_PLAYERS = 20;

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  connected,
  roomCode,
  lobbyPlayers,
  onHost,
  onJoin,
  onLeave,
  onStartGame,
  onEditProfile,
  canStart,
  initialName,
  initialAvatar,
  initialMode,
  initialCode,
  autoSubmitKey,
  stepLabel,
  stepCurrent,
  stepTotal,
  titleWhenNoRoomOverride,
  shellStyle = "default",
}) => {
  const [mode, setMode] = useState<"host" | "join">(initialMode ?? "host");
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const next = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, next));
  });
  const [code, setCode] = useState(() => cleanCode(initialCode ?? ""));
  const [pending, setPending] = useState<Pending>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [maxRounds, setMaxRounds] = useState(12);
  const copiedTimer = useRef<number | null>(null);
  const lastAutoSubmittedKeyRef = useRef<number | null>(null);

  const validName = name.trim().length >= 2;
  const validCode = cleanCode(code).length >= 4;

  const canCreate = connected && !roomCode && mode === "host" && validName;
  const canJoin =
    connected && !roomCode && mode === "join" && validName && validCode;
  const canLaunch =
    connected && !!roomCode && canStart && lobbyPlayers.length >= 1;
  const sortedPlayers = useMemo(
    () =>
      [...lobbyPlayers].sort((a, b) => {
        const hostGap = Number(b.isHost) - Number(a.isHost);
        if (hostGap !== 0) return hostGap;
        const aConnected = a.connected !== false;
        const bConnected = b.connected !== false;
        const connectionGap = Number(bConnected) - Number(aConnected);
        if (connectionGap !== 0) return connectionGap;
        return a.name.localeCompare(b.name, "fr");
      }),
    [lobbyPlayers]
  );
  const hostPlayerName =
    lobbyPlayers.find((player) => player.isHost)?.name ?? fr.terms.host;

  const subtitle = useMemo(() => {
    if (!connected) return fr.onlineOnboarding.connecting;
    if (roomCode) return `${fr.onlineLobby.roomActive} : ${roomCode}`;
    return fr.onlineLobby.onlineSubtitle.replace("{maxPlayers}", String(MAX_PLAYERS));
  }, [connected, roomCode]);
  const hasProgress =
    !roomCode &&
    typeof stepCurrent === "number" &&
    typeof stepTotal === "number" &&
    stepTotal > 0;
  const progressPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round((stepCurrent / stepTotal) * 100)))
    : 0;
  const progressFromPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round(((stepCurrent - 1) / stepTotal) * 100)))
    : 0;
  const animatedProgressPct = useAnimatedProgress(progressPct, progressFromPct);

  useEffect(() => {
    if (!connected) {
      setPending("idle");
      setError(fr.onlineLobby.serverUnavailable);
      return;
    }

    setError((prev) =>
      prev === fr.onlineLobby.serverUnavailable ? null : prev
    );

    if (roomCode && (pending === "hosting" || pending === "joining")) {
      setPending("idle");
      setError(null);
    }

    if (!roomCode && pending === "starting") {
      setPending("idle");
    }
  }, [connected, roomCode, pending]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (roomCode) return;
    if (typeof initialName === "string") setName(cleanName(initialName));
    if (typeof initialAvatar === "number") {
      setAvatar(Math.max(0, Math.min(AVATARS.length - 1, initialAvatar)));
    }
    if (initialMode) setMode(initialMode);
    if (typeof initialCode === "string") setCode(cleanCode(initialCode));
  }, [initialName, initialAvatar, initialMode, initialCode, roomCode]);

  const copyRoom = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  };

  const submitHost = useCallback(() => {
    if (!canCreate) return;
    setError(null);
    setPending("hosting");
    onHost(name.trim(), avatar);
  }, [avatar, canCreate, name, onHost]);

  const submitJoin = useCallback(() => {
    if (!canJoin) return;
    setError(null);
    setPending("joining");
    onJoin(cleanCode(code), name.trim(), avatar);
  }, [avatar, canJoin, code, name, onJoin]);

  const submitStart = () => {
    if (!canLaunch) return;
    setError(null);
    setPending("starting");
    onStartGame(maxRounds);
  };

  const submitLeave = () => {
    if (pending !== "idle") return;
    if (!roomCode) {
      if (onEditProfile) {
        onEditProfile();
        return;
      }
      onLeave();
      return;
    }
    setLeaveDialogOpen(true);
  };

  const confirmLeave = () => {
    setLeaveDialogOpen(false);
    onLeave();
  };

  const primaryLabel = roomCode
    ? pending === "starting"
      ? fr.onlineLobby.launching
      : fr.onlineLobby.launchParty
    : mode === "host"
    ? pending === "hosting"
      ? fr.onlineLobby.createLoading
      : fr.onlineLobby.createParty
    : pending === "joining"
    ? fr.onlineLobby.joining
    : fr.onlineLobby.joinAction;

  const primaryDisabled =
    pending !== "idle" ||
    (roomCode ? !canLaunch : mode === "host" ? !canCreate : !canJoin);

  useEffect(() => {
    if (!autoSubmitKey || roomCode || pending !== "idle") return;
    if (lastAutoSubmittedKeyRef.current === autoSubmitKey) return;
    if (mode === "host" && canCreate) {
      lastAutoSubmittedKeyRef.current = autoSubmitKey;
      submitHost();
      return;
    }
    if (mode === "join" && canJoin) {
      lastAutoSubmittedKeyRef.current = autoSubmitKey;
      submitJoin();
    }
  }, [autoSubmitKey, roomCode, pending, mode, canCreate, canJoin, submitHost, submitJoin]);

  const transparentShellClass = "relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8";
  const defaultShellClass =
    "relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col rounded border border-cyan-300/60 bg-[linear-gradient(180deg,rgba(8,18,38,0.88)_0%,rgba(8,12,24,0.9)_100%)] p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8";
  const ShellContainer: React.ElementType = shellStyle === "transparent" ? Card : "div";
  const shellClassName = shellStyle === "transparent" ? transparentShellClass : defaultShellClass;

  return (
    <div
      className={cn(
        "scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pt-4 sm:pt-6",
        roomCode ? "pb-28 sm:pb-32" : "pb-28 sm:pb-28"
      )}
    >
      <RetroScreenBackground />

      <ShellContainer className={shellClassName}>
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.onlineLobby.brand}</span>
          {!roomCode && stepLabel ? (
            <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">
              {stepLabel}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {roomCode ? fr.onlineLobby.roomReady : (titleWhenNoRoomOverride || fr.onlineLobby.quickConfig)}
        </h1>

        {roomCode ? (
          <p className="mt-4 text-center text-xs text-slate-300 sm:text-sm">{subtitle}</p>
        ) : null}
        {hasProgress ? (
          <div className="mt-4 h-1 w-full overflow-hidden rounded bg-slate-900/55">
            <div
              className="h-full rounded bg-cyan-400/90 transition-all duration-300"
              style={{ width: `${animatedProgressPct}%` }}
            />
          </div>
        ) : null}

        {error && (
          <div className="mx-auto mt-4 max-w-md rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
            {error}
          </div>
        )}

        {!roomCode && (
          <Card className="mx-auto mt-6 grid w-full max-w-lg gap-3 p-4 sm:p-5">
            <div className="rounded-md border border-cyan-300/25 bg-slate-950/45 p-3">
              <SectionHeader title={fr.onlineLobby.profileTitle} className="mb-2" />
              <div className="flex items-center justify-between gap-3 rounded-md border border-cyan-300/20 bg-slate-900/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/25 bg-slate-950/60 text-xl">
                    {AVATARS[avatar] ?? "?"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-cyan-100/80">{fr.onlineLobby.profileNameLabel}</div>
                    <div className="truncate text-sm font-semibold text-cyan-50">
                      {name || fr.onlineOnboarding.displayNamePlaceholder}
                    </div>
                    <span
                      className={cn(
                        "mt-1 inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] tracking-normal",
                        connected
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      )}
                    >
                      {connected ? fr.onlineLobby.connected : fr.onlineLobby.connecting}
                    </span>
                  </div>
                </div>
                {onEditProfile && (
                  <SecondaryButton
                    type="button"
                    onClick={onEditProfile}
                    disabled={pending !== "idle"}
                    className="h-9 min-h-0 px-3 text-xs"
                  >
                    {fr.onlineLobby.editProfile}
                  </SecondaryButton>
                )}
              </div>
            </div>

            {!validName && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {fr.onlineLobby.profileIncomplete}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <SecondaryButton
                type="button"
                onClick={() => setMode("host")}
                disabled={pending !== "idle"}
                className={cn(
                  "h-11 font-semibold transition-all",
                  mode === "host" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                )}
              >
                {fr.onlineLobby.hostAction}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => setMode("join")}
                disabled={pending !== "idle"}
                className={cn(
                  "h-11 font-semibold transition-all",
                  mode === "join" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                )}
              >
                {fr.onlineLobby.joinAction}
              </SecondaryButton>
            </div>

            {mode === "join" && (
              <div className="space-y-1">
                <Input
                  placeholder={fr.onlineLobby.roomCodePlaceholder}
                  value={code}
                  disabled={pending !== "idle"}
                  className="h-11 border-cyan-300/20 bg-slate-900/50 text-cyan-50 placeholder:text-slate-400"
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canJoin) submitJoin();
                  }}
                />
                {!validCode && code.length > 0 && (
                  <p className="text-xs text-amber-200">{fr.onlineLobby.minCodeHint}</p>
                )}
              </div>
            )}

            <p className="text-center text-[11px] text-slate-400">
              {primaryLabel}
            </p>
          </Card>
        )}

        {roomCode && (
          <section className="mx-auto mt-6 grid w-full max-w-4xl gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <Card className="grid gap-2 p-4 sm:p-5">
              {canStart ? (
                <>
                  <p className="rounded-md border border-cyan-300/25 bg-slate-900/40 px-3 py-3 text-xs text-slate-300">
                    {fr.onlineLobby.hostLaunchHint}
                  </p>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-cyan-100/85">{fr.onlineLobby.roundsLabel}</label>
                      <span className="rounded-md border border-cyan-300/35 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                        {maxRounds}
                      </span>
                    </div>
                    <div className="rounded-lg border border-cyan-300/20 bg-slate-900/55 px-3 py-3">
                      <Slider
                        min={1}
                        max={30}
                        step={1}
                        value={[maxRounds]}
                        onValueChange={(values) => {
                          const next = values[0];
                          if (!Number.isFinite(next)) return;
                          setMaxRounds(Math.max(1, Math.min(30, Math.round(next))));
                        }}
                        className="px-1"
                        aria-label={fr.onlineLobby.roundsLabel}
                      />
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-300">
                        <span>1</span>
                        <span>30</span>
                      </div>
                    </div>
                  </div>

                </>
              ) : (
                <div className="rounded-md border border-cyan-300/20 bg-slate-900/40 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                    {fr.onlineLobby.waitingHostTitle}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">
                    {fr.onlineLobby.waitingHostDescription.replace(
                      "{host}",
                      hostPlayerName
                    )}
                  </p>
                </div>
              )}

            </Card>

            <Card className="grid gap-3 p-4 sm:p-5">
              <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                  {fr.onlineLobby.codeLabel}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-cyan-500/15 px-2 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-200">
                    {roomCode}
                  </span>
                  <SecondaryButton
                    onClick={copyRoom}
                    disabled={pending !== "idle"}
                    className="h-9 min-h-0 px-3 text-xs"
                  >
                    {copied ? fr.onlineLobby.copied : fr.onlineLobby.copy}
                  </SecondaryButton>
                </div>
                <p className="mt-2 text-xs text-slate-300">{fr.onlineLobby.inviteHint}</p>
              </div>
            </Card>
          </section>
        )}

        {roomCode && (
        <Card className="mt-6 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
              {fr.onlineLobby.playersTitle}
            </h2>
            <span className="text-xs text-slate-300">{lobbyPlayers.length}/{MAX_PLAYERS}</span>
          </div>

          <div className="grid max-h-[38vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
            {sortedPlayers.map((p, i) => (
              <div
                key={`${p.name}-${p.avatar}-${i}`}
                className="flex items-center justify-between rounded-md border border-cyan-300/20 bg-slate-900/55 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-cyan-300/25 bg-slate-950/50">
                    {AVATARS[p.avatar] ?? "?"}
                  </span>
                  <span className="text-sm font-medium text-cyan-50">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.connected !== false && (
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                      {fr.onlineLobby.online}
                    </span>
                  )}
                  {p.connected === false && (
                    <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                      {fr.onlineLobby.offline}
                    </span>
                  )}
                  {p.isHost && (
                    <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                      {fr.terms.host.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {lobbyPlayers.length === 0 && (
              <div className="rounded-md border border-dashed border-cyan-300/20 px-3 py-4 text-center text-sm text-slate-300 sm:col-span-2">
                {fr.onlineLobby.waitingPlayers}
              </div>
            )}
          </div>
        </Card>
        )}
      </ShellContainer>

      {roomCode && (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
            <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
              {canStart ? (
                <div className="flex items-center justify-between gap-2">
                  <SecondaryButton
                    onClick={submitLeave}
                    disabled={pending !== "idle"}
                    className={cn("h-11", CTA_NEON_DANGER)}
                  >
                    {fr.onlineLobby.cancelParty}
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={submitStart}
                    disabled={!canLaunch || pending !== "idle"}
                    className="h-11"
                  >
                    {fr.onlineLobby.hostPrimaryAction}
                  </PrimaryButton>
                </div>
              ) : (
                <div className="grid gap-2">
                  <p className="text-xs text-slate-300">
                    {fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
                  </p>
                  <SecondaryButton
                    onClick={submitLeave}
                    disabled={pending !== "idle"}
                    className={cn("h-11", CTA_NEON_DANGER)}
                  >
                    {fr.onlineLobby.leaveParty}
                  </SecondaryButton>
                </div>
              )}
            </Card>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
            <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
              {canStart ? (
                <div className="grid grid-cols-2 gap-2">
                  <SecondaryButton
                    onClick={submitLeave}
                    disabled={pending !== "idle"}
                    className={cn("h-12", CTA_NEON_DANGER)}
                  >
                    {fr.onlineLobby.cancelParty}
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={submitStart}
                    disabled={!canLaunch || pending !== "idle"}
                    className="h-12"
                  >
                    {fr.onlineLobby.hostPrimaryAction}
                  </PrimaryButton>
                </div>
              ) : (
                <div className="grid gap-2">
                  <p className="text-xs text-slate-300">
                    {fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
                  </p>
                  <SecondaryButton
                    onClick={submitLeave}
                    disabled={pending !== "idle"}
                    className={cn("h-12", CTA_NEON_DANGER)}
                  >
                    {fr.onlineLobby.leaveParty}
                  </SecondaryButton>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {!roomCode && (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
            <Card className="pointer-events-auto mx-auto flex w-full max-w-4xl items-center justify-between gap-2 border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
                <SecondaryButton
                  type="button"
                  onClick={submitLeave}
                  disabled={pending !== "idle"}
                  className="h-11"
                >
                  {fr.onlineOnboarding.back}
                </SecondaryButton>
              <PrimaryButton
                type="button"
                onClick={mode === "host" ? submitHost : submitJoin}
                disabled={primaryDisabled}
                className="h-11"
                title={primaryLabel}
              >
                {fr.onlineOnboarding.next}
              </PrimaryButton>
            </Card>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
            <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton
                  type="button"
                  onClick={submitLeave}
                  disabled={pending !== "idle"}
                  className="h-12 min-h-0"
                >
                  {fr.onlineOnboarding.back}
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  onClick={mode === "host" ? submitHost : submitJoin}
                  disabled={primaryDisabled}
                  className="h-12 min-h-0"
                  title={primaryLabel}
                >
                  {fr.onlineOnboarding.next}
                </PrimaryButton>
              </div>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-md rounded-2xl border-cyan-300/40 p-5 sm:p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_14px_40px_rgba(2,6,23,0.6)]")}>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base uppercase tracking-[0.08em] text-cyan-100">
              {canStart ? fr.onlineLobby.cancelPartyQuestion : fr.onlineLobby.leavePartyQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              {canStart
                ? fr.onlineLobby.disconnectAll
                : fr.onlineLobby.leavingCurrent}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-cyan-100")}>
              {fr.onlineLobby.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")}
              onClick={confirmLeave}
            >
              {canStart ? fr.onlineLobby.cancelParty : fr.onlineLobby.leaveParty}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

