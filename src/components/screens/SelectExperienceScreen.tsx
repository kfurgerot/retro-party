import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { Gamepad2, Pencil, Radar, Puzzle, Layers, LucideIcon } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { SAAS_SURFACE_SOFT } from "@/lib/uiTokens";
import { useAnimatedProgress } from "@/hooks/useAnimatedProgress";

export type ExperienceId =
  | "retro-party"
  | "planning-poker"
  | "draw-duel"
  | "agile-radar"
  | "retro-generator";

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
    id: "agile-radar",
    Icon: Radar,
    title: "Radar Party",
    description: "Radar d'equipe Agile avec questionnaire, scoring et insights atelier.",
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
    typeof stepCurrent === "number" && typeof stepTotal === "number" && stepTotal > 0;
  const progressPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round((stepCurrent / stepTotal) * 100)))
    : 0;
  const progressFromPct = hasProgress
    ? Math.max(0, Math.min(100, Math.round(((stepCurrent - 1) / stepTotal) * 100)))
    : 0;
  const animatedProgressPct = useAnimatedProgress(progressPct, progressFromPct);
  const computedStepLabel = hasProgress
    ? `${fr.onlineOnboarding.step} ${stepCurrent}/${stepTotal}`
    : stepLabel;

  return (
    <div className="relative flex min-h-svh w-full items-start justify-center overflow-hidden bg-[#f7f8f3] px-4 pb-28 pt-4 text-[#18211f] sm:pb-28 sm:pt-6">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

      <Card
        tone="saas"
        className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8"
      >
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#647067]">
          <span>{fr.selectExperience.brand}</span>
          {computedStepLabel ? (
            <span className="rounded-full border border-[#d8e2d9] bg-white/62 px-2 py-0.5">
              {computedStepLabel}
            </span>
          ) : null}
        </div>

        <h1 className="mt-4 text-center text-xl font-black tracking-tight text-[#18211f] sm:text-3xl">
          {fr.selectExperience.title}
        </h1>
        {hasProgress ? (
          <div className="mt-4 h-1 w-full overflow-hidden rounded bg-[#d8e2d9]">
            <div
              className="h-full rounded bg-[#163832] transition-all duration-300"
              style={{ width: `${animatedProgressPct}%` }}
            />
          </div>
        ) : null}

        <Card tone="saas" className="mt-6 p-4 sm:p-5">
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
                  `${SAAS_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]`,
                  tool.available
                    ? "hover:border-[#aebcaf] hover:bg-white"
                    : "cursor-not-allowed opacity-70",
                  selectedExperience === tool.id &&
                    tool.available &&
                    "border-[#163832]/35 bg-[#edf5ef]",
                )}
              >
                {(() => {
                  const isBetaExperience =
                    tool.id === "planning-poker" || tool.id === "agile-radar";
                  const availableBadgeClass = isBetaExperience
                    ? "border border-sky-400/45 bg-sky-500/12 text-sky-200"
                    : "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200";
                  const badgeText = !tool.available
                    ? fr.selectExperience.soon
                    : isBetaExperience
                      ? fr.selectExperience.beta
                      : fr.selectExperience.ready;

                  return (
                    <div className="flex items-center justify-between gap-2">
                      <tool.Icon className="h-7 w-7 text-[#24443d]" aria-hidden="true" />
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                          tool.available
                            ? availableBadgeClass
                            : "border border-amber-400/40 bg-amber-500/10 text-amber-200",
                        )}
                      >
                        {badgeText}
                      </span>
                    </div>
                  );
                })()}
                <div className="mt-3 text-sm font-semibold text-[#18211f]">{tool.title}</div>
                <div className="mt-1 text-xs text-[#647067]">{tool.description}</div>
              </button>
            ))}
          </div>
        </Card>
      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card
          tone="saas"
          className="pointer-events-auto mx-auto w-full max-w-4xl bg-[#f7f8f3]/94 p-3 shadow-[0_-12px_38px_rgba(22,56,50,0.14)]"
        >
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton tone="saas" type="button" className="h-11" onClick={onBack}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              tone="saas"
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
        <Card
          tone="saas"
          className="pointer-events-auto mx-auto w-full max-w-4xl bg-[#f7f8f3]/94 p-3 shadow-[0_-12px_38px_rgba(22,56,50,0.14)]"
        >
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton tone="saas" type="button" className="h-12 min-h-0" onClick={onBack}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              tone="saas"
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
