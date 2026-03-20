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

export const APP_SHELL_SURFACE =
  `${GAME_UI_THEME.radius.panel} border ${GAME_UI_THEME.palette.border} ${GAME_UI_THEME.palette.panel} backdrop-blur ${GAME_UI_THEME.shadow.panel}`;

export const APP_SHELL_SURFACE_SOFT =
  `${GAME_UI_THEME.radius.panel} border border-cyan-300/18 ${GAME_UI_THEME.palette.panelSoft} backdrop-blur-sm`;

export const APP_SHELL_INPUT =
  "h-11 rounded-xl border border-cyan-300/25 bg-slate-900/60 text-cyan-50 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";

export const CTA_NEON_PRIMARY =
  `border-cyan-300 ${GAME_UI_THEME.palette.primary} text-slate-950 ${GAME_UI_THEME.shadow.button} ${GAME_UI_THEME.palette.primaryHover}`;

export const CTA_NEON_SECONDARY =
  `border-cyan-300/50 ${GAME_UI_THEME.palette.secondary} text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)] ${GAME_UI_THEME.palette.secondaryHover} hover:text-cyan-50`;

export const CTA_NEON_SECONDARY_SUBTLE =
  "border-cyan-300/20 bg-slate-900/45 text-cyan-100 hover:bg-slate-900/70";

export const CTA_NEON_DANGER = GAME_UI_THEME.palette.danger;
