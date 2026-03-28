import { Radar, RadarChart, PolarGrid, PolarAngleAxis } from "recharts";
import { Card } from "@/components/app-shell";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { RadarAxisValues } from "@/features/radarParty/scoring";

const config = {
  value: {
    label: "Score",
    color: "hsl(183 88% 57%)",
  },
} satisfies ChartConfig;

const radarDataFromValues = (radar: RadarAxisValues) => [
  { axis: "Collaboration", value: radar.collaboration },
  { axis: "Produit", value: radar.product },
  { axis: "Decision", value: radar.decision },
  { axis: "Organisation", value: radar.organization },
];

type RadarChartCardProps = {
  title: string;
  subtitle?: string;
  radar: RadarAxisValues;
};

export function RadarChartCard({ title, subtitle, radar }: RadarChartCardProps) {
  const radarData = radarDataFromValues(radar);

  return (
    <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
      <h3 className="text-base font-semibold text-cyan-100">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-300">{subtitle}</p> : null}
      <ChartContainer
        config={config}
        className="mt-4 !aspect-auto h-[220px] w-full max-w-full overflow-hidden sm:h-[280px]"
      >
        <RadarChart data={radarData} outerRadius="58%" margin={{ top: 12, right: 20, bottom: 12, left: 20 }}>
          <PolarGrid stroke="rgba(148,163,184,0.35)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "rgba(226,232,240,0.95)", fontSize: 11 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ChartContainer>
    </Card>
  );
}
