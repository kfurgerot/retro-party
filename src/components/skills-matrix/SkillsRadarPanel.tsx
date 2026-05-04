import { resolveMatrixCellTone } from "@/features/skillsMatrix/cellTone";
import type { SkillsRadarModel } from "@/features/skillsMatrix/radarModel";
import { cn } from "@/lib/utils";

type SkillsRadarPanelProps = {
  title: string;
  subtitle: string;
  model: SkillsRadarModel;
};

export function SkillsRadarPanel({ title, subtitle, model }: SkillsRadarPanelProps) {
  const categories = model.categories;
  const axisCount = categories.length;
  const canRenderRadar = axisCount >= 3;
  const ringTicks = [20, 40, 60, 80, 100];
  const size = 420;
  const center = size / 2;
  const radius = 128;
  const labelRadius = 165;

  const axes = canRenderRadar
    ? categories.map((category, index) => {
        const angleRad = (index / axisCount) * Math.PI * 2 - Math.PI / 2;
        const axisX = center + Math.cos(angleRad) * radius;
        const axisY = center + Math.sin(angleRad) * radius;
        const labelX = center + Math.cos(angleRad) * labelRadius;
        const labelY = center + Math.sin(angleRad) * labelRadius;
        const cosine = Math.cos(angleRad);
        return {
          ...category,
          angleRad,
          axisX,
          axisY,
          labelX,
          labelY,
          anchor:
            cosine > 0.4
              ? ("start" as const)
              : cosine < -0.4
                ? ("end" as const)
                : ("middle" as const),
        };
      })
    : [];

  const radarPoints = axes.map((axis) => {
    const pointRadius = (axis.scorePct / 100) * radius;
    const x = center + Math.cos(axis.angleRad) * pointRadius;
    const y = center + Math.sin(axis.angleRad) * pointRadius;
    return { ...axis, x, y };
  });

  const radarPath =
    radarPoints.length > 0
      ? `${radarPoints
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
          )
          .join(" ")} Z`
      : "";

  const completedRatio =
    model.totalSkills > 0 ? Math.round((model.completedSkills / model.totalSkills) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-200">
            {Math.round(model.averageScorePct)}% couvert
          </span>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-slate-400">
            {completedRatio}% renseigné
          </span>
        </div>
      </div>

      {canRenderRadar ? (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-2 sm:p-3">
          <div className="h-[300px] w-full sm:h-[340px]">
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
              {ringTicks.map((ring, index) => {
                const ringRadius = (ring / 100) * radius;
                const vertices = axes.map((axis) => {
                  const x = center + Math.cos(axis.angleRad) * ringRadius;
                  const y = center + Math.sin(axis.angleRad) * ringRadius;
                  return `${x.toFixed(2)},${y.toFixed(2)}`;
                });
                return (
                  <polygon
                    key={`ring-${ring}`}
                    points={vertices.join(" ")}
                    fill={index % 2 === 0 ? "rgba(56,189,248,0.05)" : "rgba(15,23,42,0.32)"}
                    stroke="rgba(148,163,184,0.32)"
                    strokeWidth={ring === 100 ? 1.4 : 1}
                  />
                );
              })}

              {axes.map((axis) => (
                <line
                  key={`axis-${axis.categoryKey}`}
                  x1={center}
                  y1={center}
                  x2={axis.axisX}
                  y2={axis.axisY}
                  stroke="rgba(148,163,184,0.32)"
                  strokeWidth={1}
                />
              ))}

              {radarPath ? (
                <>
                  <path
                    d={radarPath}
                    fill="rgba(14,165,233,0.24)"
                    stroke="rgba(56,189,248,0.95)"
                    strokeWidth={2.2}
                  />
                  {radarPoints.map((point) => (
                    <circle
                      key={`point-${point.categoryKey}`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill="rgba(56,189,248,1)"
                      stroke="rgba(224,242,254,0.95)"
                      strokeWidth={1.2}
                    />
                  ))}
                </>
              ) : null}

              {axes.map((axis) => (
                <text
                  key={`label-${axis.categoryKey}`}
                  x={axis.labelX}
                  y={axis.labelY}
                  fill="rgba(226,232,240,0.95)"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor={axis.anchor}
                  dominantBaseline="middle"
                >
                  {axis.categoryName}
                </text>
              ))}
            </svg>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Plus la forme est large, plus l'équipe maîtrise les compétences requises.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-3 text-xs text-slate-400">
          Ajoute au moins 3 catégories pour afficher un radar.
        </div>
      )}

      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {categories.map((category) => {
          const catPct = Math.round(category.scorePct);
          const catColor =
            catPct >= 80 ? "text-emerald-400" : catPct >= 50 ? "text-cyan-400" : "text-amber-400";
          return (
            <div
              key={category.categoryKey}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-100">{category.categoryName}</div>
                <span className={cn("text-[11px] font-bold", catColor)}>{catPct}%</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {category.skills.map((skill) => {
                  const tone = resolveMatrixCellTone(skill.currentLevel, skill.requiredLevel);
                  const isFilled = skill.currentLevel != null;
                  const meetsRequired = isFilled && skill.currentLevel! >= skill.requiredLevel;
                  return (
                    <div
                      key={skill.skillId}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]",
                        tone.surfaceClass,
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-100">
                        {skill.skillName}
                      </span>
                      {isFilled ? (
                        <span className={cn("shrink-0 font-bold", tone.valueClass)}>
                          {meetsRequired ? "✓" : ""} Niv. {skill.currentLevel}
                        </span>
                      ) : (
                        <span className="shrink-0 text-slate-600">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
