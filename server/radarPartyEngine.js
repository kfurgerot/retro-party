import { RADAR_QUESTIONS } from "./radarPartyQuestions.js";

function clampAnswer(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function round(value) {
  return Math.round(value);
}

function toPct(avgOnFive) {
  return ((avgOnFive - 1) / 4) * 100;
}

export function computeRadarScores(answers) {
  const byDimension = {
    visionStrategy: [],
    planning: [],
    execution: [],
    mindsetBehaviors: [],
  };

  const bySubdimension = {};

  for (const question of RADAR_QUESTIONS) {
    const answer = clampAnswer(answers?.[String(question.id)] ?? answers?.[question.id]);
    byDimension[question.dimension].push(answer);

    if (!bySubdimension[question.subdimension]) {
      bySubdimension[question.subdimension] = [];
    }
    bySubdimension[question.subdimension].push(answer);
  }

  const radar = {
    visionStrategy: round(toPct(byDimension.visionStrategy.reduce((a, b) => a + b, 0) / byDimension.visionStrategy.length)),
    planning: round(toPct(byDimension.planning.reduce((a, b) => a + b, 0) / byDimension.planning.length)),
    execution: round(toPct(byDimension.execution.reduce((a, b) => a + b, 0) / byDimension.execution.length)),
    mindsetBehaviors: round(
      toPct(byDimension.mindsetBehaviors.reduce((a, b) => a + b, 0) / byDimension.mindsetBehaviors.length)
    ),
  };

  const polesPercent = {};
  Object.entries(bySubdimension).forEach(([key, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    polesPercent[key] = round(toPct(avg));
  });

  return { radar, polesPercent };
}

export function computeTeamAverageRadar(radars) {
  if (!Array.isArray(radars) || radars.length === 0) {
    return { visionStrategy: 50, planning: 50, execution: 50, mindsetBehaviors: 50 };
  }

  const total = radars.reduce(
    (acc, radar) => ({
      visionStrategy: acc.visionStrategy + Number(radar.visionStrategy || 0),
      planning: acc.planning + Number(radar.planning || 0),
      execution: acc.execution + Number(radar.execution || 0),
      mindsetBehaviors: acc.mindsetBehaviors + Number(radar.mindsetBehaviors || 0),
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

const AXIS_LABELS = {
  visionStrategy: "Vision & strategie",
  planning: "Planification",
  execution: "Execution",
  mindsetBehaviors: "Etat d'esprit & comportements",
};

function axisMessage(axis, value) {
  if (value >= 75) return `${AXIS_LABELS[axis]} est un vrai point d'appui d'equipe.`;
  if (value <= 40) return `${AXIS_LABELS[axis]} semble sous tension et merite un focus.`;
  return `${AXIS_LABELS[axis]} est globalement stable avec marge de progression.`;
}

function sortByScore(radar) {
  return Object.entries(radar)
    .map(([axis, value]) => ({ axis, value: Number(value) }))
    .sort((a, b) => b.value - a.value);
}

export function buildIndividualInsights(radar) {
  const sorted = sortByScore(radar);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  return {
    summary: `Profil dominant: ${AXIS_LABELS[first.axis]} (${first.value}/100). ${axisMessage(first.axis, first.value)}`,
    strengths: [
      `Point fort potentiel: ${axisMessage(first.axis, first.value)}`,
      `Levier secondaire: ${axisMessage(second.axis, second.value)}`,
      `Atout complementaire: ${axisMessage(third.axis, third.value)}`,
    ],
    watchouts: [
      `Vigilance: eviter de negliger les axes moins bien notes au profit de ${AXIS_LABELS[first.axis]}.`,
      `Vigilance: verifier les effets de bord de ${AXIS_LABELS[second.axis]} sur la charge de l'equipe.`,
      `Vigilance: formaliser des actions concretes autour de ${AXIS_LABELS[third.axis]}.`,
    ],
    workshopQuestions: [
      `Qu'est-ce qui explique notre score sur ${AXIS_LABELS[first.axis]} ?`,
      `Quel micro-changement pourrait faire progresser ${AXIS_LABELS[second.axis]} des le prochain sprint ?`,
      `Quel signal concret suivrons-nous pour ameliorer ${AXIS_LABELS[third.axis]} ?`,
    ],
  };
}

export function buildTeamInsights(teamRadar, memberRadars) {
  const spreads = Object.keys(teamRadar).map((axis) => {
    const values = memberRadars.map((radar) => Number(radar[axis]));
    const min = values.length ? Math.min(...values) : Number(teamRadar[axis]);
    const max = values.length ? Math.max(...values) : Number(teamRadar[axis]);
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

  const homogeneousAxes = spreads.filter((x) => x.homogeneous).map((x) => AXIS_LABELS[x.axis]);
  const polarizedAxes = spreads.filter((x) => x.polarized).map((x) => AXIS_LABELS[x.axis]);

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
