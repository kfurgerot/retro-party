function normalizeColorType(type) {
  const value = String(type ?? "").toLowerCase();
  if (value === "purple") return "violet";
  if (value === "kudobox" || value === "star") return "bonus";
  return value;
}

export function playerName(state, playerId, fallback = "Joueur") {
  return state.players.find((p) => p.id === playerId)?.name ?? fallback;
}

export function currentPlayerName(state, fallback = "Joueur actif") {
  return state.players[state.currentPlayerIndex]?.name ?? fallback;
}

export function formatTileLabel(tileType) {
  const normalized = normalizeColorType(tileType);
  if (normalized === "blue") return "Bleu";
  if (normalized === "green") return "Vert";
  if (normalized === "red") return "Rouge";
  if (normalized === "violet") return "Violet";
  if (normalized === "bonus") return "Kudobox";
  if (normalized === "shop") return "Boutique";
  return "Case";
}

export const actionLogMessage = {
  preRollEffectArmed: (name, effectType) => `${name} active un bonus de lancer (${effectType}).`,
  rollSecondDieStart: (name) => `${name} lance le second de.`,
  rollSecondDieResult: (name, firstDie, secondDie, total) => `${name} obtient ${firstDie} + ${secondDie} = ${total}.`,
  rollDoubleFirstDieStart: (name) => `${name} lance le de (double lancer - de 1).`,
  rollDoubleFirstDieResult: (name, value) => `${name} obtient ${value} au premier de.`,
  rollStart: (name) => `${name} lance le de.`,
  rollResultWithBonus: (name, die, bonus, total) => `${name} obtient ${die} + bonus ${bonus} = ${total}.`,
  rollResult: (name, total) => `${name} obtient ${total}.`,
  pointDuelStart: (attackerName, defenderName) => `${attackerName} declenche un duel contre ${defenderName}.`,
  pointDuelTie: () => "Duel: egalite, aucun point vole.",
  pointDuelSteal: (winnerName, points, loserName) => `Duel: ${winnerName} vole ${points} points a ${loserName ?? "adversaire"}.`,
  pointDuelAttackerRoll: (attackerName, roll) => `${attackerName} lance le de du duel: ${roll}.`,
  pointDuelDefenderRoll: (defenderName, roll) => `${defenderName} repond au duel avec ${roll}.`,
  moveStart: (name, steps) => `${name} avance de ${steps} case(s).`,
  moveIntersection: (name) => `${name} arrive a une intersection.`,
  moveKudobox: (name) => `${name} arrive sur une case Kudobox.`,
  moveShop: (name) => `${name} arrive a la boutique.`,
  moveFinished: (name, tileType) => `${name} termine son deplacement sur ${formatTileLabel(tileType)}.`,
  pathContinue: (name) => `${name} choisit une route et poursuit son deplacement.`,
  pathValidated: (name) => `${name} valide son chemin.`,
  kudoConverted: (name, cost) => `${name} convertit ${cost} points en 1 Kudo.`,
  kudoPassed: (name) => `${name} passe la case Kudobox.`,
  kudoBought: (name) => `${name} achete un Kudo.`,
  kudoSkipped: (name) => `${name} continue sans achat Kudo.`,
  kudoBoughtAndContinue: (name) => `${name} achete un Kudo et poursuit son deplacement.`,
  kudoRefusedAndContinue: (name) => `${name} refuse le Kudo et poursuit son deplacement.`,
  questionOpened: (name) => `${name} ouvre la carte question.`,
  questionValidatedWithBugSmash: (name) => `${name} valide la question. Lancement du mini-jeu Bug Smash.`,
  questionValidated: (name, upVotes, downVotes) => `${name} valide la question (${upVotes} utile, ${downVotes} a creuser).`,
  shopClosed: (name) => `${name} ferme la boutique.`,
  shopBoughtItem: (name, label, cost) => `${name} achete ${label} pour ${cost} points.`,
  preRollNoItem: (name) => `${name} continue sans objet de pre-lancer.`,
  preRollPreparedItem: (name, label) => `${name} prepare ${label} avant son lancer.`,
  itemActivated: (name, label) => `${name} active ${label}.`,
  itemUsedOnTarget: (name, label, targetName) => `${name} utilise ${label} sur ${targetName}.`,
  itemStolePoints: (name, points, targetName) => `${name} vole ${points} points a ${targetName}.`,
  itemTeleportStar: (name, label) => `${name} utilise ${label} et se teleporte sur une case Kudobox.`,
  gameFinished: () => "Partie terminee: affichage des resultats.",
  nextTurn: (name, round, maxRounds) => `Nouveau tour: ${name ?? "Joueur"} joue (manche ${round}/${maxRounds}).`,
  bugSmashCompleted: (name, score, stars) => `${name} termine Bug Smash: ${score} points, ${stars} Kudo gagne(s).`,
};
