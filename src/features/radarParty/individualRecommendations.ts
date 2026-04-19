import { RADAR_DIMENSIONS, RADAR_DIMENSION_LABELS, type RadarDimension } from "./questions";
import type { RadarAxisValues } from "./scoring";

export type IndividualRecommendationKind = "reinforce" | "next-lever" | "preserve";

export type IndividualRecommendationCard = {
  kind: IndividualRecommendationKind;
  axis: RadarDimension;
  axisLabel: string;
  score: number;
  title: string;
  observation: string;
  suggestionLabel: "Suggestion";
  suggestion: string;
  firstStep: string;
  indicator: string;
};

export type IndividualRecommendations = {
  cards: IndividualRecommendationCard[];
};

type AxisCopy = {
  reinforceSuggestion: string;
  reinforceFirstStep: string;
  reinforceIndicator: string;
  preserveSuggestion: string;
  preserveFirstStep: string;
  preserveIndicator: string;
};

const AXIS_COPY: Record<RadarDimension, AxisCopy> = {
  collaboration: {
    reinforceSuggestion:
      "Rendre la collaboration plus visible avec un rituel court de coordination.",
    reinforceFirstStep:
      "Tester un point de synchro de 10 minutes sur les blocages pendant 2 semaines.",
    reinforceIndicator: "Nombre de blocages leves en moins de 48h.",
    preserveSuggestion: "Conserver les pratiques d'entraide qui fonctionnent deja dans l'equipe.",
    preserveFirstStep:
      "Identifier un rituel de collaboration efficace et le garder dans le prochain sprint.",
    preserveIndicator: "Maintien du score collaboration et feedback positif sur la coordination.",
  },
  fun: {
    reinforceSuggestion: "Soutenir l'energie collective avec des moments courts de respiration.",
    reinforceFirstStep: "Ajouter un rituel hebdo de celebration ou de reconnaissance.",
    reinforceIndicator: "Perception d'energie de l'equipe au prochain point d'etape.",
    preserveSuggestion: "Preserver l'ambiance positive qui soutient l'engagement quotidien.",
    preserveFirstStep: "Maintenir un moment de celebration d'equipe chaque semaine.",
    preserveIndicator: "Stabilite du score fun sur les deux prochaines semaines.",
  },
  learning: {
    reinforceSuggestion: "Transformer les constats en actions d'amelioration concretes et suivies.",
    reinforceFirstStep: "Choisir une action d'apprentissage a tester des cette semaine.",
    reinforceIndicator: "Taux d'actions d'amelioration terminees sur la periode.",
    preserveSuggestion: "Conserver les pratiques d'apprentissage qui font progresser l'equipe.",
    preserveFirstStep: "Formaliser un partage de connaissance court dans le rituel d'equipe.",
    preserveIndicator: "Maintien du score learning et progression percue des competences.",
  },
  alignment: {
    reinforceSuggestion: "Clarifier les priorites pour reduire les ambiguities de decision.",
    reinforceFirstStep: "Rendre visible un top 3 des priorites pour les 2 semaines a venir.",
    reinforceIndicator: "Part des travaux explicitement relies aux priorites affichees.",
    preserveSuggestion: "Preserver la clarte actuelle des objectifs lors des arbitrages.",
    preserveFirstStep: "Maintenir un rappel de priorites en debut de sprint.",
    preserveIndicator: "Stabilite du score alignment et baisse des incomprehensions.",
  },
  ownership: {
    reinforceSuggestion: "Renforcer l'autonomie avec des decisions prises plus pres du terrain.",
    reinforceFirstStep: "Identifier une decision recurrente a reprendre directement en equipe.",
    reinforceIndicator: "Nombre de decisions prises sans escalade externe.",
    preserveSuggestion: "Preserver le niveau de responsabilite collective deja present.",
    preserveFirstStep: "Lister les zones d'autonomie a proteger sur le prochain cycle.",
    preserveIndicator: "Maintien du score ownership et fluidite des decisions.",
  },
  process: {
    reinforceSuggestion: "Simplifier un processus pour gagner en fluidite sans perdre en qualite.",
    reinforceFirstStep: "Supprimer ou adapter une etape jugee peu utile pendant 2 semaines.",
    reinforceIndicator: "Evolution du temps de cycle apres simplification.",
    preserveSuggestion: "Conserver les rituels utiles et evitant la lourdeur process.",
    preserveFirstStep: "Identifier une pratique process a garder telle quelle.",
    preserveIndicator: "Stabilite du score process et satisfaction sur la fluidite.",
  },
  resources: {
    reinforceSuggestion: "Traiter les contraintes de moyens qui freinent le delivery.",
    reinforceFirstStep:
      "Lister les 3 blocages ressources prioritaires et choisir le premier a lever.",
    reinforceIndicator: "Nombre de blocages ressources leves en 2 semaines.",
    preserveSuggestion:
      "Preserver les conditions de travail qui facilitent actuellement la livraison.",
    preserveFirstStep: "Documenter les ressources critiques a securiser sur la periode.",
    preserveIndicator: "Maintien du score resources et baisse des interruptions.",
  },
  roles: {
    reinforceSuggestion: "Clarifier les roles pour reduire les zones de flou et les doublons.",
    reinforceFirstStep: "Aligner l'equipe sur qui fait quoi pour une activite concrete.",
    reinforceIndicator: "Reduction des clarifications de role en cours de sprint.",
    preserveSuggestion: "Conserver la clarte des responsabilites deja acquise.",
    preserveFirstStep: "Revalider rapidement les interfaces de role a la prochaine planification.",
    preserveIndicator: "Stabilite du score roles et baisse des chevauchements.",
  },
  speed: {
    reinforceSuggestion: "Fluidifier le flux en traitant le principal point de ralentissement.",
    reinforceFirstStep: "Identifier un goulot et lancer une action de debouchage cette semaine.",
    reinforceIndicator: "Evolution du lead time et du nombre de travaux bloques.",
    preserveSuggestion: "Preserver le rythme soutenable actuel sans pression excessive.",
    preserveFirstStep: "Maintenir un garde-fou sur la charge de travail en cours de sprint.",
    preserveIndicator: "Maintien du score speed avec une cadence stable.",
  },
  value: {
    reinforceSuggestion: "Reconnecter les choix de travail a la valeur utilisateur.",
    reinforceFirstStep: "Ajouter un critere d'impact utilisateur sur une priorite de la semaine.",
    reinforceIndicator: "Part des sujets priorises avec impact utilisateur explicite.",
    preserveSuggestion: "Preserver l'orientation valeur dans les prochaines decisions.",
    preserveFirstStep: "Continuer a verifier l'impact attendu sur un sujet cle chaque semaine.",
    preserveIndicator: "Maintien du score value et retours utilisateurs exploites.",
  },
};

const DIMENSION_INDEX = RADAR_DIMENSIONS.reduce(
  (acc, dimension, index) => {
    acc[dimension] = index;
    return acc;
  },
  {} as Record<RadarDimension, number>,
);

function toAxisScores(radar: RadarAxisValues) {
  return RADAR_DIMENSIONS.map((axis) => ({
    axis,
    score: Number.isFinite(radar[axis]) ? Math.round(radar[axis]) : 0,
    index: DIMENSION_INDEX[axis],
  }));
}

function sortAscendingStable(radar: RadarAxisValues) {
  return toAxisScores(radar).sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.index - b.index;
  });
}

function sortDescendingStable(radar: RadarAxisValues) {
  return toAxisScores(radar).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.index - a.index;
  });
}

function buildCard(
  kind: IndividualRecommendationKind,
  axis: RadarDimension,
  score: number,
): IndividualRecommendationCard {
  const axisLabel = RADAR_DIMENSION_LABELS[axis];
  const copy = AXIS_COPY[axis];

  if (kind === "preserve") {
    return {
      kind,
      axis,
      axisLabel,
      score,
      title: `A preserver: ${axisLabel}`,
      observation: `Score actuel: ${score}/100. C'est un point fort a conserver pendant la progression.`,
      suggestionLabel: "Suggestion",
      suggestion: copy.preserveSuggestion,
      firstStep: copy.preserveFirstStep,
      indicator: copy.preserveIndicator,
    };
  }

  const isPrimary = kind === "reinforce";
  return {
    kind,
    axis,
    axisLabel,
    score,
    title: isPrimary ? `A renforcer: ${axisLabel}` : `Prochain levier: ${axisLabel}`,
    observation: isPrimary
      ? `Score actuel: ${score}/100. C'est la priorite la plus faible du profil individuel.`
      : `Score actuel: ${score}/100. C'est un levier secondaire a travailler apres la priorite principale.`,
    suggestionLabel: "Suggestion",
    suggestion: copy.reinforceSuggestion,
    firstStep: copy.reinforceFirstStep,
    indicator: copy.reinforceIndicator,
  };
}

export function buildIndividualRecommendations(radar: RadarAxisValues): IndividualRecommendations {
  const lowestToHighest = sortAscendingStable(radar);
  const highestToLowest = sortDescendingStable(radar);
  const usedAxes = new Set<RadarDimension>();
  const cards: IndividualRecommendationCard[] = [];

  const weakest = lowestToHighest[0];
  if (weakest) {
    usedAxes.add(weakest.axis);
    cards.push(buildCard("reinforce", weakest.axis, weakest.score));
  }

  const nextWeakest = lowestToHighest.find((item) => !usedAxes.has(item.axis));
  if (nextWeakest) {
    usedAxes.add(nextWeakest.axis);
    cards.push(buildCard("next-lever", nextWeakest.axis, nextWeakest.score));
  }

  const strongest = highestToLowest.find((item) => !usedAxes.has(item.axis));
  if (strongest) {
    usedAxes.add(strongest.axis);
    cards.push(buildCard("preserve", strongest.axis, strongest.score));
  }

  return {
    cards: cards.slice(0, 3),
  };
}
