import React from "react";
import { cn } from "@/lib/utils";

type ActionBadgeTone =
  | "move"
  | "decision"
  | "question"
  | "shop"
  | "minigame"
  | "system"
  | "active"
  | "next"
  | "neutral";

const toneClass: Record<ActionBadgeTone, string> = {
  move: "border-sky-300/45 bg-sky-50 text-sky-800",
  decision: "border-amber-300/45 bg-amber-50 text-amber-800",
  question: "border-violet-300/45 bg-violet-50 text-violet-800",
  shop: "border-orange-300/45 bg-orange-50 text-orange-800",
  minigame: "border-emerald-300/45 bg-emerald-50 text-emerald-800",
  system: "border-[#d8e2d9] bg-white/62 text-[#647067]",
  active: "border-[#163832]/35 bg-[#edf5ef] text-[#163832]",
  next: "border-emerald-300/45 bg-emerald-50 text-emerald-800",
  neutral: "border-[#d8e2d9] bg-white/62 text-[#647067]",
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
        className,
      )}
    >
      {label}
    </span>
  );
};
