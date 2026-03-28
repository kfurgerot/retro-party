export type RadarDimension = "collaboration" | "product" | "decision" | "organization";

export type RadarPole =
  | "solo"
  | "team"
  | "delivery"
  | "quality"
  | "data"
  | "intuition"
  | "structured"
  | "adaptive";

export type RadarQuestion = {
  id: number;
  text: string;
  dimension: RadarDimension;
  pole: RadarPole;
};

export const RADAR_QUESTIONS: RadarQuestion[] = [
  { id: 1, text: "Je prefere travailler seul sur mes taches.", dimension: "collaboration", pole: "solo" },
  { id: 2, text: "J'aime resoudre des problemes en groupe.", dimension: "collaboration", pole: "team" },
  { id: 3, text: "Je sollicite facilement mes collegues quand j'ai un doute.", dimension: "collaboration", pole: "team" },
  { id: 4, text: "Je prefere avancer sans dependre des autres.", dimension: "collaboration", pole: "solo" },
  { id: 5, text: "Les echanges d'equipe ameliorent souvent la qualite d'une solution.", dimension: "collaboration", pole: "team" },
  { id: 6, text: "Je trouve les reunions souvent peu utiles pour avancer.", dimension: "collaboration", pole: "solo" },
  { id: 7, text: "J'aime partager regulierement mes avancees.", dimension: "collaboration", pole: "team" },
  { id: 8, text: "Je suis plus efficace quand je gere mes sujets de maniere autonome.", dimension: "collaboration", pole: "solo" },
  { id: 9, text: "Travailler en binome ou en revue croisee apporte de la valeur.", dimension: "collaboration", pole: "team" },
  { id: 10, text: "Je produis mon meilleur travail quand je suis seul.", dimension: "collaboration", pole: "solo" },

  { id: 11, text: "Livrer rapidement est souvent plus important que livrer parfaitement.", dimension: "product", pole: "delivery" },
  { id: 12, text: "Je prefere prendre plus de temps pour garantir la qualite.", dimension: "product", pole: "quality" },
  { id: 13, text: "Une premiere version imparfaite mais disponible vite peut etre une bonne chose.", dimension: "product", pole: "delivery" },
  { id: 14, text: "La robustesse technique doit primer sur la vitesse.", dimension: "product", pole: "quality" },
  { id: 15, text: "Les tests sont indispensables avant de livrer.", dimension: "product", pole: "quality" },
  { id: 16, text: "On peut ameliorer apres, l'important est de mettre vite entre les mains des utilisateurs.", dimension: "product", pole: "delivery" },
  { id: 17, text: "Reduire la dette technique est une priorite importante.", dimension: "product", pole: "quality" },
  { id: 18, text: "Le time-to-market doit souvent passer avant le perfectionnement.", dimension: "product", pole: "delivery" },
  { id: 19, text: "Je suis a l'aise avec des livraisons frequentes meme si tout n'est pas optimal.", dimension: "product", pole: "delivery" },
  { id: 20, text: "La stabilite d'ensemble vaut mieux qu'une sortie rapide.", dimension: "product", pole: "quality" },

  { id: 21, text: "Je prends plus facilement une decision quand j'ai des donnees pour l'appuyer.", dimension: "decision", pole: "data" },
  { id: 22, text: "Je me fie souvent a mon ressenti pour decider.", dimension: "decision", pole: "intuition" },
  { id: 23, text: "Les metriques sont essentielles pour arbitrer.", dimension: "decision", pole: "data" },
  { id: 24, text: "Le ressenti de l'equipe compte autant que les indicateurs.", dimension: "decision", pole: "intuition" },
  { id: 25, text: "J'aime analyser avant d'agir.", dimension: "decision", pole: "data" },
  { id: 26, text: "Je peux decider rapidement meme sans disposer de toutes les informations.", dimension: "decision", pole: "intuition" },
  { id: 27, text: "Les faits doivent primer sur les opinions.", dimension: "decision", pole: "data" },
  { id: 28, text: "L'humain doit parfois passer avant les chiffres.", dimension: "decision", pole: "intuition" },
  { id: 29, text: "Je challenge plus facilement une decision a partir d'elements mesurables.", dimension: "decision", pole: "data" },
  { id: 30, text: "Je privilegie volontiers le consensus meme si toutes les donnees ne sont pas disponibles.", dimension: "decision", pole: "intuition" },

  { id: 31, text: "J'aime planifier mon travail a l'avance.", dimension: "organization", pole: "structured" },
  { id: 32, text: "Je prefere m'adapter au fil de l'eau plutot que tout prevoir.", dimension: "organization", pole: "adaptive" },
  { id: 33, text: "Les processus clairs aident l'equipe a mieux avancer.", dimension: "organization", pole: "structured" },
  { id: 34, text: "Je n'aime pas etre trop contraint par des regles ou un cadre fixe.", dimension: "organization", pole: "adaptive" },
  { id: 35, text: "Les rituels Agile sont utiles quand ils sont bien utilises.", dimension: "organization", pole: "structured" },
  { id: 36, text: "Je prefere garder de la flexibilite plutot que figer un mode de fonctionnement.", dimension: "organization", pole: "adaptive" },
  { id: 37, text: "J'aime avoir un cadre clair pour travailler sereinement.", dimension: "organization", pole: "structured" },
  { id: 38, text: "Je m'adapte facilement aux imprevus et changements de cap.", dimension: "organization", pole: "adaptive" },
  { id: 39, text: "Les priorites doivent etre cadrees tot pour eviter la confusion.", dimension: "organization", pole: "structured" },
  { id: 40, text: "Je suis a l'aise dans l'incertitude si l'equipe garde sa capacite d'ajustement.", dimension: "organization", pole: "adaptive" },
];
