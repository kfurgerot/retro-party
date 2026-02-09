import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";

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
  onStartGame: () => void;
  canStart: boolean;
  initialName?: string;
  initialAvatar?: number;
  initialMode?: "host" | "join";
  initialCode?: string;
  autoSubmitKey?: number;
}

type Pending = "idle" | "hosting" | "joining" | "starting";

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
  canStart,
  initialName,
  initialAvatar,
  initialMode,
  initialCode,
  autoSubmitKey,
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
  const copiedTimer = useRef<number | null>(null);
  const lastAutoSubmittedKeyRef = useRef<number | null>(null);

  const validName = name.trim().length >= 2;
  const validCode = cleanCode(code).length >= 4;

  const canCreate = connected && !roomCode && mode === "host" && validName;
  const canJoin =
    connected && !roomCode && mode === "join" && validName && validCode;
  const canLaunch =
    connected && !!roomCode && canStart && lobbyPlayers.length >= 2;

  const subtitle = useMemo(() => {
    if (!connected) return "Connexion au serveur...";
    if (roomCode) return `Room active : ${roomCode}`;
    return "Multijoueur en ligne (2-10 joueurs)";
  }, [connected, roomCode]);

  useEffect(() => {
    if (!connected) {
      setPending("idle");
      setError("Serveur indisponible. Verifie ta connexion.");
      return;
    }

    setError((prev) =>
      prev === "Serveur indisponible. Verifie ta connexion." ? null : prev
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

  const submitHost = () => {
    if (!canCreate) return;
    setError(null);
    setPending("hosting");
    onHost(name.trim(), avatar);
  };

  const submitJoin = () => {
    if (!canJoin) return;
    setError(null);
    setPending("joining");
    onJoin(cleanCode(code), name.trim(), avatar);
  };

  const submitStart = () => {
    if (!canLaunch) return;
    setError(null);
    setPending("starting");
    onStartGame();
  };

  const submitLeave = () => {
    if (pending !== "idle") return;
    if (!roomCode) {
      onLeave();
      return;
    }
    const message = canStart
      ? "Annuler la room ? Tous les joueurs seront deconnectes."
      : "Quitter la room ?";
    if (!window.confirm(message)) return;
    onLeave();
  };

  const primaryLabel = roomCode
    ? pending === "starting"
      ? "Lancement..."
      : "Lancer la partie"
    : mode === "host"
    ? pending === "hosting"
      ? "Creation..."
      : "Creer la room"
    : pending === "joining"
    ? "Connexion..."
    : "Rejoindre";

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
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />

      <div className="relative z-10 w-full max-w-3xl rounded border border-cyan-300/60 bg-card/88 p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>Retro Party Online</span>
          <span className="rounded-full border border-cyan-300/45 px-2 py-1">
            Lobby
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {roomCode ? "Room prete" : "Configuration rapide"}
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
            {connected ? "Connecte" : "Connexion..."}
          </span>
          <span className="rounded-full border border-cyan-300/35 bg-slate-900/40 px-3 py-1 text-cyan-100">
            {lobbyPlayers.length}/10 joueurs
          </span>
        </div>

        <p className="mt-4 text-center text-xs text-slate-300 sm:text-sm">{subtitle}</p>

        {error && (
          <div className="mx-auto mt-4 max-w-md rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
            {error}
          </div>
        )}

        {!roomCode && (
          <section className="mx-auto mt-6 grid w-full max-w-md gap-3 rounded-lg border border-cyan-300/25 bg-slate-900/35 p-4">
            {!validName && (
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Profil incomplet. Reviens a l'etape precedente.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
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
                Heberger
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
                Rejoindre
              </Button>
            </div>

            {mode === "join" && (
              <div className="space-y-1">
                <Input
                  placeholder="Code room"
                  value={code}
                  disabled={pending !== "idle"}
                  className="h-11 border-cyan-300/20 bg-slate-900/50 text-cyan-50 placeholder:text-slate-400"
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canJoin) submitJoin();
                  }}
                />
                {!validCode && code.length > 0 && (
                  <p className="text-xs text-amber-200">Min. 4 caracteres (A-Z0-9)</p>
                )}
              </div>
            )}

            <Button
              type="button"
              onClick={mode === "host" ? submitHost : submitJoin}
              disabled={primaryDisabled}
              className="h-11 border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
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
              Changer de profil
            </Button>
          </section>
        )}

        {roomCode && (
          <>
            <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-slate-900/45 p-2">
              <span className="text-xs text-cyan-100/80">Code:</span>
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
                {copied ? "Copie" : "Copier"}
              </Button>
            </div>

            <section className="mx-auto mt-6 grid w-full max-w-md gap-2 rounded-lg border border-cyan-300/25 bg-slate-900/35 p-4">
              <p className="text-center text-xs text-slate-300">
                {canStart
                  ? "Tu es host. Lance la partie quand tout le monde est pret."
                  : "En attente du host pour lancer la partie."}
              </p>
              <Button
                onClick={submitStart}
                disabled={!canLaunch || pending !== "idle"}
                className="h-11 border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
              >
                {primaryLabel}
              </Button>
              <Button
                onClick={submitLeave}
                disabled={pending !== "idle"}
                variant="secondary"
                className="h-11 border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70"
              >
                {canStart ? "Annuler la room" : "Quitter la room"}
              </Button>
            </section>
          </>
        )}

        <section className="mt-6 rounded-lg border border-cyan-300/25 bg-slate-900/35 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
              Joueurs
            </h2>
            <span className="text-xs text-slate-300">{lobbyPlayers.length}/10</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {lobbyPlayers.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-cyan-300/20 bg-slate-900/45 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span>{AVATARS[p.avatar] ?? "?"}</span>
                  <span className="text-sm font-medium text-cyan-50">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.connected === false && (
                    <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                      Hors ligne
                    </span>
                  )}
                  {p.isHost && (
                    <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                      HOST
                    </span>
                  )}
                </div>
              </div>
            ))}

            {lobbyPlayers.length === 0 && (
              <div className="rounded-md border border-dashed border-cyan-300/20 px-3 py-4 text-center text-sm text-slate-300 sm:col-span-2">
                En attente de joueurs...
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
