import type { TemplateItem } from "@/net/api";

export type SkillsMatrixTemplateCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

export type SkillsMatrixTemplateSkill = {
  id: string;
  name: string;
  categoryId: string | null;
  requiredLevel: number;
  requiredPeople: number;
  sortOrder: number;
};

export type SkillsMatrixTemplateConfig = {
  module: "skills-matrix";
  scaleMin: number;
  scaleMax: number;
  categories: SkillsMatrixTemplateCategory[];
  skills: SkillsMatrixTemplateSkill[];
};

const SCALE_MIN_BOUND = 0;
const SCALE_MAX_BOUND = 10;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const toInteger = (
  value: unknown,
  {
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
  }: { min?: number; max?: number } = {},
): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  const rounded = Math.round(numericValue);
  if (rounded < min || rounded > max) return null;
  return rounded;
};

export const normalizeScaleRange = (rawMin: number, rawMax: number): [number, number] => {
  const safeMin = Math.max(SCALE_MIN_BOUND, Math.min(SCALE_MAX_BOUND, Math.round(rawMin)));
  const safeMax = Math.max(SCALE_MIN_BOUND, Math.min(SCALE_MAX_BOUND, Math.round(rawMax)));
  if (safeMin === safeMax) {
    if (safeMax >= SCALE_MAX_BOUND) return [safeMin - 1, safeMax];
    return [safeMin, safeMax + 1];
  }
  if (safeMin < safeMax) return [safeMin, safeMax];
  return [safeMax, safeMin];
};

const clampLevel = (value: unknown, scaleMin: number, scaleMax: number): number => {
  const parsed = toInteger(value, { min: scaleMin, max: scaleMax });
  if (parsed === null) return scaleMin;
  return parsed;
};

const clampPeople = (value: unknown): number => {
  const parsed = toInteger(value, { min: 0, max: 500 });
  if (parsed === null) return 1;
  return parsed;
};

const normalizeCategoryId = (value: unknown, fallback: string): string => {
  const normalized = toText(value, 80);
  if (!normalized) return fallback;
  return normalized;
};

export const createDraftId = (prefix: "cat" | "skill") => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeCategories = (raw: unknown): SkillsMatrixTemplateCategory[] => {
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .map((entry, index) => {
      if (!isObject(entry)) return null;
      const name = toText(entry.name, 80);
      if (name.length < 2) return null;
      const sortOrder = toInteger(entry.sortOrder, { min: 0, max: 10000 }) ?? index;
      return {
        id: normalizeCategoryId(entry.id, `cat-${index}`),
        name,
        sortOrder,
      };
    })
    .filter((entry): entry is SkillsMatrixTemplateCategory => entry !== null)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "fr"),
    );

  return mapped.map((category, index) => ({
    ...category,
    sortOrder: index,
  }));
};

const normalizeSkills = (
  raw: unknown,
  {
    scaleMin,
    scaleMax,
    categoryIds,
  }: {
    scaleMin: number;
    scaleMax: number;
    categoryIds: Set<string>;
  },
): SkillsMatrixTemplateSkill[] => {
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .map((entry, index) => {
      if (!isObject(entry)) return null;
      const name = toText(entry.name, 120);
      if (name.length < 2) return null;
      const sortOrder = toInteger(entry.sortOrder, { min: 0, max: 10000 }) ?? index;
      const rawCategoryId = toText(entry.categoryId, 80);
      const categoryId = rawCategoryId && categoryIds.has(rawCategoryId) ? rawCategoryId : null;
      return {
        id: normalizeCategoryId(entry.id, `skill-${index}`),
        name,
        categoryId,
        requiredLevel: clampLevel(entry.requiredLevel, scaleMin, scaleMax),
        requiredPeople: clampPeople(entry.requiredPeople),
        sortOrder,
      };
    })
    .filter((entry): entry is SkillsMatrixTemplateSkill => entry !== null)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "fr"),
    );

  return mapped.map((skill, index) => ({
    ...skill,
    sortOrder: index,
  }));
};

export const normalizeSkillsMatrixTemplateConfig = (
  rawConfig: unknown,
  fallback: { scaleMin: number; scaleMax: number } = { scaleMin: 1, scaleMax: 5 },
): SkillsMatrixTemplateConfig => {
  const config = isObject(rawConfig) ? rawConfig : {};
  const moduleId =
    typeof config.module === "string" && config.module.trim().toLowerCase() === "skills-matrix"
      ? "skills-matrix"
      : "skills-matrix";

  const [scaleMin, scaleMax] = normalizeScaleRange(
    toInteger(config.scaleMin, { min: SCALE_MIN_BOUND, max: SCALE_MAX_BOUND }) ?? fallback.scaleMin,
    toInteger(config.scaleMax, { min: SCALE_MIN_BOUND, max: SCALE_MAX_BOUND }) ?? fallback.scaleMax,
  );

  const categories = normalizeCategories(config.categories);
  const categoryIds = new Set(categories.map((category) => category.id));
  const skills = normalizeSkills(config.skills, { scaleMin, scaleMax, categoryIds });

  return {
    module: moduleId,
    scaleMin,
    scaleMax,
    categories,
    skills,
  };
};

export const isSkillsMatrixTemplate = (template: TemplateItem): boolean => {
  const moduleValue = template.baseConfig?.module;
  return typeof moduleValue === "string" && moduleValue.trim().toLowerCase() === "skills-matrix";
};
