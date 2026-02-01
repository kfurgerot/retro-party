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

type LobbyPlayer = { name: string; avatar: number; isHost: boolean };

interface OnlineLobbyScreenProps {
  connected: boolean;
  roomCode: string | null;
  lobbyPlayers: LobbyPlayer[];
  onHost: (name: string, avatar: number) => void;
  onJoin: (code: string, name: string, avatar: number) => void;
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
  onStartGame,
  canStart,
}) => {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
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

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4 overflow-hidden scanlines">
      {/* HEADER */}
      <Card className="bg-card/80 backdrop-blur">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <div>
            <div className="text-xs opacity-70">RÉTRO PARTY</div>
            <CardTitle className="text-base">Mode en ligne</CardTitle>
            <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>

            {roomCode && (
              <button
                onClick={copyRoom}
                className="mt-2 inline-flex items-center gap-2 text-xs opacity-80 hover:opacity-100 transition"
                title="Copier le code de la room"
              >
                <span className="opacity-70">Room :</span>
                <span className="font-semibold text-violet-400">{roomCode}</span>
                <span className="opacity-70">📋</span>
                {copied && (
                  <span className="ml-1 text-violet-300 opacity-100">
                    Copié !
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs opacity-70">Statut</div>
            <div className="text-sm font-semibold">
              {connected ? "Connecté" : "…"}
            </div>
          </div>
        </CardHeader>

        {error && (
          <div className="px-4 pb-3">
            <div className="text-xs rounded-full border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-1 inline-block">
              {error}
            </div>
          </div>
        )}
      </Card>

      {/* MAIN */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <Card className="h-full bg-card/80 backdrop-blur flex flex-col min-h-0">
          <CardContent className="p-4 overflow-y-auto flex flex-col gap-5 min-h-0">
            {/* Mobile players list */}
            <div className="lg:hidden">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="w-full">
                    Voir les joueurs ({lobbyPlayers.length}/10)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[92vw]">
                  <DialogHeader>
                    <DialogTitle>
                      Joueurs ({lobbyPlayers.length}/10)
                    </DialogTitle>
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
                        {p.isHost && (
                          <span className="text-xs rounded bg-muted px-2 py-1">
                            Host
                          </span>
                        )}
                      </div>
                    ))}
                    {lobbyPlayers.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        En attente de joueurs…
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* PROFIL */}
            <div className="grid gap-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Pseudo</p>
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
                    <div className="text-xs text-muted-foreground mt-1">
                      Min. 2 caractères (max 16)
                    </div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  onClick={resetPseudo}
                  disabled={pending !== "idle" || lockMode || name.length === 0}
                  title="Reset pseudo"
                  className="shrink-0"
                >
                  Reset
                </Button>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Avatar</p>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((a, i) => (
                    <button
                      key={i}
                      disabled={lockMode || pending !== "idle"}
                      onClick={() => setAvatar(i)}
                      className={cn(
                        "h-10 w-10 rounded-md border border-border bg-background/60 text-lg",
                        i === avatar && "ring-2 ring-violet-500"
                      )}
                      aria-label={`Avatar ${i}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MODE */}
            {!roomCode && (
              <div className="grid gap-3 sm:grid-cols-2">
                {/* HOST */}
                <Card
                  onClick={() => setMode("host")}
                  className={cn(
                    "cursor-pointer border border-border/60",
                    mode === "host"
                      ? "ring-2 ring-violet-500"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="font-medium mb-3">Héberger</div>
                    {mode === "host" && (
                      <Button
                        onClick={submitHost}
                        disabled={!canCreate}
                        className="w-full bg-violet-600 hover:bg-violet-700"
                      >
                        Créer la room
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* JOIN */}
                <Card
                  onClick={() => setMode("join")}
                  className={cn(
                    "cursor-pointer border border-border/60",
                    mode === "join"
                      ? "ring-2 ring-violet-500"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="font-medium mb-3">Rejoindre</div>
                    {mode === "join" && (
                      <>
                        <Input
                          placeholder="CODE"
                          value={code}
                          disabled={pending !== "idle"}
                          onChange={(e) => setCode(cleanCode(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canJoin) submitJoin();
                          }}
                        />
                        <Button
                          onClick={submitJoin}
                          disabled={!canJoin}
                          className="w-full mt-2 bg-violet-600 hover:bg-violet-700"
                        >
                          Rejoindre
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ROOM ACTIVE */}
            {roomCode && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">
                    Partage ce code :{" "}
                    <span className="font-semibold text-violet-400">
                      {roomCode}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyRoom}
                    disabled={pending !== "idle"}
                  >
                    {copied ? "Copié !" : "Copier"}
                  </Button>
                </div>

                <Button
                  onClick={submitStart}
                  disabled={!canLaunch || pending !== "idle"}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {primaryLabel}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Le host lance la partie • 2–10 joueurs
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT – JOUEURS (DESKTOP) */}
        <div className="hidden lg:block">
          <Card className="h-full bg-card/80 backdrop-blur">
            <CardHeader className="border-b border-border/60 py-4">
              <div className="flex justify-between items-baseline">
                <CardTitle className="text-base">Joueurs</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {lobbyPlayers.length}/10
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-2 p-4">
              {lobbyPlayers.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center border border-border/70 rounded-md px-3 py-2 bg-background/40"
                >
                  <div className="flex items-center gap-2">
                    <span>{AVATARS[p.avatar]}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {p.isHost && (
                    <span className="text-xs rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-violet-300">
                      HOST
                    </span>
                  )}
                </div>
              ))}

              {lobbyPlayers.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  En attente de joueurs…
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
