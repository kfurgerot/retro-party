import { Card } from "@/components/app-shell";
import type { IndividualRecommendationCard } from "@/features/radarParty/individualRecommendations";
import { cn } from "@/lib/utils";

type IndividualRecommendationsSectionProps = {
  cards: IndividualRecommendationCard[];
};

type RecommendationTone = {
  label: string;
  cardClass: string;
  badgeClass: string;
};

const RECOMMENDATION_TONE: Record<"reinforce" | "next-lever" | "preserve", RecommendationTone> = {
  reinforce: {
    label: "A renforcer",
    cardClass: "border-red-300/60 bg-red-500/12",
    badgeClass: "border-red-300/70 bg-red-600/20 text-red-100",
  },
  "next-lever": {
    label: "Prochain levier",
    cardClass: "border-amber-300/60 bg-amber-500/12",
    badgeClass: "border-amber-300/70 bg-amber-600/18 text-amber-100",
  },
  preserve: {
    label: "A preserver",
    cardClass: "border-emerald-300/60 bg-emerald-500/12",
    badgeClass: "border-emerald-300/70 bg-emerald-600/20 text-emerald-100",
  },
};

export function IndividualRecommendationsSection({ cards }: IndividualRecommendationsSectionProps) {
  if (cards.length === 0) return null;

  return (
    <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
      <h4 className="text-sm font-semibold text-cyan-100">Recommandations suggerees (2 semaines)</h4>
      <p className="mt-1 text-xs text-slate-300">Suggestions automatiques (sans IA externe).</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {cards.map((card) => {
          const tone = RECOMMENDATION_TONE[card.kind];
          return (
            <div key={`${card.kind}-${card.axis}`} className={cn("rounded-3xl border p-4", tone.cardClass)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone.badgeClass)}>
                  {tone.label}
                </span>
                <span className="text-xs font-semibold text-slate-100">{card.score}/100</span>
              </div>

              <p className="mt-2 text-sm font-semibold text-slate-100">{card.axisLabel}</p>
              <p className="mt-1 text-xs text-slate-200/90">{card.observation}</p>

              <div className="mt-3 space-y-2 text-sm text-slate-100/95">
                <p className="break-words">
                  <span className="font-semibold text-cyan-100">{card.suggestionLabel}:</span> {card.suggestion}
                </p>
                <p className="break-words">
                  <span className="font-semibold text-cyan-100">Premier pas:</span> {card.firstStep}
                </p>
                <p className="break-words">
                  <span className="font-semibold text-cyan-100">Indicateur (2 semaines):</span> {card.indicator}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

