export type UIMode = "legacy" | "modern";

// P3 foundation: global visual direction switch.
// Keep "modern" by default while allowing controlled rollback if needed.
export const UI_MODE: UIMode = "modern";
