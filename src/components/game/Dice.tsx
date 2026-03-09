import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { getPlayerBoardKey, BOARD_KEYS } from "@/data/keyboardMappings";
import { RollResult } from "@/types/game";

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

export const Dice: React.FC<DiceProps> = ({
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

  const playerKey = getPlayerBoardKey(playerIndex);
  const canOpen = canOpenQuestionCard && !!onOpenQuestionCard;
  const hasInvalidRollResult = !!rollResult && (!Array.isArray(rollResult.dice) || rollResult.dice.length === 0);

  const disabled = !canRoll && !canMove && !canOpen;

  const handleAction = () => {
    if (canRoll) return onRoll();
    if (canMove && value != null) return onMove(value);
    if (canOpen) return onOpenQuestionCard();
  };

  const label = (() => {
    if (isRolling) return "Lancer...";
    if (canRoll && pendingDoubleRollFirstDie != null) return `Lancer De 2 [${playerKey}]`;
    if (canRoll) return `Lancer [${playerKey}]`;
    if (canMove && value != null) return `Avancer (${value})`;
    if (canOpen) return "Ouvrir carte";
    return "Attente";
  })();

  const rollDetails = (() => {
    if (pendingDoubleRollFirstDie != null && (!rollResult || rollResult.dice.length <= 1)) {
      return [
        `De 1: ${pendingDoubleRollFirstDie}`,
        "De 2: en attente...",
        "Total: en attente...",
        "Deplacement applique: en attente...",
      ];
    }

    if (!rollResult) return null;

    if (rollResult.effectType === "double_roll") {
      const [a = 0, b = 0] = rollResult.dice;
      return [
        `De 1: ${a}`,
        `De 2: ${b}`,
        `Total: ${rollResult.total}`,
        `Deplacement applique: ${rollResult.total}`,
      ];
    }

    if (rollResult.effectType === "plus_two_roll") {
      const [a = 0] = rollResult.dice;
      return [
        `De brut: ${a}`,
        `Bonus: +${rollResult.bonus}`,
        `Total: ${rollResult.total}`,
        `Deplacement applique: ${rollResult.total}`,
      ];
    }

    const [a = 0] = rollResult.dice;
    return [
      `De: ${a}`,
      `Total: ${rollResult.total}`,
      `Deplacement applique: ${rollResult.total}`,
    ];
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
    <div className="flex flex-col items-center gap-4">
      <div className={cn("transition-transform", isRolling && "animate-dice-roll")}>
        <DiceFace value={value ?? lastRolledValue} />
      </div>

      <button
        onClick={handleAction}
        disabled={disabled}
        className={cn(
          "px-6 py-3 font-pixel text-xs uppercase",
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

      {rollDetails && (
        <div className="text-xs text-cyan-100 text-center">
          {rollDetails.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {import.meta.env.DEV && hasInvalidRollResult && (
        <div className="text-[10px] text-rose-300">RollResult invalide: dice vide</div>
      )}
    </div>
  );
};
