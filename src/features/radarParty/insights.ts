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
  collaboration: "Collaboration",
  product: "Approche produit",
  decision: "Decision",
  organization: "Organisation",
};

const axisMessage = (axis: keyof RadarAxisValues, value: number): string => {
  if (axis === "collaboration") {
    if (value > 70) return "Equipe tres tournee collectif.";
    if (value < 35) return "Forte autonomie individuelle, risque de silos.";
    return "Equilibre entre autonomie et dynamique collective.";
  }
  if (axis === "product") {
    if (value > 70) return "Bonne exigence qualite, attention a la lenteur potentielle.";
    if (value < 35) return "Forte culture delivery, attention a la dette technique.";
    return "Compromis sain entre vitesse et robustesse.";
  }
  if (axis === "decision") {
    if (value > 70) return "Decisions fortement pilotees par la mesure.";
    if (value < 35) return "Decisions plus intuitives et humaines.";
    return "Usage combine des donnees et de l'experience terrain.";
  }
  if (value > 70) return "Cadre fort et lisible, avec risque de rigidite.";
  if (value < 35) return "Souplesse elevee, avec risque de flou.";
  return "Cadre et adaptation globalement bien doses.";
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
      `Point fort possible sur ${AXIS_LABELS[a1.axis].toLowerCase()}: ${axisMessage(a1.axis, a1.value)}`,
      `Point fort possible sur ${AXIS_LABELS[a2.axis].toLowerCase()}: ${axisMessage(a2.axis, a2.value)}`,
      `Point fort possible sur ${AXIS_LABELS[a3.axis].toLowerCase()}: ${axisMessage(a3.axis, a3.value)}`,
    ],
    watchouts: [
      `Vigilance: verifier l'impact de ${AXIS_LABELS[a1.axis].toLowerCase()} sur les autres axes.`,
      `Vigilance: eviter les angles morts quand ${AXIS_LABELS[a2.axis].toLowerCase()} devient prioritaire.`,
      `Vigilance: expliciter les arbitrages autour de ${AXIS_LABELS[a3.axis].toLowerCase()}.`,
    ],
    workshopQuestions: [
      `Qu'est-ce qui nous aide aujourd'hui sur l'axe ${AXIS_LABELS[a1.axis]} ?`,
      `Quel risque concret observons-nous si ${AXIS_LABELS[a2.axis].toLowerCase()} est sur- ou sous-pondere ?`,
      `Quel experiment sur 2 semaines peut mieux equilibrer ${AXIS_LABELS[a3.axis].toLowerCase()} ?`,
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
  const divergenceAxes = polarizedAxes;

  return {
    summary: [
      `Radar equipe: Collaboration ${teamRadar.collaboration}, Produit ${teamRadar.product}, Decision ${teamRadar.decision}, Organisation ${teamRadar.organization}.`,
      `Lecture: ${axisMessage("collaboration", teamRadar.collaboration)} ${axisMessage("product", teamRadar.product)}`,
    ].join(" "),
    homogeneousAxes,
    polarizedAxes,
    divergenceAxes,
    workshopQuestions: [
      "Sur quel axe avons-nous le plus besoin d'un langage commun ?",
      "Quel est le cout actuel de nos ecarts de perception ?",
      "Quel accord d'equipe testons-nous au prochain sprint pour reduire un ecart critique ?",
    ],
    spreads,
  };
}
