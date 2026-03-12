export type UIMode = "legacy" | "modern";

// P3 foundation: global visual direction switch.
// Keep "modern" by default while allowing controlled rollback if needed.
export const UI_MODE: UIMode = "modern";

// P3 board rollout: keep isolated to frontend presentation.
// Disabled by default to preserve the classic board-game movement feel.
// Opt-in only via env: VITE_ENABLE_BOARD_V2=1
export const ENABLE_BOARD_V2 = import.meta.env.VITE_ENABLE_BOARD_V2 === "1";
