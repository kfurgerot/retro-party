import React from "react";
import { ShopCatalogItem, ShopItemInstance, ShopItemType } from "@/types/game";
import { cn } from "@/lib/utils";

type GroupedItem = {
  type: ShopItemType;
  count: number;
  label: string;
  description: string;
};

interface PreRollActionPanelProps {
  open: boolean;
  inventory: ShopItemInstance[];
  catalogByType: Record<string, ShopCatalogItem>;
  canUseAction: boolean;
  canRoll: boolean;
  onUseType: (itemType: ShopItemType) => void;
  onRoll: () => void;
  activeBtnClass: string;
  neutralBtnClass: string;
}

export const PreRollActionPanel: React.FC<PreRollActionPanelProps> = ({
  open,
  inventory,
  catalogByType,
  canUseAction,
  canRoll,
  onUseType,
  onRoll,
  activeBtnClass,
  neutralBtnClass,
}) => {
  if (!open) return null;

  const groupedMap = new Map<ShopItemType, GroupedItem>();
  for (const item of inventory) {
    const def = catalogByType[item.type];
    if (!def || def.timing !== "before_roll") continue;
    const existing = groupedMap.get(item.type);
    if (existing) {
      existing.count += 1;
    } else {
      groupedMap.set(item.type, {
        type: item.type,
        count: 1,
        label: def.label,
        description: def.description,
      });
    }
  }

  const groupedItems = [...groupedMap.values()];

  return (
    <div className="mt-2 rounded-md border border-[#d8e2d9] bg-white/62 p-2 shadow-[0_0_16px_rgba(34,211,238,0.1)]">
      <div className="text-xs uppercase tracking-[0.1em] text-[#647067]">Debut du tour</div>
      <div className="mt-1 text-xs text-[#24443d]">
        Tu peux lancer normalement ou utiliser un objet.
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "rounded border px-3 py-1.5 text-xs font-semibold",
            canRoll
              ? activeBtnClass
              : "cursor-not-allowed border-[#d8e2d9] bg-white/62 text-[#647067]",
          )}
          disabled={!canRoll}
          onClick={onRoll}
        >
          Lancer le dé
        </button>

        {groupedItems.map((item) => (
          <button
            key={item.type}
            type="button"
            className={cn(
              "rounded border px-3 py-1.5 text-xs font-semibold",
              canUseAction
                ? neutralBtnClass
                : "cursor-not-allowed border-[#d8e2d9] bg-white/62 text-[#647067]",
            )}
            disabled={!canUseAction}
            onClick={() => onUseType(item.type)}
            title={item.description}
          >
            {item.label} (x{item.count})
          </button>
        ))}
      </div>
    </div>
  );
};
