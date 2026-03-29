import { RADAR_DIMENSIONS, type RadarDimension, RADAR_QUESTIONS } from "./questions";

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

const createBuckets = (): Record<RadarDimension, number[]> =>
  Object.fromEntries(RADAR_DIMENSIONS.map((dimension) => [dimension, [] as number[]])) as Record<RadarDimension, number[]>;

export function createNeutralRadar(seed = 50): RadarAxisValues {
  return Object.fromEntries(
    RADAR_DIMENSIONS.map((dimension) => [dimension, round(seed)])
  ) as RadarAxisValues;
}

export function computeRadarScores(answers: RadarAnswers): RadarScoreResult {
  const byDimension = createBuckets();
  const bySubdimension: Record<string, number[]> = {};

  for (const question of RADAR_QUESTIONS) {
    const answer = clampScore(answers[question.id] ?? 3);
    byDimension[question.dimension].push(answer);
    if (!bySubdimension[question.subdimension]) bySubdimension[question.subdimension] = [];
    bySubdimension[question.subdimension].push(answer);
  }

  const radar = RADAR_DIMENSIONS.reduce((acc, dimension) => {
    const values = byDimension[dimension];
    const averageScore = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 3;
    acc[dimension] = round(toPct(averageScore));
    return acc;
  }, createNeutralRadar());

  const polesPercent: RadarDetailScores = {};
  Object.entries(bySubdimension).forEach(([key, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    polesPercent[key] = round(toPct(avg));
  });

  return { radar, polesPercent };
}

export function computeTeamAverageRadar(radars: RadarAxisValues[]): RadarAxisValues {
  if (radars.length === 0) {
    return createNeutralRadar();
  }

  const totals = RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = 0;
    return acc;
  }, createNeutralRadar(0));

  for (const radar of radars) {
    for (const dimension of RADAR_DIMENSIONS) {
      totals[dimension] += Number(radar[dimension] ?? 0);
    }
  }

  return RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = round(totals[dimension] / radars.length);
    return acc;
  }, createNeutralRadar());
}
