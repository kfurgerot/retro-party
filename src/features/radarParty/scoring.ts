import { RADAR_QUESTIONS, type RadarDimension, type RadarPole } from "./questions";

export type RadarAxisValues = Record<RadarDimension, number>;

export type RadarPoles = {
  collaboration: { solo: number; team: number };
  product: { delivery: number; quality: number };
  decision: { data: number; intuition: number };
  organization: { structured: number; adaptive: number };
};

export type RadarScoreResult = {
  radar: RadarAxisValues;
  polesPercent: RadarPoles;
};

export type RadarAnswers = Record<number, number>;

const clampScore = (value: number) => Math.max(1, Math.min(5, Math.round(value)));
const round = (value: number) => Math.round(value);

function getPolePair(dimension: RadarDimension): [RadarPole, RadarPole] {
  if (dimension === "collaboration") return ["solo", "team"];
  if (dimension === "product") return ["delivery", "quality"];
  if (dimension === "decision") return ["data", "intuition"];
  return ["structured", "adaptive"];
}

export function computeRadarScores(answers: RadarAnswers): RadarScoreResult {
  const raw = {
    collaboration: { solo: 0, team: 0 },
    product: { delivery: 0, quality: 0 },
    decision: { data: 0, intuition: 0 },
    organization: { structured: 0, adaptive: 0 },
  };

  for (const question of RADAR_QUESTIONS) {
    const answer = clampScore(answers[question.id] ?? 3);
    if (question.dimension === "collaboration") {
      raw.collaboration[question.pole as "solo" | "team"] += answer;
      continue;
    }
    if (question.dimension === "product") {
      raw.product[question.pole as "delivery" | "quality"] += answer;
      continue;
    }
    if (question.dimension === "decision") {
      raw.decision[question.pole as "data" | "intuition"] += answer;
      continue;
    }
    raw.organization[question.pole as "structured" | "adaptive"] += answer;
  }

  const polesPercent: RadarPoles = {
    collaboration: { solo: 50, team: 50 },
    product: { delivery: 50, quality: 50 },
    decision: { data: 50, intuition: 50 },
    organization: { structured: 50, adaptive: 50 },
  };

  (Object.keys(raw) as RadarDimension[]).forEach((dimension) => {
    const [leftPole, rightPole] = getPolePair(dimension);
    const left = raw[dimension][leftPole as keyof (typeof raw)[typeof dimension]] as number;
    const right = raw[dimension][rightPole as keyof (typeof raw)[typeof dimension]] as number;
    const total = left + right;
    const leftPct = total > 0 ? (left / total) * 100 : 50;
    const rightPct = 100 - leftPct;

    if (dimension === "collaboration") {
      polesPercent.collaboration.solo = round(leftPct);
      polesPercent.collaboration.team = round(rightPct);
      return;
    }
    if (dimension === "product") {
      polesPercent.product.delivery = round(leftPct);
      polesPercent.product.quality = round(rightPct);
      return;
    }
    if (dimension === "decision") {
      polesPercent.decision.data = round(leftPct);
      polesPercent.decision.intuition = round(rightPct);
      return;
    }
    polesPercent.organization.structured = round(leftPct);
    polesPercent.organization.adaptive = round(rightPct);
  });

  return {
    radar: {
      collaboration: polesPercent.collaboration.team,
      product: polesPercent.product.quality,
      decision: polesPercent.decision.data,
      organization: polesPercent.organization.structured,
    },
    polesPercent,
  };
}

export function computeTeamAverageRadar(radars: RadarAxisValues[]): RadarAxisValues {
  if (radars.length === 0) {
    return { collaboration: 50, product: 50, decision: 50, organization: 50 };
  }
  const total = radars.reduce(
    (acc, radar) => ({
      collaboration: acc.collaboration + radar.collaboration,
      product: acc.product + radar.product,
      decision: acc.decision + radar.decision,
      organization: acc.organization + radar.organization,
    }),
    { collaboration: 0, product: 0, decision: 0, organization: 0 }
  );

  return {
    collaboration: round(total.collaboration / radars.length),
    product: round(total.product / radars.length),
    decision: round(total.decision / radars.length),
    organization: round(total.organization / radars.length),
  };
}
