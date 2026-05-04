import { describe, expect, it } from "vitest";
import type { SkillsMatrixParticipant, SkillsMatrixRow, SkillsMatrixSnapshot } from "@/net/api";
import {
  buildGroupSkillsRadarModel,
  buildParticipantSkillsRadarModels,
  computeMatrixFilling,
  groupMatrixRowsByCategory,
} from "./radarModel";

const participants: SkillsMatrixParticipant[] = [
  { id: "p1", displayName: "Ada" },
  { id: "p2", displayName: "Linus" },
] as SkillsMatrixParticipant[];

const rows: SkillsMatrixRow[] = [
  {
    skillId: "s1",
    skillName: "React",
    categoryId: "frontend",
    categoryName: "Frontend",
    requiredLevel: 4,
    requiredPeople: 1,
    coverageCount: 1,
    missingCount: 0,
    cells: [
      {
        participantId: "p1",
        currentLevel: 4,
        targetLevel: null,
        wantsToProgress: false,
        wantsToMentor: true,
      },
      {
        participantId: "p2",
        currentLevel: 2,
        targetLevel: 4,
        wantsToProgress: true,
        wantsToMentor: false,
      },
    ],
  },
  {
    skillId: "s2",
    skillName: "Node",
    categoryId: "backend",
    categoryName: "Backend",
    requiredLevel: 2,
    requiredPeople: 1,
    coverageCount: 1,
    missingCount: 0,
    cells: [
      {
        participantId: "p1",
        currentLevel: null,
        targetLevel: null,
        wantsToProgress: false,
        wantsToMentor: false,
      },
      {
        participantId: "p2",
        currentLevel: 2,
        targetLevel: null,
        wantsToProgress: false,
        wantsToMentor: true,
      },
    ],
  },
] as SkillsMatrixRow[];

describe("skills matrix radar model", () => {
  it("groups matrix rows by category", () => {
    const groups = groupMatrixRowsByCategory(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      categoryId: "frontend",
      categoryName: "Frontend",
      rows: [rows[0]],
    });
    expect(groups[1]).toMatchObject({
      categoryId: "backend",
      categoryName: "Backend",
      rows: [rows[1]],
    });
  });

  it("builds team and participant radar coverage", () => {
    const groups = groupMatrixRowsByCategory(rows);
    const groupModel = buildGroupSkillsRadarModel(groups);
    const participantModels = buildParticipantSkillsRadarModels(groups, participants);

    expect(groupModel.totalSkills).toBe(2);
    expect(groupModel.completedSkills).toBe(2);
    expect(groupModel.averageScorePct).toBe(87.5);
    expect(groupModel.categories.map((category) => category.scorePct)).toEqual([75, 100]);

    expect(participantModels.get("p1")?.averageScorePct).toBe(50);
    expect(participantModels.get("p2")?.averageScorePct).toBe(75);
  });

  it("computes matrix filling from assessments", () => {
    const snapshot = {
      matrix: rows,
      participants,
      assessments: [{ currentLevel: 4 }, { currentLevel: 2 }, { currentLevel: null }],
    } as Pick<SkillsMatrixSnapshot, "matrix" | "participants" | "assessments">;

    expect(computeMatrixFilling(snapshot)).toEqual({
      filled: 2,
      total: 4,
      ratio: 50,
    });
  });
});
