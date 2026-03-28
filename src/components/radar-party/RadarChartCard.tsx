import { useId } from "react";
import { Card } from "@/components/app-shell";
import { RADAR_QUESTIONS, type RadarDimension } from "@/features/radarParty/questions";
import type { RadarAxisValues } from "@/features/radarParty/scoring";

const AXIS_BY_DIMENSION: Record<RadarDimension, keyof RadarAxisValues> = {
  visionStrategy: "visionStrategy",
  planning: "planning",
  execution: "execution",
  mindsetBehaviors: "mindsetBehaviors",
};

const DISPLAY_DIMENSIONS: RadarDimension[] = [
  "planning",
  "execution",
  "mindsetBehaviors",
  "visionStrategy",
];

const DIMENSION_LABEL: Record<RadarDimension, string> = {
  planning: "Planning",
  execution: "Execution",
  mindsetBehaviors: "Mindset",
  visionStrategy: "Vision",
};

const SUBDIMENSION_LABELS: Record<string, { desktop: string; mobile: string }> = {
  "Vision & Purpose": { desktop: "Vision produit", mobile: "Vision" },
  "Customer Focus": { desktop: "Focus client", mobile: "Client" },
  "Goals & Outcomes": { desktop: "Objectifs valeur", mobile: "Objectifs" },
  "Learning & Experimenting": { desktop: "Apprentissage", mobile: "Learn" },
  "Creativity & Innovation": { desktop: "Innovation equipe", mobile: "Inno" },
  "Strategic Alignment": { desktop: "Alignement strat", mobile: "Alignement" },
  "Prioritization Logic": { desktop: "Logique priorite", mobile: "Priorite" },
  "Feedback Integration": { desktop: "Integration feedback", mobile: "Feedback" },
  "Strategic Adaptability": { desktop: "Adaptation strat", mobile: "Adaptation" },
  "Roadmap Clarity": { desktop: "Roadmap claire", mobile: "Roadmap" },

  "Short-Term Plan": { desktop: "Plan court terme", mobile: "Court terme" },
  "Prioritization Breakdown": { desktop: "Decoupage priorites", mobile: "Decoupage" },
  Roadmap: { desktop: "Roadmap", mobile: "Roadmap" },
  "Risk Anticipation": { desktop: "Anticipation risques", mobile: "Risques" },
  "Roles & Skills": { desktop: "Roles et compet.", mobile: "Roles" },
  Tools: { desktop: "Outils", mobile: "Outils" },
  "Capacity Planning": { desktop: "Plan de charge", mobile: "Charge" },
  "Stakeholder Visibility": { desktop: "Visibilite parties", mobile: "Parties pren." },
  "Planning Hygiene": { desktop: "Qualite planning", mobile: "Qualite plan." },
  "Plan Adaptation": { desktop: "Adaptation plan", mobile: "Adapt. plan" },

  "Effective Meetings": { desktop: "Reunions utiles", mobile: "Reunions" },
  "Operational Decision-Making": { desktop: "Decision operation.", mobile: "Decision op." },
  Metrics: { desktop: "Metriques", mobile: "Metriques" },
  "Obstacle Removal": { desktop: "Levee obstacles", mobile: "Obstacles" },
  "Delivery Rhythm": { desktop: "Cadence livraisons", mobile: "Cadence" },
  "Execution Consistency": { desktop: "Execution stable", mobile: "Execution" },
  Reliability: { desktop: "Fiabilite", mobile: "Fiabilite" },
  "Continuous Improvement": { desktop: "Amelioration continue", mobile: "Amelioration" },
  "Operational Transparency": { desktop: "Transparence operation.", mobile: "Transparence" },
  "Plan Execution": { desktop: "Execution du plan", mobile: "Exec. plan" },

  "Engaged & Motivated": { desktop: "Engagement equipe", mobile: "Engagement" },
  Autonomy: { desktop: "Autonomie", mobile: "Autonomie" },
  "Trust & Respect": { desktop: "Confiance et respect", mobile: "Confiance" },
  "Well-Being": { desktop: "Bien-etre", mobile: "Bien-etre" },
  "Psychological Safety": { desktop: "Securite psychologique", mobile: "Secu psy" },
  "Constructive Conversations": { desktop: "Echanges constructifs", mobile: "Echanges" },
  "Diversity & Inclusion": { desktop: "Diversite et inclusion", mobile: "Diversite" },
  "Accountability & Ownership": { desktop: "Responsabilite collective", mobile: "Responsabilite" },
  "Feedback & Recognition": { desktop: "Feedback et reco.", mobile: "Feedback" },
  "Open & Collaborative": { desktop: "Ouvert et collaboratif", mobile: "Collaboration" },
};

type RadarChartCardProps = {
  title: string;
  subtitle?: string;
  radar: RadarAxisValues;
  detailScores?: Record<string, number>;
};

type SeriesPoint = {
  label: string;
  value: number;
  dimension: RadarDimension;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const buildSeries = (radar: RadarAxisValues, detailScores?: Record<string, number>): SeriesPoint[] => {
  const hasDetails = Boolean(detailScores && Object.keys(detailScores).length > 0);

  if (!hasDetails) {
    return DISPLAY_DIMENSIONS.map((dimension) => ({
      label: DIMENSION_LABEL[dimension],
      value: clampPercent(radar[AXIS_BY_DIMENSION[dimension]]),
      dimension,
    }));
  }

  const orderedQuestions = DISPLAY_DIMENSIONS.flatMap((dimension) =>
    RADAR_QUESTIONS.filter((question) => question.dimension === dimension)
  );

  return orderedQuestions.map((question) => {
    const axisKey = AXIS_BY_DIMENSION[question.dimension];
    const fallback = radar[axisKey];
    const detail = detailScores?.[question.subdimension];
    return {
      label: question.subdimension,
      value: clampPercent(Number.isFinite(detail) ? detail : fallback),
      dimension: question.dimension,
    };
  });
};

const degToRad = (deg: number) => ((deg - 90) * Math.PI) / 180;

const polarPoint = (cx: number, cy: number, radius: number, angleDeg: number) => {
  const angle = degToRad(angleDeg);
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
};

const donutSectorPath = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) => {
  const startOuter = polarPoint(cx, cy, outerRadius, startAngle);
  const endOuter = polarPoint(cx, cy, outerRadius, endAngle);
  const startInner = polarPoint(cx, cy, innerRadius, startAngle);
  const endInner = polarPoint(cx, cy, innerRadius, endAngle);
  const sweep = ((endAngle - startAngle + 360) % 360) || 360;
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

const arcPath = (
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  sweepFlag: 0 | 1,
  largeArcFlag: 0 | 1
) => {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

const shortSubLabel = (label: string, compact: boolean) => {
  const mapped = SUBDIMENSION_LABELS[label];
  if (mapped) return compact ? mapped.mobile : mapped.desktop;
  if (compact) return label.length <= 12 ? label : `${label.slice(0, 12)}...`;
  return label.length <= 22 ? label : `${label.slice(0, 22)}...`;
};

const midAngle = (start: number, end: number) => {
  const sweep = ((end - start + 360) % 360) || 360;
  return (start + sweep / 2) % 360;
};

export function RadarChartCard({ title, subtitle, radar, detailScores }: RadarChartCardProps) {
  const uid = useId().replace(/:/g, "");
  const topArcId = `radar-top-arc-${uid}`;
  const bottomArcId = `radar-bottom-arc-${uid}`;

  const series = buildSeries(radar, detailScores);
  const hasDetails = series.length > 4;

  const size = 700;
  const center = size / 2;
  const gridRadius = 238;
  const subCategoryRadius = 268;
  const axisBandInner = 284;
  const axisBandOuter = 308;
  const globalBandInner = 314;
  const globalBandOuter = 346;

  const rings = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  const axisLineRadius = hasDetails ? subCategoryRadius : gridRadius;

  const coords = series.map((point, index) => {
    const angleDeg = (index / series.length) * 360;
    const valueRadius = (point.value / 100) * gridRadius;
    const valuePt = polarPoint(center, center, valueRadius, angleDeg);
    const axisPt = polarPoint(center, center, axisLineRadius, angleDeg);
    const labelPt = polarPoint(center, center, subCategoryRadius + 18, angleDeg);
    return {
      ...point,
      angleDeg,
      valueX: valuePt.x,
      valueY: valuePt.y,
      axisX: axisPt.x,
      axisY: axisPt.y,
      labelX: labelPt.x,
      labelY: labelPt.y,
    };
  });

  const polylinePoints = [...coords, coords[0]]
    .map((point) => `${point.valueX.toFixed(2)},${point.valueY.toFixed(2)}`)
    .join(" ");

  const axisBands = [
    { dimension: "planning" as const, start: 315, end: 45, fill: "#dcefff" },
    { dimension: "execution" as const, start: 45, end: 135, fill: "#dcefff" },
    { dimension: "mindsetBehaviors" as const, start: 135, end: 225, fill: "#f3d3e5" },
    { dimension: "visionStrategy" as const, start: 225, end: 315, fill: "#dcefff" },
  ];

  const mobileLabelPoints = hasDetails ? coords.filter((_point, index) => index % 5 === 0) : coords;

  return (
    <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
      <h3 className="text-base font-semibold text-cyan-100">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-300">{subtitle}</p> : null}

      <div className="mt-4 h-[430px] w-full sm:h-[620px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <path id={topArcId} d={arcPath(center, center, 329, 300, 60, 1, 0)} />
            <path id={bottomArcId} d={arcPath(center, center, 329, 240, 120, 0, 0)} />
          </defs>

          <path d={donutSectorPath(center, center, globalBandInner, globalBandOuter, 300, 60)} fill="#53a9cf" />
          <path d={donutSectorPath(center, center, globalBandInner, globalBandOuter, 60, 300)} fill="#d62e86" />

          {axisBands.map((band) => (
            <path
              key={`band-${band.dimension}`}
              d={donutSectorPath(center, center, axisBandInner, axisBandOuter, band.start, band.end)}
              fill={band.fill}
              stroke="#0f172a"
              strokeWidth={1}
            />
          ))}

          <circle cx={center} cy={center} r={gridRadius + 18} fill="#f8fafc" stroke="#0f172a" strokeWidth={1.4} />

          {rings.map((value) => {
            const r = (value / 100) * gridRadius;
            return (
              <circle
                key={`ring-${value}`}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke="rgba(15,23,42,0.45)"
                strokeWidth={value % 20 === 0 ? 1.1 : 0.6}
                strokeDasharray={value % 20 === 0 ? "none" : "2 2"}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {coords.map((point, index) => {
            const majorSplit = hasDetails ? index % 10 === 0 : true;
            return (
              <line
                key={`axis-${index}`}
                x1={center}
                y1={center}
                x2={point.axisX}
                y2={point.axisY}
                stroke={majorSplit ? "#0f172a" : "rgba(15,23,42,0.7)"}
                strokeWidth={majorSplit ? 2 : 1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {rings.filter((value) => value % 20 === 0).map((value) => {
            const y = center - (value / 100) * gridRadius;
            return (
              <text key={`pct-${value}`} x={center + 8} y={y - 2} fill="#0f172a" fontSize="11" fontWeight="700">
                {value}%
              </text>
            );
          })}

          {axisBands.map((band) => {
            const angle = midAngle(band.start, band.end);
            const pos = polarPoint(center, center, (axisBandInner + axisBandOuter) / 2, angle);
            return (
              <text
                key={`axis-label-${band.dimension}`}
                x={pos.x}
                y={pos.y}
                fill="#0f172a"
                fontSize="12"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {DIMENSION_LABEL[band.dimension]}
              </text>
            );
          })}

          {hasDetails ? (
            <g className="hidden sm:block">
              {coords.map((point, index) => {
                const angle = point.angleDeg;
                const onLeftSide = angle > 180;
                const baseRotation = angle - 90;
                const rotation = onLeftSide ? baseRotation + 180 : baseRotation;
                const label = shortSubLabel(point.label, false);
                const width = Math.min(128, Math.max(36, label.length * 4.6 + 12));
                const height = 14;
                return (
                  <g
                    key={`chip-d-${index}`}
                    transform={`translate(${point.labelX.toFixed(2)} ${point.labelY.toFixed(2)}) rotate(${rotation.toFixed(2)})`}
                  >
                    <rect
                      x={(-width / 2).toFixed(2)}
                      y={(-height / 2).toFixed(2)}
                      width={width}
                      height={height}
                      rx="7"
                      fill="rgba(255,255,255,0.96)"
                      stroke="rgba(15,23,42,0.9)"
                      strokeWidth="0.7"
                    />
                    <text
                      fill="#0f172a"
                      fontSize="7"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      textLength={Math.max(16, width - 10)}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          {hasDetails ? (
            <g className="sm:hidden">
              {mobileLabelPoints.map((point, index) => {
                const label = shortSubLabel(point.label, true);
                const width = Math.min(110, Math.max(30, label.length * 4.2 + 12));
                const height = 12;
                return (
                  <g key={`chip-m-${index}`} transform={`translate(${point.labelX.toFixed(2)} ${point.labelY.toFixed(2)})`}>
                    <rect
                      x={(-width / 2).toFixed(2)}
                      y={(-height / 2).toFixed(2)}
                      width={width}
                      height={height}
                      rx="6"
                      fill="rgba(255,255,255,0.94)"
                      stroke="rgba(15,23,42,0.85)"
                      strokeWidth="0.7"
                    />
                    <text
                      fill="#0f172a"
                      fontSize="6.5"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      textLength={Math.max(14, width - 9)}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={polylinePoints}
            fill="none"
            stroke="#ff1a1a"
            strokeWidth="3.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {coords.map((point, index) => (
            <circle
              key={`dot-${index}`}
              cx={point.valueX}
              cy={point.valueY}
              r={4}
              fill="#ff1a1a"
              stroke="#ffffff"
              strokeWidth={1.1}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${point.label}: ${point.value}%`}</title>
            </circle>
          ))}

          <circle cx={center} cy={center} r={11} fill="#000000" />

          <text fill="#f8fafc" fontSize="10" fontWeight="800" letterSpacing="0.14em">
            <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
              WAYS OF WORKING
            </textPath>
          </text>

          <text fill="#f8fafc" fontSize="10" fontWeight="800" letterSpacing="0.14em">
            <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
              MINDSET & BEHAVIORS
            </textPath>
          </text>
        </svg>
      </div>

      <p className="mt-2 text-[11px] text-slate-300">
        Radar a 3 niveaux: global, axes, sous-categories. Les points rouges sont relies en toile d'araignee.
      </p>
    </Card>
  );
}
