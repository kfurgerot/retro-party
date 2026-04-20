import React from "react";
import { cn } from "@/lib/utils";

interface ShopItemCardProps {
  title: string;
  description: string;
  costLabel: string;
  buyLabel: string;
  canBuy: boolean;
  canInteract: boolean;
  onBuy: () => void;
  buyButtonClass: string;
}

export const ShopItemCard: React.FC<ShopItemCardProps> = ({
  title,
  description,
  costLabel,
  buyLabel,
  canBuy,
  canInteract,
  onBuy,
  buyButtonClass,
}) => {
  return (
    <div className="rounded-xl border border-pink-400/25 bg-slate-900/55 p-3 shadow-[0_0_0_1px_rgba(236,72,153,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-xs text-slate-300">{description}</div>
        </div>
        <div className="text-sm font-bold text-amber-300">{costLabel}</div>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={!canInteract || !canBuy}
          className={cn(
            "rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
            canInteract && canBuy
              ? buyButtonClass
              : "cursor-not-allowed border-slate-500 bg-slate-700/60 text-slate-300",
          )}
          onClick={onBuy}
        >
          {buyLabel}
        </button>
      </div>
    </div>
  );
};
