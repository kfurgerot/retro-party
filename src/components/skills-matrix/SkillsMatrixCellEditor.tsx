import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { resolveMatrixCellTone } from "@/features/skillsMatrix/cellTone";

export type MatrixCellEditorState = {
  skillId: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number | null;
  targetLevel: number | null;
  wantsToProgress: boolean;
  wantsToMentor: boolean;
};

function LevelSelector({
  value,
  min,
  max,
  requiredLevel,
  onChange,
}: {
  value: number | null;
  min: number;
  max: number;
  requiredLevel?: number;
  onChange: (level: number | null) => void;
}) {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const cols = Math.min(levels.length, 5);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {levels.map((level) => {
        const isSelected = value === level;
        const isRequired = level === requiredLevel;
        const selectedTone =
          isSelected && requiredLevel != null ? resolveMatrixCellTone(level, requiredLevel) : null;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(isSelected ? null : level)}
            className={cn(
              "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-bold transition active:scale-95",
              isSelected
                ? cn(
                    selectedTone?.surfaceClass ?? "border-cyan-300/60 bg-cyan-500/30",
                    selectedTone?.valueClass ?? "text-cyan-100",
                  )
                : isRequired
                  ? "border-white/[0.28] bg-white/[0.06] text-slate-200"
                  : "border-white/[0.1] bg-white/[0.04] text-slate-400 hover:border-white/[0.22] hover:bg-white/[0.08]",
            )}
          >
            {level}
            {isRequired && (
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  isSelected ? "bg-current opacity-60" : "bg-cyan-400",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CellEditorFormBody({
  editingCell,
  scaleMin,
  scaleMax,
  setEditingCell,
}: {
  editingCell: MatrixCellEditorState;
  scaleMin: number;
  scaleMax: number;
  setEditingCell: Dispatch<SetStateAction<MatrixCellEditorState | null>>;
}) {
  const currentTone = resolveMatrixCellTone(editingCell.currentLevel, editingCell.requiredLevel);
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Niveau actuel
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-bold",
              editingCell.currentLevel != null
                ? currentTone.badgeClass
                : "border-slate-400/30 bg-slate-500/15 text-slate-300",
            )}
          >
            {editingCell.currentLevel ?? "Non renseigné"}
          </span>
        </div>
        <LevelSelector
          value={editingCell.currentLevel}
          min={scaleMin}
          max={scaleMax}
          requiredLevel={editingCell.requiredLevel}
          onChange={(level) =>
            setEditingCell((prev) => (prev ? { ...prev, currentLevel: level } : prev))
          }
        />
        {editingCell.currentLevel != null && (
          <button
            type="button"
            onClick={() =>
              setEditingCell((prev) => (prev ? { ...prev, currentLevel: null } : prev))
            }
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Niveau cible (optionnel)
          </span>
          <span className="rounded-full border border-white/[0.14] bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {editingCell.targetLevel ?? "—"}
          </span>
        </div>
        <LevelSelector
          value={editingCell.targetLevel}
          min={scaleMin}
          max={scaleMax}
          requiredLevel={editingCell.requiredLevel}
          onChange={(level) =>
            setEditingCell((prev) => (prev ? { ...prev, targetLevel: level } : prev))
          }
        />
        {editingCell.targetLevel != null && (
          <button
            type="button"
            onClick={() => setEditingCell((prev) => (prev ? { ...prev, targetLevel: null } : prev))}
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={editingCell.wantsToProgress}
            onChange={(event) =>
              setEditingCell((prev) =>
                prev ? { ...prev, wantsToProgress: event.target.checked } : prev,
              )
            }
            className="h-4 w-4 shrink-0 accent-cyan-500"
          />
          <span>Je souhaite être formé sur cette compétence</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={editingCell.wantsToMentor}
            onChange={(event) =>
              setEditingCell((prev) =>
                prev ? { ...prev, wantsToMentor: event.target.checked } : prev,
              )
            }
            className="h-4 w-4 shrink-0 accent-cyan-500"
          />
          <span>Je souhaite former sur cette compétence</span>
        </label>
      </div>
    </>
  );
}
