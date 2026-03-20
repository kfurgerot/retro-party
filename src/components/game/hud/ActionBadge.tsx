import React from "react";
import { cn } from "@/lib/utils";

type ActionBadgeTone = "move" | "decision" | "question" | "shop" | "minigame" | "system" | "active" | "next" | "neutral";

const toneClass: Record<ActionBadgeTone, string> = {
  move: "border-sky-300/35 bg-sky-500/12 text-sky-100",
  decision: "border-amber-300/35 bg-amber-500/12 text-amber-100",
  question: "border-violet-300/35 bg-violet-500/12 text-violet-100",
  shop: "border-orange-300/35 bg-orange-500/12 text-orange-100",
  minigame: "border-emerald-300/35 bg-emerald-500/12 text-emerald-100",
  system: "border-cyan-300/25 bg-slate-900/35 text-cyan-100/85",
  active: "border-cyan-300/45 bg-cyan-500/15 text-cyan-100",
  next: "border-emerald-300/40 bg-emerald-500/12 text-emerald-100",
  neutral: "border-cyan-300/20 bg-slate-900/35 text-slate-200",
};

interface ActionBadgeProps {
  label: string;
  tone: ActionBadgeTone;
  className?: string;
}

export const ActionBadge: React.FC<ActionBadgeProps> = ({ label, tone, className }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]",
        toneClass[tone],
        className
      )}
    >
      {label}
    </span>
  );
};

