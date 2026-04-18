export const GAME_UI_THEME = {
  palette: {
    bg: "bg-slate-950",
    panel: "bg-slate-900/55",
    panelSoft: "bg-slate-950/35",
    textPrimary: "text-cyan-50",
    textSecondary: "text-cyan-100/85",
    textMuted: "text-slate-300",
    border: "border-cyan-300/25",
    borderStrong: "border-cyan-300/45",
    primary: "bg-cyan-500",
    primaryHover: "hover:bg-cyan-400",
    secondary: "bg-cyan-500/15",
    secondaryHover: "hover:bg-cyan-500/25",
    success: "bg-emerald-500/18 text-emerald-100 border-emerald-300/45",
    danger: "bg-rose-500 text-white border-rose-300 hover:bg-rose-400",
    info: "bg-sky-500/18 text-sky-100 border-sky-300/45",
    accent: "bg-amber-500/18 text-amber-100 border-amber-300/45",
  },
  typography: {
    title: "text-2xl font-semibold tracking-tight",
    sectionTitle: "text-sm font-semibold uppercase tracking-[0.14em]",
    body: "text-sm leading-relaxed",
    caption: "text-xs tracking-[0.08em]",
  },
  spacing: {
    touch: "min-h-11 px-4",
    block: "p-4 sm:p-5",
    compact: "p-2 sm:p-3",
  },
  radius: {
    panel: "rounded-xl",
    button: "rounded-xl",
    chip: "rounded-full",
  },
  shadow: {
    panel: "shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_12px_32px_rgba(8,47,73,0.35)]",
    button: "shadow-[0_0_0_2px_rgba(34,211,238,0.28)]",
  },
} as const;

// Portal-aligned shell tokens (used by pre-game screens)
export const APP_SHELL_SURFACE =
  "rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur";

export const APP_SHELL_SURFACE_SOFT =
  "rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm";

export const APP_SHELL_INPUT =
  "h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-100 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-indigo-400/60 focus-visible:border-white/20 transition";

export const CTA_NEON_PRIMARY =
  "border-indigo-400/40 bg-indigo-500 text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] hover:bg-indigo-400";

export const CTA_NEON_SECONDARY =
  "border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white";

export const CTA_NEON_SECONDARY_SUBTLE =
  "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white";

export const CTA_NEON_DANGER = GAME_UI_THEME.palette.danger;

// Per-tool accent colors (shared between Portal and game screens)
export const TOOL_ACCENT = {
  "planning-poker": { color: "#6366f1", glow: "rgba(99,102,241,0.3)", ambientColor: "rgba(99,102,241,0.08)", ambientGlow: "rgba(99,102,241,0.04)" },
  "retro-party":    { color: "#ec4899", glow: "rgba(236,72,153,0.3)",  ambientColor: "rgba(236,72,153,0.08)",  ambientGlow: "rgba(99,102,241,0.04)" },
  "radar-party":    { color: "#10b981", glow: "rgba(16,185,129,0.3)",  ambientColor: "rgba(16,185,129,0.08)",  ambientGlow: "rgba(16,185,129,0.04)" },
} as const;

export type ToolAccentKey = keyof typeof TOOL_ACCENT;

export const GAME_DRAWER_CONTENT =
  "border-cyan-300/30 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] text-cyan-50 lg:hidden";

export const GAME_DRAWER_CLOSE_BUTTON =
  "h-10 text-cyan-100 hover:bg-slate-800/60 hover:text-cyan-50";

export const GAME_DIALOG_CONTENT =
  "rounded-2xl border-cyan-300/40 bg-slate-950/95 p-5 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_14px_40px_rgba(2,6,23,0.6)] sm:p-6";

export const GAME_MOBILE_ACTION_BUTTON =
  "h-12 w-full rounded-xl";

export const GAME_HUD_SURFACE =
  "rounded-2xl border border-cyan-300/32 bg-slate-950/72 text-cyan-50 backdrop-blur shadow-[0_0_0_1px_rgba(34,211,238,0.14),0_10px_26px_rgba(2,6,23,0.45)]";

export const GAME_PANEL_SURFACE =
  "rounded-xl border border-cyan-300/25 bg-slate-900/58 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_8px_24px_rgba(2,6,23,0.34)]";

export const GAME_SUBPANEL_SURFACE =
  "rounded-xl border border-cyan-300/18 bg-slate-950/32";

export const GAME_TAB_BUTTON =
  "h-9 rounded-xl border border-cyan-300/22 bg-slate-900/45 px-3 text-xs font-semibold text-cyan-100 hover:bg-slate-900/65";

export const GAME_TAB_BUTTON_ACTIVE =
  "border-cyan-300/55 bg-cyan-500/20 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.24)]";

export const GAME_SECTION_BADGE =
  "inline-flex rounded-full border border-cyan-300/28 bg-slate-900/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-cyan-100";
