import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, AVATARS } from "@/types/game";
import { PixelCard } from "./PixelCard";
import { PixelButton } from "./PixelButton";
import { MINIGAME_KEYS } from "@/data/keyboardMappings";

interface BugSmashMinigameProps {
  players: Player[];
  seed?: number;
  startAt?: number;
  durationMs?: number;
  onComplete: (results: { playerId: number; score: number }[]) => void;
}

interface Bug {
  id: number;
  x: number;
  y: number;
  isSmashed: boolean;
  smashedBy: number | null;
  targetPlayerIndex: number;
  keyRequired: "left" | "right";
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUG_SPAWN_INTERVAL = 600;
const BUG_LIFETIME = 2500;

export const BugSmashMinigame: React.FC<BugSmashMinigameProps> = ({
  players,
  seed,
  startAt,
  durationMs,
  onComplete,
}) => {
  const [phase, setPhase] = useState<"intro" | "playing" | "results">("intro");
  const [timeLeft, setTimeLeft] = useState<number>(Math.ceil((durationMs ?? 45000) / 1000));
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const gameAreaRef = useRef<HTMLDivElement>(null);

  const rngRef = useRef<(() => number) | null>(null);
  const startEpochRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const bugIdRef = useRef(0);

  const effectiveDurationMs = durationMs ?? 45000;

  // init scores
  useEffect(() => {
    const init: Record<number, number> = {};
    players.forEach((p) => (init[p.id] = 0));
    setScores(init);
    setBugs([]);
    completedRef.current = false;
    bugIdRef.current = 0;
    setPhase("intro");
    setTimeLeft(Math.ceil(effectiveDurationMs / 1000));
  }, [players, effectiveDurationMs]);

  const startGame = (epoch: number) => {
    startEpochRef.current = epoch;
    const s = typeof seed === "number" ? seed : Math.floor(Math.random() * 1_000_000_000);
    rngRef.current = mulberry32(s);
    setTimeLeft(Math.ceil(effectiveDurationMs / 1000));
    setPhase("playing");
  };

  // auto-start when startAt provided
  useEffect(() => {
    if (!startAt) return;
    if (phase !== "intro") return;
    const delay = Math.max(0, startAt - Date.now());
    const t = window.setTimeout(() => startGame(startAt), delay);
    return () => window.clearTimeout(t);
  }, [startAt, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard
  useEffect(() => {
    if (phase !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
        const [leftKey, rightKey] = MINIGAME_KEYS[playerIndex] || [];
        if (!leftKey || !rightKey) continue;

        if (key === leftKey || key === rightKey) {
          const keyType: "left" | "right" = key === leftKey ? "left" : "right";

          setBugs((prev) => {
            const bug = prev.find(
              (b) =>
                !b.isSmashed &&
                b.targetPlayerIndex === playerIndex &&
                b.keyRequired === keyType
            );
            if (!bug) return prev;

            const pid = players[playerIndex].id;
            setScores((s) => ({ ...s, [pid]: (s[pid] ?? 0) + 1 }));

            return prev.map((b) =>
              b.id === bug.id ? { ...b, isSmashed: true, smashedBy: pid } : b
            );
          });

          break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, players]);

  // spawn bugs (deterministic if rngRef is seeded)
  useEffect(() => {
    if (phase !== "playing") return;

    const spawn = () => {
      const rect = gameAreaRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rng = rngRef.current ?? Math.random;
      const targetPlayerIndex = Math.floor(rng() * Math.max(1, players.length));
      const keyRequired: "left" | "right" = rng() > 0.5 ? "left" : "right";

      const newBug: Bug = {
        id: bugIdRef.current++,
        x: rng() * (rect.width - 80) + 40,
        y: rng() * (rect.height - 80) + 40,
        isSmashed: false,
        smashedBy: null,
        targetPlayerIndex,
        keyRequired,
      };

      setBugs((prev) => [...prev, newBug]);
      window.setTimeout(() => {
        setBugs((prev) => prev.filter((b) => b.id !== newBug.id));
      }, BUG_LIFETIME);
    };

    const interval = window.setInterval(spawn, BUG_SPAWN_INTERVAL);
    return () => window.clearInterval(interval);
  }, [phase, players.length]);

  // timer (synced)
  useEffect(() => {
    if (phase !== "playing") return;

    const startEpoch = startEpochRef.current ?? Date.now();
    const endEpoch = startEpoch + effectiveDurationMs;

    const tick = () => {
      const remaining = Math.max(0, endEpoch - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) setPhase("results");
    };

    tick();
    const t = window.setInterval(tick, 150);
    return () => window.clearInterval(t);
  }, [phase, effectiveDurationMs]);

  // complete once when results
  useEffect(() => {
    if (phase !== "results") return;
    if (completedRef.current) return;
    completedRef.current = true;

    const results = Object.entries(scores).map(([playerId, score]) => ({
      playerId: Number(playerId),
      score: Number(score),
    }));

    onComplete(results);
  }, [phase, scores, onComplete]);

  const sorted = useMemo(() => {
    return Object.entries(scores)
      .map(([playerId, score]) => ({
        player: players.find((p) => p.id === Number(playerId))!,
        score: Number(score),
      }))
      .sort((a, b) => b.score - a.score);
  }, [scores, players]);

  if (phase === "intro") {
    const ms = startAt ? Math.max(0, startAt - Date.now()) : 0;
    const countdown = startAt ? Math.ceil(ms / 1000) : null;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <PixelCard className="max-w-md w-full text-center">
          <h2 className="font-pixel text-xl mb-4">BUG SMASH</h2>
          <p className="font-pixel text-xs text-muted-foreground mb-4">
            Chaque joueur tape sa touche pour écraser les bugs qui lui sont assignés.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {players.slice(0, 10).map((p, idx) => {
              const [l, r] = MINIGAME_KEYS[idx] || ["?", "?"];
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <div className="w-6 h-6 text-lg">{AVATARS[p.avatar] ?? "🙂"}</div>
                  <div className="text-left">
                    <div className="font-pixel text-xs">{p.name}</div>
                    <div className="font-pixel text-[10px] text-muted-foreground">
                      {l?.toUpperCase()} / {r?.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="font-pixel text-xs text-muted-foreground mb-4">
            Durée: {Math.ceil(effectiveDurationMs / 1000)} secondes
          </p>

          {startAt ? (
            <div className="font-pixel text-xs text-muted-foreground">
              Démarrage synchronisé… {countdown}
            </div>
          ) : (
            <PixelButton onClick={() => startGame(Date.now())} size="lg">
              START!
            </PixelButton>
          )}
        </PixelCard>
      </div>
    );
  }

  if (phase === "results") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <PixelCard className="max-w-md w-full text-center">
          <h2 className="font-pixel text-xl mb-4">RÉSULTATS</h2>
          <div className="space-y-2 mb-4">
            {sorted.map((r, idx) => (
              <div key={r.player.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <span className="font-pixel text-sm">#{idx + 1}</span>
                  <span className="text-lg">{AVATARS[r.player.avatar] ?? "🙂"}</span>
                  <span className="font-pixel text-xs">{r.player.name}</span>
                </div>
                <span className="font-pixel text-sm">{r.score}</span>
              </div>
            ))}
          </div>
          <p className="font-pixel text-xs text-muted-foreground">
            Retour au plateau…
          </p>
        </PixelCard>
      </div>
    );
  }

  // playing
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4 flex items-center justify-between">
        <div className="font-pixel text-sm">BUG SMASH</div>
        <div className="font-pixel text-sm">{timeLeft}s</div>
      </div>

      <div className="flex-1 p-4">
        <div ref={gameAreaRef} className="relative w-full h-[60vh] bg-muted rounded overflow-hidden">
          {bugs.map((b) => (
            <div
              key={b.id}
              className={`absolute select-none ${b.isSmashed ? "opacity-40" : ""}`}
              style={{ left: b.x, top: b.y, transform: "translate(-50%, -50%)" }}
              title={`Joueur ${b.targetPlayerIndex + 1} - ${b.keyRequired}`}
            >
              🐞
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-2">
        {players.slice(0, 10).map((p) => (
          <div key={p.id} className="p-2 bg-muted rounded flex items-center justify-between">
            <span className="font-pixel text-xs">{p.name}</span>
            <span className="font-pixel text-xs">{scores[p.id] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
