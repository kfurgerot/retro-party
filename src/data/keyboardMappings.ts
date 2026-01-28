// Keyboard mappings for Rétro Party
// Board: 1 button per player
// Minigames: 2 buttons per player

export const BOARD_KEYS: Record<number, string> = {
  0: 'a', // Player 1
  1: 's', // Player 2
  2: 'd', // Player 3
  3: 'f', // Player 4
  4: 'g', // Player 5
  5: 'h', // Player 6
  6: 'j', // Player 7
  7: 'k', // Player 8
  8: 'l', // Player 9
  9: ';', // Player 10
};

export const MINIGAME_KEYS: Record<number, [string, string]> = {
  0: ['q', 'w'], // Player 1
  1: ['e', 'r'], // Player 2
  2: ['t', 'y'], // Player 3
  3: ['u', 'i'], // Player 4
  4: ['o', 'p'], // Player 5
  5: ['z', 'x'], // Player 6
  6: ['c', 'v'], // Player 7
  7: ['b', 'n'], // Player 8
  8: ['m', ','], // Player 9
  9: ['.', '/'], // Player 10
};

export const getPlayerBoardKey = (playerIndex: number): string => {
  return BOARD_KEYS[playerIndex]?.toUpperCase() || '?';
};

export const getPlayerMinigameKeys = (playerIndex: number): [string, string] => {
  const keys = MINIGAME_KEYS[playerIndex];
  return keys ? [keys[0].toUpperCase(), keys[1].toUpperCase()] : ['?', '?'];
};
