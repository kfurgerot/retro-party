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
import { GAME_DIALOG_CONTENT } from "@/lib/uiTokens";

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
      <AlertDialogContent className={cn(GAME_DIALOG_CONTENT, "max-w-2xl")}>
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

        <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
          <AlertDialogCancel
            className={cn(neutralBtnClass, "h-11 w-full rounded-xl text-cyan-100")}
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
