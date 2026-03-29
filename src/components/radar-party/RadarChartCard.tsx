import { Card } from "@/components/app-shell";
import {
  RADAR_DIMENSIONS,
  RADAR_DIMENSION_LABELS,
  type RadarDimension,
} from "@/features/radarParty/questions";
import type { RadarAxisValues } from "@/features/radarParty/scoring";

type RadarChartCardProps = {
  title: string;
  subtitle?: string;
  radar: RadarAxisValues;
  detailScores?: Record<string, number>;
};

type ThemeDefinition = {
  key: RadarDimension;
  label: string;
  short: string;
};

const THEMES: ThemeDefinition[] = [
  { key: "collaboration", label: "Collaboration", short: "Collab." },
  { key: "fun", label: "Fun", short: "Fun" },
  { key: "learning", label: "Apprentissages", short: "Apprent." },
  { key: "alignment", label: "Alignement", short: "Align." },
  { key: "ownership", label: "Ownership", short: "Owner." },
  { key: "process", label: "Processus", short: "Process" },
  { key: "resources", label: "Ressources", short: "Ress." },
  { key: "roles", label: "Roles", short: "Roles" },
  { key: "speed", label: "Vitesse", short: "Vitesse" },
  { key: "value", label: "Valeur", short: "Valeur" },
];

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const polarPoint = (cx: number, cy: number, radius: number, angleRad: number) => ({
  x: cx + Math.cos(angleRad) * radius,
  y: cy + Math.sin(angleRad) * radius,
});

export function RadarChartCard({ title, subtitle, radar, detailScores }: RadarChartCardProps) {
  const themeScores = THEMES.map((theme) => {
    const detailScore = detailScores?.[theme.key];
    const score = Number.isFinite(detailScore) ? Number(detailScore) : radar[theme.key];

    return {
      ...theme,
      label: theme.label || RADAR_DIMENSION_LABELS[theme.key],
      score: clampPercent(score),
    };
  });

  const size = 600;
  const center = size / 2;
  const maxRadius = 226;
  const labelRadius = 258;
  const rings = [20, 40, 60, 80, 100];

  const points = themeScores.map((theme, index) => {
    const angleRad = (index / RADAR_DIMENSIONS.length) * Math.PI * 2 - Math.PI / 2;
    const valueRadius = (theme.score / 100) * maxRadius;
    const valuePoint = polarPoint(center, center, valueRadius, angleRad);
    const axisPoint = polarPoint(center, center, maxRadius, angleRad);
    const labelPoint = polarPoint(center, center, labelRadius, angleRad);
    const cosine = Math.cos(angleRad);
    const sine = Math.sin(angleRad);

    return {
      ...theme,
      angleRad,
      x: valuePoint.x,
      y: valuePoint.y,
      axisX: axisPoint.x,
      axisY: axisPoint.y,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      labelAnchor: cosine > 0.35 ? ("start" as const) : cosine < -0.35 ? ("end" as const) : ("middle" as const),
      labelDy: sine > 0.35 ? 10 : sine < -0.35 ? -7 : 2,
    };
  });

  const spiderRings = rings.map((ring, index) => {
    const ringRadius = (ring / 100) * maxRadius;
    const vertices = points.map((point) => {
      const p = polarPoint(center, center, ringRadius, point.angleRad);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    });

    return {
      ring,
      points: `${vertices.join(" ")} ${vertices[0]}`,
      fill: index % 2 === 0 ? "rgba(8,47,73,0.22)" : "rgba(30,41,59,0.42)",
    };
  });

  const polygonPoints = [...points, points[0]].map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

  const guideDots = points.flatMap((point, axisIndex) =>
    rings.map((ring, ringIndex) => {
      const p = polarPoint(center, center, (ring / 100) * maxRadius, point.angleRad);
      return {
        key: `guide-${axisIndex}-${ringIndex}`,
        x: p.x,
        y: p.y,
        size: ringIndex === rings.length - 1 ? 1.8 : 1.3,
      };
    })
  );

  return (
    <Card className="relative overflow-hidden rounded-xl border border-cyan-300/30 bg-slate-950/60 p-3 sm:p-4 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_14px_36px_rgba(2,6,23,0.55)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(59,130,246,0.08),transparent_42%)]" />
      <h3 className="relative text-base font-semibold uppercase tracking-[0.12em] text-cyan-100">{title}</h3>
      {subtitle ? <p className="relative mt-1 text-xs text-slate-300">{subtitle}</p> : null}

      <div className="relative mt-3 h-[430px] w-full sm:mt-4 sm:h-[560px]">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter id="radarGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22d3ee" floodOpacity="0.55" />
            </filter>
          </defs>

          {spiderRings.map((ring) => (
            <polyline
              key={`ring-${ring.ring}`}
              points={ring.points}
              fill={ring.fill}
              stroke="rgba(56,189,248,0.35)"
              strokeWidth={ring.ring === 100 ? 1.7 : 1.1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {points.map((point) => (
            <line
              key={`axis-${point.key}`}
              x1={center}
              y1={center}
              x2={point.axisX}
              y2={point.axisY}
              stroke="rgba(125,211,252,0.34)"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {guideDots.map((dot) => (
            <circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.size} fill="rgba(186,230,253,0.46)" />
          ))}

          {rings.map((ring) => (
            <text
              key={`pct-${ring}`}
              x={center + 11}
              y={center - (ring / 100) * maxRadius - 3}
              fill="rgba(186,230,253,0.86)"
              fontSize="11"
              fontWeight="600"
              style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
            >
              {ring}%
            </text>
          ))}

          <polyline
            points={polygonPoints}
            fill="rgba(34,211,238,0.18)"
            stroke="#22d3ee"
            strokeWidth={3.1}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#radarGlow)"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((point) => (
            <g key={`point-${point.key}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#22d3ee"
                stroke="#e0f2fe"
                strokeWidth={1.4}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={point.x - 12} y={point.y - 22} width={24} height={12} rx={4} fill="#0891b2" opacity={0.95} />
              <text x={point.x} y={point.y - 13} fill="#ecfeff" fontSize="8" fontWeight="700" textAnchor="middle">
                {(point.score / 20).toFixed(1)}
              </text>
              <title>{`${point.label}: ${point.score}%`}</title>
            </g>
          ))}

          <g className="hidden sm:block">
            {points.map((point) => (
              <text
                key={`lbl-d-${point.key}`}
                x={point.labelX}
                y={point.labelY}
                fill="rgba(224,242,254,0.97)"
                fontSize="12"
                fontWeight="700"
                textAnchor={point.labelAnchor}
                dominantBaseline="middle"
                dy={point.labelDy}
                stroke="rgba(2,6,23,0.9)"
                strokeWidth="1.2"
                paintOrder="stroke"
                style={{
                  letterSpacing: "0.25px",
                  fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                }}
              >
                {point.label}
              </text>
            ))}
          </g>

          <g className="sm:hidden">
            {points.map((point) => (
              <text
                key={`lbl-m-${point.key}`}
                x={point.labelX}
                y={point.labelY}
                fill="rgba(186,230,253,0.98)"
                fontSize="10"
                fontWeight="700"
                textAnchor={point.labelAnchor}
                dominantBaseline="middle"
                dy={point.labelDy}
                stroke="rgba(2,6,23,0.95)"
                strokeWidth="1.1"
                paintOrder="stroke"
                style={{ letterSpacing: "0.2px", fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
              >
                {point.short}
              </text>
            ))}
          </g>

          <circle cx={center} cy={center} r={7} fill="#0f172a" stroke="rgba(34,211,238,0.7)" strokeWidth="1.2" />
        </svg>
      </div>
    </Card>
  );
}