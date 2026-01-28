import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getPlayerBoardKey, BOARD_KEYS } from '@/data/keyboardMappings';

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled?: boolean;
  playerIndex?: number;
}

const DiceFace: React.FC<{ value: number }> = ({ value }) => {
  const dotPositions: Record<number, string[]> = {
    1: ['top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'],
    2: ['top-3 right-3', 'bottom-3 left-3'],
    3: ['top-3 right-3', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-3 left-3'],
    4: ['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'],
    5: ['top-3 left-3', 'top-3 right-3', 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-3 left-3', 'bottom-3 right-3'],
    6: ['top-3 left-3', 'top-3 right-3', 'top-1/2 left-3 -translate-y-1/2', 'top-1/2 right-3 -translate-y-1/2', 'bottom-3 left-3', 'bottom-3 right-3'],
  };

  return (
    <div className="relative w-20 h-20 bg-foreground border-4 border-primary">
      {dotPositions[value]?.map((pos, i) => (
        <div
          key={i}
          className={cn(
            'absolute w-4 h-4 bg-background',
            pos
          )}
        />
      ))}
    </div>
  );
};

export const Dice: React.FC<DiceProps> = ({ value, isRolling, onRoll, disabled, playerIndex = 0 }) => {
  const playerKey = getPlayerBoardKey(playerIndex);
  
  // Keyboard support
  useEffect(() => {
    if (disabled || isRolling) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const expectedKey = BOARD_KEYS[playerIndex];
      
      if (key === expectedKey) {
        e.preventDefault();
        onRoll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isRolling, onRoll, playerIndex]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={cn(
          'transition-transform',
          isRolling && 'animate-dice-roll'
        )}
      >
        <DiceFace value={value || 1} />
      </div>
      <button
        onClick={onRoll}
        disabled={disabled || isRolling}
        className={cn(
          'px-6 py-3 font-pixel text-xs uppercase',
          'bg-accent text-accent-foreground border-4 border-accent',
          'shadow-[4px_4px_0px_rgba(0,0,0,0.5)]',
          'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.5)]',
          'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0',
          isRolling && 'animate-pixel-pulse'
        )}
      >
        {isRolling ? 'Rolling...' : `Lancer [${playerKey}]`}
      </button>
    </div>
  );
};
