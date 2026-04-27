import type { SuiteModuleId } from "@/net/api";

export type ExperienceCategoryId = "improve" | "estimate" | "measure" | "develop";

export type ExperienceCategory = {
  id: ExperienceCategoryId;
  label: string;
  tagline: string;
  rgb: string;
};

export const EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  {
    id: "improve",
    label: "Améliorer",
    tagline: "Rétros, action items, amélioration continue",
    rgb: "236,72,153",
  },
  {
    id: "estimate",
    label: "Estimer",
    tagline: "Aligner l'équipe sur la charge et les écarts",
    rgb: "99,102,241",
  },
  {
    id: "measure",
    label: "Mesurer",
    tagline: "Diagnostiquer la maturité et les zones grises",
    rgb: "16,185,129",
  },
  {
    id: "develop",
    label: "Développer",
    tagline: "Compétences, mentorat, montée en autonomie",
    rgb: "14,165,233",
  },
];

export const EXPERIENCE_CATEGORY_BY_ID = Object.fromEntries(
  EXPERIENCE_CATEGORIES.map((c) => [c.id, c]),
) as Record<ExperienceCategoryId, ExperienceCategory>;

export type Experience = {
  id: SuiteModuleId;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  accentRgb: string;
  category: ExperienceCategoryId;
  hostRoute: string;
  joinRoute: (code: string) => string;
  prepareRoute: string | null;
};

export const EXPERIENCES: Experience[] = [
  {
    id: "retro-party",
    label: "Retro Party",
    tagline: "Rétrospective gamifiée",
    description:
      "Plateau de jeu collaboratif, kudos, mini-jeux. Vos rétros redeviennent attendues.",
    icon: "🎲",
    accent: "#ec4899",
    accentRgb: "236,72,153",
    category: "improve",
    hostRoute: "/play?from=app",
    joinRoute: (code) => `/play?from=app&mode=join&code=${code}`,
    prepareRoute: "/prepare/retro-party",
  },
  {
    id: "planning-poker",
    label: "Planning Party",
    tagline: "Estimation collaborative",
    description:
      "Vote synchronisé, révélation simultanée, focus sur les écarts qui méritent discussion.",
    icon: "🃏",
    accent: "#6366f1",
    accentRgb: "99,102,241",
    category: "estimate",
    hostRoute: "/play?from=app&experience=planning-poker",
    joinRoute: (code) => `/play?from=app&experience=planning-poker&mode=join&code=${code}`,
    prepareRoute: "/prepare/planning-poker",
  },
  {
    id: "radar-party",
    label: "Radar Party",
    tagline: "Diagnostic d'équipe",
    description:
      "Questionnaires par thèmes, radar individuel et collectif, écarts de perception visibles.",
    icon: "📡",
    accent: "#10b981",
    accentRgb: "16,185,129",
    category: "measure",
    hostRoute: "/radar-party?from=app&mode=host",
    joinRoute: (code) => `/radar-party?mode=join&code=${code}`,
    prepareRoute: null,
  },
  {
    id: "skills-matrix",
    label: "Skills Matrix",
    tagline: "Matrice de compétences",
    description:
      "Cartographie des forces, envies de progresser et capacité à former. Plan de montée en compétence.",
    icon: "🧩",
    accent: "#0ea5e9",
    accentRgb: "14,165,233",
    category: "develop",
    hostRoute: "/skills-matrix?from=app&mode=host",
    joinRoute: (code) => `/skills-matrix?mode=join&code=${code}`,
    prepareRoute: "/prepare/skills-matrix",
  },
];

export const EXPERIENCE_BY_ID = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e])) as Record<
  SuiteModuleId,
  Experience
>;

export const ds = {
  bg: "#0a0a14",
  surface0: "rgba(255,255,255,0.02)",
  surface1: "rgba(255,255,255,0.04)",
  surface2: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  textPrimary: "#f1f5f9",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  textFaint: "#64748b",
} as const;
