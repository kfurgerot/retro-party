export const PIXI_GAME_THEME = {
  panel: {
    width: 204,
    height: 126,
    x: -102,
    y: -118,
    radius: 12,
    border: 0x67e8f9,
    borderAlpha: 0.45,
    fill: 0x0f172a,
    fillAlpha: 0.9,
    separatorY: -26,
    separatorHalfWidth: 84,
  },
  button: {
    width: 168,
    height: 42,
    radius: 10,
    y: -2,
  },
  face: {
    x: -32,
    y: -95,
    width: 64,
    height: 64,
    radius: 8,
  },
  colors: {
    ink: 0x0f172a,
    white: 0xffffff,
    slateLight: 0xe2e8f0,
    slateMedium: 0x64748b,
    cyan: 0x06b6d4,
    cyanHover: 0x22d3ee,
    cyanPressed: 0x0891b2,
  },
  text: {
    actionSize: 7,
    diceSizeSingle: 18,
    diceSizeDouble: 14,
  },
} as const;

export const ACTION_OVERLAY_HITBOX = {
  halfWidth: PIXI_GAME_THEME.panel.width / 2,
  topY: PIXI_GAME_THEME.panel.y,
  bottomY: 19,
  safePadding: 8,
} as const;
