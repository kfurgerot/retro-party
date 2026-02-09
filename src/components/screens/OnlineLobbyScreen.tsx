import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
}) => {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending>("idle");
  const [error, setError] = useState<string | null>(null);

  // Feedback copy (optionnel)
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  const lockMode = !!roomCode;

  const validName = name.trim().length >= 2;
  const validCode = cleanCode(code).length >= 4;

  const canCreate = connected && !roomCode && mode === "host" && validName;
  const canJoin =
    connected && !roomCode && mode === "join" && validName && validCode;

  const canLaunch =
    connected && !!roomCode && canStart && lobbyPlayers.length >= 2;

  const subtitle = useMemo(() => {
    if (!connected) return "Connexion au serveur…";
    if (roomCode) return `Room active : ${roomCode}`;
    return "Multijoueur en ligne (2–10 joueurs)";
  }, [connected, roomCode]);

  /**
   * FIX PRINCIPAL :
   * - Affiche l'erreur uniquement quand connected === false
   * - Efface l'erreur automatiquement quand connected === true
   */
  useEffect(() => {
    if (!connected) {
      setPending("idle");
      setError("Serveur indisponible. Vérifie ta connexion.");
      return;
    }

    // Connecté => on efface l'erreur "serveur indisponible"
    setError((prev) =>
      prev === "Serveur indisponible. Vérifie ta connexion." ? null : prev
    );

    // Succès après host/join (roomCode apparaît)
    if (roomCode && (pending === "hosting" || pending === "joining")) {
      setPending("idle");
      setError(null);
    }

    // Retour lobby (sécurité)
    if (!roomCode && pending === "starting") {
      setPending("idle");
    }
  }, [connected, roomCode, pending]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

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

  const resetPseudo = () => {
    // Reset simple
    setName("");
    setError(null);
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
    if (!roomCode || pending !== "idle") return;
    const isHost = canStart;
    const message = isHost
      ? "Annuler la room ? Tous les joueurs seront déconnectés."
      : "Quitter la room ?";
    if (!window.confirm(message)) return;
    onLeave();
  };

  const primaryLabel = roomCode
    ? pending === "starting"
      ? "Lancement…"
      : "Lancer la partie"
    : mode === "host"
    ? pending === "hosting"
      ? "Création…"
      : "Créer la room"
    : pending === "joining"
    ? "Connexion…"
    : "Rejoindre";

  const primaryDisabled =
    pending !== "idle" ||
    (roomCode ? !canLaunch : mode === "host" ? !canCreate : !canJoin);
  const neutralSecondaryBtn =
    "border-border/70 bg-background/50 text-foreground hover:bg-background/70";

  return (
    <div className="scanlines flex min-h-svh w-full flex-col gap-3 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4">
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs opacity-70">RETRO PARTY</div>
              <CardTitle className="text-base">Lobby en ligne</CardTitle>
              <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "rounded-full border px-2 py-1",
                  connected
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                )}
              >
                {connected ? "Connecte" : "Connexion..."}
              </span>
              <span className="rounded-full border border-border/70 bg-background/40 px-2 py-1">
                {lobbyPlayers.length}/10 joueurs
              </span>
            </div>
          </div>
        </CardHeader>

        {(roomCode || error) && (
          <CardContent className="pt-0 pb-3">
            {roomCode && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Code room:</span>
                <span className="rounded bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-300">
                  {roomCode}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className={neutralSecondaryBtn}
                  onClick={copyRoom}
                  disabled={pending !== "idle"}
                >
                  {copied ? "Copie !" : "Copier"}
                </Button>
              </div>
            )}

            {error && (
              <div className="mt-2 inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                {error}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur lg:h-full lg:min-h-0">
          <CardContent className="flex flex-col gap-5 p-4 lg:min-h-0 lg:overflow-y-auto">
            <div className="lg:hidden">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    className={cn("w-full", neutralSecondaryBtn)}
                  >
                    Voir les joueurs ({lobbyPlayers.length}/10)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[92vw]">
                  <DialogHeader>
                    <DialogTitle>Joueurs ({lobbyPlayers.length}/10)</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-2">
                    {lobbyPlayers.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border border-border/60 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{AVATARS[p.avatar]}</span>
                          <span className="font-medium">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.connected === false && (
                            <span className="text-xs text-muted-foreground">Hors ligne</span>
                          )}
                          {p.isHost && (
                            <span className="rounded bg-muted px-2 py-1 text-xs">Host</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {lobbyPlayers.length === 0 && (
                      <div className="text-sm text-muted-foreground">En attente de joueurs...</div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <section className="grid gap-4 rounded-lg border border-border/60 bg-background/30 p-3 sm:p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Profil joueur
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-sm text-muted-foreground">Pseudo</p>
                  <Input
                    value={name}
                    disabled={lockMode || pending !== "idle"}
                    placeholder="Ton pseudo"
                    onChange={(e) => setName(cleanName(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (mode === "host" && canCreate) submitHost();
                      if (mode === "join" && canJoin) submitJoin();
                    }}
                  />
                  {!validName && name.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Min. 2 caracteres (max 16)
                    </div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  onClick={resetPseudo}
                  disabled={pending !== "idle" || lockMode || name.length === 0}
                  className={cn("shrink-0", neutralSecondaryBtn)}
                >
                  Reset
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Avatar</p>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/60 bg-background/70 text-2xl">
                      {AVATARS[avatar]}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Selection actuelle
                    </div>
                  </div>

                  <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="secondary"
                        disabled={lockMode || pending !== "idle"}
                        className={neutralSecondaryBtn}
                      >
                        Changer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[92vw] sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Choisir un avatar</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                        {AVATARS.map((a, i) => (
                          <button
                            key={i}
                            disabled={lockMode || pending !== "idle"}
                            onClick={() => {
                              setAvatar(i);
                              setAvatarDialogOpen(false);
                            }}
                            className={cn(
                              "h-12 w-12 rounded-md border border-border bg-background/60 text-xl",
                              i === avatar && "ring-2 ring-cyan-400"
                            )}
                            aria-label={`Avatar ${i + 1}`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </section>

            {!roomCode && (
              <section className="grid gap-3 rounded-lg border border-border/60 bg-background/30 p-3 sm:p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acces room
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setMode("host")}
                    disabled={pending !== "idle"}
                    className={cn(
                      "h-11 border-border/70 bg-background/50 font-semibold text-foreground transition-all hover:bg-background/70",
                      mode === "host"
                        ? "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                        : "opacity-95"
                    )}
                  >
                    Heberger
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setMode("join")}
                    disabled={pending !== "idle"}
                    className={cn(
                      "h-11 border-border/70 bg-background/50 font-semibold text-foreground transition-all hover:bg-background/70",
                      mode === "join"
                        ? "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                        : "opacity-95"
                    )}
                  >
                    Rejoindre
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Mode actif:{" "}
                  <span className="font-semibold text-cyan-300">
                    {mode === "host" ? "Heberger" : "Rejoindre"}
                  </span>
                </div>

                {mode === "join" ? (
                  <div className="grid gap-2">
                    <div className="flex items-start gap-2">
                      <Input
                        placeholder="Code room"
                        value={code}
                        disabled={pending !== "idle"}
                        className="h-11 flex-1"
                        onChange={(e) => setCode(cleanCode(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canJoin) submitJoin();
                        }}
                      />
                      <Button
                        onClick={submitJoin}
                        disabled={primaryDisabled}
                        className="h-11 shrink-0 bg-cyan-500 px-4 text-slate-950 shadow-sm hover:bg-cyan-400"
                      >
                        {primaryLabel}
                      </Button>
                    </div>
                    {!validCode && code.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Min. 4 caracteres (A-Z0-9)
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={submitHost}
                    disabled={primaryDisabled}
                    className="h-11 bg-cyan-500 text-slate-950 shadow-sm hover:bg-cyan-400"
                  >
                    {primaryLabel}
                  </Button>
                )}
              </section>
            )}

            {roomCode && (
              <section className="grid gap-3 rounded-lg border border-border/60 bg-background/30 p-3 sm:p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions de room
                </div>
                <div className="text-sm text-muted-foreground">
                  {canStart
                    ? "Tu es host. Lance la partie quand tous les joueurs sont prets."
                    : "En attente du host pour lancer la partie."}
                </div>

                <Button
                  onClick={submitStart}
                  disabled={!canLaunch || pending !== "idle"}
                  className="h-11 bg-cyan-500 text-slate-950 shadow-sm hover:bg-cyan-400"
                >
                  {primaryLabel}
                </Button>

                <Button
                  onClick={submitLeave}
                  disabled={pending !== "idle"}
                  variant="secondary"
                  className={neutralSecondaryBtn}
                >
                  {canStart ? "Annuler la room" : "Quitter la room"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Le host lance la partie - 2 a 10 joueurs
                </p>
              </section>
            )}
          </CardContent>
        </Card>

        <div className="hidden min-h-0 lg:block">
          <Card className="h-full min-h-0 border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader className="border-b border-border/60 py-4">
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-base">Joueurs</CardTitle>
                <div className="text-sm text-muted-foreground">{lobbyPlayers.length}/10</div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 overflow-y-auto p-4">
              {lobbyPlayers.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span>{AVATARS[p.avatar]}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.connected === false && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                        Hors ligne
                      </span>
                    )}
                    {p.isHost && (
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">
                        HOST
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {lobbyPlayers.length === 0 && (
                <div className="text-sm text-muted-foreground">En attente de joueurs...</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
