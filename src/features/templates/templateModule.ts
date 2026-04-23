import type { TemplateItem } from "@/net/api";

export type TemplateModuleId = "retro-party" | "planning-poker" | "skills-matrix";

export const getTemplateModuleId = (template: TemplateItem): TemplateModuleId => {
  const rawModule = template.baseConfig?.module;
  if (typeof rawModule === "string") {
    const normalized = rawModule.trim().toLowerCase();
    if (normalized === "planning-poker") return "planning-poker";
    if (normalized === "skills-matrix") return "skills-matrix";
  }
  return "retro-party";
};

export const isTemplateForModule = (template: TemplateItem, moduleId: TemplateModuleId): boolean =>
  getTemplateModuleId(template) === moduleId;
