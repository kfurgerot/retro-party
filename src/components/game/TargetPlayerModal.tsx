import React from "react";
import { Player, ShopCatalogItem } from "@/types/game";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

interface TargetPlayerModalProps {
  open: boolean;
  action?: ShopCatalogItem | null;
  players: Player[];
  onSelect: (targetPlayerId: string) => void;
  onCancel: () => void;
  neutralBtnClass: string;
}

export const TargetPlayerModal: React.FC<TargetPlayerModalProps> = ({
  open,
  action,
  players,
  onSelect,
  onCancel,
  neutralBtnClass,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50">
        <AlertDialogHeader>
          <AlertDialogTitle>{fr.targetPlayerModal.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-300">
            {fr.targetPlayerModal.description.replace("{action}", action?.label ?? fr.targetPlayerModal.actionFallback)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              className="rounded border border-cyan-300/25 bg-slate-900/55 px-3 py-2 text-left hover:bg-slate-800/65"
              onClick={() => onSelect(player.id)}
            >
              <span className="text-sm font-semibold">{player.name}</span>
              <span className="ml-2 text-xs text-slate-300">
                {fr.targetPlayerModal.pointsLabel} {player.points ?? 0} | {fr.targetPlayerModal.kudoLabel} {player.stars}
              </span>
            </button>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className={cn(neutralBtnClass, "text-cyan-100")} onClick={onCancel}>
            {fr.targetPlayerModal.cancel}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
