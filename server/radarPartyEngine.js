import { RADAR_QUESTIONS } from "./radarPartyQuestions.js";

const RADAR_DIMENSIONS = [
  "collaboration",
  "fun",
  "learning",
  "alignment",
  "ownership",
  "process",
  "resources",
  "roles",
  "speed",
  "value",
];

const AXIS_LABELS = {
  collaboration: "Collaboration",
  fun: "Fun",
  learning: "Apprentissages",
  alignment: "Alignement",
  ownership: "Ownership (Responsabilité)",
  process: "Processus",
  resources: "Ressources",
  roles: "Rôles",
  speed: "Vitesse",
  value: "Valeur",
};

const AXIS_GUIDANCE = {
  collaboration: {
    high: "la coopération est fluide et l’entraide soutient la performance collective.",
    medium: "la collaboration existe mais peut encore gagner en régularité.",
    low: "le risque de travail en silo est réel sans rituels de synchronisation renforcés.",
    workshopPrompt: "Quel rituel simple peut améliorer la circulation d’information cette semaine ?",
  },
  fun: {
    high: "l’ambiance d’équipe renforce l’engagement au quotidien.",
    medium: "la dynamique est correcte mais reste sensible à la pression.",
    low: "la baisse d’énergie peut impacter motivation et cohésion.",
    workshopPrompt: "Qu’est-ce qui redonnerait rapidement de l’énergie positive à l’équipe ?",
  },
  learning: {
    high: "l’équipe apprend activement et transforme les retours en progrès.",
    medium: "les apprentissages existent mais sont encore peu systématisés.",
    low: "le risque est de répéter les mêmes problèmes sans boucle d’amélioration claire.",
    workshopPrompt: "Quelle action d’amélioration continue allons-nous ancrer dès le prochain sprint ?",
  },
  alignment: {
    high: "les priorités sont claires et alignées avec les objectifs business.",
    medium: "la direction est globalement comprise mais parfois ambiguë.",
    low: "le manque d’alignement peut créer de la dispersion et des arbitrages incohérents.",
    workshopPrompt: "Quelle priorité devons-nous clarifier immédiatement pour réduire les ambiguïtés ?",
  },
  ownership: {
    high: "la responsabilité collective est forte et l’équipe agit avec autonomie.",
    medium: "l’ownership progresse mais dépend encore de validations externes.",
    low: "la dépendance externe freine la capacité de décision de l’équipe.",
    workshopPrompt: "Quelle décision l’équipe pourrait reprendre en autonomie dès maintenant ?",
  },
  process: {
    high: "les processus soutiennent l’exécution sans lourdeur inutile.",
    medium: "les pratiques fonctionnent mais méritent d’être affinées.",
    low: "les modes de fonctionnement peuvent ralentir la livraison de valeur.",
    workshopPrompt: "Quel processus pouvons-nous simplifier sans perdre en qualité ?",
  },
  resources: {
    high: "les ressources et le support disponibles facilitent le delivery.",
    medium: "les moyens sont globalement suffisants avec quelques points de friction.",
    low: "des contraintes de moyens ou de support peuvent bloquer durablement l’équipe.",
    workshopPrompt: "Quel blocage ressource doit être traité en priorité et par qui ?",
  },
  roles: {
    high: "les responsabilités sont claires et complémentaires.",
    medium: "la répartition fonctionne mais certaines zones de flou subsistent.",
    low: "le manque de clarté des rôles peut générer doublons et angles morts.",
    workshopPrompt: "Quelle responsabilité doit être clarifiée pour fluidifier la collaboration ?",
  },
  speed: {
    high: "le rythme est soutenable et la livraison reste régulière.",
    medium: "la cadence est correcte mais fragile en cas d’imprévus.",
    low: "la vitesse perçue peut être freinée par des blocages récurrents.",
    workshopPrompt: "Quel goulot d’étranglement devons-nous traiter pour fluidifier le flux ?",
  },
  value: {
    high: "la valeur livrée est lisible et orientée impact utilisateur.",
    medium: "la valeur est présente mais pas toujours mesurée ou explicitée.",
    low: "la priorisation risque de se déconnecter des besoins réels des utilisateurs.",
    workshopPrompt: "Quel indicateur de valeur allons-nous suivre pour guider les prochaines décisions ?",
  },
};

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

function createNeutralRadar(seed = 50) {
  return RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = round(seed);
    return acc;
  }, {});
}

function sortByScore(radar) {
  return RADAR_DIMENSIONS.map((axis) => ({ axis, value: Number(radar?.[axis] ?? 0) })).sort((a, b) => b.value - a.value);
}

function messageForAxis(axis, value) {
  if (value >= 75) return AXIS_GUIDANCE[axis].high;
  if (value >= 55) return AXIS_GUIDANCE[axis].medium;
  return AXIS_GUIDANCE[axis].low;
}

export function computeRadarScores(answers) {
  const byDimension = RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = [];
    return acc;
  }, {});

  const bySubdimension = {};

  for (const question of RADAR_QUESTIONS) {
    const answer = clampAnswer(answers?.[String(question.id)] ?? answers?.[question.id]);
    byDimension[question.dimension].push(answer);

    if (!bySubdimension[question.subdimension]) {
      bySubdimension[question.subdimension] = [];
    }
    bySubdimension[question.subdimension].push(answer);
  }

  const radar = RADAR_DIMENSIONS.reduce((acc, dimension) => {
    const values = byDimension[dimension];
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 3;
    acc[dimension] = round(toPct(average));
    return acc;
  }, createNeutralRadar());

  const polesPercent = {};
  Object.entries(bySubdimension).forEach(([key, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    polesPercent[key] = round(toPct(avg));
  });

  return { radar, polesPercent };
}

export function computeTeamAverageRadar(radars) {
  if (!Array.isArray(radars) || radars.length === 0) {
    return createNeutralRadar();
  }

  const total = RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = 0;
    return acc;
  }, createNeutralRadar(0));

  for (const radar of radars) {
    for (const dimension of RADAR_DIMENSIONS) {
      total[dimension] += Number(radar?.[dimension] || 0);
    }
  }

  return RADAR_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = round(total[dimension] / radars.length);
    return acc;
  }, createNeutralRadar());
}

export function buildIndividualInsights(radar) {
  const sorted = sortByScore(radar);
  const topThree = sorted.slice(0, 3);
  const lowThree = sorted.slice(-3).reverse();
  const dominant = topThree[0];
  const fragile = lowThree[0];
  const scoreGap = dominant.value - fragile.value;

  const summary =
    scoreGap > 25
      ? `Profil dominant: ${AXIS_LABELS[dominant.axis]} (${dominant.value}/100). ${messageForAxis(
          dominant.axis,
          dominant.value
        )} Axe à consolider en priorité: ${AXIS_LABELS[fragile.axis]} (${fragile.value}/100).`
      : `Profil globalement équilibré. Point d’appui principal: ${AXIS_LABELS[dominant.axis]} (${dominant.value}/100). Point de progression principal: ${AXIS_LABELS[fragile.axis]} (${fragile.value}/100).`;

  return {
    summary,
    strengths: topThree.map(
      ({ axis, value }) => `${AXIS_LABELS[axis]} (${value}/100): ${messageForAxis(axis, value)}`
    ),
    watchouts: lowThree.map(({ axis, value }) => {
      const severity = value < 40 ? "Vigilance élevée" : "Point de vigilance";
      return `${severity} - ${AXIS_LABELS[axis]} (${value}/100): ${AXIS_GUIDANCE[axis].low}`;
    }),
    workshopQuestions: [
      `${AXIS_LABELS[fragile.axis]}: ${AXIS_GUIDANCE[fragile.axis].workshopPrompt}`,
      `${AXIS_LABELS[lowThree[1].axis]}: ${AXIS_GUIDANCE[lowThree[1].axis].workshopPrompt}`,
      `Comment préserver ${AXIS_LABELS[dominant.axis]} tout en faisant progresser ${AXIS_LABELS[fragile.axis]} ?`,
    ],
  };
}

export function buildTeamInsights(teamRadar, memberRadars) {
  const spreads = RADAR_DIMENSIONS.map((axis) => {
    const values = memberRadars.map((radar) => Number(radar?.[axis])).filter((value) => Number.isFinite(value));
    const min = values.length ? Math.min(...values) : Number(teamRadar?.[axis] || 0);
    const max = values.length ? Math.max(...values) : Number(teamRadar?.[axis] || 0);
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

  const rankedTeamAxes = sortByScore(teamRadar || createNeutralRadar());
  const topAxis = rankedTeamAxes[0];
  const lowAxis = rankedTeamAxes[rankedTeamAxes.length - 1];

  const summary =
    polarizedAxes.length > 0
      ? `Radar équipe: point fort moyen sur ${AXIS_LABELS[topAxis.axis]} (${topAxis.value}/100), axe le plus bas sur ${AXIS_LABELS[lowAxis.axis]} (${lowAxis.value}/100). Des divergences de perception sont marquées sur ${polarizedAxes.join(", ")}.`
      : `Radar équipe: point fort moyen sur ${AXIS_LABELS[topAxis.axis]} (${topAxis.value}/100), axe le plus bas sur ${AXIS_LABELS[lowAxis.axis]} (${lowAxis.value}/100). Les perceptions restent globalement alignées entre membres.`;

  return {
    summary,
    homogeneousAxes,
    polarizedAxes,
    divergenceAxes: polarizedAxes,
    workshopQuestions: [
      `Quelle action collective permettrait de renforcer ${AXIS_LABELS[lowAxis.axis]} dès la prochaine itération ?`,
      polarizedAxes.length > 0
        ? `Qu’est-ce qui explique les écarts de perception sur ${polarizedAxes[0]} ?`
        : "Comment maintenir l’alignement actuel tout en progressant sur les axes les plus faibles ?",
      "Quel indicateur suivons-nous sur 2 semaines pour mesurer l’impact des actions décidées ?",
    ],
    spreads,
  };
}
