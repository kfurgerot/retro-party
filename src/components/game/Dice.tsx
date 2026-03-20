import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { BOARD_KEYS } from "@/data/keyboardMappings";
import { RollResult } from "@/types/game";
import { fr } from "@/i18n/fr";

interface DiceProps {
  value: number | null;
  rollResult?: RollResult | null;
  pendingDoubleRollFirstDie?: number | null;
  isRolling: boolean;

  canRoll: boolean;
  canMove: boolean;
  canOpenQuestionCard?: boolean;

  onRoll: () => void;
  onMove: (steps: number) => void;
  onOpenQuestionCard?: () => void;

  playerIndex?: number;
  compact?: boolean;
  showCompactDetails?: boolean;
}

const DiceFace: React.FC<{ value: number }> = ({ value }) => {
  const dotPositions: Record<number, string[]> = {
    1: ["top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"],
    2: ["top-3 right-3", "bottom-3 left-3"],
    3: [
      "top-3 right-3",
      "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-3 left-3",
    ],
    4: ["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"],
    5: [
      "top-3 left-3",
      "top-3 right-3",
      "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-3 left-3",
      "bottom-3 right-3",
    ],
    6: [
      "top-2 left-3",
      "top-2 right-3",
      "top-1/2 left-3 -translate-y-1/2",
      "top-1/2 right-3 -translate-y-1/2",
      "bottom-2 left-3",
      "bottom-2 right-3",
    ],
  };

  if (!dotPositions[value]) {
    return (
      <div className="relative w-20 h-20 bg-foreground border-4 border-primary flex items-center justify-center">
        <span className="font-pixel text-base text-background">{value}</span>
      </div>
    );
  }

  return (
    <div className="relative w-20 h-20 bg-foreground border-4 border-primary">
      {dotPositions[value]?.map((pos, i) => (
        <div key={i} className={cn("absolute w-3 h-3 rounded-full bg-background", pos)} />
      ))}
    </div>
  );
};

const CardFace: React.FC = () => {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center border-4 border-primary bg-foreground">
      <div className="absolute inset-1 border-2 border-primary/60" />
      <span className="font-pixel text-[10px] text-background">CARTE</span>
      <span className="absolute right-1 top-1 text-[10px] text-background">★</span>
      <span className="absolute bottom-1 left-1 text-[10px] text-background">★</span>
    </div>
  );
};

const DiceComponent: React.FC<DiceProps> = ({
  value,
  rollResult = null,
  pendingDoubleRollFirstDie = null,
  isRolling,
  canRoll,
  canMove,
  canOpenQuestionCard = false,
  onRoll,
  onMove,
  onOpenQuestionCard,
  playerIndex = 0,
  compact = false,
  showCompactDetails = false,
}) => {
  const [lastRolledValue, setLastRolledValue] = React.useState<number>(1);

  useEffect(() => {
    if (value != null) setLastRolledValue(value);
  }, [value]);

  useEffect(() => {
    if (!rollResult || !Array.isArray(rollResult.dice) || rollResult.dice.length === 0) return;
    const latestDie = rollResult.dice[rollResult.dice.length - 1];
    if (Number.isFinite(latestDie)) setLastRolledValue(latestDie);
  }, [rollResult]);

  const canOpen = canOpenQuestionCard && !!onOpenQuestionCard;
  const hasInvalidRollResult = !!rollResult && (!Array.isArray(rollResult.dice) || rollResult.dice.length === 0);

  const disabled = !canRoll && !canMove && !canOpen;
  const showCardFace = canOpen && !canRoll && !canMove && !isRolling;

  const handleAction = () => {
    if (canRoll) return onRoll();
    if (canMove && value != null) return onMove(value);
    if (canOpen) return onOpenQuestionCard();
  };

  const label = (() => {
    if (isRolling) return `${fr.dice.rollShort}...`;
    if (canRoll && pendingDoubleRollFirstDie != null) return fr.dice.rollShortSecond;
    if (canRoll) return fr.dice.rollShort;
    if (canMove && value != null) return `${fr.dice.moveShort} (${value})`;
    if (canOpen) return fr.dice.openShort;
    return fr.dice.waitingShort;
  })();

  const rollDetails = (() => {
    if (pendingDoubleRollFirstDie != null && (!rollResult || rollResult.dice.length <= 1)) {
      return [fr.dice.movementAppliedPending];
    }

    if (!rollResult) return null;

    if (rollResult.effectType === "double_roll") {
      return [fr.dice.movementApplied.replace("{total}", String(rollResult.total))];
    }

    if (rollResult.effectType === "plus_two_roll") {
      return [fr.dice.movementApplied.replace("{total}", String(rollResult.total))];
    }

    return [fr.dice.movementApplied.replace("{total}", String(rollResult.total))];
  })();

  useEffect(() => {
    if (disabled || isRolling) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const expectedKey = BOARD_KEYS[playerIndex];

      if (key === expectedKey) {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, isRolling, canRoll, canMove, canOpen, value, playerIndex]);

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-2" : "gap-4")}>
      <div className={cn("transition-transform", isRolling && "animate-dice-roll")}>
        {showCardFace ? <CardFace /> : <DiceFace value={value ?? lastRolledValue} />}
      </div>

      <button
        onClick={handleAction}
        disabled={disabled}
        className={cn(
          compact
            ? "px-4 py-2 text-[11px] font-semibold uppercase"
            : "px-6 py-3 font-pixel text-xs uppercase",
          "bg-accent text-accent-foreground border-4 border-accent",
          "shadow-[4px_4px_0px_rgba(0,0,0,0.5)]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.5)]",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0",
          isRolling && "animate-pixel-pulse"
        )}
      >
        {label}
      </button>

      {rollDetails && (!compact || showCompactDetails) && (
        <div className={cn("text-cyan-100 text-center", compact ? "text-[10px]" : "text-xs")}>
          {rollDetails.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {import.meta.env.DEV && hasInvalidRollResult && (
        <div className="text-[10px] text-rose-300">{fr.dice.invalidRollResult}</div>
      )}
    </div>
  );
};

export const Dice = React.memo(DiceComponent);
Dice.displayName = "Dice";
