import React, { useMemo, useState } from "react";
import { AVATARS } from "@/types/game";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type LobbyPlayer = { name: string; avatar: number; isHost: boolean };

interface OnlineLobbyScreenProps {
  connected: boolean;
  roomCode: string | null;
  lobbyPlayers: LobbyPlayer[];
  onHost: (name: string, avatar: number) => void;
  onJoin: (code: string, name: string, avatar: number) => void;
  onStartGame: () => void;
  canStart: boolean; // host only
}

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
  const [name, setName] = useState("Karl");
  const [avatar, setAvatar] = useState(0);
  const [code, setCode] = useState("");

  const subtitle = useMemo(() => {
    if (!connected) return "Connexion au serveur…";
    if (roomCode) return `Room active : ${roomCode}`;
    return "Multijoueur en ligne (2–10 joueurs)";
  }, [connected, roomCode]);

  const canCreate = connected && !roomCode && mode === "host";
  const canJoin = connected && !roomCode && mode === "join" && code.trim().length >= 4;

  return (
    <div className="flex h-full w-full flex-col gap-3 sm:gap-4 p-3 sm:p-4 overflow-hidden scanlines">
      {/* Header */}
      {/* Mobile: compact header */}
      <div className="lg:hidden">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs opacity-70">RÉTRO PARTY</div>
                <CardTitle className="text-base">Mode en ligne</CardTitle>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-70">Statut</div>
                <div className="text-sm font-semibold">{connected ? "Connecté" : "…"}</div>
                {roomCode && (
                  <div className="text-xs opacity-70 mt-1">
                    Room : <span className="font-semibold text-foreground">{roomCode}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Desktop */}
      <div className="hidden lg:grid grid-cols-3 gap-2">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="py-2">
            <div className="text-xs opacity-70">RÉTRO PARTY</div>
            <CardTitle className="text-base">Mode en ligne</CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="py-2">
            <div className="text-xs opacity-70">Statut</div>
            <CardTitle className="text-base">{connected ? "Connecté" : "…"}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="py-2">
            <div className="text-xs opacity-70">Room</div>
            <CardTitle className="text-base">{roomCode ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

<div className="grid flex-1 grid-cols-1 gap-4 min-h-0 lg:grid-cols-[1fr_360px]">
        {/* Left: setup */}
        <Card className="h-full overflow-hidden bg-card/80 backdrop-blur">
          <CardHeader className="border-b border-border/60 py-4">
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </CardHeader>

          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={mode === "host" ? "default" : "secondary"}
                  onClick={() => setMode("host")}
                >
                  Héberger
                </Button>
                <Button
                  variant={mode === "join" ? "default" : "secondary"}
                  onClick={() => setMode("join")}
                >
                  Rejoindre
                </Button>
              </div>

              <div className="lg:hidden">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full">
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
                          {p.isHost && (
                            <span className="text-xs rounded bg-muted px-2 py-1">Host</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pseudo</p>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avatar</p>

                  {/* Mobile: compact avatar picker (no huge grid) */}
                  <div className="flex items-center gap-3 sm:hidden">
                    <div className="h-11 w-11 rounded-md border border-border bg-background/60 text-xl flex items-center justify-center">
                      {AVATARS[avatar]}
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="secondary" className="flex-1">
                          Changer d’avatar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[92vw]">
                        <DialogHeader>
                          <DialogTitle>Choisir un avatar</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-wrap gap-2">
                          {AVATARS.map((a, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setAvatar(i)}
                              className={cn(
                                "h-11 w-11 rounded-md border border-border bg-background/60 text-xl",
                                "transition hover:bg-background",
                                i === avatar && "ring-2 ring-primary"
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

                  {/* Desktop / tablet */}
                  <div className="hidden sm:flex flex-wrap gap-2">
                    {AVATARS.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatar(i)}
                        className={cn(
                          "h-10 w-10 rounded-md border border-border bg-background/60 text-lg",
                          "transition hover:bg-background",
                          i === avatar && "ring-2 ring-primary"
                        )}
                        aria-label={`Avatar ${i + 1}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "join" && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Code room</p>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABCD"
                    />
                  </div>
                )}
              </div>

              {!roomCode && (
                <div className="flex flex-col sm:flex-row gap-2">
                  {mode === "host" ? (
                    <Button onClick={() => onHost(name, avatar)} disabled={!canCreate} className="sm:w-fit">
                      Créer la room
                    </Button>
                  ) : (
                    <Button onClick={() => onJoin(code, name, avatar)} disabled={!canJoin} className="sm:w-fit">
                      Rejoindre
                    </Button>
                  )}
                  <div className="text-xs text-muted-foreground self-center">
                    {connected ? "" : "Connexion en cours…"}
                  </div>
                </div>
              )}

              {roomCode && (
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-muted-foreground">
                    Partage ce code : <span className="font-semibold text-foreground">{roomCode}</span>
                  </div>

                  <Button onClick={onStartGame} disabled={!canStart || lobbyPlayers.length < 2}>
                    Lancer la partie
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Le host lance la partie • 2–10 joueurs
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: players list */}
        <div className="hidden lg:block">
          <Card className="h-full overflow-hidden bg-card/80 backdrop-blur">
          <CardHeader className="border-b border-border/60 py-4">
            <div className="flex items-baseline justify-between">
              <CardTitle className="text-base">Joueurs</CardTitle>
              <div className="text-sm text-muted-foreground">{lobbyPlayers.length}/10</div>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-2">
              {lobbyPlayers.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{AVATARS[p.avatar] ?? "🙂"}</span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {p.isHost && (
                    <span className="text-xs rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                      HOST
                    </span>
                  )}
                </div>
              ))}

              {lobbyPlayers.length === 0 && (
                <div className="text-sm text-muted-foreground">En attente de joueurs…</div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};
