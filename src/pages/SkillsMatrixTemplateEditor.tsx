import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/app-shell";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import {
  createDraftId,
  isSkillsMatrixTemplate,
  normalizeScaleRange,
  normalizeSkillsMatrixTemplateConfig,
  type SkillsMatrixTemplateCategory,
  type SkillsMatrixTemplateSkill,
} from "@/features/skillsMatrix/templateConfig";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { api } from "@/net/api";

const SKILLS_ACCENT = TOOL_ACCENT["skills-matrix"];
const inputCls =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-cyan-400/60";
const selectCls =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/30";

export default function SkillsMatrixTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [scaleRange, setScaleRange] = useState<[number, number]>([1, 5]);
  const [categories, setCategories] = useState<SkillsMatrixTemplateCategory[]>([]);
  const [skills, setSkills] = useState<SkillsMatrixTemplateSkill[]>([]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategoryId, setNewSkillCategoryId] = useState("");
  const [newSkillRequiredLevel, setNewSkillRequiredLevel] = useState(1);
  const [newSkillRequiredPeople, setNewSkillRequiredPeople] = useState(1);

  const [scaleMin, scaleMax] = scaleRange;

  const loadTemplate = useCallback(async () => {
    if (!templateId) {
      setLoadingTemplate(false);
      setError("Template introuvable.");
      return;
    }
    setLoadingTemplate(true);
    setError(null);
    try {
      const response = await api.getTemplate(templateId);
      if (!isSkillsMatrixTemplate(response.template)) {
        throw new Error("Ce template n'est pas un template Matrice de Compétences.");
      }
      const config = normalizeSkillsMatrixTemplateConfig(response.template.baseConfig);
      setTemplateName(response.template.name);
      setTemplateDescription(response.template.description ?? "");
      setScaleRange([config.scaleMin, config.scaleMax]);
      setCategories(config.categories);
      setSkills(config.skills);
      setNewSkillRequiredLevel(config.scaleMin);
      setNewSkillRequiredPeople(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoadingTemplate(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const saveTemplate = useCallback(async () => {
    if (!templateId) return;
    if (templateName.trim().length < 2) {
      setError("Le nom du template est requis.");
      return;
    }
    setSavingTemplate(true);
    setError(null);
    try {
      const normalized = normalizeSkillsMatrixTemplateConfig({
        module: "skills-matrix",
        scaleMin,
        scaleMax,
        categories,
        skills,
      });
      await api.patchTemplate(templateId, {
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        baseConfig: normalized,
      });
      navigate("/prepare/skills-matrix");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSavingTemplate(false);
    }
  }, [
    categories,
    navigate,
    scaleMax,
    scaleMin,
    skills,
    templateDescription,
    templateId,
    templateName,
  ]);

  const addCategory = () => {
    const name = newCategoryName.trim().slice(0, 80);
    if (name.length < 2) return;
    setCategories((prev) => [
      ...prev,
      {
        id: createDraftId("cat"),
        name,
        sortOrder: prev.length,
      },
    ]);
    setNewCategoryName("");
  };

  const removeCategory = (categoryId: string) => {
    setCategories((prev) =>
      prev
        .filter((category) => category.id !== categoryId)
        .map((category, index) => ({ ...category, sortOrder: index })),
    );
    setSkills((prev) =>
      prev.map((skill) =>
        skill.categoryId === categoryId ? { ...skill, categoryId: null } : skill,
      ),
    );
  };

  const addSkill = () => {
    const name = newSkillName.trim().slice(0, 120);
    if (name.length < 2) return;
    const requiredLevel = Math.max(scaleMin, Math.min(scaleMax, Math.round(newSkillRequiredLevel)));
    const requiredPeople = Math.max(0, Math.min(500, Math.round(newSkillRequiredPeople)));
    setSkills((prev) => [
      ...prev,
      {
        id: createDraftId("skill"),
        name,
        categoryId: newSkillCategoryId || null,
        requiredLevel,
        requiredPeople,
        sortOrder: prev.length,
      },
    ]);
    setNewSkillName("");
    setNewSkillCategoryId("");
    setNewSkillRequiredLevel(scaleMin);
    setNewSkillRequiredPeople(1);
  };

  const removeSkill = (skillId: string) => {
    setSkills((prev) =>
      prev
        .filter((skill) => skill.id !== skillId)
        .map((skill, index) => ({ ...skill, sortOrder: index })),
    );
  };

  const updateSkill = (skillId: string, patch: Partial<SkillsMatrixTemplateSkill>) => {
    setSkills((prev) =>
      prev.map((skill) => {
        if (skill.id !== skillId) return skill;
        const nextLevel =
          patch.requiredLevel !== undefined
            ? Math.max(scaleMin, Math.min(scaleMax, Math.round(patch.requiredLevel)))
            : skill.requiredLevel;
        const nextPeople =
          patch.requiredPeople !== undefined
            ? Math.max(0, Math.min(500, Math.round(patch.requiredPeople)))
            : skill.requiredPeople;
        return {
          ...skill,
          ...patch,
          requiredLevel: nextLevel,
          requiredPeople: nextPeople,
        };
      }),
    );
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.sortOrder - right.sortOrder),
    [categories],
  );
  const sortedSkills = useMemo(
    () => [...skills].sort((left, right) => left.sortOrder - right.sortOrder),
    [skills],
  );

  if (authLoading || loadingTemplate) {
    return (
      <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
        <div className="neon-surface px-4 py-3 text-sm font-semibold text-cyan-100">
          Chargement...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <PageShell accentColor={SKILLS_ACCENT.ambientColor} accentGlow={SKILLS_ACCENT.ambientGlow}>
        <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-md flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
            Édition du template
          </h1>
          <p className="mt-2 text-sm text-slate-400">Connecte-toi pour modifier ce template.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
          >
            Retour au portail
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      accentColor={SKILLS_ACCENT.ambientColor}
      accentGlow={SKILLS_ACCENT.ambientGlow}
      maxWidth="4xl"
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-sm">
            🧩
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">
            Matrice de Compétences
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/prepare/skills-matrix")}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
        >
          Retour templates
        </button>
      </div>

      <h1 className="mb-1 text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
        Éditer le template
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Ajuste l'échelle, les catégories et les compétences de ce template.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Nom du template"
            className={inputCls}
          />
          <input
            value={templateDescription}
            onChange={(event) => setTemplateDescription(event.target.value)}
            placeholder="Description (optionnel)"
            className={inputCls}
          />
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Échelle des niveaux</span>
            <span className="font-semibold text-cyan-200">
              {scaleMin} à {scaleMax}
            </span>
          </div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[scaleMin, scaleMax]}
            onValueChange={(values) => {
              if (values.length < 2) return;
              const [nextMin, nextMax] = normalizeScaleRange(values[0], values[1]);
              setScaleRange([nextMin, nextMax]);
              setSkills((prev) =>
                prev.map((skill) => ({
                  ...skill,
                  requiredLevel: Math.max(nextMin, Math.min(nextMax, skill.requiredLevel)),
                })),
              );
              setNewSkillRequiredLevel((prev) => Math.max(nextMin, Math.min(nextMax, prev)));
            }}
            aria-label="Echelle des niveaux"
          />
          <div className="mt-2 flex justify-between text-[10px] text-slate-600">
            <span>0</span>
            <span>10</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Catégories ─────────────────────────────────────────── */}
          <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Catégories
            </div>

            {/* Formulaire ajout */}
            <div className="flex gap-2">
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="Nom de catégorie"
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
              />
              <button
                type="button"
                onClick={addCategory}
                className="h-10 shrink-0 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Ajouter
              </button>
            </div>

            {/* Liste */}
            <div className="space-y-2">
              {sortedCategories.length === 0 ? (
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
                  Aucune catégorie. Ajoute-en une ci-dessus.
                </div>
              ) : (
                sortedCategories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0a1020] px-3 py-2"
                  >
                    <input
                      value={category.name}
                      onChange={(event) =>
                        setCategories((prev) =>
                          prev.map((entry) =>
                            entry.id === category.id
                              ? { ...entry, name: event.target.value.slice(0, 80) }
                              : entry,
                          ),
                        )
                      }
                      className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-[#0c1228] px-2 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => removeCategory(category.id)}
                      title="Supprimer la catégorie"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-sm text-red-300 transition hover:bg-red-500/20"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── Compétences ────────────────────────────────────────── */}
          <section className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Compétences
            </div>

            {/* Formulaire ajout */}
            <div className="space-y-2 rounded-xl border border-cyan-400/10 bg-cyan-500/[0.04] p-3">
              <input
                value={newSkillName}
                onChange={(event) => setNewSkillName(event.target.value)}
                placeholder="Nom de compétence"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                    Catégorie
                  </label>
                  <select
                    value={newSkillCategoryId}
                    onChange={(event) => setNewSkillCategoryId(event.target.value)}
                    className={selectCls}
                  >
                    <option value="">Sans catégorie</option>
                    {sortedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                    Pers. requises
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={newSkillRequiredPeople}
                    onChange={(event) => setNewSkillRequiredPeople(Number(event.target.value))}
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="uppercase tracking-wide text-slate-500">Niveau requis</span>
                  <span className="font-semibold text-cyan-300">N{newSkillRequiredLevel}</span>
                </div>
                <Slider
                  min={scaleMin}
                  max={scaleMax}
                  step={1}
                  value={[newSkillRequiredLevel]}
                  onValueChange={(values) => {
                    const next = values[0];
                    if (!Number.isFinite(next)) return;
                    setNewSkillRequiredLevel(Math.round(next));
                  }}
                  aria-label="Niveau attendu"
                />
              </div>
              <button
                type="button"
                onClick={addSkill}
                className="h-9 w-full rounded-xl border border-cyan-300/30 bg-cyan-500/15 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/25"
              >
                + Ajouter la compétence
              </button>
            </div>

            {/* Liste */}
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
              {sortedSkills.length === 0 ? (
                <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
                  Aucune compétence. Ajoute-en une ci-dessus.
                </div>
              ) : (
                sortedSkills.map((skill) => {
                  const catName =
                    sortedCategories.find((c) => c.id === skill.categoryId)?.name ?? null;
                  return (
                    <div
                      key={skill.id}
                      className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#0a1020] p-3"
                    >
                      {/* Nom + supprimer */}
                      <div className="flex gap-2">
                        <input
                          value={skill.name}
                          onChange={(event) =>
                            updateSkill(skill.id, { name: event.target.value.slice(0, 120) })
                          }
                          className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                        />
                        <button
                          type="button"
                          onClick={() => removeSkill(skill.id)}
                          title="Supprimer"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-sm text-red-300 transition hover:bg-red-500/20"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Catégorie + personnes */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                            Catégorie
                          </label>
                          <select
                            value={skill.categoryId ?? ""}
                            onChange={(event) =>
                              updateSkill(skill.id, {
                                categoryId: event.target.value || null,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-white/[0.07] bg-[#0c1228] px-2 text-xs text-slate-100 outline-none focus:border-cyan-400/40"
                          >
                            <option value="">Sans catégorie</option>
                            {sortedCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                            Pers. requises
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={500}
                            value={skill.requiredPeople}
                            onChange={(event) =>
                              updateSkill(skill.id, {
                                requiredPeople: Number(event.target.value),
                              })
                            }
                            className="h-9 w-full rounded-lg border border-white/[0.07] bg-[#0c1228] px-2 text-xs text-slate-100 outline-none focus:border-cyan-400/40"
                          />
                        </div>
                      </div>

                      {/* Niveau */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="uppercase tracking-wide text-slate-500">
                            Niveau requis
                          </span>
                          <span className="font-semibold text-cyan-300">
                            N{skill.requiredLevel}
                          </span>
                        </div>
                        <Slider
                          min={scaleMin}
                          max={scaleMax}
                          step={1}
                          value={[skill.requiredLevel]}
                          onValueChange={(values) => {
                            const next = values[0];
                            if (!Number.isFinite(next)) return;
                            updateSkill(skill.id, { requiredLevel: Math.round(next) });
                          }}
                          aria-label={`Niveau attendu ${skill.name}`}
                        />
                      </div>

                      {/* Catégorie badge */}
                      {catName && (
                        <div className="text-[10px] text-slate-500">
                          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5">
                            {catName}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={() => void saveTemplate()}
          disabled={savingTemplate}
          className="h-11 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {savingTemplate ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </PageShell>
  );
}
