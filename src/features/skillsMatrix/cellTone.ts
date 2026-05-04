export type MatrixCellTone = {
  surfaceClass: string;
  valueClass: string;
  badgeClass: string;
  badgeLabel: string;
};

export function resolveMatrixCellTone(
  currentLevel: number | null,
  requiredLevel: number,
): MatrixCellTone {
  if (!Number.isFinite(currentLevel)) {
    return {
      surfaceClass: "border-slate-500/30 bg-slate-500/10",
      valueClass: "text-slate-200",
      badgeClass: "border-slate-400/30 bg-slate-500/15 text-slate-200",
      badgeLabel: "Non renseigné",
    };
  }

  const gap = Number(currentLevel) - requiredLevel;
  if (gap <= -2) {
    return {
      surfaceClass: "border-rose-400/40 bg-rose-500/15",
      valueClass: "text-rose-100",
      badgeClass: "border-rose-300/40 bg-rose-600/20 text-rose-100",
      badgeLabel: "Lacune critique",
    };
  }
  if (gap === -1) {
    return {
      surfaceClass: "border-orange-300/40 bg-orange-500/15",
      valueClass: "text-orange-100",
      badgeClass: "border-orange-200/40 bg-orange-600/20 text-orange-100",
      badgeLabel: "Lacune",
    };
  }
  if (gap === 0) {
    return {
      surfaceClass: "border-yellow-300/40 bg-yellow-500/15",
      valueClass: "text-yellow-100",
      badgeClass: "border-yellow-200/40 bg-yellow-600/20 text-yellow-100",
      badgeLabel: "Cible atteinte",
    };
  }
  if (gap === 1) {
    return {
      surfaceClass: "border-lime-300/40 bg-lime-500/15",
      valueClass: "text-lime-100",
      badgeClass: "border-lime-200/40 bg-lime-600/20 text-lime-100",
      badgeLabel: "Force",
    };
  }
  return {
    surfaceClass: "border-emerald-300/40 bg-emerald-500/15",
    valueClass: "text-emerald-100",
    badgeClass: "border-emerald-200/40 bg-emerald-600/20 text-emerald-100",
    badgeLabel: "Force forte",
  };
}
