import { WHO_SAID_IT_ROLES, whoSaidItBank } from "./whoSaidItBank.js";

export const WHO_SAID_IT_MINIGAME_ID = "WHO_SAID_IT";
export const WHO_SAID_IT_DEFAULTS = {
  rounds: 3,
  answerDurationMs: 20000,
  revealDurationMs: 3000,
  betweenRoundsMs: 1000,
};

function makeEmptyRoleMap() {
  return {
    MANAGER: 0,
    PO: 0,
    DEV: 0,
    SCRUM_MASTER: 0,
    QA_SUPPORT: 0,
  };
}

function createPointsMap(playerIds) {
  const map = {};
  playerIds.forEach((id) => {
    map[id] = 0;
  });
  return map;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function pickWhoSaidItQuote(usedQuoteIds, lastQuoteId) {
  const used = usedQuoteIds instanceof Set ? usedQuoteIds : new Set(usedQuoteIds || []);
  let candidates = whoSaidItBank.filter((quote) => !used.has(quote.id));

  if (candidates.length === 0) {
    candidates = [...whoSaidItBank];
  }

  if (candidates.length > 1 && lastQuoteId) {
    const noImmediateRepeat = candidates.filter((quote) => quote.id !== lastQuoteId);
    if (noImmediateRepeat.length > 0) {
      candidates = noImmediateRepeat;
    }
  }

  const shuffled = shuffle(candidates);
  return shuffled[0];
}

export function createWhoSaidItSession(playerIds, options = {}) {
  const rounds = options.rounds ?? WHO_SAID_IT_DEFAULTS.rounds;
  return {
    minigameId: WHO_SAID_IT_MINIGAME_ID,
    totalRounds: rounds,
    answerDurationMs: options.answerDurationMs ?? WHO_SAID_IT_DEFAULTS.answerDurationMs,
    revealDurationMs: options.revealDurationMs ?? WHO_SAID_IT_DEFAULTS.revealDurationMs,
    betweenRoundsMs: options.betweenRoundsMs ?? WHO_SAID_IT_DEFAULTS.betweenRoundsMs,
    playerIds: [...playerIds],
    pointsGained: createPointsMap(playerIds),
    roundIndex: 1,
    usedQuoteIds: new Set(),
    lastQuoteId: null,
    currentRound: null,
    status: "answer",
  };
}

export function getWhoSaidItStartPayload(session) {
  return {
    type: "MINIGAME_START",
    minigameId: WHO_SAID_IT_MINIGAME_ID,
    rounds: session.totalRounds,
  };
}

export function startWhoSaidItRound(session, nowTs = Date.now()) {
  const quote = pickWhoSaidItQuote(session.usedQuoteIds, session.lastQuoteId);
  session.usedQuoteIds.add(quote.id);
  session.lastQuoteId = quote.id;

  const round = {
    roundIndex: session.roundIndex,
    quote,
    startsAtServerTs: nowTs,
    endsAtServerTs: nowTs + session.answerDurationMs,
    submissions: {},
  };

  session.currentRound = round;
  session.status = "answer";

  return {
    roundIndex: round.roundIndex,
    totalRounds: session.totalRounds,
    quoteId: round.quote.id,
    text: round.quote.text,
    endsAtServerTs: round.endsAtServerTs,
  };
}

export function submitWhoSaidItAnswer(session, playerId, roundIndex, role, nowTs = Date.now()) {
  if (!session?.currentRound) return { accepted: false, reason: "NO_ACTIVE_ROUND" };
  if (!session.playerIds.includes(playerId)) return { accepted: false, reason: "UNKNOWN_PLAYER" };
  if (!WHO_SAID_IT_ROLES.includes(role)) return { accepted: false, reason: "INVALID_ROLE" };
  if (roundIndex !== session.currentRound.roundIndex) return { accepted: false, reason: "ROUND_MISMATCH" };
  if (session.status !== "answer") return { accepted: false, reason: "ROUND_NOT_ACCEPTING" };
  if (nowTs > session.currentRound.endsAtServerTs) return { accepted: false, reason: "ROUND_ENDED" };
  if (session.currentRound.submissions[playerId]) return { accepted: false, reason: "ALREADY_SUBMITTED" };

  session.currentRound.submissions[playerId] = {
    role,
    submittedAtServerTs: nowTs,
  };

  return { accepted: true };
}

export function revealWhoSaidItRound(session) {
  const round = session.currentRound;
  if (!round) {
    return null;
  }

  const distribution = makeEmptyRoleMap();
  const pointsDelta = createPointsMap(session.playerIds);
  const correctPlayers = [];

  for (const playerId of session.playerIds) {
    const submission = round.submissions[playerId];
    if (!submission) continue;

    distribution[submission.role] += 1;

    if (submission.role === round.quote.answer) {
      const fastAnswer = submission.submittedAtServerTs - round.startsAtServerTs <= 5000;
      pointsDelta[playerId] += fastAnswer ? 3 : 2;
      correctPlayers.push(playerId);
    }
  }

  if (correctPlayers.length === 1) {
    const soloWinnerId = correctPlayers[0];
    pointsDelta[soloWinnerId] += 1;
  }

  Object.entries(pointsDelta).forEach(([playerId, points]) => {
    session.pointsGained[playerId] = (session.pointsGained[playerId] ?? 0) + points;
  });

  session.status = "reveal";

  return {
    roundIndex: round.roundIndex,
    answerRole: round.quote.answer,
    distribution,
    winners: Object.entries(pointsDelta)
      .filter(([, points]) => points > 0)
      .map(([playerId]) => playerId),
    pointsDelta,
  };
}

export function advanceWhoSaidItSession(session) {
  session.roundIndex += 1;
  session.currentRound = null;

  if (session.roundIndex > session.totalRounds) {
    session.status = "done";
    return { done: true };
  }

  return { done: false };
}

export function getWhoSaidItEndPayload(session) {
  return {
    type: "MINIGAME_END",
    minigameId: WHO_SAID_IT_MINIGAME_ID,
    summary: {
      pointsGained: { ...session.pointsGained },
    },
  };
}

export function applyWhoSaidItPointsToState(state, session) {
  const players = state.players.map((player) => ({
    ...player,
    stars: player.stars + (session.pointsGained[player.id] ?? 0),
  }));

  return {
    ...state,
    players,
  };
}

export function removeWhoSaidItPlayer(session, playerId) {
  if (!session) return;
  session.playerIds = session.playerIds.filter((id) => id !== playerId);
  delete session.pointsGained[playerId];
  if (session.currentRound?.submissions) {
    delete session.currentRound.submissions[playerId];
  }
}

export function remapWhoSaidItPlayerId(session, oldPlayerId, newPlayerId) {
  if (!session) return;
  session.playerIds = session.playerIds.map((id) => (id === oldPlayerId ? newPlayerId : id));

  if (Object.prototype.hasOwnProperty.call(session.pointsGained, oldPlayerId)) {
    session.pointsGained[newPlayerId] = session.pointsGained[oldPlayerId];
    delete session.pointsGained[oldPlayerId];
  }

  if (session.currentRound?.submissions?.[oldPlayerId]) {
    session.currentRound.submissions[newPlayerId] = session.currentRound.submissions[oldPlayerId];
    delete session.currentRound.submissions[oldPlayerId];
  }
}
