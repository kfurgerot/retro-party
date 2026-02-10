import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Player, WhoSaidItRole, WhoSaidItViewState } from "@/types/game";
import { cn } from "@/lib/utils";

interface WhoSaidItMinigameProps {
  state: WhoSaidItViewState;
  players: Player[];
  myPlayerId?: string | null;
  onSubmit: (role: WhoSaidItRole) => void;
}

const ROLE_CONFIG: Array<{ role: WhoSaidItRole; label: string; keyHint: string }> = [
  { role: "MANAGER", label: "Manager", keyHint: "1" },
  { role: "PO", label: "PO", keyHint: "2" },
  { role: "DEV", label: "Dev", keyHint: "3" },
  { role: "SCRUM_MASTER", label: "Scrum Master", keyHint: "4" },
  { role: "QA_SUPPORT", label: "QA / Support", keyHint: "5" },
];

const ROLE_LABELS: Record<WhoSaidItRole, string> = {
  MANAGER: "Manager",
  PO: "PO",
  DEV: "Dev",
  SCRUM_MASTER: "Scrum Master",
  QA_SUPPORT: "QA / Support",
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

  return (
    <div className="absolute inset-0 z-50 flex h-full w-full flex-col overflow-hidden bg-slate-950/95 p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 text-cyan-50">
        <div className="rounded border border-cyan-300/35 bg-slate-900/70 px-3 py-2 text-sm font-semibold">
          Manche {Math.max(1, roundIndex)} / {state.totalRounds}
        </div>
        <div className="rounded border border-cyan-300/35 bg-slate-900/70 px-3 py-2 text-sm font-semibold">
          {phase === "answer" ? `${timerSeconds}s` : phase === "reveal" ? "Revelation" : phase === "done" ? "Resultat" : "Preparation"}
        </div>
      </div>

      <div className="mx-auto mt-3 flex w-full max-w-4xl flex-1 flex-col gap-3 overflow-hidden">
        <Card className="flex min-h-[170px] items-center justify-center border-cyan-300/35 bg-slate-900/70 p-6 text-center">
          <p className="text-xl font-semibold leading-relaxed text-cyan-50 sm:text-2xl">{quoteText}</p>
        </Card>

        {phase === "answer" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {ROLE_CONFIG.map((role) => {
              const isSelected = selectedRole === role.role;
              return (
                <Button
                  key={role.role}
                  type="button"
                  size="lg"
                  onClick={() => submit(role.role)}
                  disabled={!!selectedRole}
                  className={cn(
                    "h-16 text-base font-semibold",
                    isSelected
                      ? "border-cyan-300 bg-cyan-500 text-slate-950"
                      : "border-cyan-300/35 bg-slate-900/75 text-cyan-50 hover:bg-slate-800"
                  )}
                >
                  <span>{role.keyHint}. {role.label}</span>
                </Button>
              );
            })}
          </div>
        )}

        {phase === "answer" && (
          <Card className="border-cyan-300/35 bg-slate-900/70 p-3 text-center text-cyan-100">
            {selectedRole ? "Reponse envoyee OK" : "Choisis un role avant la fin du timer"}
          </Card>
        )}

        {phase === "reveal" && (
          <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-cyan-50">
            <div className="text-lg font-bold">Bonne reponse: {state.answerRole ? ROLE_LABELS[state.answerRole] : "-"}</div>
            <div className="mt-3 grid gap-2">
              {ROLE_CONFIG.map(({ role, label }) => {
                const votes = state.distribution[role] ?? 0;
                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{label}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm">
              Gagnants: {winnerNames.length ? winnerNames.join(", ") : "Aucun"}
            </div>
            <div className="mt-1 text-sm">Tes points sur cette manche: +{myDelta}</div>
          </Card>
        )}

        {phase === "done" && (
          <Card className="border-cyan-300/35 bg-slate-900/70 p-4 text-cyan-50">
            <div className="text-lg font-bold">Mini-jeu termine</div>
            <div className="mt-2 text-sm">
              Points gagnes: +{myPlayerId && state.summary ? state.summary.pointsGained[myPlayerId] ?? 0 : 0}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
