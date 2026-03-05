import React from "react";
import { Button } from "@/components/ui/button";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { cn } from "@/lib/utils";

export type ExperienceId = "retro-party" | "draw-duel" | "agile-radar" | "retro-generator";

type ToolItem = {
  id: ExperienceId;
  icon: string;
  title: string;
  description: string;
  available: boolean;
};

const TOOLS: ToolItem[] = [
  {
    id: "retro-party",
    icon: "🕹️",
    title: "Retro Party",
    description: "Multiplayer retro board game for team retros.",
    available: true,
  },
  {
    id: "draw-duel",
    icon: "✏️",
    title: "Draw Duel",
    description: "Fast drawing duel for icebreaker warm-up.",
    available: false,
  },
  {
    id: "agile-radar",
    icon: "📡",
    title: "Agile Radar",
    description: "Team maturity radar and discussion starter.",
    available: false,
  },
  {
    id: "retro-generator",
    icon: "🧩",
    title: "Retro Generator",
    description: "Generate facilitation-ready retrospective formats.",
    available: false,
  },
];

interface SelectExperienceScreenProps {
  onSelect: (experience: ExperienceId) => void;
  onBack: () => void;
}

export const SelectExperienceScreen: React.FC<SelectExperienceScreenProps> = ({
  onSelect,
  onBack,
}) => {
  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />

      <div className="relative z-10 w-full max-w-5xl rounded border border-cyan-300/60 bg-card/88 p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>Retro Agile Toolbox</span>
          <span>Select Experience</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          Select your experience
        </h1>
        <p className="mt-2 text-center text-sm text-slate-300">
          Choose a tool or game to continue.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelect(tool.id)}
              className={cn(
                "rounded-md border p-4 text-left transition",
                "border-cyan-300/35 bg-slate-900/45 hover:border-cyan-300 hover:bg-slate-900/70",
                !tool.available && "opacity-85"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl">{tool.icon}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                    tool.available
                      ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border border-amber-400/40 bg-amber-500/10 text-amber-200"
                  )}
                >
                  {tool.available ? "Ready" : "Soon"}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-cyan-100">{tool.title}</div>
              <div className="mt-1 text-xs text-slate-300">{tool.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <Button
            type="button"
            variant="secondary"
            className="border-border/70 bg-background/50 text-foreground hover:bg-background/70"
            onClick={onBack}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
};
