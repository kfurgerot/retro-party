import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AVATARS } from "@/types/game";
import { Player, WhoSaidItRole, WhoSaidItViewState } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { ActionBadge, PlayerBadge } from "./hud";

interface WhoSaidItMinigameProps {
  state: WhoSaidItViewState;
  players: Player[];
  myPlayerId?: string | null;
  onSubmit: (role: WhoSaidItRole) => void;
}

const ROLE_CONFIG: Array<{ role: WhoSaidItRole; label: string; keyHint: string }> = [
  { role: "MANAGER", label: fr.whoSaidIt.roleManager, keyHint: "1" },
  { role: "PO", label: "PO", keyHint: "2" },
  { role: "DEV", label: fr.whoSaidIt.roleDev, keyHint: "3" },
  { role: "SCRUM_MASTER", label: fr.whoSaidIt.roleScrumMaster, keyHint: "4" },
  { role: "QA_SUPPORT", label: fr.whoSaidIt.roleQaSupport, keyHint: "5" },
];

const ROLE_LABELS: Record<WhoSaidItRole, string> = {
  MANAGER: fr.whoSaidIt.roleManager,
  PO: "PO",
  DEV: fr.whoSaidIt.roleDev,
  SCRUM_MASTER: fr.whoSaidIt.roleScrumMaster,
  QA_SUPPORT: fr.whoSaidIt.roleQaSupport,
};

export const WhoSaidItMinigame: React.FC<WhoSaidItMinigameProps> = ({
  state,
  players,
  myPlayerId,
  onSubmit,
}) => {
  const [phase, setPhase] = useState<"idle" | "answer" | "reveal" | "done">("idle");
  const [roundIndex, setRoundIndex] = useState(1);
  const [quoteText, setQuoteText] = useState("");
  const [selectedRole, setSelectedRole] = useState<WhoSaidItRole | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  const totalVotes = useMemo(
    () => Object.values(state.distribution).reduce((sum, value) => sum + value, 0),
    [state.distribution]
  );

  const myDelta = myPlayerId ? state.pointsDelta[myPlayerId] ?? 0 : 0;
  const winnerNames = useMemo(
    () =>
      state.winners
        .map((id) => players.find((player) => player.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    [players, state.winners]
  );

  useEffect(() => {
    setPhase(state.phase);
    setRoundIndex(state.roundIndex);
    setQuoteText(state.quoteText);
    setSelectedRole(state.selectedRole);
  }, [state.phase, state.roundIndex, state.quoteText, state.selectedRole]);

  useEffect(() => {
    if (phase !== "answer") {
      setTimeLeftMs(0);
      return;
    }

    const tick = () => {
      const endTs = state.endsAtServerTs ?? Date.now();
      setTimeLeftMs(Math.max(0, endTs - Date.now()));
    };

    tick();
    const interval = window.setInterval(tick, 120);
    return () => window.clearInterval(interval);
  }, [phase, state.endsAtServerTs]);

  useEffect(() => {
    if (phase !== "answer" || selectedRole) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= ROLE_CONFIG.length) {
        return;
      }
      const role = ROLE_CONFIG[index].role;
      setSelectedRole(role);
      onSubmit(role);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSubmit, phase, selectedRole]);

  const submit = (role: WhoSaidItRole) => {
    if (selectedRole || phase !== "answer") return;
    setSelectedRole(role);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(20);
    }
    onSubmit(role);
  };

  const timerSeconds = Math.ceil(timeLeftMs / 1000);
  const isSpectator = !myPlayerId || !players.some((p) => p.id === myPlayerId);
  const phaseLabel =
    phase === "answer"
      ? fr.whoSaidIt.answerPhase
      : phase === "reveal"
        ? fr.whoSaidIt.revelation
        : phase === "done"
          ? fr.whoSaidIt.result
          : fr.whoSaidIt.preparation;
  const urgencyClass =
    timerSeconds <= 5
      ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
      : "border-cyan-300/35 bg-slate-900/70 text-cyan-50";
  const myPlayer = myPlayerId ? players.find((p) => p.id === myPlayerId) ?? null : null;

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-slate-950/95 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 text-cyan-50">
        <ActionBadge
          tone="active"
          className="px-3 py-2 text-sm font-semibold tracking-normal"
          label={`${fr.whoSaidIt.round} ${Math.max(1, roundIndex)} / ${state.totalRounds}`}
        />
        <div
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-semibold",
            phase === "answer" ? urgencyClass : "border-cyan-300/35 bg-slate-900/70"
          )}
        >
          {phase === "answer" ? `${phaseLabel} - ${timerSeconds}s` : phaseLabel}
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-4xl min-h-0 flex-1 flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <PlayerBadge
            name={myPlayer?.name ?? fr.buzzwordDuel.spectator}
            avatar={myPlayer ? AVATARS[myPlayer.avatar] ?? "?" : undefined}
            roleLabel={fr.whoSaidIt.yourChoice}
            highlighted={!isSpectator}
            rightSlot={
              <ActionBadge
                tone={selectedRole ? "active" : "neutral"}
                className="tracking-normal px-2 py-1"
                label={selectedRole ? ROLE_LABELS[selectedRole] : fr.whoSaidIt.none}
              />
            }
          />
          <PlayerBadge
            name={winnerNames.length ? winnerNames.join(", ") : fr.whoSaidIt.none}
            roleLabel={fr.whoSaidIt.winners}
            highlighted={phase === "reveal" || phase === "done"}
            rightSlot={
              <ActionBadge
                tone={myDelta > 0 ? "next" : "neutral"}
                className="tracking-normal px-2 py-1"
                label={`+${myDelta}`}
              />
            }
          />
        </div>

        <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-center sm:p-6">
          <p className="mx-auto max-h-[28svh] overflow-y-auto text-lg font-semibold leading-relaxed text-cyan-50 sm:max-h-[32svh] sm:text-2xl">
            {quoteText}
          </p>
        </Card>

        {phase === "answer" && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isSpectator && (
              <Card className="mb-2 border-cyan-300/35 bg-slate-900/70 p-2 text-center text-xs text-amber-200">
                {fr.buzzwordDuel.spectator}
              </Card>
            )}
            <div className="grid grid-cols-1 gap-2">
              {ROLE_CONFIG.map((role) => {
                const isSelected = selectedRole === role.role;
                return (
                  <Button
                    key={role.role}
                    type="button"
                    size="lg"
                    onClick={() => submit(role.role)}
                    disabled={!!selectedRole || isSpectator}
                    className={cn(
                      "!h-auto min-h-16 !whitespace-normal items-center justify-center px-3 py-3 text-center text-sm font-semibold sm:px-4 sm:text-base",
                      isSelected
                        ? "border-cyan-300 bg-cyan-500 text-slate-950"
                        : "border-cyan-300/35 bg-slate-900/75 text-cyan-50 hover:bg-slate-800"
                    )}
                  >
                    <span className="flex w-full items-center justify-center gap-2">
                      <span className="w-full whitespace-normal break-words text-center leading-tight">{role.label}</span>
                      <span className="hidden shrink-0 rounded border border-cyan-300/35 bg-slate-950/55 px-2 py-0.5 text-xs lg:inline-flex">
                        {role.keyHint}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {phase === "reveal" && (
          <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-cyan-50">
            <div className="mb-2">
              <ActionBadge
                tone="question"
                className="tracking-normal px-2 py-1"
                label={`${fr.whoSaidIt.correctAnswer}: ${state.answerRole ? ROLE_LABELS[state.answerRole] : "-"}`}
              />
            </div>
            <div className="mt-3 grid gap-2">
              {ROLE_CONFIG.map(({ role, label }) => {
                const votes = state.distribution[role] ?? 0;
                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                const isCorrect = state.answerRole === role;
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{label}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div
                        className={cn("h-full", isCorrect ? "bg-emerald-400" : "bg-cyan-400")}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ActionBadge tone="system" className="justify-center px-2 py-1 tracking-normal" label={`${fr.whoSaidIt.yourChoice}: ${selectedRole ? ROLE_LABELS[selectedRole] : fr.whoSaidIt.none}`} />
              <ActionBadge tone={myDelta > 0 ? "next" : "neutral"} className="justify-center px-2 py-1 tracking-normal" label={`${fr.whoSaidIt.yourPointsThisRound}: +${myDelta}`} />
            </div>
          </Card>
        )}

        {phase === "done" && (
          <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-cyan-50">
            <div className="text-lg font-bold">{fr.whoSaidIt.minigameFinished}</div>
            <div className="mt-2 text-sm">
              {fr.whoSaidIt.pointsGained}: +
              {myPlayerId && state.summary ? state.summary.pointsGained[myPlayerId] ?? 0 : 0}
            </div>
          </Card>
        )}
      </div>

      {phase === "answer" && selectedRole && (
        <Card className="mx-auto mt-2 w-full max-w-4xl border-cyan-300/35 bg-slate-900/85 p-2 text-center text-sm text-cyan-100">
          {`${fr.whoSaidIt.sentAnswer} - ${fr.whoSaidIt.yourChoice}: ${ROLE_LABELS[selectedRole]}`}
        </Card>
      )}
    </div>
  );
};
