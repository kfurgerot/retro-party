import { RADAR_DIMENSIONS, RADAR_DIMENSION_LABELS, type RadarDimension } from "./questions";
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

type AxisGuidance = {
  high: string;
  medium: string;
  low: string;
  workshopPrompt: string;
};

const AXIS_GUIDANCE: Record<RadarDimension, AxisGuidance> = {
  collaboration: {
    high: "la coopération est fluide et l’entraide soutient la performance collective.",
    medium: "la collaboration existe mais peut encore gagner en régularité.",
    low: "le risque de travail en silo est réel sans rituels de synchronisation renforcés.",
    workshopPrompt:
      "Quel rituel simple peut améliorer la circulation d’information cette semaine ?",
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
    workshopPrompt:
      "Quelle action d’amélioration continue allons-nous ancrer dès le prochain sprint ?",
  },
  alignment: {
    high: "les priorités sont claires et alignées avec les objectifs business.",
    medium: "la direction est globalement comprise mais parfois ambiguë.",
    low: "le manque d’alignement peut créer de la dispersion et des arbitrages incohérents.",
    workshopPrompt:
      "Quelle priorité devons-nous clarifier immédiatement pour réduire les ambiguïtés ?",
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
    workshopPrompt:
      "Quel indicateur de valeur allons-nous suivre pour guider les prochaines décisions ?",
  },
};

const sortByScore = (radar: RadarAxisValues) =>
  RADAR_DIMENSIONS.map((axis) => ({ axis, value: radar[axis] })).sort((a, b) => b.value - a.value);

const messageForAxis = (axis: RadarDimension, value: number) => {
  if (value >= 75) return AXIS_GUIDANCE[axis].high;
  if (value >= 55) return AXIS_GUIDANCE[axis].medium;
  return AXIS_GUIDANCE[axis].low;
};

export function buildIndividualInsights(radar: RadarAxisValues): IndividualInsights {
  const sorted = sortByScore(radar);
  const topThree = sorted.slice(0, 3);
  const lowThree = [...sorted].slice(-3).reverse();
  const dominant = topThree[0];
  const fragile = lowThree[0];
  const scoreGap = dominant.value - fragile.value;

  const summary =
    scoreGap > 25
      ? `Profil dominant: ${RADAR_DIMENSION_LABELS[dominant.axis]} (${dominant.value}/100). ${messageForAxis(
          dominant.axis,
          dominant.value,
        )} Axe à consolider en priorité: ${RADAR_DIMENSION_LABELS[fragile.axis]} (${fragile.value}/100).`
      : `Profil globalement équilibré. Point d’appui principal: ${RADAR_DIMENSION_LABELS[dominant.axis]} (${dominant.value}/100). Point de progression principal: ${RADAR_DIMENSION_LABELS[fragile.axis]} (${fragile.value}/100).`;

  return {
    summary,
    strengths: topThree.map(
      ({ axis, value }) =>
        `${RADAR_DIMENSION_LABELS[axis]} (${value}/100): ${messageForAxis(axis, value)}`,
    ),
    watchouts: lowThree.map(({ axis, value }) => {
      const severity = value < 40 ? "Vigilance élevée" : "Point de vigilance";
      return `${severity} - ${RADAR_DIMENSION_LABELS[axis]} (${value}/100): ${AXIS_GUIDANCE[axis].low}`;
    }),
    workshopQuestions: [
      `${RADAR_DIMENSION_LABELS[fragile.axis]}: ${AXIS_GUIDANCE[fragile.axis].workshopPrompt}`,
      `${RADAR_DIMENSION_LABELS[lowThree[1].axis]}: ${AXIS_GUIDANCE[lowThree[1].axis].workshopPrompt}`,
      `Comment préserver ${RADAR_DIMENSION_LABELS[dominant.axis]} tout en faisant progresser ${RADAR_DIMENSION_LABELS[fragile.axis]} ?`,
    ],
  };
}

export function buildTeamInsights(
  teamRadar: RadarAxisValues,
  memberRadars: RadarAxisValues[],
): TeamInsights {
  const spreads: TeamAxisSpread[] = RADAR_DIMENSIONS.map((axis) => {
    const values = memberRadars
      .map((radar) => radar[axis])
      .filter((value) => Number.isFinite(value));
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

  const homogeneousAxes = spreads
    .filter((item) => item.homogeneous)
    .map((item) => RADAR_DIMENSION_LABELS[item.axis]);
  const polarizedAxes = spreads
    .filter((item) => item.polarized)
    .map((item) => RADAR_DIMENSION_LABELS[item.axis]);

  const rankedTeamAxes = sortByScore(teamRadar);
  const topAxis = rankedTeamAxes[0];
  const lowAxis = rankedTeamAxes[rankedTeamAxes.length - 1];

  const summary =
    polarizedAxes.length > 0
      ? `Radar équipe: point fort moyen sur ${RADAR_DIMENSION_LABELS[topAxis.axis]} (${topAxis.value}/100), axe le plus bas sur ${RADAR_DIMENSION_LABELS[lowAxis.axis]} (${lowAxis.value}/100). Des divergences de perception sont marquées sur ${polarizedAxes.join(", ")}.`
      : `Radar équipe: point fort moyen sur ${RADAR_DIMENSION_LABELS[topAxis.axis]} (${topAxis.value}/100), axe le plus bas sur ${RADAR_DIMENSION_LABELS[lowAxis.axis]} (${lowAxis.value}/100). Les perceptions restent globalement alignées entre membres.`;

  return {
    summary,
    homogeneousAxes,
    polarizedAxes,
    divergenceAxes: polarizedAxes,
    workshopQuestions: [
      `Quelle action collective permettrait de renforcer ${RADAR_DIMENSION_LABELS[lowAxis.axis]} dès la prochaine itération ?`,
      polarizedAxes.length > 0
        ? `Qu’est-ce qui explique les écarts de perception sur ${polarizedAxes[0]} ?`
        : `Comment maintenir l’alignement actuel tout en progressant sur les axes les plus faibles ?`,
      `Quel indicateur suivons-nous sur 2 semaines pour mesurer l’impact des actions décidées ?`,
    ],
    spreads,
  };
}
