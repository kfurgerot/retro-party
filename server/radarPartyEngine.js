import { RADAR_QUESTIONS } from "./radarPartyQuestions.js";

function clampAnswer(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function round(value) {
  return Math.round(value);
}

export function computeRadarScores(answers) {
  const raw = {
    collaboration: { solo: 0, team: 0 },
    product: { delivery: 0, quality: 0 },
    decision: { data: 0, intuition: 0 },
    organization: { structured: 0, adaptive: 0 },
  };

  for (const question of RADAR_QUESTIONS) {
    const answer = clampAnswer(answers?.[String(question.id)] ?? answers?.[question.id]);
    if (question.dimension === "collaboration") raw.collaboration[question.pole] += answer;
    if (question.dimension === "product") raw.product[question.pole] += answer;
    if (question.dimension === "decision") raw.decision[question.pole] += answer;
    if (question.dimension === "organization") raw.organization[question.pole] += answer;
  }

  const polesPercent = {
    collaboration: { solo: 50, team: 50 },
    product: { delivery: 50, quality: 50 },
    decision: { data: 50, intuition: 50 },
    organization: { structured: 50, adaptive: 50 },
  };

  const collaborationTotal = raw.collaboration.solo + raw.collaboration.team;
  const collaborationSolo = collaborationTotal > 0 ? (raw.collaboration.solo / collaborationTotal) * 100 : 50;
  polesPercent.collaboration.solo = round(collaborationSolo);
  polesPercent.collaboration.team = 100 - polesPercent.collaboration.solo;

  const productTotal = raw.product.delivery + raw.product.quality;
  const productDelivery = productTotal > 0 ? (raw.product.delivery / productTotal) * 100 : 50;
  polesPercent.product.delivery = round(productDelivery);
  polesPercent.product.quality = 100 - polesPercent.product.delivery;

  const decisionTotal = raw.decision.data + raw.decision.intuition;
  const decisionData = decisionTotal > 0 ? (raw.decision.data / decisionTotal) * 100 : 50;
  polesPercent.decision.data = round(decisionData);
  polesPercent.decision.intuition = 100 - polesPercent.decision.data;

  const organizationTotal = raw.organization.structured + raw.organization.adaptive;
  const organizationStructured = organizationTotal > 0 ? (raw.organization.structured / organizationTotal) * 100 : 50;
  polesPercent.organization.structured = round(organizationStructured);
  polesPercent.organization.adaptive = 100 - polesPercent.organization.structured;

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

export function computeTeamAverageRadar(radars) {
  if (!Array.isArray(radars) || radars.length === 0) {
    return { collaboration: 50, product: 50, decision: 50, organization: 50 };
  }
  const total = radars.reduce(
    (acc, radar) => ({
      collaboration: acc.collaboration + Number(radar.collaboration || 0),
      product: acc.product + Number(radar.product || 0),
      decision: acc.decision + Number(radar.decision || 0),
      organization: acc.organization + Number(radar.organization || 0),
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

const AXIS_LABELS = {
  collaboration: "Collaboration",
  product: "Approche produit",
  decision: "Decision",
  organization: "Organisation",
};

function axisMessage(axis, value) {
  if (axis === "collaboration") {
    if (value > 70) return "Equipe tres tournee collectif.";
    if (value < 35) return "Forte autonomie individuelle, risque de silos.";
    return "Equilibre entre autonomie et dynamique collective.";
  }
  if (axis === "product") {
    if (value > 70) return "Bonne exigence qualite, attention a la lenteur potentielle.";
    if (value < 35) return "Attention dette technique / fragilite.";
    return "Compromis sain entre vitesse et robustesse.";
  }
  if (axis === "decision") {
    if (value > 70) return "Decisions tres pilotees par la mesure.";
    if (value < 35) return "Decisions plus intuitives / humaines.";
    return "Usage combine donnees et intuition terrain.";
  }
  if (value > 70) return "Cadre fort, bonne lisibilite mais possible rigidite.";
  if (value < 35) return "Souplesse elevee, mais possible flou.";
  return "Bon equilibre entre cadre et adaptation.";
}

function sortByExtremeness(radar) {
  return Object.entries(radar)
    .map(([axis, value]) => ({ axis, value: Number(value), delta: Math.abs(Number(value) - 50) }))
    .sort((a, b) => b.delta - a.delta);
}

export function buildIndividualInsights(radar) {
  const sorted = sortByExtremeness(radar);
  const first = sorted[0];
  const second = sorted[1];
  const third = sorted[2];

  return {
    summary: `Profil dominant: ${AXIS_LABELS[first.axis]} (${first.value}/100). ${axisMessage(first.axis, first.value)}`,
    strengths: [
      `Point fort possible sur ${AXIS_LABELS[first.axis].toLowerCase()}: ${axisMessage(first.axis, first.value)}`,
      `Point fort possible sur ${AXIS_LABELS[second.axis].toLowerCase()}: ${axisMessage(second.axis, second.value)}`,
      `Point fort possible sur ${AXIS_LABELS[third.axis].toLowerCase()}: ${axisMessage(third.axis, third.value)}`,
    ],
    watchouts: [
      `Vigilance: surveiller les effets de bord sur l'axe ${AXIS_LABELS[first.axis].toLowerCase()}.`,
      `Vigilance: expliciter les arbitrages quand ${AXIS_LABELS[second.axis].toLowerCase()} devient prioritaire.`,
      `Vigilance: conserver la coherence d'equipe autour de ${AXIS_LABELS[third.axis].toLowerCase()}.`,
    ],
    workshopQuestions: [
      `Qu'est-ce qui nous rend performants sur ${AXIS_LABELS[first.axis]} ?`,
      `Quel risque concret voyons-nous si ${AXIS_LABELS[second.axis].toLowerCase()} est desequilibre ?`,
      `Quel test d'equipe mettons-nous en place pour mieux equilibrer ${AXIS_LABELS[third.axis].toLowerCase()} ?`,
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
    summary: `Radar equipe: Collaboration ${teamRadar.collaboration}, Produit ${teamRadar.product}, Decision ${teamRadar.decision}, Organisation ${teamRadar.organization}.`,
    homogeneousAxes,
    polarizedAxes,
    divergenceAxes: polarizedAxes,
    workshopQuestions: [
      "Sur quel axe avons-nous le plus besoin d'un langage commun ?",
      "Quel est le cout actuel de nos ecarts de perception ?",
      "Quel accord d'equipe testons-nous au prochain sprint pour reduire une divergence majeure ?",
    ],
    spreads,
  };
}
