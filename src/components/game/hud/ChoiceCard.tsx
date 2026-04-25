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
        "w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]",
        selected
          ? "border-pink-400 bg-[#edf5ef] shadow-[0_0_0_1px_rgba(236,72,153,0.24)]"
          : "border-[#d8e2d9] bg-white/62",
        disabled && "cursor-not-allowed opacity-60",
        !disabled && "hover:border-[#163832]/35 hover:bg-white/78",
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#18211f]">{title}</div>
          <div className="mt-1 text-xs text-[#647067]">{description}</div>
        </div>
        {quantityLabel ? (
          <div className="text-sm font-bold text-[#24443d]">{quantityLabel}</div>
        ) : null}
      </div>
    </Comp>
  );
};
