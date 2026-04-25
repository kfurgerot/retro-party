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
import { ChoiceCard } from "./hud";
import { SESSION_DIALOG_CONTENT } from "@/lib/uiTokens";

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
      <AlertDialogContent className={cn(SESSION_DIALOG_CONTENT, "max-w-2xl")}>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-violet-300/70 bg-violet-50 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-violet-800">
            <span className="text-base leading-none">🧰</span>
            <span>Item avant lancer</span>
          </div>
          <AlertDialogTitle className="text-center text-2xl">
            {fr.preRollChoice.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-[#647067]">
            {fr.preRollChoice.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl border border-[#d8e2d9] bg-white/58 p-2">
          <div className="mb-2 flex items-center justify-between px-1 text-xs uppercase tracking-[0.12em] text-[#647067]">
            <span>Items disponibles</span>
            {selectedType ? (
              <span className="rounded-md border border-violet-300/70 bg-violet-50 px-2 py-0.5 text-violet-800">
                1 selection
              </span>
            ) : null}
          </div>
          <div className="grid max-h-[50vh] gap-2 overflow-auto pr-1">
            {items.map((item) => {
              const isSelected = selectedType === item.type;
              return (
                <ChoiceCard
                  key={item.type}
                  title={item.label}
                  description={item.description}
                  quantityLabel={`x${item.count}`}
                  selected={isSelected}
                  disabled={!canInteract}
                  onClick={() => onSelectType(item.type)}
                />
              );
            })}
          </div>
        </div>

        <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
          <AlertDialogCancel
            className={cn(neutralBtnClass, "h-11 w-full rounded-xl text-[#24443d]")}
            disabled={!canInteract}
            onClick={onContinue}
          >
            {fr.preRollChoice.continue}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(activeBtnClass, "h-11 w-full rounded-xl")}
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
