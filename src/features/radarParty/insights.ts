import type { RadarAxisValues } from "./scoring";

export type IndividualInsights = {
  summary: string;
  strengths: string[];
  watchouts: string[];
  workshopQuestions: string[];
};

export type TeamAxisSpread = {
  axis: keyof RadarAxisValues;
  min: number;
  max: number;
  spread: number;
  homogeneous: boolean;
  polarized: boolean;
};

export type TeamInsights = {
  summary: string;
  homogeneousAxes: string[];
  polarizedAxes: string[];
  divergenceAxes: string[];
  workshopQuestions: string[];
  spreads: TeamAxisSpread[];
};

const AXIS_LABELS: Record<keyof RadarAxisValues, string> = {
  visionStrategy: "Vision & strategie",
  planning: "Planification",
  execution: "Execution",
  mindsetBehaviors: "Etat d'esprit & comportements",
};

const axisMessage = (axis: keyof RadarAxisValues, value: number): string => {
  if (value >= 75) return `${AXIS_LABELS[axis]} est un vrai point d'appui d'equipe.`;
  if (value <= 40) return `${AXIS_LABELS[axis]} semble sous tension et merite un focus.`;
  return `${AXIS_LABELS[axis]} est globalement stable avec marge de progression.`;
};

const sortByScore = (radar: RadarAxisValues) =>
  (Object.entries(radar) as [keyof RadarAxisValues, number][])
    .map(([axis, value]) => ({ axis, value }))
    .sort((a, b) => b.value - a.value);

export function buildIndividualInsights(radar: RadarAxisValues): IndividualInsights {
  const sorted = sortByScore(radar);
  const [a1, a2, a3] = sorted;

  return {
    summary: `Profil dominant: ${AXIS_LABELS[a1.axis]} (${a1.value}/100). ${axisMessage(a1.axis, a1.value)}`,
    strengths: [
      `Point fort potentiel: ${axisMessage(a1.axis, a1.value)}`,
      `Levier secondaire: ${axisMessage(a2.axis, a2.value)}`,
      `Atout complementaire: ${axisMessage(a3.axis, a3.value)}`,
    ],
    watchouts: [
      `Vigilance: eviter de negliger les axes moins bien notes au profit de ${AXIS_LABELS[a1.axis]}.`,
      `Vigilance: verifier les effets de bord de ${AXIS_LABELS[a2.axis]} sur la charge de l'equipe.`,
      `Vigilance: formaliser des actions concretes autour de ${AXIS_LABELS[a3.axis]}.`,
    ],
    workshopQuestions: [
      `Qu'est-ce qui explique notre score sur ${AXIS_LABELS[a1.axis]} ?`,
      `Quel micro-changement pourrait faire progresser ${AXIS_LABELS[a2.axis]} des le prochain sprint ?`,
      `Quel signal concret suivrons-nous pour ameliorer ${AXIS_LABELS[a3.axis]} ?`,
    ],
  };
}

export function buildTeamInsights(teamRadar: RadarAxisValues, memberRadars: RadarAxisValues[]): TeamInsights {
  const spreads: TeamAxisSpread[] = (Object.keys(teamRadar) as (keyof RadarAxisValues)[]).map((axis) => {
    const values = memberRadars.map((radar) => radar[axis]);
    const min = values.length > 0 ? Math.min(...values) : teamRadar[axis];
    const max = values.length > 0 ? Math.max(...values) : teamRadar[axis];
    const spread = max - min;
    return {
      axis,
      min,
      max,
      spread,
      homogeneous: spread <= 12,
      polarized: spread > 25,
    };
  });

  const homogeneousAxes = spreads.filter((item) => item.homogeneous).map((item) => AXIS_LABELS[item.axis]);
  const polarizedAxes = spreads.filter((item) => item.polarized).map((item) => AXIS_LABELS[item.axis]);

  return {
    summary: `Radar equipe: Vision & strategie ${teamRadar.visionStrategy}, Planification ${teamRadar.planning}, Execution ${teamRadar.execution}, Etat d'esprit & comportements ${teamRadar.mindsetBehaviors}.`,
    homogeneousAxes,
    polarizedAxes,
    divergenceAxes: polarizedAxes,
    workshopQuestions: [
      "Quel axe a le plus d'impact business si on l'ameliore de 10 points ?",
      "Sur quel axe observons-nous le plus d'ecart de perception entre membres ?",
      "Quelle action d'equipe testons-nous des la prochaine iteration ?",
    ],
    spreads,
  };
}
