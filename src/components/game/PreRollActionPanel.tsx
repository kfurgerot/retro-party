import React from "react";
import { ShopCatalogItem, ShopItemInstance } from "@/types/game";
import { cn } from "@/lib/utils";

interface PreRollActionPanelProps {
  open: boolean;
  inventory: ShopItemInstance[];
  catalogByType: Record<string, ShopCatalogItem>;
  canUseAction: boolean;
  onUse: (item: ShopItemInstance) => void;
  onPass: () => void;
  activeBtnClass: string;
  neutralBtnClass: string;
}

export const PreRollActionPanel: React.FC<PreRollActionPanelProps> = ({
  open,
  inventory,
  catalogByType,
  canUseAction,
  onUse,
  onPass,
  activeBtnClass,
  neutralBtnClass,
}) => {
  if (!open) return null;

  return (
    <div className="mt-2 rounded-md border border-cyan-300/30 bg-slate-900/55 p-2 shadow-[0_0_16px_rgba(34,211,238,0.1)]">
      <div className="text-xs uppercase tracking-[0.1em] text-cyan-100/75">Actions avant lancer</div>
      {inventory.length === 0 ? (
        <div className="mt-1 text-xs text-slate-300">Aucune action en inventaire.</div>
      ) : (
        <div className="mt-1 grid gap-1 max-h-32 overflow-auto pr-1">
          {inventory.map((item) => {
            const def = catalogByType[item.type];
            if (!def) return null;
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-cyan-300/20 bg-slate-800/60 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{def.label}</div>
                  <div className="truncate text-[10px] text-slate-300">{def.description}</div>
                </div>
                <button
                  type="button"
                  className={cn(
                    "shrink-0 rounded border px-2 py-1 text-[11px] font-semibold",
                    canUseAction ? activeBtnClass : "border-slate-500 bg-slate-700/60 text-slate-300 cursor-not-allowed"
                  )}
                  disabled={!canUseAction}
                  onClick={() => onUse(item)}
                >
                  Utiliser
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" className={cn("rounded border px-3 py-1 text-xs font-semibold", neutralBtnClass)} onClick={onPass}>
          Passer
        </button>
      </div>
    </div>
  );
};
