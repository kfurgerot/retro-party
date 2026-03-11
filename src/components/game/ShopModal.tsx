import React from "react";
import { ShopCatalogItem } from "@/types/game";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

interface ShopModalProps {
  open: boolean;
  canInteract: boolean;
  points: number;
  items: ShopCatalogItem[];
  onBuy: (type: ShopCatalogItem["type"]) => void;
  onClose: () => void;
  activeBtnClass: string;
  neutralBtnClass: string;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  open,
  canInteract,
  points,
  items,
  onBuy,
  onClose,
  activeBtnClass,
  neutralBtnClass,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50 max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{fr.shopModal.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {fr.shopModal.availablePoints}: <span className="font-semibold text-cyan-200">{points}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2 max-h-[55vh] overflow-auto pr-1">
          {items.map((item) => {
            const canAfford = points >= item.cost;
            return (
              <div key={item.type} className="rounded-md border border-cyan-300/25 bg-slate-900/55 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-slate-300 mt-1">{item.description}</div>
                  </div>
                  <div className="text-sm font-bold text-amber-300">{item.cost} {fr.shopModal.pointsUnit}</div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={!canInteract || !canAfford}
                    className={cn(
                      "px-3 py-1 rounded border text-xs font-semibold",
                      canInteract && canAfford
                        ? activeBtnClass
                        : "border-slate-500 bg-slate-700/60 text-slate-300 cursor-not-allowed"
                    )}
                    onClick={() => onBuy(item.type)}
                  >
                    {fr.shopModal.buy}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className={cn(neutralBtnClass, "text-cyan-100")} onClick={onClose}>
            {fr.shopModal.continue}
          </AlertDialogCancel>
          <AlertDialogAction className={activeBtnClass} onClick={onClose}>
            {fr.shopModal.close}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
