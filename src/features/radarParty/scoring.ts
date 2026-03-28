import { RADAR_QUESTIONS, type RadarDimension } from "./questions";

export type RadarAxisValues = Record<RadarDimension, number>;
export type RadarDetailScores = Record<string, number>;

export type RadarScoreResult = {
  radar: RadarAxisValues;
  polesPercent: RadarDetailScores;
};

export type RadarAnswers = Record<number, number>;

const clampScore = (value: number) => Math.max(1, Math.min(5, Math.round(value)));
const round = (value: number) => Math.round(value);
const toPct = (avgOnFive: number) => ((avgOnFive - 1) / 4) * 100;

export function computeRadarScores(answers: RadarAnswers): RadarScoreResult {
  const byDimension = {
    visionStrategy: [] as number[],
    planning: [] as number[],
    execution: [] as number[],
    mindsetBehaviors: [] as number[],
  };

  const bySubdimension: Record<string, number[]> = {};

  for (const question of RADAR_QUESTIONS) {
    const answer = clampScore(answers[question.id] ?? 3);
    byDimension[question.dimension].push(answer);
    if (!bySubdimension[question.subdimension]) bySubdimension[question.subdimension] = [];
    bySubdimension[question.subdimension].push(answer);
  }

  const radar: RadarAxisValues = {
    visionStrategy: round(toPct(byDimension.visionStrategy.reduce((a, b) => a + b, 0) / byDimension.visionStrategy.length)),
    planning: round(toPct(byDimension.planning.reduce((a, b) => a + b, 0) / byDimension.planning.length)),
    execution: round(toPct(byDimension.execution.reduce((a, b) => a + b, 0) / byDimension.execution.length)),
    mindsetBehaviors: round(
      toPct(byDimension.mindsetBehaviors.reduce((a, b) => a + b, 0) / byDimension.mindsetBehaviors.length)
    ),
  };

  const polesPercent: RadarDetailScores = {};
  Object.entries(bySubdimension).forEach(([key, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    polesPercent[key] = round(toPct(avg));
  });

  return { radar, polesPercent };
}

export function computeTeamAverageRadar(radars: RadarAxisValues[]): RadarAxisValues {
  if (radars.length === 0) {
    return { visionStrategy: 50, planning: 50, execution: 50, mindsetBehaviors: 50 };
  }
  const total = radars.reduce(
    (acc, radar) => ({
      visionStrategy: acc.visionStrategy + radar.visionStrategy,
      planning: acc.planning + radar.planning,
      execution: acc.execution + radar.execution,
      mindsetBehaviors: acc.mindsetBehaviors + radar.mindsetBehaviors,
    }),
    { visionStrategy: 0, planning: 0, execution: 0, mindsetBehaviors: 0 }
  );

  return {
    visionStrategy: round(total.visionStrategy / radars.length),
    planning: round(total.planning / radars.length),
    execution: round(total.execution / radars.length),
    mindsetBehaviors: round(total.mindsetBehaviors / radars.length),
  };
}
