import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { PageShell, StickyFooter, RoomCodeDisplay, PlayerList } from "@/components/app-shell";
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
  brandLabel?: string;
  accentColor?: string;
  accentGlow?: string;
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
  hideRoundsControl?: boolean;
  hostSetupPanel?: React.ReactNode;
}

type Pending = "idle" | "hosting" | "joining" | "starting";
const MAX_PLAYERS = 20;

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({
  connected,
  roomCode,
  lobbyPlayers,
  brandLabel,
  accentColor = "#ec4899",
  accentGlow = "rgba(236,72,153,0.04)",
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
  hideRoundsControl = false,
  hostSetupPanel,
}) => {
  const [mode, setMode] = useState<"host" | "join">(initialMode ?? "host");
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const n = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, n));
  });
  const [code, setCode] = useState(() => cleanCode(initialCode ?? ""));
  const [pending, setPending] = useState<Pending>("idle");
  const [error, setError] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [maxRounds, setMaxRounds] = useState(12);
  const lastAutoSubmittedKeyRef = useRef<number | null>(null);

  const validName = name.trim().length >= 2;
  const validCode = cleanCode(code).length >= 4;
  const canCreate = connected && !roomCode && mode === "host" && validName;
  const canJoin = connected && !roomCode && mode === "join" && validName && validCode;
  const canLaunch = connected && !!roomCode && canStart && lobbyPlayers.length >= 1;

  const sortedPlayers = useMemo(
    () =>
      [...lobbyPlayers].sort((a, b) => {
        const hostGap = Number(b.isHost) - Number(a.isHost);
        if (hostGap !== 0) return hostGap;
        const aConn = a.connected !== false;
        const bConn = b.connected !== false;
        if (aConn !== bConn) return Number(bConn) - Number(aConn);
        return a.name.localeCompare(b.name, "fr");
      }),
    [lobbyPlayers],
  );
  const hostPlayerName = lobbyPlayers.find((p) => p.isHost)?.name ?? fr.terms.host;

  useEffect(() => {
    if (!connected) {
      setPending("idle");
      setError(fr.onlineLobby.serverUnavailable);
      return;
    }
    setError((prev) => (prev === fr.onlineLobby.serverUnavailable ? null : prev));
    if (roomCode && (pending === "hosting" || pending === "joining")) {
      setPending("idle");
      setError(null);
    }
    if (!roomCode && pending === "starting") setPending("idle");
  }, [connected, roomCode, pending]);

  useEffect(() => {
    if (roomCode) return;
    if (typeof initialName === "string") setName(cleanName(initialName));
    if (typeof initialAvatar === "number")
      setAvatar(Math.max(0, Math.min(AVATARS.length - 1, initialAvatar)));
    if (initialMode) setMode(initialMode);
    if (typeof initialCode === "string") setCode(cleanCode(initialCode));
  }, [initialName, initialAvatar, initialMode, initialCode, roomCode]);

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
      if (onEditProfile) { onEditProfile(); return; }
      onLeave();
      return;
    }
    setLeaveDialogOpen(true);
  };

  useEffect(() => {
    if (!autoSubmitKey || roomCode || pending !== "idle") return;
    if (lastAutoSubmittedKeyRef.current === autoSubmitKey) return;
    if (mode === "host" && canCreate) {
      lastAutoSubmittedKeyRef.current = autoSubmitKey;
      submitHost();
    } else if (mode === "join" && canJoin) {
      lastAutoSubmittedKeyRef.current = autoSubmitKey;
      submitJoin();
    }
  }, [autoSubmitKey, roomCode, pending, mode, canCreate, canJoin, submitHost, submitJoin]);

  const primaryLabel = roomCode
    ? pending === "starting" ? fr.onlineLobby.launching : fr.onlineLobby.launchParty
    : mode === "host"
      ? pending === "hosting" ? fr.onlineLobby.createLoading : fr.onlineLobby.createParty
      : pending === "joining" ? fr.onlineLobby.joining : fr.onlineLobby.joinAction;

  const primaryDisabled =
    pending !== "idle" ||
    (roomCode ? !canLaunch : mode === "host" ? !canCreate : !canJoin);

  return (
    <PageShell accentColor={`${accentColor}12`} accentGlow={accentGlow} maxWidth="5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
          {brandLabel ?? fr.onlineLobby.brand}
        </div>
        {!roomCode && stepLabel && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-500">
            {stepLabel}
          </span>
        )}
        {roomCode && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{
              color: "#10b981",
              background: "rgba(16,185,129,0.1)",
              borderColor: "rgba(16,185,129,0.25)",
            }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Session active
          </span>
        )}
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
        {roomCode ? fr.onlineLobby.roomReady : (titleWhenNoRoomOverride ?? fr.onlineLobby.quickConfig)}
      </h1>
      {roomCode && (
        <p className="mt-1.5 text-sm text-slate-500">
          {fr.onlineLobby.roomActive} · {roomCode}
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* PRE-ROOM: profile + mode selector */}
      {!roomCode && (
        <div className="mt-7 mx-auto max-w-lg space-y-4">
          {/* Profile */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              {fr.onlineLobby.profileTitle}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl border text-xl"
                  style={{ borderColor: `${accentColor}25`, background: `${accentColor}10` }}
                >
                  {AVATARS[avatar] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {name || <span className="text-slate-600">{fr.onlineOnboarding.displayNamePlaceholder}</span>}
                  </div>
                  <div
                    className="mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: connected ? "#10b981" : "#f59e0b",
                      background: connected ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                      borderColor: connected ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
                    }}
                  >
                    {connected ? fr.onlineLobby.connected : fr.onlineLobby.connecting}
                  </div>
                </div>
              </div>
              {onEditProfile && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  disabled={pending !== "idle"}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                >
                  {fr.onlineLobby.editProfile}
                </button>
              )}
            </div>
            {!validName && (
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {fr.onlineLobby.profileIncomplete}
              </p>
            )}
          </div>

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2">
            {(["host", "join"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={pending !== "idle"}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold transition-all disabled:opacity-40",
                  mode === m
                    ? "border-white/20 text-white"
                    : "border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200",
                )}
                style={
                  mode === m
                    ? {
                        background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}18)`,
                        boxShadow: `0 0 0 1px ${accentColor}40`,
                        color: accentColor,
                      }
                    : undefined
                }
              >
                {m === "host" ? fr.onlineLobby.hostAction : fr.onlineLobby.joinAction}
              </button>
            ))}
          </div>

          {mode === "join" && (
            <div>
              <input
                value={code}
                placeholder={fr.onlineLobby.roomCodePlaceholder}
                disabled={pending !== "idle"}
                onChange={(e) => setCode(cleanCode(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter" && canJoin) submitJoin(); }}
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 font-mono text-sm tracking-widest text-slate-100 outline-none placeholder:text-slate-600 transition focus:border-white/20 disabled:opacity-40"
              />
              {!validCode && code.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-400">{fr.onlineLobby.minCodeHint}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* IN-ROOM */}
      {roomCode && (
        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left: setup / waiting */}
          <div className="space-y-4">
            {canStart ? (
              <>
                {!hideRoundsControl && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-200">
                        {fr.onlineLobby.roundsLabel}
                      </label>
                      <span
                        className="rounded-lg border px-2.5 py-1 text-sm font-bold"
                        style={{
                          borderColor: `${accentColor}30`,
                          background: `${accentColor}10`,
                          color: accentColor,
                        }}
                      >
                        {maxRounds}
                      </span>
                    </div>
                    <Slider
                      min={1} max={30} step={1}
                      value={[maxRounds]}
                      onValueChange={(vals) => {
                        const n = vals[0];
                        if (Number.isFinite(n)) setMaxRounds(Math.max(1, Math.min(30, Math.round(n))));
                      }}
                      aria-label={fr.onlineLobby.roundsLabel}
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                      <span>1</span><span>30</span>
                    </div>
                  </div>
                )}
                {hostSetupPanel && (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    {hostSetupPanel}
                  </div>
                )}
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.015] px-4 py-3 text-sm text-slate-500">
                  {fr.onlineLobby.hostLaunchHint}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {fr.onlineLobby.waitingHostTitle}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
                </p>
              </div>
            )}
          </div>

          {/* Right: room code + players */}
          <div className="space-y-4">
            <RoomCodeDisplay
              code={roomCode}
              accentColor={accentColor}
              hint={fr.onlineLobby.inviteHint}
            />

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">{fr.onlineLobby.playersTitle}</h2>
                <span className="text-xs text-slate-500">{lobbyPlayers.length} / {MAX_PLAYERS}</span>
              </div>
              <PlayerList
                players={sortedPlayers}
                accentColor={accentColor}
                emptyLabel={fr.onlineLobby.waitingPlayers}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sticky footer */}
      <StickyFooter maxWidth="5xl">
        {roomCode ? (
          <div className={cn("flex items-center gap-2.5", !canStart && "flex-col sm:flex-row")}>
            {!canStart && (
              <p className="w-full text-xs text-slate-500 sm:flex-1">
                {fr.onlineLobby.waitingHostDescription.replace("{host}", hostPlayerName)}
              </p>
            )}
            <div className={cn("flex gap-2.5", canStart ? "w-full" : "w-full sm:w-auto")}>
              <button
                type="button"
                onClick={submitLeave}
                disabled={pending !== "idle"}
                className="h-11 flex-1 rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-40 sm:flex-none sm:px-5"
              >
                {canStart ? fr.onlineLobby.cancelParty : fr.onlineLobby.leaveParty}
              </button>
              {canStart && (
                <button
                  type="button"
                  onClick={submitStart}
                  disabled={!canLaunch || pending !== "idle"}
                  className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                    boxShadow: canLaunch ? `0 4px 16px ${accentColor}40` : "none",
                  }}
                >
                  {fr.onlineLobby.hostPrimaryAction}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={submitLeave}
              disabled={pending !== "idle"}
              className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              {fr.onlineOnboarding.back}
            </button>
            <button
              type="button"
              onClick={mode === "host" ? submitHost : submitJoin}
              disabled={primaryDisabled}
              className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                boxShadow: !primaryDisabled ? `0 4px 16px ${accentColor}40` : "none",
              }}
              title={primaryLabel}
            >
              {primaryLabel}
            </button>
          </div>
        )}
      </StickyFooter>

      {/* Leave dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl border border-white/[0.08] bg-[#0f0f1c] p-6 text-slate-100 shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-slate-50">
              {canStart ? fr.onlineLobby.cancelPartyQuestion : fr.onlineLobby.leavePartyQuestion}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-400">
              {canStart ? fr.onlineLobby.disconnectAll : fr.onlineLobby.leavingCurrent}
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
              {canStart ? fr.onlineLobby.cancelParty : fr.onlineLobby.leaveParty}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};
