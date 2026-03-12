import React from "react";
import { ShopItemType } from "@/types/game";
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

type ItemChoice = {
  type: ShopItemType;
  count: number;
  label: string;
  description: string;
};

interface PreRollChoiceModalProps {
  open: boolean;
  canInteract: boolean;
  items: ItemChoice[];
  selectedType: ShopItemType | null;
  onSelectType: (itemType: ShopItemType) => void;
  onConfirmSelection: () => void;
  onContinue: () => void;
  activeBtnClass: string;
  neutralBtnClass: string;
}

export const PreRollChoiceModal: React.FC<PreRollChoiceModalProps> = ({
  open,
  canInteract,
  items,
  selectedType,
  onSelectType,
  onConfirmSelection,
  onContinue,
  activeBtnClass,
  neutralBtnClass,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50 max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{fr.preRollChoice.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {fr.preRollChoice.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 max-h-[50vh] overflow-auto pr-1">
          {items.map((item) => {
            const isSelected = selectedType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                disabled={!canInteract}
                className={cn(
                  "w-full rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                  isSelected
                    ? "border-cyan-300 bg-cyan-500/20"
                    : "border-cyan-300/25 bg-slate-900/55",
                  !canInteract && "cursor-not-allowed opacity-60"
                )}
                onClick={() => onSelectType(item.type)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-slate-300 mt-1">{item.description}</div>
                  </div>
                  <div className="text-sm font-bold text-cyan-200">x{item.count}</div>
                </div>
              </button>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            className={cn(neutralBtnClass, "text-cyan-100")}
            disabled={!canInteract}
            onClick={onContinue}
          >
            {fr.preRollChoice.continue}
          </AlertDialogCancel>
          <AlertDialogAction
            className={activeBtnClass}
            disabled={!canInteract || !selectedType}
            onClick={onConfirmSelection}
          >
            {fr.preRollChoice.useItem}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
