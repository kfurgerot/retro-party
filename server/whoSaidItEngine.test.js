import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceWhoSaidItSession,
  createWhoSaidItSession,
  revealWhoSaidItRound,
  startWhoSaidItRound,
  submitWhoSaidItAnswer,
} from "./whoSaidItEngine.js";

function pickWrongRole(correctRole) {
  const roles = ["MANAGER", "PO", "DEV", "SCRUM_MASTER", "QA_SUPPORT"];
  return roles.find((role) => role !== correctRole);
}

test("WSI_SUBMIT accepte une seule reponse par joueur et par manche", () => {
  const session = createWhoSaidItSession(["p1", "p2"], { rounds: 1, answerDurationMs: 20000 });
  const round = startWhoSaidItRound(session, 1000);

  const first = submitWhoSaidItAnswer(session, "p1", round.roundIndex, "DEV", 1200);
  const second = submitWhoSaidItAnswer(session, "p1", round.roundIndex, "PO", 1300);

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.reason, "ALREADY_SUBMITTED");
});

test("Scoring: fast=+3, slow=+2, faux=0, unique correct +1", () => {
  const session = createWhoSaidItSession(["p1", "p2", "p3"], {
    rounds: 1,
    answerDurationMs: 20000,
  });
  const round = startWhoSaidItRound(session, 1000);

  const correctRole = session.currentRound.quote.answer;
  const wrongRole = pickWrongRole(correctRole);

  submitWhoSaidItAnswer(session, "p1", round.roundIndex, correctRole, 2000);
  submitWhoSaidItAnswer(session, "p2", round.roundIndex, wrongRole, 3000);

  const reveal = revealWhoSaidItRound(session);

  assert.equal(reveal.pointsDelta.p1, 4);
  assert.equal(reveal.pointsDelta.p2, 0);
  assert.equal(reveal.pointsDelta.p3, 0);
  assert.deepEqual(reveal.winners, ["p1"]);

  const endStep = advanceWhoSaidItSession(session);
  assert.equal(endStep.done, true);
});

test("Scoring: deux bonnes reponses, sans bonus unique", () => {
  const session = createWhoSaidItSession(["p1", "p2", "p3"], {
    rounds: 1,
    answerDurationMs: 20000,
  });
  const round = startWhoSaidItRound(session, 1000);

  const correctRole = session.currentRound.quote.answer;
  const wrongRole = pickWrongRole(correctRole);
  submitWhoSaidItAnswer(session, "p1", round.roundIndex, correctRole, 2500);
  submitWhoSaidItAnswer(session, "p2", round.roundIndex, correctRole, 9000);
  submitWhoSaidItAnswer(session, "p3", round.roundIndex, wrongRole, 5000);

  const reveal = revealWhoSaidItRound(session);

  assert.equal(reveal.pointsDelta.p1, 3);
  assert.equal(reveal.pointsDelta.p2, 2);
  assert.equal(reveal.pointsDelta.p3, 0);
});
