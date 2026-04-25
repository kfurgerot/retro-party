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
import { ShopItemCard } from "./hud";
import { SESSION_DIALOG_CONTENT } from "@/lib/uiTokens";

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
      <AlertDialogContent className={cn(SESSION_DIALOG_CONTENT, "max-w-2xl")}>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-orange-300/70 bg-orange-50 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-orange-800">
            <span className="text-base leading-none">🛒</span>
            <span>Boutique</span>
          </div>
          <AlertDialogTitle className="text-center text-2xl">{fr.shopModal.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-[#647067]">
            {fr.shopModal.availablePoints}
            <span className="ml-2 inline-flex items-center rounded-lg border border-[#163832]/35 bg-[#edf5ef] px-2 py-0.5 font-semibold text-[#24443d]">
              {points} {fr.shopModal.pointsUnit}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border border-[#d8e2d9] bg-white/58 p-2">
          <div className="mb-2 px-1 text-xs uppercase tracking-[0.12em] text-[#647067]">
            Articles disponibles
          </div>
          <div className="grid max-h-[52vh] gap-2 overflow-auto pr-1">
            {items.map((item) => {
              const canAfford = points >= item.cost;
              return (
                <ShopItemCard
                  key={item.type}
                  title={item.label}
                  description={item.description}
                  costLabel={`${item.cost} ${fr.shopModal.pointsUnit}`}
                  buyLabel={fr.shopModal.buy}
                  canBuy={canAfford}
                  canInteract={canInteract}
                  onBuy={() => onBuy(item.type)}
                  buyButtonClass={activeBtnClass}
                />
              );
            })}
          </div>
        </div>
        <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
          <AlertDialogCancel
            className={cn(neutralBtnClass, "h-11 w-full rounded-xl text-[#24443d]")}
            onClick={onClose}
          >
            {fr.shopModal.continue}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(activeBtnClass, "h-11 w-full rounded-xl")}
            onClick={onClose}
          >
            {fr.shopModal.close}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
