import React from "react";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  title: string;
  description: string;
  quantityLabel?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  title,
  description,
  quantityLabel,
  selected = false,
  disabled = false,
  onClick,
}) => {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      disabled={onClick ? disabled : undefined}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        selected ? "border-cyan-300 bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]" : "border-cyan-300/25 bg-slate-900/55",
        disabled && "cursor-not-allowed opacity-60"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-cyan-50">{title}</div>
          <div className="mt-1 text-xs text-slate-300">{description}</div>
        </div>
        {quantityLabel ? <div className="text-sm font-bold text-cyan-200">{quantityLabel}</div> : null}
      </div>
    </Comp>
  );
};

