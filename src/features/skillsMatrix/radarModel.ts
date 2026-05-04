import type { SkillsMatrixParticipant, SkillsMatrixRow, SkillsMatrixSnapshot } from "@/net/api";

export type RadarSkillMetric = {
  skillId: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number | null;
  scorePct: number;
};

export type RadarCategoryMetric = {
  categoryKey: string;
  categoryName: string;
  scorePct: number;
  averageCurrentLevel: number | null;
  averageRequiredLevel: number;
  skills: RadarSkillMetric[];
};

export type SkillsRadarModel = {
  categories: RadarCategoryMetric[];
  averageScorePct: number;
  completedSkills: number;
  totalSkills: number;
};

export type MatrixRowsByCategory = {
  categoryId: string | null;
  categoryName: string;
  rows: SkillsMatrixRow[];
};

export type MatrixFilling = {
  filled: number;
  total: number;
  ratio: number;
};

export const EMPTY_SKILLS_RADAR_MODEL: SkillsRadarModel = {
  categories: [],
  averageScorePct: 0,
  completedSkills: 0,
  totalSkills: 0,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function averageFiniteNumbers(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toCoveragePercent(currentLevel: number | null, requiredLevel: number) {
  if (!Number.isFinite(currentLevel)) return 0;
  if (requiredLevel <= 0) return 100;
  return clampNumber((Number(currentLevel) / requiredLevel) * 100, 0, 100);
}

export function groupMatrixRowsByCategory(rows: SkillsMatrixRow[]): MatrixRowsByCategory[] {
  const byCategory = new Map<string, MatrixRowsByCategory>();
  for (const row of rows) {
    const key = row.categoryId ?? "__uncategorized__";
    if (!byCategory.has(key)) {
      byCategory.set(key, {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        rows: [],
      });
    }
    byCategory.get(key)?.rows.push(row);
  }
  return Array.from(byCategory.values());
}

export function buildSkillsRadarModel(
  matrixRowsByCategory: MatrixRowsByCategory[],
  resolveCurrentLevel: (row: SkillsMatrixRow) => number | null,
): SkillsRadarModel {
  const categories = matrixRowsByCategory
    .map<RadarCategoryMetric>((group) => {
      const skills = group.rows.map<RadarSkillMetric>((row) => {
        const currentLevel = resolveCurrentLevel(row);
        return {
          skillId: row.skillId,
          skillName: row.skillName,
          requiredLevel: row.requiredLevel,
          currentLevel,
          scorePct: toCoveragePercent(currentLevel, row.requiredLevel),
        };
      });

      const categorySkillScores = skills.map((skill) => skill.scorePct);
      const categorySkillLevels = skills
        .map((skill) => skill.currentLevel)
        .filter((value): value is number => Number.isFinite(value));
      const categoryRequiredLevels = skills.map((skill) => skill.requiredLevel);
      const categoryScore = averageFiniteNumbers(categorySkillScores) ?? 0;
      const averageCurrentLevel = averageFiniteNumbers(categorySkillLevels);
      const averageRequiredLevel = averageFiniteNumbers(categoryRequiredLevels) ?? 0;

      return {
        categoryKey: group.categoryId ?? `uncategorized-${group.categoryName}`,
        categoryName: group.categoryName,
        scorePct: categoryScore,
        averageCurrentLevel,
        averageRequiredLevel,
        skills,
      };
    })
    .filter((category) => category.skills.length > 0);

  const totalSkills = categories.reduce((sum, category) => sum + category.skills.length, 0);
  const completedSkills = categories.reduce(
    (sum, category) =>
      sum + category.skills.filter((skill) => Number.isFinite(skill.currentLevel)).length,
    0,
  );
  const averageScorePct =
    averageFiniteNumbers(
      categories.flatMap((category) => category.skills.map((skill) => skill.scorePct)),
    ) ?? 0;

  return {
    categories,
    averageScorePct,
    completedSkills,
    totalSkills,
  };
}

export function buildGroupSkillsRadarModel(
  matrixRowsByCategory: MatrixRowsByCategory[],
): SkillsRadarModel {
  return buildSkillsRadarModel(matrixRowsByCategory, (row) => {
    const levels = row.cells
      .map((cell) => cell.currentLevel)
      .filter((value): value is number => Number.isFinite(value));
    return averageFiniteNumbers(levels);
  });
}

export function buildParticipantSkillsRadarModels(
  matrixRowsByCategory: MatrixRowsByCategory[],
  participants: SkillsMatrixParticipant[],
) {
  const models = new Map<string, SkillsRadarModel>();
  participants.forEach((participant) => {
    models.set(
      participant.id,
      buildSkillsRadarModel(matrixRowsByCategory, (row) => {
        const cell = row.cells.find((entry) => entry.participantId === participant.id);
        return cell?.currentLevel ?? null;
      }),
    );
  });
  return models;
}

export function computeMatrixFilling(
  snapshot: Pick<SkillsMatrixSnapshot, "matrix" | "participants" | "assessments"> | null,
): MatrixFilling {
  if (!snapshot) return { filled: 0, total: 0, ratio: 0 };
  const total = snapshot.matrix.length * snapshot.participants.length;
  const filled = snapshot.assessments.filter((assessment) =>
    Number.isFinite(assessment.currentLevel),
  ).length;
  const ratio = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, ratio };
}
