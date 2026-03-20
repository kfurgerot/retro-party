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
