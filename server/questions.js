export const QUESTIONS = {
  "blue": [
    "Qu’est-ce qui a le mieux fonctionné ce sprint ?",
    "Qu’est-ce qui a été livré et dont on peut être fier ?",
    "Quel moment a été le plus productif pour l’équipe ?",
    "Qu’est-ce qui a pris plus de temps que prévu ?",
    "Qu’est-ce qui s’est passé exactement quand on a eu un problème ?",
    "Quelle décision a eu un impact positif ?",
    "Quel événement a marqué le sprint ?",
    "Quelle tâche a été plus simple que prévu ?",
    "Qu’est-ce qui a été plus complexe que prévu ?",
    "Quelle collaboration a bien fonctionné ?",
    "Quel outil ou pratique nous a aidés ?",
    "Quel moment du sprint a été le plus fluide ?",
    "Qu’est-ce qu’on referait exactement de la même façon ?",
    "Qu’est-ce qu’on a appris sur notre façon de travailler ?",
    "Si tu devais résumer le sprint en une phrase, laquelle ?",
    "Quel fait important pourrait être oublié si on ne le disait pas ?"
  ],
  "green": [
    "Quelle amélioration simple pourrait avoir un gros impact ?",
    "Que pourrait-on faire pour réduire les interruptions ?",
    "Quelle pratique Agile pourrait-on renforcer ?",
    "Que devrait-on arrêter de faire dès le prochain sprint ?",
    "Quelle nouvelle idée pourrait améliorer notre efficacité ?",
    "Comment mieux collaborer avec le PO / client ?",
    "Quelle règle d’équipe pourrait être clarifiée ?",
    "Comment améliorer la qualité dès le départ ?",
    "Quelle automatisation pourrait nous faire gagner du temps ?",
    "Que pourrait-on tester pendant un sprint ?",
    "Comment rendre notre backlog plus clair ?",
    "Quelle amélioration sur nos rituels serait utile ?",
    "Comment réduire les retours ou bugs ?",
    "Quelle amélioration sur la communication ?",
    "Si on ne changeait qu’une seule chose, laquelle ?",
    "Quelle bonne pratique d’une autre équipe pourrait-on adopter ?"
  ],
  "red": [
    "Qu’est-ce qui t’a le plus frustré ce sprint ?",
    "Qu’est-ce qui t’a fait perdre du temps inutilement ?",
    "Quel obstacle a été le plus pénible ?",
    "Qu’est-ce qui a ralenti l’équipe ?",
    "Quelle situation t’a mis sous pression ?",
    "Qu’est-ce qui a créé de la confusion ?",
    "Quel moment t’a fait douter du plan ?",
    "Qu’est-ce qui a été mal anticipé ?",
    "Quelle dépendance externe nous a bloqués ?",
    "Qu’est-ce qui a été décidé trop tard ?",
    "Quel sujet évite-t-on de traiter ?",
    "Qu’est-ce qui t’a donné envie de dire “on aurait pu faire mieux” ?",
    "Quel process nous freine plus qu’il ne nous aide ?",
    "Qu’est-ce qui a été inutilement compliqué ?",
    "Quelle décision a eu un impact négatif ?",
    "Si tu pouvais supprimer une contrainte, laquelle ?"
  ],
  "violet": [
    "À quoi ressemblerait un sprint idéal ?",
    "Où aimerais-tu voir l’équipe dans 3 sprints ?",
    "Quelle serait notre plus grande réussite dans 6 mois ?",
    "Qu’est-ce qui ferait dire au client “c’est top” ?",
    "Quelle priorité devrait guider nos décisions ?",
    "Si un nouveau dev arrivait, que devrait-il ressentir ?",
    "Qu’est-ce qui donnerait plus de sens à notre travail ?",
    "Si on continue comme aujourd’hui, que va-t-il se passer ?",
    "Quelle vision d’équipe aimerais-tu construire ?",
    "Qu’est-ce qui ferait vraiment progresser notre produit ?",
    "Quel problème client devrait-on résoudre en priorité ?",
    "Si on osait plus, que ferait-on ?",
    "Qu’est-ce qui différencierait notre équipe des autres ?",
    "Quel objectif ambitieux mais atteignable pourrait-on se fixer ?",
    "Quelle habitude d’équipe aimerais-tu voir émerger ?",
    "Dans un an, de quoi serions-nous le plus fiers ?"
  ],
  "bonus": [
    "Remercie un membre de l’équipe pour quelque chose de précis.",
    "Cite une personne qui t’a aidé pendant le sprint.",
    "Remercie quelqu’un pour son attitude, pas seulement ses résultats.",
    "Dis merci à l’équipe pour un moment particulier.",
    "Remercie quelqu’un pour un effort invisible.",
    "Remercie quelqu’un pour sa patience ou son soutien.",
    "Cite une action qui mérite d’être reconnue.",
    "Remercie quelqu’un qui a facilité ton travail.",
    "Dis merci à quelqu’un qui a pris une initiative.",
    "Remercie quelqu’un pour son esprit d’équipe."
  ]
};

export function pickQuestion(type, rng=Math.random) {
  const list = QUESTIONS[type] || [];
  if (!list.length) return "";
  const idx = Math.floor(rng() * list.length);
  return list[idx];
}
