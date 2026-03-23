export const POKER_WORLD = {
  width: 1000,
  height: 620,
} as const;

export const POKER_THEME = {
  bg: {
    frame: 0x020617,
    frameBorder: 0x22d3ee,
  },
  table: {
    shadow: 0x020617,
    rimOuter: 0x334155,
    rimInner: 0x1f2937,
    felt: 0x115e59,
    feltAccent: 0x0f766e,
    line: 0x67e8f9,
  },
  seat: {
    offline: 0xf59e0b,
    online: 0x67e8f9,
    meFill: 0x164e63,
    defaultFill: 0x0f172a,
    text: 0xe2e8f0,
    badge: 0x99f6e4,
  },
  center: {
    panel: 0x0f172a,
    border: 0x67e8f9,
    title: 0xcffafe,
    body: 0xe2e8f0,
  },
} as const;

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function seeded(index: number) {
  const x = Math.sin(index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
