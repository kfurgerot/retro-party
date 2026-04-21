import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type MatrixCellEditorState = {
  skillId: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number | null;
  targetLevel: number | null;
  wantsToProgress: boolean;
  wantsToMentor: boolean;
};

type MatrixCellTone = {
  surfaceClass: string;
  valueClass: string;
  badgeClass: string;
  badgeLabel: string;
};

type RadarSkillMetric = {
  skillId: string;
  skillName: string;
  requiredLevel: number;
  currentLevel: number | null;
  scorePct: number;
};

type RadarCategoryMetric = {
  categoryKey: string;
  categoryName: string;
  scorePct: number;
  averageCurrentLevel: number | null;
  averageRequiredLevel: number;
  skills: RadarSkillMetric[];
};

type SkillsRadarModel = {
  categories: RadarCategoryMetric[];
  averageScorePct: number;
  completedSkills: number;
  totalSkills: number;
};

const AUTO_REFRESH_MS = 10000;
const SKILLS_ACCENT = TOOL_ACCENT["skills-matrix"];
const SKILLS_MATRIX_SESSION_STORAGE_KEY = "retro-party:skills-matrix:session";
const EMPTY_RADAR_MODEL: SkillsRadarModel = {
  categories: [],
  averageScorePct: 0,
  completedSkills: 0,
  totalSkills: 0,
};

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 16);
}

function assessmentKey(skillId: string, participantId: string) {
  return `${skillId}:${participantId}`;
}

type SkillsMatrixPersistedSession = {
  code: string;
  participantId: string;
  profile: { name: string; avatar: number };
  updatedAt: number;
};

function loadPersistedSkillsMatrixSession(): SkillsMatrixPersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SKILLS_MATRIX_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SkillsMatrixPersistedSession> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const code = typeof parsed.code === "string" ? parsed.code.trim().toUpperCase() : "";
    const participantId =
      typeof parsed.participantId === "string" ? parsed.participantId.trim() : "";
    if (!code || !participantId) return null;
    const profileRaw = parsed.profile ?? {};
    const name = typeof profileRaw.name === "string" ? cleanName(profileRaw.name) : "";
    const avatarRaw = Number(profileRaw.avatar);
    const avatar = Number.isFinite(avatarRaw)
      ? Math.max(0, Math.min(AVATARS.length - 1, Math.floor(avatarRaw)))
      : 0;
    const updatedAtRaw = Number(parsed.updatedAt);
    const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : Date.now();
    return {
      code,
      participantId,
      profile: { name, avatar },
      updatedAt,
    };
  } catch {
    return null;
  }
}

function persistSkillsMatrixSession(session: SkillsMatrixPersistedSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SKILLS_MATRIX_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SKILLS_MATRIX_SESSION_STORAGE_KEY, JSON.stringify(session));
}

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

function toDisplayLevel(level: number | null) {
  if (!Number.isFinite(level)) return "—";
  const rounded = Math.round(Number(level) * 10) / 10;
  return Number.isInteger(rounded) ? `N${rounded}` : `N${rounded.toFixed(1)}`;
}

function resolveMatrixCellTone(currentLevel: number | null, requiredLevel: number): MatrixCellTone {
  if (!Number.isFinite(currentLevel)) {
    return {
      surfaceClass: "border-slate-500/30 bg-slate-500/10",
      valueClass: "text-slate-200",
      badgeClass: "border-slate-400/30 bg-slate-500/15 text-slate-200",
      badgeLabel: "Non renseigné",
    };
  }

  const gap = Number(currentLevel) - requiredLevel;
  if (gap <= -2) {
    return {
      surfaceClass: "border-rose-400/40 bg-rose-500/15",
      valueClass: "text-rose-100",
      badgeClass: "border-rose-300/40 bg-rose-600/20 text-rose-100",
      badgeLabel: "Lacune critique",
    };
  }
  if (gap === -1) {
    return {
      surfaceClass: "border-orange-300/40 bg-orange-500/15",
      valueClass: "text-orange-100",
      badgeClass: "border-orange-200/40 bg-orange-600/20 text-orange-100",
      badgeLabel: "Lacune",
    };
  }
  if (gap === 0) {
    return {
      surfaceClass: "border-yellow-300/40 bg-yellow-500/15",
      valueClass: "text-yellow-100",
      badgeClass: "border-yellow-200/40 bg-yellow-600/20 text-yellow-100",
      badgeLabel: "Cible atteinte",
    };
  }
  if (gap === 1) {
    return {
      surfaceClass: "border-lime-300/40 bg-lime-500/15",
      valueClass: "text-lime-100",
      badgeClass: "border-lime-200/40 bg-lime-600/20 text-lime-100",
      badgeLabel: "Force",
    };
  }
  return {
    surfaceClass: "border-emerald-300/40 bg-emerald-500/15",
    valueClass: "text-emerald-100",
    badgeClass: "border-emerald-200/40 bg-emerald-600/20 text-emerald-100",
    badgeLabel: "Force forte",
  };
}

type SkillsRadarPanelProps = {
  title: string;
  subtitle: string;
  model: SkillsRadarModel;
};

function SkillsRadarPanel({ title, subtitle, model }: SkillsRadarPanelProps) {
  const categories = model.categories;
  const axisCount = categories.length;
  const canRenderRadar = axisCount >= 3;
  const ringTicks = [20, 40, 60, 80, 100];
  const size = 420;
  const center = size / 2;
  const radius = 128;
  const labelRadius = 165;

  const axes = canRenderRadar
    ? categories.map((category, index) => {
        const angleRad = (index / axisCount) * Math.PI * 2 - Math.PI / 2;
        const axisX = center + Math.cos(angleRad) * radius;
        const axisY = center + Math.sin(angleRad) * radius;
        const labelX = center + Math.cos(angleRad) * labelRadius;
        const labelY = center + Math.sin(angleRad) * labelRadius;
        const cosine = Math.cos(angleRad);
        return {
          ...category,
          angleRad,
          axisX,
          axisY,
          labelX,
          labelY,
          anchor:
            cosine > 0.4
              ? ("start" as const)
              : cosine < -0.4
                ? ("end" as const)
                : ("middle" as const),
        };
      })
    : [];

  const radarPoints = axes.map((axis) => {
    const pointRadius = (axis.scorePct / 100) * radius;
    const x = center + Math.cos(axis.angleRad) * pointRadius;
    const y = center + Math.sin(axis.angleRad) * pointRadius;
    return { ...axis, x, y };
  });

  const radarPath =
    radarPoints.length > 0
      ? `${radarPoints
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
          )
          .join(" ")} Z`
      : "";

  const completedRatio =
    model.totalSkills > 0 ? Math.round((model.completedSkills / model.totalSkills) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/14 px-2 py-0.5 text-cyan-100">
            Couverture {Math.round(model.averageScorePct)}%
          </span>
          <span className="rounded-full border border-white/[0.14] bg-white/[0.04] px-2 py-0.5 text-slate-300">
            Compétences remplies {completedRatio}%
          </span>
        </div>
      </div>

      {canRenderRadar ? (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-2 sm:p-3">
          <div className="h-[300px] w-full sm:h-[340px]">
            <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
              {ringTicks.map((ring, index) => {
                const ringRadius = (ring / 100) * radius;
                const vertices = axes.map((axis) => {
                  const x = center + Math.cos(axis.angleRad) * ringRadius;
                  const y = center + Math.sin(axis.angleRad) * ringRadius;
                  return `${x.toFixed(2)},${y.toFixed(2)}`;
                });
                return (
                  <polygon
                    key={`ring-${ring}`}
                    points={vertices.join(" ")}
                    fill={index % 2 === 0 ? "rgba(56,189,248,0.05)" : "rgba(15,23,42,0.32)"}
                    stroke="rgba(148,163,184,0.32)"
                    strokeWidth={ring === 100 ? 1.4 : 1}
                  />
                );
              })}

              {axes.map((axis) => (
                <line
                  key={`axis-${axis.categoryKey}`}
                  x1={center}
                  y1={center}
                  x2={axis.axisX}
                  y2={axis.axisY}
                  stroke="rgba(148,163,184,0.32)"
                  strokeWidth={1}
                />
              ))}

              {radarPath ? (
                <>
                  <path
                    d={radarPath}
                    fill="rgba(14,165,233,0.24)"
                    stroke="rgba(56,189,248,0.95)"
                    strokeWidth={2.2}
                  />
                  {radarPoints.map((point) => (
                    <circle
                      key={`point-${point.categoryKey}`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill="rgba(56,189,248,1)"
                      stroke="rgba(224,242,254,0.95)"
                      strokeWidth={1.2}
                    />
                  ))}
                </>
              ) : null}

              {axes.map((axis) => (
                <text
                  key={`label-${axis.categoryKey}`}
                  x={axis.labelX}
                  y={axis.labelY}
                  fill="rgba(226,232,240,0.95)"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor={axis.anchor}
                  dominantBaseline="middle"
                >
                  {axis.categoryName}
                </text>
              ))}
            </svg>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            100% = niveau requis atteint en moyenne sur la catégorie.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-3 text-xs text-slate-400">
          Ajoute au moins 3 catégories pour afficher un radar.
        </div>
      )}

      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {categories.map((category) => (
          <div
            key={category.categoryKey}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-200">{category.categoryName}</div>
              <div className="text-[11px] text-slate-400">
                {toDisplayLevel(category.averageCurrentLevel)} /{" "}
                {toDisplayLevel(category.averageRequiredLevel)}
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {category.skills.map((skill) => {
                const tone = resolveMatrixCellTone(skill.currentLevel, skill.requiredLevel);
                return (
                  <div
                    key={skill.skillId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[11px]",
                      tone.surfaceClass,
                    )}
                  >
                    <span className="min-w-0 truncate text-slate-100">{skill.skillName}</span>
                    <span className={cn("shrink-0 font-semibold", tone.valueClass)}>
                      {toDisplayLevel(skill.currentLevel)} / N{skill.requiredLevel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [editingCell, setEditingCell] = useState<MatrixCellEditorState | null>(null);
  const [savingCell, setSavingCell] = useState(false);
  const [selectedRadarParticipantId, setSelectedRadarParticipantId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);

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
    if (nextSnapshot.me?.participantId) {
      setParticipantId(nextSnapshot.me.participantId);
    }
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
  const myParticipantId = participantId || snapshot?.me?.participantId || null;
  const selfParticipant =
    myParticipantId && snapshot
      ? (snapshot.participants.find((participant) => participant.id === myParticipantId) ?? null)
      : null;
  const isAdmin = selfParticipant?.isAdmin === true;

  useEffect(() => {
    if (!templateFromQuery) return;
    setSelectedTemplateId(templateFromQuery);
  }, [templateFromQuery]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsRestoringSession(false);
      return;
    }

    let cancelled = false;

    const restoreSession = async () => {
      const persisted = loadPersistedSkillsMatrixSession();
      if (!persisted) {
        if (!cancelled) setIsRestoringSession(false);
        return;
      }

      try {
        const restored = await api.skillsMatrixGetSession(persisted.code, persisted.participantId);
        if (cancelled) return;
        const restoredSelf =
          restored.participants.find((participant) => participant.id === persisted.participantId) ??
          null;
        setParticipantId(persisted.participantId);
        setProfile({
          name:
            persisted.profile.name ||
            cleanName(restoredSelf?.displayName || user.displayName || "Equipe"),
          avatar:
            Number.isFinite(persisted.profile.avatar) && persisted.profile.avatar >= 0
              ? persisted.profile.avatar
              : Number.isFinite(restoredSelf?.avatar)
                ? Number(restoredSelf?.avatar)
                : 0,
        });
        applySnapshot(restored);
        setShowOnlineOnboarding(false);
      } catch {
        persistSkillsMatrixSession(null);
        if (!cancelled) {
          setParticipantId("");
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, authLoading, user]);

  useEffect(() => {
    if (isRestoringSession) return;
    if (!roomCode || !participantId) {
      persistSkillsMatrixSession(null);
      return;
    }
    persistSkillsMatrixSession({
      code: roomCode,
      participantId,
      profile: {
        name: cleanName(profile.name || ""),
        avatar: Number.isFinite(profile.avatar) ? profile.avatar : 0,
      },
      updatedAt: Date.now(),
    });
  }, [isRestoringSession, participantId, profile.avatar, profile.name, roomCode]);

  const refreshSession = useCallback(async () => {
    if (!roomCode || !participantId) return;
    const next = await api.skillsMatrixGetSession(roomCode, participantId);
    applySnapshot(next);
  }, [applySnapshot, participantId, roomCode]);

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
      if (!snapshot || !templateId || !participantId) return;
      setApplyingTemplate(true);
      await withLoading(async () => {
        const next = await api.skillsMatrixApplyTemplate(
          snapshot.session.code,
          { templateId },
          participantId,
        );
        applySnapshot(next);
      });
      setApplyingTemplate(false);
    },
    [applySnapshot, participantId, snapshot, withLoading],
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
    if (!roomCode || !participantId) return;
    const timer = window.setInterval(() => {
      void api
        .skillsMatrixGetSession(roomCode, participantId)
        .then((next) => {
          applySnapshot(next);
        })
        .catch(() => {
          // Keep last known state if polling fails.
        });
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [applySnapshot, participantId, roomCode]);

  const handleHost = useCallback(
    (name: string, avatar: number) => {
      void withLoading(async () => {
        const created = await api.skillsMatrixCreateSession({
          displayName: cleanName(name),
          avatar,
        });
        setProfile({ name: cleanName(name), avatar });
        setParticipantId(created.me?.participantId ?? "");
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
        setParticipantId(joined.me?.participantId ?? "");
        applySnapshot(joined);
      });
    },
    [applySnapshot, withLoading],
  );

  const handleStartSession = useCallback(() => {
    if (!roomCode || !participantId) return;
    void withLoading(async () => {
      const started = await api.skillsMatrixStartSession(roomCode, participantId);
      applySnapshot(started);
    });
  }, [applySnapshot, participantId, roomCode, withLoading]);

  const handleLeaveLobby = useCallback(() => {
    persistSkillsMatrixSession(null);
    setParticipantId("");
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

  useEffect(() => {
    const participantIds = snapshot?.participants.map((participant) => participant.id) ?? [];
    if (participantIds.length === 0) {
      setSelectedRadarParticipantId(null);
      return;
    }
    setSelectedRadarParticipantId((previous) =>
      previous && participantIds.includes(previous) ? previous : participantIds[0],
    );
  }, [snapshot]);

  const buildRadarModel = useCallback(
    (resolveCurrentLevel: (row: SkillsMatrixSnapshot["matrix"][number]) => number | null) => {
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
        averageFiniteNumbers(categories.map((category) => category.scorePct)) ?? 0;

      return {
        categories,
        averageScorePct,
        completedSkills,
        totalSkills,
      };
    },
    [matrixRowsByCategory],
  );

  const groupRadarModel = useMemo(
    () =>
      buildRadarModel((row) => {
        const levels = row.cells
          .map((cell) => cell.currentLevel)
          .filter((value): value is number => Number.isFinite(value));
        return averageFiniteNumbers(levels);
      }),
    [buildRadarModel],
  );

  const participantRadarModels = useMemo(() => {
    if (!snapshot) return new Map<string, SkillsRadarModel>();
    const models = new Map<string, SkillsRadarModel>();
    snapshot.participants.forEach((participant) => {
      models.set(
        participant.id,
        buildRadarModel((row) => {
          const cell = row.cells.find((entry) => entry.participantId === participant.id);
          return cell?.currentLevel ?? null;
        }),
      );
    });
    return models;
  }, [buildRadarModel, snapshot]);

  const selectedRadarParticipant =
    snapshot?.participants.find((participant) => participant.id === selectedRadarParticipantId) ??
    null;
  const selectedParticipantRadarModel =
    (selectedRadarParticipant && participantRadarModels.get(selectedRadarParticipant.id)) ??
    EMPTY_RADAR_MODEL;

  const matrixFilling = useMemo(() => {
    if (!snapshot) return { filled: 0, total: 0, ratio: 0 };
    const total = snapshot.matrix.length * snapshot.participants.length;
    const filled = snapshot.assessments.filter((assessment) =>
      Number.isFinite(assessment.currentLevel),
    ).length;
    const ratio = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { filled, total, ratio };
  }, [snapshot]);

  const openCellEditor = useCallback(
    (row: SkillsMatrixSnapshot["matrix"][number]) => {
      if (!myParticipantId) return;
      const existing =
        assessmentByCellKey.get(assessmentKey(row.skillId, myParticipantId)) ??
        ({
          currentLevel: null,
          targetLevel: null,
          wantsToProgress: false,
          wantsToMentor: false,
        } as const);
      setEditingCell({
        skillId: row.skillId,
        skillName: row.skillName,
        requiredLevel: row.requiredLevel,
        currentLevel: existing.currentLevel ?? null,
        targetLevel: existing.targetLevel ?? null,
        wantsToProgress: existing.wantsToProgress === true,
        wantsToMentor: existing.wantsToMentor === true,
      });
    },
    [assessmentByCellKey, myParticipantId],
  );

  const closeCellEditor = useCallback(() => {
    if (savingCell) return;
    setEditingCell(null);
  }, [savingCell]);

  const saveCellEditor = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!snapshot || !editingCell || !participantId) return;
      setSavingCell(true);
      setError(null);
      try {
        const next = await api.skillsMatrixUpsertAssessment(
          snapshot.session.code,
          editingCell.skillId,
          {
            currentLevel: editingCell.currentLevel,
            targetLevel: editingCell.targetLevel,
            wantsToProgress: editingCell.wantsToProgress,
            wantsToMentor: editingCell.wantsToMentor,
          },
          participantId,
        );
        applySnapshot(next);
        setEditingCell(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      } finally {
        setSavingCell(false);
      }
    },
    [applySnapshot, editingCell, participantId, snapshot],
  );

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixCreateCategory(
        snapshot.session.code,
        {
          name: categoryNameInput,
        },
        participantId,
      );
      applySnapshot(next);
      setCategoryNameInput("");
    });
  };

  const deleteCategory = async (categoryId: string) => {
    if (!snapshot || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixDeleteCategory(
        snapshot.session.code,
        categoryId,
        participantId,
      );
      applySnapshot(next);
    });
  };

  const createSkill = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixCreateSkill(
        snapshot.session.code,
        {
          name: skillNameInput,
          categoryId: skillCategoryInput || null,
          requiredLevel: skillRequiredLevelInput,
          requiredPeople: skillRequiredPeopleInput,
        },
        participantId,
      );
      applySnapshot(next);
      setSkillNameInput("");
      setSkillRequiredPeopleInput(1);
      setSkillRequiredLevelInput(next.session.scaleMin);
    });
  };

  const saveSkillDraft = async (skillId: string) => {
    if (!snapshot || !participantId) return;
    const draft = skillDrafts[skillId];
    if (!draft) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixPatchSkill(
        snapshot.session.code,
        skillId,
        {
          name: draft.name,
          categoryId: draft.categoryId,
          requiredLevel: draft.requiredLevel,
          requiredPeople: draft.requiredPeople,
        },
        participantId,
      );
      applySnapshot(next);
    });
  };

  const deleteSkill = async (skillId: string) => {
    if (!snapshot || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixDeleteSkill(snapshot.session.code, skillId, participantId);
      applySnapshot(next);
    });
  };

  const saveSessionSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !participantId) return;
    if (sessionSettingsScaleMin >= sessionSettingsScaleMax) {
      setError("L'échelle est invalide (min doit être strictement inférieur à max).");
      return;
    }
    await withLoading(async () => {
      const next = await api.skillsMatrixUpdateSession(
        snapshot.session.code,
        {
          title: sessionSettingsTitle,
          scaleMin: sessionSettingsScaleMin,
          scaleMax: sessionSettingsScaleMax,
        },
        participantId,
      );
      applySnapshot(next);
    });
  };

  if (authLoading || !user || isRestoringSession) {
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
          <Card className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(17,24,39,0.84)_50%,rgba(13,18,36,0.94))] p-0 shadow-[0_16px_42px_rgba(2,6,23,0.42)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-300">
                  Session active
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {snapshot.session.title}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Code <span className="font-mono">{snapshot.session.code}</span> · Échelle{" "}
                  {snapshot.session.scaleMin} à {snapshot.session.scaleMax}
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
                        ? "border-cyan-200/60 bg-cyan-500/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]"
                        : "border-white/[0.1] bg-white/[0.04] text-slate-300 hover:border-white/[0.22]",
                    )}
                  >
                    {tab === "matrix" ? "Matrice" : "Dashboard"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 px-4 py-3 sm:grid-cols-3 sm:px-5">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
                Couverture globale: {snapshot.dashboard.summary.coveredSkillsCount}/
                {Math.max(1, snapshot.dashboard.summary.totalSkills)}
              </div>
              <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[11px] text-slate-200">
                Cases renseignées: {matrixFilling.filled}/{Math.max(1, matrixFilling.total)} (
                {matrixFilling.ratio}%)
              </div>
              <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                Compétences à risque: {snapshot.dashboard.summary.riskySkillsCount}
              </div>
            </div>
          </Card>

          {activeTab === "matrix" ? (
            <Card className="overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0c1124]/95 p-0 shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:px-5">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Matrice compétences x membres
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded-full border border-rose-300/35 bg-rose-500/20 px-2 py-0.5 text-rose-100">
                    Lacunes
                  </span>
                  <span className="rounded-full border border-yellow-300/35 bg-yellow-500/18 px-2 py-0.5 text-yellow-100">
                    Cible
                  </span>
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
                    Forces
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <p className="mb-3 text-[11px] text-slate-500 md:hidden">
                  Vue mobile: complète chaque compétence via ta carte personnelle. Le détail de
                  l'équipe reste visible juste en dessous.
                </p>

                <div className="space-y-3 md:hidden">
                  {!myParticipantId ? (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                      Profil non associé à la session. Recharge la page ou rejoins à nouveau la
                      partie pour renseigner ta matrice.
                    </div>
                  ) : null}

                  {matrixRowsByCategory.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1021] px-3 py-3 text-xs text-slate-400">
                      Aucune compétence disponible. Ajoute des compétences dans la configuration
                      host pour compléter la matrice.
                    </div>
                  ) : (
                    matrixRowsByCategory.map((group) => (
                      <section
                        key={`mobile-group-${group.categoryId ?? "none"}`}
                        className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a1021]"
                      >
                        <div className="border-b border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-300">
                          {group.categoryName}
                        </div>
                        <div className="space-y-2.5 p-3">
                          {group.rows.map((row) => {
                            const myCell = myParticipantId
                              ? (assessmentByCellKey.get(
                                  assessmentKey(row.skillId, myParticipantId),
                                ) ?? null)
                              : null;
                            const myTone = resolveMatrixCellTone(
                              myCell?.currentLevel ?? null,
                              row.requiredLevel,
                            );
                            const showsProgressBadge = myCell?.wantsToProgress === true;
                            const showsMentorBadge = myCell?.wantsToMentor === true;
                            const otherParticipants = snapshot.participants.filter(
                              (participant) => participant.id !== myParticipantId,
                            );

                            return (
                              <article
                                key={`mobile-row-${row.skillId}`}
                                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                              >
                                <div className="font-semibold text-slate-100">{row.skillName}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                  Niveau attendu: {row.requiredLevel} · Personnes attendues:{" "}
                                  {row.requiredPeople}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Couverture actuelle: {row.coverageCount}/{row.requiredPeople}
                                  {row.missingCount > 0
                                    ? ` · Manque: ${row.missingCount}`
                                    : " · Besoin couvert"}
                                </div>

                                {myParticipantId ? (
                                  <button
                                    type="button"
                                    onClick={() => openCellEditor(row)}
                                    className={cn(
                                      "mt-2.5 w-full rounded-xl border px-3 py-2 text-left transition active:scale-[0.99]",
                                      myTone.surfaceClass,
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span
                                        className={cn(
                                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                                          myTone.badgeClass,
                                        )}
                                      >
                                        {myTone.badgeLabel}
                                      </span>
                                      <span className="text-[10px] font-semibold text-cyan-200/90">
                                        Modifier
                                      </span>
                                    </div>
                                    <div className="mt-2 flex items-end justify-between gap-2">
                                      <div>
                                        <div
                                          className={cn(
                                            "text-2xl font-extrabold",
                                            myTone.valueClass,
                                          )}
                                        >
                                          {myCell?.currentLevel ?? "—"}
                                        </div>
                                        <div className="text-[11px] text-slate-300">
                                          Cible: {myCell?.targetLevel ?? "—"}
                                        </div>
                                      </div>
                                      <div className="text-right text-[10px] text-slate-300">
                                        Ta cellule
                                      </div>
                                    </div>
                                    <div className="mt-2 flex min-h-[20px] flex-wrap gap-1">
                                      {showsProgressBadge ? (
                                        <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                                          Souhaite être formé
                                        </span>
                                      ) : null}
                                      {showsMentorBadge ? (
                                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                          Souhaite former
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                ) : null}

                                {otherParticipants.length > 0 ? (
                                  <details className="mt-2.5 group">
                                    <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 transition group-open:text-slate-300">
                                      Équipe ({otherParticipants.length})
                                    </summary>
                                    <div className="mt-1.5 space-y-1.5">
                                      {otherParticipants.map((participant) => {
                                        const cell =
                                          assessmentByCellKey.get(
                                            assessmentKey(row.skillId, participant.id),
                                          ) ?? null;
                                        const tone = resolveMatrixCellTone(
                                          cell?.currentLevel ?? null,
                                          row.requiredLevel,
                                        );
                                        return (
                                          <div
                                            key={`mobile-row-${row.skillId}-${participant.id}`}
                                            className={cn(
                                              "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5",
                                              tone.surfaceClass,
                                            )}
                                          >
                                            <div className="flex min-w-0 items-center gap-2">
                                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-500/10 text-sm">
                                                {AVATARS[participant.avatar] ?? "?"}
                                              </span>
                                              <span className="truncate text-xs text-slate-100">
                                                {participant.displayName}
                                              </span>
                                            </div>
                                            <div
                                              className={cn(
                                                "text-xs font-semibold",
                                                tone.valueClass,
                                              )}
                                            >
                                              {cell?.currentLevel ?? "—"} · C
                                              {cell?.targetLevel ?? "—"}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>

                <div className="hidden md:block">
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0a1021]">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-white/[0.04] text-slate-300">
                        <tr>
                          <th className="sticky left-0 z-20 min-w-[300px] border-b border-white/[0.08] bg-[#111830] px-3 py-2 text-left">
                            Compétence
                          </th>
                          {snapshot.participants.map((participant) => (
                            <th
                              key={participant.id}
                              className="min-w-[200px] border-b border-white/[0.08] px-3 py-2 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-base">
                                  {AVATARS[participant.avatar] ?? "?"}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-slate-100">
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
                            <tr
                              key={row.skillId}
                              className="border-t border-white/[0.06] align-top"
                            >
                              <td className="sticky left-0 z-10 bg-[#101735] px-3 py-3">
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
                                  assessmentByCellKey.get(
                                    assessmentKey(row.skillId, participant.id),
                                  ) ?? null;
                                const tone = resolveMatrixCellTone(
                                  cell?.currentLevel ?? null,
                                  row.requiredLevel,
                                );
                                const canEdit = participant.id === myParticipantId;
                                const showsProgressBadge = cell?.wantsToProgress === true;
                                const showsMentorBadge = cell?.wantsToMentor === true;
                                const cellContent = (
                                  <div
                                    className={cn(
                                      "min-h-[116px] rounded-2xl border px-3 py-2.5 text-left",
                                      "flex flex-col justify-between gap-1.5 transition",
                                      "bg-gradient-to-br from-white/[0.11] via-white/[0.04] to-slate-950/45 backdrop-blur-[1px]",
                                      canEdit
                                        ? "shadow-[0_10px_24px_rgba(2,6,23,0.32)] group-hover:shadow-[0_14px_30px_rgba(2,6,23,0.4)]"
                                        : "",
                                      tone.surfaceClass,
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span
                                        className={cn(
                                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                                          tone.badgeClass,
                                        )}
                                      >
                                        {tone.badgeLabel}
                                      </span>
                                      {canEdit ? (
                                        <span className="text-[10px] font-semibold text-cyan-200/90">
                                          Modifier
                                        </span>
                                      ) : null}
                                    </div>

                                    <div>
                                      <div
                                        className={cn(
                                          "text-2xl font-extrabold leading-none",
                                          tone.valueClass,
                                        )}
                                      >
                                        {cell?.currentLevel ?? "—"}
                                      </div>
                                      <div className="mt-1 text-[11px] text-slate-300">
                                        Cible: {cell?.targetLevel ?? "—"}
                                      </div>
                                    </div>

                                    <div className="flex min-h-[20px] flex-wrap gap-1">
                                      {showsProgressBadge ? (
                                        <span className="rounded-full border border-violet-300/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                                          Souhaite être formé
                                        </span>
                                      ) : null}
                                      {showsMentorBadge ? (
                                        <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                          Souhaite former
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );

                                return (
                                  <td
                                    key={`${row.skillId}-${participant.id}`}
                                    className="px-2 py-2 align-top"
                                  >
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => openCellEditor(row)}
                                        className="group w-full text-left transition hover:-translate-y-0.5"
                                      >
                                        {cellContent}
                                      </button>
                                    ) : (
                                      <div>{cellContent}</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          )),
                        ])}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-slate-400">
                    Compétences
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-100">
                    {snapshot.dashboard.summary.totalSkills}
                  </div>
                </Card>
                <Card className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-amber-100">À risque</div>
                  <div className="mt-1 text-xl font-bold text-amber-100">
                    {snapshot.dashboard.summary.riskySkillsCount}
                  </div>
                </Card>
                <Card className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-emerald-100">
                    Couvertes
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-100">
                    {snapshot.dashboard.summary.coveredSkillsCount}
                  </div>
                </Card>
                <Card className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.08em] text-rose-100">
                    Manques (personnes)
                  </div>
                  <div className="mt-1 text-xl font-bold text-rose-100">
                    {snapshot.dashboard.summary.totalMissingPeople}
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 2xl:grid-cols-2">
                <Card className="rounded-3xl border border-white/[0.1] bg-[#0c1124]/95 p-4 sm:p-5">
                  <SkillsRadarPanel
                    title="Radar groupe"
                    subtitle="Synthèse par catégorie (moyenne des niveaux de l'équipe)."
                    model={groupRadarModel}
                  />
                </Card>

                <Card className="rounded-3xl border border-white/[0.1] bg-[#0c1124]/95 p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-100">Radar individuel</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Sélectionne un membre pour analyser ses catégories et ses compétences.
                    </p>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {snapshot.participants.map((participant) => (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => setSelectedRadarParticipantId(participant.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition",
                          selectedRadarParticipantId === participant.id
                            ? "border-cyan-300/55 bg-cyan-500/20 text-cyan-100"
                            : "border-white/[0.1] bg-white/[0.04] text-slate-300 hover:border-white/[0.22]",
                        )}
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-500/10 text-sm">
                          {AVATARS[participant.avatar] ?? "?"}
                        </span>
                        <span className="max-w-[110px] truncate">{participant.displayName}</span>
                      </button>
                    ))}
                  </div>
                  <SkillsRadarPanel
                    title={
                      selectedRadarParticipant
                        ? selectedRadarParticipant.displayName
                        : "Aucun membre"
                    }
                    subtitle="Lecture individuelle par catégorie et compétences."
                    model={selectedParticipantRadarModel}
                  />
                </Card>
              </div>

              <Card className="rounded-3xl border border-white/[0.1] bg-[#0d1228]/92 p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200">
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
                  </div>

                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200">
                      Compétences couvertes
                    </div>
                    {snapshot.dashboard.coveredSkills.length === 0 ? (
                      <div className="text-sm text-slate-400">
                        Aucune compétence couverte pour le moment.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {snapshot.dashboard.coveredSkills.map((skill) => (
                          <div
                            key={skill.skillId}
                            className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
                          >
                            <span className="font-semibold">{skill.skillName}</span> (
                            {skill.categoryName}) · couverture {skill.coverageCount}/
                            {skill.requiredPeople}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="rounded-3xl border border-white/[0.1] bg-[#0d1228]/92 p-4 sm:p-5">
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
                              .map(
                                (helper) =>
                                  `${helper.displayName} (N${helper.currentLevel})${helper.wantsToMentor ? " · formateur volontaire" : ""}`,
                              )
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

        <Dialog open={Boolean(editingCell)} onOpenChange={(open) => !open && closeCellEditor()}>
          <DialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 text-slate-100 shadow-2xl">
            <div className="rounded-t-2xl border-b border-white/[0.08] bg-gradient-to-r from-cyan-500/16 via-indigo-500/10 to-cyan-500/8 px-5 py-4">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-slate-100">
                  Mettre à jour une compétence
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300">
                  {editingCell?.skillName} · Niveau attendu {editingCell?.requiredLevel}
                </DialogDescription>
              </DialogHeader>
            </div>

            <form onSubmit={saveCellEditor} className="space-y-4 px-5 py-4">
              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Niveau actuel
                  </label>
                  <span className="rounded-full border border-white/[0.14] bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-slate-200">
                    {editingCell?.currentLevel ?? "Non renseigné"}
                  </span>
                </div>
                <Slider
                  min={snapshot.session.scaleMin}
                  max={snapshot.session.scaleMax}
                  step={1}
                  value={[editingCell?.currentLevel ?? snapshot.session.scaleMin]}
                  onValueChange={(values) =>
                    setEditingCell((prev) =>
                      prev
                        ? {
                            ...prev,
                            currentLevel: values[0] ?? snapshot.session.scaleMin,
                          }
                        : prev,
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) => (prev ? { ...prev, currentLevel: null } : prev))
                    }
                    className="rounded-lg border border-white/[0.14] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    Non renseigné
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) =>
                        prev ? { ...prev, currentLevel: prev.requiredLevel } : prev,
                      )
                    }
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/14 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/24"
                  >
                    Aligner au requis
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Niveau cible
                  </label>
                  <span className="rounded-full border border-white/[0.14] bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-slate-200">
                    {editingCell?.targetLevel ?? "Non renseigné"}
                  </span>
                </div>
                <Slider
                  min={snapshot.session.scaleMin}
                  max={snapshot.session.scaleMax}
                  step={1}
                  value={[
                    editingCell?.targetLevel ??
                      editingCell?.currentLevel ??
                      snapshot.session.scaleMin,
                  ]}
                  onValueChange={(values) =>
                    setEditingCell((prev) =>
                      prev
                        ? {
                            ...prev,
                            targetLevel: values[0] ?? snapshot.session.scaleMin,
                          }
                        : prev,
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) => (prev ? { ...prev, targetLevel: null } : prev))
                    }
                    className="rounded-lg border border-white/[0.14] bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    Non renseigné
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) =>
                        prev ? { ...prev, targetLevel: prev.requiredLevel } : prev,
                      )
                    }
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/14 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/24"
                  >
                    Cible requise
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={editingCell?.wantsToProgress === true}
                  onChange={(event) =>
                    setEditingCell((prev) =>
                      prev ? { ...prev, wantsToProgress: event.target.checked } : prev,
                    )
                  }
                />
                Je souhaite être formé sur cette compétence
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={editingCell?.wantsToMentor === true}
                  onChange={(event) =>
                    setEditingCell((prev) =>
                      prev ? { ...prev, wantsToMentor: event.target.checked } : prev,
                    )
                  }
                />
                Je souhaite former sur cette compétence
              </label>

              <DialogFooter className="pt-2">
                <button
                  type="button"
                  onClick={closeCellEditor}
                  disabled={savingCell}
                  className="h-10 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCell}
                  className="h-10 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {savingCell ? "Enregistrement..." : "Enregistrer"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
