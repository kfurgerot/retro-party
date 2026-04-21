function assessmentKey(skillId, participantId) {
  return `${skillId}:${participantId}`;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function normalizeNullableLevel(value) {
  if (!isFiniteNumber(value)) return null;
  return Number(value);
}

function shouldLearn(cell) {
  if (cell.wantsToProgress) return true;
  if (!isFiniteNumber(cell.targetLevel)) return false;
  if (!isFiniteNumber(cell.currentLevel)) return true;
  return cell.targetLevel > cell.currentLevel;
}

export function computeSkillsMatrixInsights({ skills, participants, assessments }) {
  const assessmentByCell = new Map();
  for (const assessment of assessments) {
    assessmentByCell.set(assessmentKey(assessment.skillId, assessment.participantId), assessment);
  }

  const matrixRows = skills.map((skill) => {
    const requiredLevel = Number(skill.requiredLevel);
    const requiredPeople = Number(skill.requiredPeople);

    const cells = participants.map((participant) => {
      const assessment = assessmentByCell.get(assessmentKey(skill.id, participant.id));
      return {
        participantId: participant.id,
        currentLevel: normalizeNullableLevel(assessment?.currentLevel),
        targetLevel: normalizeNullableLevel(assessment?.targetLevel),
        wantsToProgress: assessment?.wantsToProgress === true,
      };
    });

    const helpers = cells
      .filter((cell) => isFiniteNumber(cell.currentLevel) && cell.currentLevel >= requiredLevel)
      .map((cell) => ({
        participantId: cell.participantId,
        currentLevel: Number(cell.currentLevel),
      }));

    const learners = cells
      .filter((cell) => shouldLearn(cell))
      .map((cell) => ({
        participantId: cell.participantId,
        currentLevel: isFiniteNumber(cell.currentLevel) ? Number(cell.currentLevel) : null,
        targetLevel: isFiniteNumber(cell.targetLevel) ? Number(cell.targetLevel) : null,
        wantsToProgress: cell.wantsToProgress,
      }));

    const coverageCount = helpers.length;
    const missingCount = Math.max(0, requiredPeople - coverageCount);

    return {
      skillId: skill.id,
      coverageCount,
      missingCount,
      requiredLevel,
      requiredPeople,
      cells,
      helpers,
      learners,
    };
  });

  const riskySkills = matrixRows.filter((row) => row.missingCount > 0);
  const coveredSkills = matrixRows.filter((row) => row.missingCount === 0);

  return {
    matrixRows,
    dashboard: {
      summary: {
        totalSkills: matrixRows.length,
        riskySkillsCount: riskySkills.length,
        coveredSkillsCount: coveredSkills.length,
        totalMissingPeople: riskySkills.reduce((sum, row) => sum + row.missingCount, 0),
      },
      riskySkills,
      coveredSkills,
      mentoringBySkill: matrixRows.map((row) => ({
        skillId: row.skillId,
        helpers: row.helpers,
        learners: row.learners,
      })),
    },
  };
}
