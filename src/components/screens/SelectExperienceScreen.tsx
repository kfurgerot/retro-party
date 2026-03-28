import React, { useMemo, useState } from "react";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { Gamepad2, Pencil, Radar, Puzzle, Layers, LucideIcon } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { APP_SHELL_SURFACE_SOFT } from "@/lib/uiTokens";
import { useAnimatedProgress } from "@/hooks/useAnimatedProgress";

export type ExperienceId = "retro-party" | "planning-poker" | "draw-duel" | "agile-radar" | "retro-generator";

type ToolItem = {
  id: ExperienceId;
  Icon: LucideIcon;
  title: string;
  description: string;
  available: boolean;
};

const TOOLS: ToolItem[] = [
  {
    id: "retro-party",
    Icon: Gamepad2,
    title: fr.selectExperience.retroPartyTitle,
    description: fr.selectExperience.retroPartyDescription,
    available: true,
  },
  {
    id: "planning-poker",
    Icon: Layers,
    title: fr.selectExperience.planningPokerTitle,
    description: fr.selectExperience.planningPokerDescription,
    available: true,
  },
  {
    id: "draw-duel",
    Icon: Pencil,
    title: fr.selectExperience.drawDuelTitle,
    description: fr.selectExperience.drawDuelDescription,
    available: false,
  },
  {
    id: "agile-radar",
    Icon: Radar,
    title: "Radar Party",
    description: "Radar d'equipe Agile avec questionnaire, scoring et insights atelier.",
    available: true,
  },
  {
    id: "retro-generator",
    Icon: Puzzle,
    title: fr.selectExperience.retroGeneratorTitle,
    description: fr.selectExperience.retroGeneratorDescription,
    available: false,
  },
];

interface SelectExperienceScreenProps {
  onSelect: (experience: ExperienceId) => void;
  onBack: () => void;
  stepLabel?: string;
  stepCurrent?: number;
  stepTotal?: number;
}

export const SelectExperienceScreen: React.FC<SelectExperienceScreenProps> = ({
  onSelect,
  onBack,
  stepLabel,
  stepCurrent,
  stepTotal,
}) => {
  const defaultExperience = useMemo<ExperienceId>(() => {
    const firstAvailable = TOOLS.find((tool) => tool.available);
    return firstAvailable?.id ?? "retro-party";
  }, []);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId>(defaultExperience);
  const hasProgress =
    typeof stepCurrent === "number" &&
    typeof stepTotal === "number" &&
    stepTotal > 0;
  const progressPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round((stepCurrent / stepTotal) * 100)))
    : 0;
  const progressFromPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round(((stepCurrent - 1) / stepTotal) * 100)))
    : 0;
  const animatedProgressPct = useAnimatedProgress(progressPct, progressFromPct);
  const computedStepLabel = hasProgress ? `${fr.onlineOnboarding.step} ${stepCurrent}/${stepTotal}` : stepLabel;

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-28 pt-4 sm:pb-28 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.selectExperience.brand}</span>
          {computedStepLabel ? (
            <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">{computedStepLabel}</span>
          ) : null}
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {fr.selectExperience.title}
        </h1>
        {hasProgress ? (
          <div className="mt-4 h-1 w-full overflow-hidden rounded bg-slate-900/55">
            <div
              className="h-full rounded bg-cyan-400/90 transition-all duration-300"
              style={{ width: `${animatedProgressPct}%` }}
            />
          </div>
        ) : null}

        <Card className="mt-6 rounded-md p-4 sm:p-5">
          <div className="grid flex-1 content-start grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  if (!tool.available) return;
                  setSelectedExperience(tool.id);
                }}
                onDoubleClick={() => {
                  if (!tool.available) return;
                  onSelect(tool.id);
                }}
                disabled={!tool.available}
                aria-disabled={!tool.available}
                className={cn(
                  `${APP_SHELL_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`,
                  tool.available
                    ? "hover:border-cyan-300/45 hover:bg-slate-900/70"
                    : "cursor-not-allowed border-cyan-300/20 bg-slate-900/30 opacity-80",
                  selectedExperience === tool.id && tool.available && "border-cyan-300/50 bg-cyan-500/10"
                )}
              >
                {(() => {
                  const isPlanningParty = tool.id === "planning-poker";
                  const availableBadgeClass = isPlanningParty
                    ? "border border-sky-400/45 bg-sky-500/12 text-sky-200"
                    : "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
                  const badgeText = !tool.available
                    ? fr.selectExperience.soon
                    : isPlanningParty
                    ? fr.selectExperience.beta
                    : fr.selectExperience.ready;

                  return (
                <div className="flex items-center justify-between gap-2">
                  <tool.Icon className="h-7 w-7 text-cyan-100" aria-hidden="true" />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                      tool.available
                        ? availableBadgeClass
                        : "border border-amber-400/40 bg-amber-500/10 text-amber-200"
                    )}
                  >
                    {badgeText}
                  </span>
                </div>
                  );
                })()}
                <div className="mt-3 text-sm font-semibold text-cyan-100">{tool.title}</div>
                <div className="mt-1 text-xs text-slate-300">{tool.description}</div>
              </button>
            ))}
          </div>
        </Card>

      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton
              type="button"
              className="h-11"
              onClick={onBack}
            >
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              type="button"
              className="h-11"
              onClick={() => onSelect(selectedExperience)}
            >
              {fr.selectExperience.next}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              type="button"
              className="h-12 min-h-0"
              onClick={onBack}
            >
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              type="button"
              className="h-12 min-h-0"
              onClick={() => onSelect(selectedExperience)}
            >
              {fr.selectExperience.next}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
};
