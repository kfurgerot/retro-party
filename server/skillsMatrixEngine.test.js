import test from "node:test";
import assert from "node:assert/strict";
import { computeSkillsMatrixInsights } from "./skillsMatrixEngine.js";

function makeParticipant(id) {
  return { id, displayName: id, userId: `${id}-user`, isAdmin: false };
}

function makeSkill(id, requiredLevel, requiredPeople) {
  return {
    id,
    name: id,
    categoryId: null,
    requiredLevel,
    requiredPeople,
  };
}

test("computeSkillsMatrixInsights calcule la couverture et les manques", () => {
  const participants = [makeParticipant("p1"), makeParticipant("p2"), makeParticipant("p3")];
  const skills = [makeSkill("s1", 3, 2)];
  const assessments = [
    { skillId: "s1", participantId: "p1", currentLevel: 4, targetLevel: 5, wantsToProgress: false },
    { skillId: "s1", participantId: "p2", currentLevel: 2, targetLevel: 4, wantsToProgress: true },
  ];

  const result = computeSkillsMatrixInsights({ participants, skills, assessments });

  assert.equal(result.matrixRows.length, 1);
  assert.equal(result.matrixRows[0].coverageCount, 1);
  assert.equal(result.matrixRows[0].missingCount, 1);
  assert.equal(result.dashboard.riskySkills.length, 1);
  assert.equal(result.dashboard.summary.totalMissingPeople, 1);
});

test("computeSkillsMatrixInsights detecte les apprenants via targetLevel", () => {
  const participants = [makeParticipant("p1"), makeParticipant("p2")];
  const skills = [makeSkill("s1", 4, 1)];
  const assessments = [
    { skillId: "s1", participantId: "p1", currentLevel: 5, targetLevel: 5, wantsToProgress: false },
    { skillId: "s1", participantId: "p2", currentLevel: 2, targetLevel: 4, wantsToProgress: false },
  ];

  const result = computeSkillsMatrixInsights({ participants, skills, assessments });
  const mentoring = result.dashboard.mentoringBySkill[0];

  assert.equal(mentoring.helpers.length, 1);
  assert.equal(mentoring.helpers[0].participantId, "p1");
  assert.equal(mentoring.learners.length, 1);
  assert.equal(mentoring.learners[0].participantId, "p2");
});
