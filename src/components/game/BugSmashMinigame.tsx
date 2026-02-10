import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AVATARS, Player } from "@/types/game";
import { cn } from "@/lib/utils";

interface BugSmashMinigameProps {
  players: Player[];
  targetPlayerId: string;
  myPlayerId?: string | null;
  startAt?: number;
  durationMs?: number;
  canPlay?: boolean;
  liveScore?: number;
  onProgress?: (score: number) => void;
  onComplete: (score: number) => void;
}

type Bug = {
  id: number;
  x: number;
  y: number;
  bornAt: number;
};

const DEFAULT_DURATION_MS = 20000;
const SPAWN_EVERY_MS = 320;
const BUG_LIFETIME_MS = 1300;
const RESULT_SCREEN_MS = 4000;

const getBugSmashStars = (value: number) => {
  if (value >= 18) return 3;
  if (value >= 12) return 2;
  if (value >= 6) return 1;
  return 0;
};

export const BugSmashMinigame: React.FC<BugSmashMinigameProps> = ({
  players,
  targetPlayerId,
  myPlayerId,
  startAt,
  durationMs = DEFAULT_DURATION_MS,
  canPlay = false,
  liveScore = 0,
  onProgress,
  onComplete,
}) => {
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [timeLeftMs, setTimeLeftMs] = useState(durationMs);
  const [score, setScore] = useState(0);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const bugIdRef = useRef(1);
  const completedRef = useRef(false);
  const completeTimerRef = useRef<number | null>(null);

  const targetPlayer = useMemo(
    () => players.find((player) => player.id === targetPlayerId) ?? null,
    [players, targetPlayerId]
  );
  const isTargetPlayer = !!myPlayerId && myPlayerId === targetPlayerId;
  const canControl = canPlay || isTargetPlayer;

  useEffect(() => {
    setPhase("intro");
    setScore(0);
    setTimeLeftMs(durationMs);
    setBugs([]);
    completedRef.current = false;
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
    bugIdRef.current = 1;
  }, [durationMs, targetPlayerId]);

  useEffect(() => {
    if (!startAt || phase !== "intro") return;
    const delay = Math.max(0, startAt - Date.now());
    const timer = window.setTimeout(() => {
      setPhase("playing");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase, startAt]);

  useEffect(() => {
    if (phase !== "playing") return;
    const endAt = (startAt ?? Date.now()) + durationMs;

    const timer = window.setInterval(() => {
      const remaining = Math.max(0, endAt - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        setPhase("done");
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [durationMs, phase, startAt]);

  useEffect(() => {
    if (!canControl || !onProgress) return;
    onProgress(score);
  }, [canControl, onProgress, score]);

  useEffect(() => {
    if (phase !== "playing" || !canControl) return;
    const interval = window.setInterval(() => {
      const el = areaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 20;
      const width = Math.max(1, rect.width - margin * 2);
      const height = Math.max(1, rect.height - margin * 2);
      const now = Date.now();
      const bug: Bug = {
        id: bugIdRef.current++,
        x: margin + Math.random() * width,
        y: margin + Math.random() * height,
        bornAt: now,
      };
      setBugs((prev) => [...prev, bug].filter((entry) => now - entry.bornAt <= BUG_LIFETIME_MS));
    }, SPAWN_EVERY_MS);

    return () => window.clearInterval(interval);
  }, [canControl, phase]);

  useEffect(() => {
    if (phase !== "playing" || !canControl) return;
    const ttlCleaner = window.setInterval(() => {
      const now = Date.now();
      setBugs((prev) => prev.filter((entry) => now - entry.bornAt <= BUG_LIFETIME_MS));
    }, 120);
    return () => window.clearInterval(ttlCleaner);
  }, [canControl, phase]);

  useEffect(() => {
    if (phase !== "done" || completedRef.current || !canControl) return;
    completeTimerRef.current = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(score);
      completeTimerRef.current = null;
    }, RESULT_SCREEN_MS);
    return () => {
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, [canControl, onComplete, phase, score]);

  useEffect(() => {
    return () => {
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
    };
  }, []);

  const smashBug = (id: number) => {
    if (!canControl || phase !== "playing") return;
    setBugs((prev) => prev.filter((bug) => bug.id !== id));
    setScore((value) => value + 1);
  };

  const countdown = startAt ? Math.max(0, Math.ceil((startAt - Date.now()) / 1000)) : null;
  const timeLabel = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const displayedScore = canControl ? score : liveScore;
  const starsEarned = getBugSmashStars(displayedScore);

  const continueAfterResults = () => {
    if (!canControl || completedRef.current || phase !== "done") return;
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
    completedRef.current = true;
    onComplete(score);
  };

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-slate-950/95 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 text-cyan-50">
        <div className="rounded border border-cyan-300/35 bg-slate-900/70 px-3 py-2 text-sm font-semibold">
          Bug Smash
        </div>
        <div className="rounded border border-cyan-300/35 bg-slate-900/70 px-3 py-2 text-sm font-semibold">
          {phase === "intro" ? `Debut ${countdown ?? 0}s` : `${timeLabel}s`}
        </div>
      </div>

      <div className="mx-auto mt-3 grid w-full max-w-5xl flex-1 gap-3 lg:grid-cols-[1fr_280px]">
        <Card className="flex min-h-[280px] flex-col border-cyan-300/35 bg-slate-900/70 p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-cyan-100">
            <span>
              Joueur: {targetPlayer ? `${AVATARS[targetPlayer.avatar] ?? "?"} ${targetPlayer.name}` : "?"}
            </span>
            <span>Score: {displayedScore}</span>
          </div>

          <div
            ref={areaRef}
            className={cn(
              "relative flex-1 overflow-hidden rounded border border-cyan-300/20 bg-slate-950/65",
              !canControl && "opacity-80"
            )}
          >
            {canControl && phase === "playing" ? (
              bugs.map((bug) => (
                <button
                  key={bug.id}
                  type="button"
                  aria-label="Smash"
                  onClick={() => smashBug(bug.id)}
                  className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-rose-300/70 bg-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.55)] transition hover:scale-110"
                  style={{ left: bug.x, top: bug.y }}
                />
              ))
            ) : phase === "done" ? (
              <div className="flex h-full items-center justify-center px-4">
                <Card className="w-full max-w-md border-cyan-300/35 bg-slate-900/85 p-4 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
                  <h4 className="text-center text-base font-bold">Resultat Bug Smash</h4>
                  <div className="mt-3 grid gap-2 text-center">
                    <div className="rounded border border-cyan-300/35 bg-slate-950/70 px-3 py-2 text-sm">
                      Bugs elimines: <span className="font-bold">{displayedScore}</span>
                    </div>
                    <div className="rounded border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      Etoiles gagnees: <span className="font-bold">+{starsEarned}</span>
                    </div>
                  </div>
                  {canControl ? (
                    <Button
                      className="mt-4 w-full border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      onClick={continueAfterResults}
                    >
                      Continuer
                    </Button>
                  ) : (
                    <div className="mt-4 text-center text-xs text-cyan-100/75">
                      En attente de la validation du joueur actif...
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-cyan-100/80">
                {canControl
                  ? "Attends le top depart..."
                  : "Le joueur actif est en train de jouer."}
              </div>
            )}
          </div>
        </Card>

        <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-cyan-50">
          <h3 className="text-base font-bold">Case Rouge: Bug Smash</h3>
          <p className="mt-2 text-sm text-slate-200">
            Ecrase un maximum de bugs avant la fin du chrono.
          </p>
          <div className="mt-3 text-xs text-cyan-100/80">
            {canControl ? "Controles: clic souris uniquement." : "Mode spectateur en cours."}
          </div>

          <div className="mt-4 space-y-1 text-xs text-slate-200">
            <div>Recompenses:</div>
            <div>6+ bugs: +1 etoile</div>
            <div>12+ bugs: +2 etoiles</div>
            <div>18+ bugs: +3 etoiles</div>
          </div>

          {phase === "intro" && canControl && !startAt && (
            <Button className="mt-4 w-full border-cyan-300 bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => setPhase("playing")}>
              Demarrer
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
};
