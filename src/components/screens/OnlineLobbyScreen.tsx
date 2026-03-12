import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { fr } from "@/i18n/fr";
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
  const connectedPlayersCount = useMemo(
    () => lobbyPlayers.filter((player) => player.connected !== false).length,
    [lobbyPlayers]
  );
  const offlinePlayers = useMemo(
    () => lobbyPlayers.filter((player) => player.connected === false),
    [lobbyPlayers]
  );
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
  const launchChecklist = useMemo(
    () => [
      { ok: canStart, label: fr.onlineLobby.checkHostControl },
      {
        ok: connectedPlayersCount >= 2,
        label: fr.onlineLobby.checkTwoPlayers.replace(
          "{count}",
          String(connectedPlayersCount)
        ),
      },
      {
        ok: offlinePlayers.length === 0,
        label: fr.onlineLobby.checkAllConnected.replace(
          "{count}",
          String(offlinePlayers.length)
        ),
      },
    ],
    [canStart, connectedPlayersCount, offlinePlayers.length]
  );
  const launchReady = launchChecklist.every((item) => item.ok);
  const launchBlockers = useMemo(
    () => launchChecklist.filter((item) => !item.ok).map((item) => item.label),
    [launchChecklist]
  );

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

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-8 pt-4 sm:pt-6">
      <RetroScreenBackground />

      <div className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col rounded border border-cyan-300/60 bg-[linear-gradient(180deg,rgba(8,18,38,0.88)_0%,rgba(8,12,24,0.9)_100%)] p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>{fr.onlineLobby.brand}</span>
          <div className="flex items-center gap-2">
            {!roomCode && stepLabel ? (
              <span className="rounded-full border border-cyan-300/40 px-2 py-1">
                {stepLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-cyan-300/45 px-2 py-1">
              {fr.onlineLobby.lobbyBadge}
            </span>
          </div>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {roomCode ? fr.onlineLobby.roomReady : fr.onlineLobby.quickConfig}
        </h1>

        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-full border px-3 py-1",
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            )}
          >
            {connected ? fr.onlineLobby.connected : fr.onlineLobby.connecting}
          </span>
        </div>

        <p className="mt-4 text-center text-xs text-slate-300 sm:text-sm">{subtitle}</p>
        {hasProgress ? (
          <div className="mx-auto mt-3 h-1.5 w-full max-w-xl overflow-hidden rounded bg-slate-900/55">
            <div
              className="h-full rounded bg-cyan-400/90 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        ) : null}

        {error && (
          <div className="mx-auto mt-4 max-w-md rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
            {error}
          </div>
        )}

        {!roomCode && (
          <section className="neon-surface mx-auto mt-6 grid w-full max-w-lg gap-3 p-4 sm:p-5">
            <div className="rounded-md border border-cyan-300/25 bg-slate-950/45 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-cyan-100/80">
                {fr.onlineLobby.profileTitle}
              </p>
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
                  </div>
                </div>
                {onEditProfile && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onEditProfile}
                    disabled={pending !== "idle"}
                    className="h-9 border-cyan-300/20 bg-slate-900/45 px-3 text-cyan-100 hover:bg-slate-900/70"
                  >
                    {fr.onlineLobby.editProfile}
                  </Button>
                )}
              </div>
            </div>

            {!validName && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {fr.onlineLobby.profileIncomplete}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("host")}
                disabled={pending !== "idle"}
                className={cn(
                  "h-11 border-cyan-300/20 bg-slate-900/45 font-semibold text-cyan-100 transition-all hover:bg-slate-900/70",
                  mode === "host" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                )}
              >
                {fr.onlineLobby.hostAction}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("join")}
                disabled={pending !== "idle"}
                className={cn(
                  "h-11 border-cyan-300/20 bg-slate-900/45 font-semibold text-cyan-100 transition-all hover:bg-slate-900/70",
                  mode === "join" && "border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                )}
              >
                {fr.onlineLobby.joinAction}
              </Button>
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

            <Button
              type="button"
              onClick={mode === "host" ? submitHost : submitJoin}
              disabled={primaryDisabled}
              className="h-11 border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] hover:bg-cyan-400"
            >
              {primaryLabel}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={submitLeave}
              disabled={pending !== "idle"}
              className="h-11 border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70"
            >
              {fr.onlineLobby.backHome}
            </Button>
          </section>
        )}

        {roomCode && (
          <section className="mx-auto mt-6 grid w-full max-w-4xl gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="neon-surface grid gap-2 p-4 sm:p-5">
              {canStart ? (
                <>
                  <div
                    className={cn(
                      "rounded-md border px-3 py-3",
                      launchReady
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-amber-500/40 bg-amber-500/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                        {fr.onlineLobby.hostPanelTitle}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          launchReady
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-200"
                        )}
                      >
                        {launchReady
                          ? fr.onlineLobby.hostReady
                          : fr.onlineLobby.hostBlocked}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      {launchReady ? fr.onlineLobby.hostReadyHint : fr.onlineLobby.hostBlockedHint}
                    </p>
                  </div>

                  {launchBlockers.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-amber-100/90">
                        {fr.onlineLobby.launchBlockedTitle}
                      </p>
                      <div className="mt-2 grid gap-1.5 text-xs text-amber-100">
                        {launchBlockers.map((blocker) => (
                          <div key={blocker} className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1">
                            {blocker}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs text-cyan-100/85">{fr.onlineLobby.roundsLabel}</label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={maxRounds}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const bounded = Number.isFinite(raw)
                          ? Math.max(1, Math.min(30, Math.floor(raw)))
                          : 12;
                        setMaxRounds(bounded);
                      }}
                      className="h-11 border-cyan-300/20 bg-slate-900/50 text-cyan-50"
                    />
                  </div>

                  <Button
                    onClick={submitStart}
                    disabled={!canLaunch || pending !== "idle"}
                    className="h-12 border border-cyan-300 bg-cyan-500 text-base font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    {fr.onlineLobby.hostPrimaryAction}
                  </Button>
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

              <Button
                onClick={submitLeave}
                disabled={pending !== "idle"}
                variant="secondary"
                className="h-11 border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70"
              >
                {canStart ? fr.onlineLobby.cancelParty : fr.onlineLobby.leaveParty}
              </Button>
            </div>

            <div className="neon-surface grid gap-3 p-4 sm:p-5">
              <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                  {fr.onlineLobby.lobbyStatusTitle}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{fr.onlineLobby.connectedPlayersLabel}</span>
                  <span className="font-semibold text-cyan-100">{connectedPlayersCount}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-300">{fr.onlineLobby.offlinePlayersLabel}</span>
                  <span className={cn("font-semibold", offlinePlayers.length > 0 ? "text-amber-200" : "text-emerald-200")}>
                    {offlinePlayers.length}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-cyan-300/25 bg-slate-900/45 p-3">
                <div className="mb-2 text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                  {fr.onlineLobby.codeLabel}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-cyan-500/15 px-2 py-1 text-sm font-semibold tracking-[0.12em] text-cyan-200">
                    {roomCode}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyRoom}
                    disabled={pending !== "idle"}
                    className="border-cyan-300/30 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70"
                  >
                    {copied ? fr.onlineLobby.copied : fr.onlineLobby.copy}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-slate-300">{fr.onlineLobby.inviteHint}</p>
              </div>
            </div>
          </section>
        )}

        {roomCode && (
        <section className="neon-surface mt-6 p-4 sm:p-5">
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
        </section>
        )}
      </div>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canStart ? fr.onlineLobby.cancelPartyQuestion : fr.onlineLobby.leavePartyQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {canStart
                ? fr.onlineLobby.disconnectAll
                : fr.onlineLobby.leavingCurrent}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70">
              {fr.onlineLobby.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="border-rose-300 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.35)] hover:bg-rose-400"
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

