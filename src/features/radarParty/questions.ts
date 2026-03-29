export type RadarDimension =
  | "collaboration"
  | "fun"
  | "learning"
  | "alignment"
  | "ownership"
  | "process"
  | "resources"
  | "roles"
  | "speed"
  | "value";

export const RADAR_DIMENSIONS: RadarDimension[] = [
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

export const RADAR_DIMENSION_LABELS: Record<RadarDimension, string> = {
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

export type RadarQuestion = {
  id: number;
  text: string;
  dimension: RadarDimension;
  subdimension: string;
};

export const RADAR_QUESTIONS: RadarQuestion[] = [
  { id: 1, text: "Les membres de l’équipe communiquent régulièrement entre eux.", dimension: "collaboration", subdimension: "collaboration" },
  { id: 2, text: "Les échanges sont constructifs, même en cas de désaccord.", dimension: "collaboration", subdimension: "collaboration" },
  { id: 3, text: "L’information circule facilement au sein de l’équipe.", dimension: "collaboration", subdimension: "collaboration" },
  { id: 4, text: "Nous collaborons efficacement avec les autres équipes / parties prenantes.", dimension: "collaboration", subdimension: "collaboration" },
  { id: 5, text: "Nous nous entraidons spontanément pour atteindre nos objectifs.", dimension: "collaboration", subdimension: "collaboration" },

  { id: 6, text: "Je prends du plaisir à travailler avec cette équipe.", dimension: "fun", subdimension: "fun" },
  { id: 7, text: "L’ambiance est positive et motivante au quotidien.", dimension: "fun", subdimension: "fun" },
  { id: 8, text: "Nous célébrons régulièrement nos réussites.", dimension: "fun", subdimension: "fun" },
  { id: 9, text: "L’équipe sait garder une bonne énergie même en période de stress.", dimension: "fun", subdimension: "fun" },
  { id: 10, text: "Les moments informels renforcent la cohésion de l’équipe.", dimension: "fun", subdimension: "fun" },

  { id: 11, text: "L’équipe prend le temps de s’améliorer en continu.", dimension: "learning", subdimension: "learning" },
  { id: 12, text: "Nous partageons régulièrement nos connaissances.", dimension: "learning", subdimension: "learning" },
  { id: 13, text: "Les erreurs sont utilisées comme des opportunités d’apprentissage.", dimension: "learning", subdimension: "learning" },
  { id: 14, text: "Je sens que je progresse dans mes compétences au sein de l’équipe.", dimension: "learning", subdimension: "learning" },
  { id: 15, text: "Des actions concrètes sont mises en place suite aux rétrospectives.", dimension: "learning", subdimension: "learning" },

  { id: 16, text: "Les objectifs de l’équipe sont clairs pour tous.", dimension: "alignment", subdimension: "alignment" },
  { id: 17, text: "Nous comprenons la valeur de ce que nous livrons.", dimension: "alignment", subdimension: "alignment" },
  { id: 18, text: "Les priorités sont bien définies et comprises.", dimension: "alignment", subdimension: "alignment" },
  { id: 19, text: "Nous savons dire non quand cela ne correspond pas à nos objectifs.", dimension: "alignment", subdimension: "alignment" },
  { id: 20, text: "Les décisions sont cohérentes avec la vision produit / entreprise.", dimension: "alignment", subdimension: "alignment" },

  { id: 21, text: "L’équipe prend des décisions sans dépendre systématiquement de l’extérieur.", dimension: "ownership", subdimension: "ownership" },
  { id: 22, text: "Chacun se sent responsable du résultat collectif.", dimension: "ownership", subdimension: "ownership" },
  { id: 23, text: "Nous prenons des initiatives pour améliorer notre fonctionnement.", dimension: "ownership", subdimension: "ownership" },
  { id: 24, text: "Les responsabilités sont assumées sans ambiguïté.", dimension: "ownership", subdimension: "ownership" },
  { id: 25, text: "Les problèmes sont traités par l’équipe sans attendre une validation externe.", dimension: "ownership", subdimension: "ownership" },

  { id: 26, text: "Nos processus nous aident réellement à être efficaces.", dimension: "process", subdimension: "process" },
  { id: 27, text: "Nous adaptons nos pratiques en fonction des retours.", dimension: "process", subdimension: "process" },
  { id: 28, text: "Les rituels sont utiles et apportent de la valeur.", dimension: "process", subdimension: "process" },
  { id: 29, text: "Nous ne sommes pas ralentis par des procédures inutiles.", dimension: "process", subdimension: "process" },
  { id: 30, text: "Nos méthodes de travail sont régulièrement remises en question.", dimension: "process", subdimension: "process" },

  { id: 31, text: "Nous avons les outils nécessaires pour bien travailler.", dimension: "resources", subdimension: "resources" },
  { id: 32, text: "Les problèmes techniques sont traités rapidement.", dimension: "resources", subdimension: "resources" },
  { id: 33, text: "Nous avons accès au support nécessaire (métiers, IT, management).", dimension: "resources", subdimension: "resources" },
  { id: 34, text: "Nous disposons du temps nécessaire pour faire du travail de qualité.", dimension: "resources", subdimension: "resources" },
  { id: 35, text: "Les dépendances externes ne bloquent pas durablement notre travail.", dimension: "resources", subdimension: "resources" },

  { id: 36, text: "Les rôles de chacun sont clairs.", dimension: "roles", subdimension: "roles" },
  { id: 37, text: "Les responsabilités sont bien réparties dans l’équipe.", dimension: "roles", subdimension: "roles" },
  { id: 38, text: "Nous avons toutes les compétences nécessaires dans l’équipe.", dimension: "roles", subdimension: "roles" },
  { id: 39, text: "Il y a peu de zones de flou ou de doublons dans les responsabilités.", dimension: "roles", subdimension: "roles" },
  { id: 40, text: "Chacun comprend le rôle des autres membres de l’équipe.", dimension: "roles", subdimension: "roles" },

  { id: 41, text: "Nous respectons généralement nos engagements.", dimension: "speed", subdimension: "speed" },
  { id: 42, text: "Le rythme de travail est soutenable dans la durée.", dimension: "speed", subdimension: "speed" },
  { id: 43, text: "Nous arrivons à livrer régulièrement.", dimension: "speed", subdimension: "speed" },
  { id: 44, text: "Les imprévus sont bien gérés sans désorganiser l’équipe.", dimension: "speed", subdimension: "speed" },
  { id: 45, text: "Le flux de travail est fluide (peu de blocages, peu d’attente).", dimension: "speed", subdimension: "speed" },

  { id: 46, text: "Nous comprenons l’impact de ce que nous livrons.", dimension: "value", subdimension: "value" },
  { id: 47, text: "Nous mesurons la valeur apportée aux utilisateurs.", dimension: "value", subdimension: "value" },
  { id: 48, text: "Nous priorisons en fonction de la valeur métier.", dimension: "value", subdimension: "value" },
  { id: 49, text: "Ce que nous livrons répond réellement aux besoins.", dimension: "value", subdimension: "value" },
  { id: 50, text: "Les retours utilisateurs influencent nos décisions.", dimension: "value", subdimension: "value" },
];
