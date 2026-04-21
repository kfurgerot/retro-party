import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { Slider } from "@/components/ui/slider";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isSkillsMatrixTemplate } from "@/features/skillsMatrix/templateConfig";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { AVATARS } from "@/types/game";
import { api, type SkillsMatrixSnapshot, type TemplateItem } from "@/net/api";

type WorkspaceTab = "matrix" | "dashboard";

type SkillDraft = {
  name: string;
  categoryId: string | null;
  requiredLevel: number;
  requiredPeople: number;
};

const AUTO_REFRESH_MS = 10000;
const SKILLS_ACCENT = TOOL_ACCENT["skills-matrix"];

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 16);
}

function assessmentKey(skillId: string, participantId: string) {
  return `${skillId}:${participantId}`;
}

export default function SkillsMatrixPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialMode = searchParams.get("mode") === "join" ? "join" : "host";
  const initialCode = (searchParams.get("code") || "").trim().toUpperCase();
  const templateFromQuery = (searchParams.get("template") || "").trim();
  const initialName = cleanName(searchParams.get("name") || "");
  const rawInitialAvatar = Number(searchParams.get("avatar"));
  const initialAvatar = Number.isFinite(rawInitialAvatar)
    ? Math.max(0, Math.min(AVATARS.length - 1, Math.floor(rawInitialAvatar)))
    : 0;
  const initialAutoSubmit = searchParams.get("auto") === "1";
  const initialDirectAccess = initialAutoSubmit || !!initialCode;

  const [snapshot, setSnapshot] = useState<SkillsMatrixSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("matrix");
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateFromQuery);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [autoApplyGuard, setAutoApplyGuard] = useState<string | null>(null);
  const [autoSubmitKey] = useState<number>(() => (initialAutoSubmit ? Date.now() : 0));

  const [profile, setProfile] = useState(() => ({ name: initialName, avatar: initialAvatar }));
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState(
    () => !initialDirectAccess && initialName.length < 2,
  );
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    initialName.length >= 2 ? 2 : 1,
  );

  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [skillNameInput, setSkillNameInput] = useState("");
  const [skillCategoryInput, setSkillCategoryInput] = useState<string>("");
  const [skillRequiredLevelInput, setSkillRequiredLevelInput] = useState<number>(1);
  const [skillRequiredPeopleInput, setSkillRequiredPeopleInput] = useState<number>(1);
  const [sessionSettingsTitle, setSessionSettingsTitle] = useState("");
  const [sessionSettingsScaleMin, setSessionSettingsScaleMin] = useState<number>(1);
  const [sessionSettingsScaleMax, setSessionSettingsScaleMax] = useState<number>(5);
  const [skillDrafts, setSkillDrafts] = useState<Record<string, SkillDraft>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/", { replace: true });
      return;
    }
    if (user && !profile.name) {
      setProfile((prev) => ({ ...prev, name: cleanName(user.displayName || "Equipe") }));
    }
  }, [authLoading, navigate, profile.name, user]);

  const applySnapshot = useCallback((nextSnapshot: SkillsMatrixSnapshot) => {
    setSnapshot(nextSnapshot);
    setError(null);
  }, []);

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setLoadingAction(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoadingAction(false);
    }
  }, []);

  const roomCode = snapshot?.session.code ?? null;
  const isLobbyStage = !snapshot || snapshot.session.status === "lobby";
  const isAdmin = snapshot?.me?.isAdmin === true;
  const myParticipantId = snapshot?.me?.participantId ?? null;

  useEffect(() => {
    if (!templateFromQuery) return;
    setSelectedTemplateId(templateFromQuery);
  }, [templateFromQuery]);

  const refreshSession = useCallback(async () => {
    if (!roomCode) return;
    const next = await api.skillsMatrixGetSession(roomCode);
    applySnapshot(next);
  }, [applySnapshot, roomCode]);

  const loadTemplateOptions = useCallback(async () => {
    if (!user) return;
    setLoadingTemplates(true);
    try {
      const response = await api.listTemplates();
      setTemplates(response.items.filter(isSkillsMatrixTemplate));
    } catch {
      // Keep host setup usable even if template fetch fails.
    } finally {
      setLoadingTemplates(false);
    }
  }, [user]);

  useEffect(() => {
    if (!roomCode || !isLobbyStage || !isAdmin) {
      setTemplates([]);
      return;
    }
    void loadTemplateOptions();
  }, [isAdmin, isLobbyStage, loadTemplateOptions, roomCode]);

  const applyTemplate = useCallback(
    async (templateId: string) => {
      if (!snapshot || !templateId) return;
      setApplyingTemplate(true);
      await withLoading(async () => {
        const next = await api.skillsMatrixApplyTemplate(snapshot.session.code, { templateId });
        applySnapshot(next);
      });
      setApplyingTemplate(false);
    },
    [applySnapshot, snapshot, withLoading],
  );

  useEffect(() => {
    if (!templateFromQuery || !roomCode || !isLobbyStage || !isAdmin || templates.length === 0)
      return;
    const guardKey = `${roomCode}:${templateFromQuery}`;
    if (autoApplyGuard === guardKey) return;
    if (!templates.some((template) => template.id === templateFromQuery)) return;
    setAutoApplyGuard(guardKey);
    setSelectedTemplateId(templateFromQuery);
    void applyTemplate(templateFromQuery);
  }, [
    applyTemplate,
    autoApplyGuard,
    isAdmin,
    isLobbyStage,
    roomCode,
    templateFromQuery,
    templates,
  ]);

  useEffect(() => {
    if (!roomCode) return;
    const timer = window.setInterval(() => {
      void api
        .skillsMatrixGetSession(roomCode)
        .then((next) => {
          applySnapshot(next);
        })
        .catch(() => {
          // Keep last known state if polling fails.
        });
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [applySnapshot, roomCode]);

  const handleHost = useCallback(
    (name: string, avatar: number) => {
      void withLoading(async () => {
        const created = await api.skillsMatrixCreateSession({
          displayName: cleanName(name),
          avatar,
        });
        setProfile({ name: cleanName(name), avatar });
        applySnapshot(created);
      });
    },
    [applySnapshot, withLoading],
  );

  const handleJoin = useCallback(
    (code: string, name: string, avatar: number) => {
      void withLoading(async () => {
        const joined = await api.skillsMatrixJoinSession(code, {
          displayName: cleanName(name),
          avatar,
        });
        setProfile({ name: cleanName(name), avatar });
        applySnapshot(joined);
      });
    },
    [applySnapshot, withLoading],
  );

  const handleStartSession = useCallback(() => {
    if (!roomCode) return;
    void withLoading(async () => {
      const started = await api.skillsMatrixStartSession(roomCode);
      applySnapshot(started);
    });
  }, [applySnapshot, roomCode, withLoading]);

  const handleLeaveLobby = useCallback(() => {
    setSnapshot(null);
    setError(null);
    setShowOnlineOnboarding(true);
    if (!roomCode) {
      navigate("/");
    }
  }, [navigate, roomCode]);

  useEffect(() => {
    if (!snapshot) return;
    setSessionSettingsTitle(snapshot.session.title);
    setSessionSettingsScaleMin(snapshot.session.scaleMin);
    setSessionSettingsScaleMax(snapshot.session.scaleMax);
    setSkillRequiredLevelInput(snapshot.session.scaleMin);

    const nextDrafts = snapshot.skills.reduce<Record<string, SkillDraft>>((acc, skill) => {
      acc[skill.id] = {
        name: skill.name,
        categoryId: skill.categoryId,
        requiredLevel: skill.requiredLevel,
        requiredPeople: skill.requiredPeople,
      };
      return acc;
    }, {});
    setSkillDrafts(nextDrafts);
  }, [snapshot]);

  const levelOptions = useMemo(() => {
    if (!snapshot) return [];
    const options = [];
    for (let level = snapshot.session.scaleMin; level <= snapshot.session.scaleMax; level += 1) {
      options.push(level);
    }
    return options;
  }, [snapshot]);

  const assessmentByCellKey = useMemo(() => {
    if (!snapshot) return new Map<string, SkillsMatrixSnapshot["assessments"][number]>();
    return new Map(
      snapshot.assessments.map((assessment) => [
        assessmentKey(assessment.skillId, assessment.participantId),
        assessment,
      ]),
    );
  }, [snapshot]);

  const matrixRowsByCategory = useMemo(() => {
    if (!snapshot) return [];
    const byCategory = new Map<
      string,
      { categoryId: string | null; categoryName: string; rows: SkillsMatrixSnapshot["matrix"] }
    >();
    for (const row of snapshot.matrix) {
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
  }, [snapshot]);

  const updateAssessment = useCallback(
    async (
      skillId: string,
      patch: Partial<{
        currentLevel: number | null;
        targetLevel: number | null;
        wantsToProgress: boolean;
      }>,
    ) => {
      if (!snapshot || !myParticipantId) return;
      const existing =
        assessmentByCellKey.get(assessmentKey(skillId, myParticipantId)) ??
        ({
          currentLevel: null,
          targetLevel: null,
          wantsToProgress: false,
        } as const);
      const payload = {
        currentLevel:
          patch.currentLevel !== undefined ? patch.currentLevel : (existing.currentLevel ?? null),
        targetLevel:
          patch.targetLevel !== undefined ? patch.targetLevel : (existing.targetLevel ?? null),
        wantsToProgress:
          patch.wantsToProgress !== undefined
            ? patch.wantsToProgress
            : existing.wantsToProgress === true,
      };

      await withLoading(async () => {
        const next = await api.skillsMatrixUpsertAssessment(
          snapshot.session.code,
          skillId,
          payload,
        );
        applySnapshot(next);
      });
    },
    [applySnapshot, assessmentByCellKey, myParticipantId, snapshot, withLoading],
  );

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixCreateCategory(snapshot.session.code, {
        name: categoryNameInput,
      });
      applySnapshot(next);
      setCategoryNameInput("");
    });
  };

  const deleteCategory = async (categoryId: string) => {
    if (!snapshot) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixDeleteCategory(snapshot.session.code, categoryId);
      applySnapshot(next);
    });
  };

  const createSkill = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixCreateSkill(snapshot.session.code, {
        name: skillNameInput,
        categoryId: skillCategoryInput || null,
        requiredLevel: skillRequiredLevelInput,
        requiredPeople: skillRequiredPeopleInput,
      });
      applySnapshot(next);
      setSkillNameInput("");
      setSkillRequiredPeopleInput(1);
      setSkillRequiredLevelInput(next.session.scaleMin);
    });
  };

  const saveSkillDraft = async (skillId: string) => {
    if (!snapshot) return;
    const draft = skillDrafts[skillId];
    if (!draft) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixPatchSkill(snapshot.session.code, skillId, {
        name: draft.name,
        categoryId: draft.categoryId,
        requiredLevel: draft.requiredLevel,
        requiredPeople: draft.requiredPeople,
      });
      applySnapshot(next);
    });
  };

  const deleteSkill = async (skillId: string) => {
    if (!snapshot) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixDeleteSkill(snapshot.session.code, skillId);
      applySnapshot(next);
    });
  };

  const saveSessionSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot) return;
    if (sessionSettingsScaleMin >= sessionSettingsScaleMax) {
      setError("L'échelle est invalide (min doit être strictement inférieur à max).");
      return;
    }
    await withLoading(async () => {
      const next = await api.skillsMatrixUpdateSession(snapshot.session.code, {
        title: sessionSettingsTitle,
        scaleMin: sessionSettingsScaleMin,
        scaleMax: sessionSettingsScaleMax,
      });
      applySnapshot(next);
    });
  };

  if (authLoading || !user) {
    return (
      <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
        <div className="neon-surface px-4 py-3 text-sm font-semibold text-cyan-100">
          Chargement...
        </div>
      </div>
    );
  }

  if (isLobbyStage) {
    if (!roomCode && showOnlineOnboarding) {
      return (
        <OnlineOnboardingScreen
          connected={true}
          brandLabel="Matrice de Compétences"
          accentColor={SKILLS_ACCENT.color}
          accentGlow={SKILLS_ACCENT.ambientGlow}
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialStep={onboardingInitialStep}
          overallStepStart={3}
          overallStepTotal={5}
          onSubmit={({ name, avatar }) => {
            setProfile({ name: cleanName(name), avatar });
            setShowOnlineOnboarding(false);
            setOnboardingInitialStep(1);
          }}
          onBack={() => navigate("/")}
        />
      );
    }

    const lobbyPlayers =
      snapshot?.participants.map((participant) => ({
        name: participant.displayName,
        avatar: participant.avatar,
        isHost: participant.isAdmin,
        connected: true,
      })) ?? [];

    const hostSetupPanel =
      snapshot && isAdmin ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
              Configuration Host
            </h2>
            <button
              type="button"
              onClick={() => navigate("/prepare/skills-matrix")}
              className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Préparer une partie
            </button>
          </div>

          <section className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Templates
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-slate-100"
              >
                <option value="">Aucun template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void applyTemplate(selectedTemplateId)}
                disabled={!selectedTemplateId || applyingTemplate}
                className="h-10 rounded-lg border border-cyan-300/30 bg-cyan-500/12 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/22 disabled:opacity-50"
              >
                {applyingTemplate ? "Application..." : "Appliquer"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/prepare/skills-matrix")}
                className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
              >
                Gérer
              </button>
            </div>
            {loadingTemplates ? (
              <div className="text-[11px] text-slate-500">Chargement des templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                Aucun template Skills Matrix. Crée-en un via “Préparer une partie”.
              </div>
            ) : null}
          </section>

          <section className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Paramètres session
            </div>
            <form onSubmit={saveSessionSettings} className="space-y-3">
              <input
                value={sessionSettingsTitle}
                onChange={(event) => setSessionSettingsTitle(event.target.value)}
                placeholder="Nom de session"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100"
              />
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Échelle des niveaux</span>
                  <span className="font-semibold text-cyan-200">
                    {sessionSettingsScaleMin} à {sessionSettingsScaleMax}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={1}
                  value={[sessionSettingsScaleMin, sessionSettingsScaleMax]}
                  onValueChange={(values) => {
                    if (values.length < 2) return;
                    let nextMin = Math.round(values[0]);
                    let nextMax = Math.round(values[1]);
                    if (nextMin === nextMax) {
                      if (nextMax >= 10) nextMin = nextMax - 1;
                      else nextMax = nextMin + 1;
                    }
                    if (nextMin > nextMax) {
                      const swap = nextMin;
                      nextMin = nextMax;
                      nextMax = swap;
                    }
                    setSessionSettingsScaleMin(nextMin);
                    setSessionSettingsScaleMax(nextMax);
                  }}
                  aria-label="Echelle des niveaux"
                />
              </div>
              <PrimaryButton className="h-10 min-h-0 px-3 text-xs">Enregistrer</PrimaryButton>
            </form>
          </section>

          <section className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Catégories
            </div>
            <form onSubmit={createCategory} className="flex flex-wrap gap-2">
              <input
                value={categoryNameInput}
                onChange={(event) => setCategoryNameInput(event.target.value)}
                placeholder="Nom de catégorie"
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100"
              />
              <PrimaryButton className="h-10 min-h-0 px-3 text-xs">Ajouter</PrimaryButton>
            </form>
            <div className="grid gap-2 sm:grid-cols-2">
              {snapshot.categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2"
                >
                  <span className="truncate text-sm text-slate-200">{category.name}</span>
                  <button
                    type="button"
                    onClick={() => void deleteCategory(category.id)}
                    className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-200"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Compétences
            </div>
            <form
              onSubmit={createSkill}
              className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <input
                value={skillNameInput}
                onChange={(event) => setSkillNameInput(event.target.value)}
                placeholder="Nom de compétence"
                className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100"
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <select
                  value={skillCategoryInput}
                  onChange={(event) => setSkillCategoryInput(event.target.value)}
                  className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100"
                >
                  <option value="">Sans catégorie</option>
                  {snapshot.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={skillRequiredPeopleInput}
                  onChange={(event) => setSkillRequiredPeopleInput(Number(event.target.value))}
                  className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-400">
                  Niveau attendu:{" "}
                  <span className="font-semibold text-cyan-200">{skillRequiredLevelInput}</span>
                </div>
                <Slider
                  min={snapshot.session.scaleMin}
                  max={snapshot.session.scaleMax}
                  step={1}
                  value={[skillRequiredLevelInput]}
                  onValueChange={(values) => {
                    const next = values[0];
                    if (!Number.isFinite(next)) return;
                    setSkillRequiredLevelInput(Math.round(next));
                  }}
                  aria-label="Niveau attendu"
                />
              </div>
              <PrimaryButton className="h-10 min-h-0 px-3 text-xs">Ajouter</PrimaryButton>
            </form>

            <div className="space-y-2">
              {snapshot.skills.map((skill) => {
                const draft = skillDrafts[skill.id];
                return (
                  <div
                    key={skill.id}
                    className="space-y-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_170px_120px]">
                      <input
                        value={draft?.name ?? skill.name}
                        onChange={(event) =>
                          setSkillDrafts((prev) => ({
                            ...prev,
                            [skill.id]: {
                              ...(prev[skill.id] ?? {
                                name: skill.name,
                                categoryId: skill.categoryId,
                                requiredLevel: skill.requiredLevel,
                                requiredPeople: skill.requiredPeople,
                              }),
                              name: event.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-sm text-slate-100"
                      />
                      <select
                        value={draft?.categoryId ?? ""}
                        onChange={(event) =>
                          setSkillDrafts((prev) => ({
                            ...prev,
                            [skill.id]: {
                              ...(prev[skill.id] ?? {
                                name: skill.name,
                                categoryId: skill.categoryId,
                                requiredLevel: skill.requiredLevel,
                                requiredPeople: skill.requiredPeople,
                              }),
                              categoryId: event.target.value || null,
                            },
                          }))
                        }
                        className="h-9 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-sm text-slate-100"
                      >
                        <option value="">Sans catégorie</option>
                        {snapshot.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={draft?.requiredPeople ?? skill.requiredPeople}
                        onChange={(event) =>
                          setSkillDrafts((prev) => ({
                            ...prev,
                            [skill.id]: {
                              ...(prev[skill.id] ?? {
                                name: skill.name,
                                categoryId: skill.categoryId,
                                requiredLevel: skill.requiredLevel,
                                requiredPeople: skill.requiredPeople,
                              }),
                              requiredPeople: Number(event.target.value),
                            },
                          }))
                        }
                        className="h-9 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-sm text-slate-100"
                      />
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] text-slate-400">
                        Niveau attendu:{" "}
                        <span className="font-semibold text-cyan-200">
                          {draft?.requiredLevel ?? skill.requiredLevel}
                        </span>
                      </div>
                      <Slider
                        min={snapshot.session.scaleMin}
                        max={snapshot.session.scaleMax}
                        step={1}
                        value={[draft?.requiredLevel ?? skill.requiredLevel]}
                        onValueChange={(values) => {
                          const next = values[0];
                          if (!Number.isFinite(next)) return;
                          setSkillDrafts((prev) => ({
                            ...prev,
                            [skill.id]: {
                              ...(prev[skill.id] ?? {
                                name: skill.name,
                                categoryId: skill.categoryId,
                                requiredLevel: skill.requiredLevel,
                                requiredPeople: skill.requiredPeople,
                              }),
                              requiredLevel: Math.round(next),
                            },
                          }));
                        }}
                        aria-label={`Niveau attendu ${skill.name}`}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveSkillDraft(skill.id)}
                        className="h-9 rounded-lg border border-cyan-300/30 bg-cyan-500/12 px-3 text-xs font-semibold text-cyan-200"
                      >
                        Sauver
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSkill(skill.id)}
                        className="h-9 rounded-lg border border-red-400/30 bg-red-500/10 px-3 text-xs font-semibold text-red-200"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null;

    return (
      <div>
        {error ? (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        <OnlineLobbyScreen
          connected={true}
          brandLabel="Matrice de Compétences"
          accentColor={SKILLS_ACCENT.color}
          accentGlow={SKILLS_ACCENT.ambientGlow}
          roomCode={roomCode}
          lobbyPlayers={lobbyPlayers}
          onHost={handleHost}
          onJoin={handleJoin}
          onLeave={handleLeaveLobby}
          onEditProfile={() => {
            setOnboardingInitialStep(2);
            setShowOnlineOnboarding(true);
          }}
          onStartGame={() => {
            handleStartSession();
          }}
          canStart={Boolean(roomCode) && isAdmin}
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialMode={initialMode}
          initialCode={initialCode}
          autoSubmitKey={autoSubmitKey}
          stepLabel="Etape 5/5"
          stepCurrent={5}
          stepTotal={5}
          shellStyle="transparent"
          hideRoundsControl
          titleWhenNoRoomOverride="Créer ou rejoindre une session Matrice"
          hostSetupPanel={hostSetupPanel}
        />
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#0a0a14] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 18% 12%, rgba(14,165,233,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 52% 36% at 82% 82%, rgba(99,102,241,0.08) 0%, transparent 70%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1260px] px-4 pb-12 pt-6 sm:px-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 text-sm">
                🧩
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">
                Agile Suite
              </span>
            </div>
            <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none tracking-tight text-slate-50">
              Matrice de Compétences
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Session démarrée. Pilote la couverture des compétences et les plans de progression.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton className="h-10 min-h-0 px-3 text-xs" onClick={() => navigate("/")}>
              Retour
            </SecondaryButton>
            <PrimaryButton
              className="h-10 min-h-0 px-3 text-xs"
              onClick={() => void refreshSession()}
            >
              Actualiser
            </PrimaryButton>
          </div>
        </header>

        {error ? (
          <Card className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </Card>
        ) : null}

        <div className="space-y-4">
          <Card className="rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Session active
                </div>
                <div className="mt-1 text-sm text-slate-200">
                  {snapshot.session.title} · Code{" "}
                  <span className="font-mono">{snapshot.session.code}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Échelle: {snapshot.session.scaleMin} à {snapshot.session.scaleMax}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["matrix", "dashboard"] as WorkspaceTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                      activeTab === tab
                        ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/[0.15]",
                    )}
                  >
                    {tab === "matrix" ? "Matrice" : "Dashboard"}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {activeTab === "matrix" ? (
            <Card className="rounded-2xl p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Matrice Compétences x Membres
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-white/[0.04] text-slate-300">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[280px] border-b border-white/[0.08] bg-[#141426] px-3 py-2 text-left">
                        Compétence
                      </th>
                      {snapshot.participants.map((participant) => (
                        <th
                          key={participant.id}
                          className="min-w-[190px] border-b border-white/[0.08] px-3 py-2 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-500/10 text-base">
                              {AVATARS[participant.avatar] ?? "?"}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-100">
                                {participant.displayName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {participant.isAdmin ? "Host" : "Membre"}
                              </div>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRowsByCategory.flatMap((group) => [
                      <tr key={`group-${group.categoryId ?? "none"}`}>
                        <td
                          colSpan={snapshot.participants.length + 1}
                          className="bg-white/[0.02] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-300"
                        >
                          {group.categoryName}
                        </td>
                      </tr>,
                      ...group.rows.map((row) => (
                        <tr key={row.skillId} className="border-t border-white/[0.06] align-top">
                          <td className="sticky left-0 z-10 bg-[#101020] px-3 py-3">
                            <div className="font-semibold text-slate-100">{row.skillName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Niveau attendu: {row.requiredLevel} · Personnes attendues:{" "}
                              {row.requiredPeople}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              Couverture actuelle: {row.coverageCount}/{row.requiredPeople}
                              {row.missingCount > 0
                                ? ` · Manque: ${row.missingCount}`
                                : " · Besoin couvert"}
                            </div>
                          </td>
                          {snapshot.participants.map((participant) => {
                            const cell =
                              assessmentByCellKey.get(assessmentKey(row.skillId, participant.id)) ??
                              null;
                            const canEdit = participant.id === myParticipantId;
                            if (!canEdit) {
                              return (
                                <td key={`${row.skillId}-${participant.id}`} className="px-3 py-3">
                                  <div className="text-xs text-slate-200">
                                    Actuel: {cell?.currentLevel ?? "-"}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Cible: {cell?.targetLevel ?? "-"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {cell?.wantsToProgress ? "Souhaite progresser" : " "}
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={`${row.skillId}-${participant.id}`} className="px-3 py-3">
                                <div className="space-y-1.5">
                                  <select
                                    value={cell?.currentLevel ?? ""}
                                    onChange={(event) => {
                                      const raw = event.target.value;
                                      void updateAssessment(row.skillId, {
                                        currentLevel: raw === "" ? null : Number(raw),
                                      });
                                    }}
                                    className="h-8 w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-2 text-xs text-slate-100"
                                  >
                                    <option value="">Actuel -</option>
                                    {levelOptions.map((level) => (
                                      <option key={`${row.skillId}-current-${level}`} value={level}>
                                        Actuel {level}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={cell?.targetLevel ?? ""}
                                    onChange={(event) => {
                                      const raw = event.target.value;
                                      void updateAssessment(row.skillId, {
                                        targetLevel: raw === "" ? null : Number(raw),
                                      });
                                    }}
                                    className="h-8 w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-2 text-xs text-slate-100"
                                  >
                                    <option value="">Cible -</option>
                                    {levelOptions.map((level) => (
                                      <option key={`${row.skillId}-target-${level}`} value={level}>
                                        Cible {level}
                                      </option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-2 text-xs text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={cell?.wantsToProgress === true}
                                      onChange={(event) => {
                                        void updateAssessment(row.skillId, {
                                          wantsToProgress: event.target.checked,
                                        });
                                      }}
                                    />
                                    Progresser
                                  </label>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Card className="rounded-2xl p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                    Compétences
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-100">
                    {snapshot.dashboard.summary.totalSkills}
                  </div>
                </Card>
                <Card className="rounded-2xl p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">À risque</div>
                  <div className="mt-1 text-xl font-bold text-amber-300">
                    {snapshot.dashboard.summary.riskySkillsCount}
                  </div>
                </Card>
                <Card className="rounded-2xl p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                    Couvertes
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-300">
                    {snapshot.dashboard.summary.coveredSkillsCount}
                  </div>
                </Card>
                <Card className="rounded-2xl p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                    Manques (personnes)
                  </div>
                  <div className="mt-1 text-xl font-bold text-rose-300">
                    {snapshot.dashboard.summary.totalMissingPeople}
                  </div>
                </Card>
              </div>

              <Card className="rounded-2xl p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Compétences à risque
                </div>
                {snapshot.dashboard.riskySkills.length === 0 ? (
                  <div className="text-sm text-emerald-300">Aucune compétence à risque.</div>
                ) : (
                  <div className="space-y-2">
                    {snapshot.dashboard.riskySkills.map((skill) => (
                      <div
                        key={skill.skillId}
                        className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                      >
                        <span className="font-semibold">{skill.skillName}</span> (
                        {skill.categoryName}) · couverture {skill.coverageCount}/
                        {skill.requiredPeople} · manque {skill.missingCount}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="rounded-2xl p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Qui peut aider / qui veut apprendre
                </div>
                <div className="space-y-2">
                  {snapshot.dashboard.mentoringBySkill.map((item) => (
                    <div
                      key={item.skillId}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
                    >
                      <div className="text-sm font-semibold text-slate-100">
                        {item.skillName}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          ({item.categoryName})
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Aider:{" "}
                        {item.helpers.length > 0
                          ? item.helpers
                              .map((helper) => `${helper.displayName} (N${helper.currentLevel})`)
                              .join(", ")
                          : "personne"}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">
                        Apprendre:{" "}
                        {item.learners.length > 0
                          ? item.learners
                              .map(
                                (learner) =>
                                  `${learner.displayName}${learner.targetLevel ? ` (cible N${learner.targetLevel})` : ""}`,
                              )
                              .join(", ")
                          : "personne"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </div>

        {loadingAction ? (
          <div className="fixed bottom-4 right-4 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
            Mise à jour...
          </div>
        ) : null}
      </div>
    </div>
  );
}
