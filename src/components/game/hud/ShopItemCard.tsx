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
    <div className="rounded-xl border border-[#d8e2d9] bg-white/62 p-3 shadow-[0_0_0_1px_rgba(236,72,153,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#18211f]">{title}</div>
          <div className="mt-1 text-xs text-[#647067]">{description}</div>
        </div>
        <div className="text-sm font-bold text-amber-900">{costLabel}</div>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={!canInteract || !canBuy}
          className={cn(
            "rounded-xl border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f3]",
            canInteract && canBuy
              ? buyButtonClass
              : "cursor-not-allowed border-[#d8e2d9] bg-white/62 text-[#647067]",
          )}
          onClick={onBuy}
        >
          {buyLabel}
        </button>
      </div>
    </div>
  );
};
