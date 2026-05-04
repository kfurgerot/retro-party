import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { C2S_EVENTS, S2C_EVENTS } from "@shared/contracts/socketEvents.js";
import { IdentityStep, SessionLobby, ConnectingState } from "@/components/app-shell-v2/pre-game";
import type { PresenceParticipant } from "@/components/app-shell-v2/pre-game";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { FileDown } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { setHostSession } from "@/lib/hostSession";
import {
  loadPersistedSkillsMatrixSession,
  persistSkillsMatrixSession,
} from "@/features/skillsMatrix/sessionPersistence";
import { useAuth } from "@/contexts/AuthContext";
import { isSkillsMatrixTemplate } from "@/features/skillsMatrix/templateConfig";
import { assessmentKey, cleanName } from "@/features/skillsMatrix/utils";
import { CTA_NEON_DANGER, CTA_NEON_SECONDARY_SUBTLE, TOOL_ACCENT } from "@/lib/uiTokens";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AVATARS } from "@/types/game";
import { api, type SkillsMatrixSnapshot, type TemplateItem } from "@/net/api";
import { socket } from "@/net/socket";
import { AuthModal } from "@/components/AuthModal";

type WorkspaceTab = "matrix" | "dashboard" | "manage";

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

const AUTO_REFRESH_MS = 4000;
const SKILLS_ACCENT = TOOL_ACCENT["skills-matrix"];
const EMPTY_RADAR_MODEL: SkillsRadarModel = {
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

function LevelSelector({
  value,
  min,
  max,
  requiredLevel,
  onChange,
}: {
  value: number | null;
  min: number;
  max: number;
  requiredLevel?: number;
  onChange: (level: number | null) => void;
}) {
  const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const cols = Math.min(levels.length, 5);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {levels.map((level) => {
        const isSelected = value === level;
        const isRequired = level === requiredLevel;
        const selectedTone =
          isSelected && requiredLevel != null ? resolveMatrixCellTone(level, requiredLevel) : null;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(isSelected ? null : level)}
            className={cn(
              "relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-bold transition active:scale-95",
              isSelected
                ? cn(
                    selectedTone?.surfaceClass ?? "border-cyan-300/60 bg-cyan-500/30",
                    selectedTone?.valueClass ?? "text-cyan-100",
                  )
                : isRequired
                  ? "border-white/[0.28] bg-white/[0.06] text-slate-200"
                  : "border-white/[0.1] bg-white/[0.04] text-slate-400 hover:border-white/[0.22] hover:bg-white/[0.08]",
            )}
          >
            {level}
            {isRequired && (
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  isSelected ? "bg-current opacity-60" : "bg-cyan-400",
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function CellEditorFormBody({
  editingCell,
  scaleMin,
  scaleMax,
  setEditingCell,
}: {
  editingCell: MatrixCellEditorState;
  scaleMin: number;
  scaleMax: number;
  setEditingCell: Dispatch<SetStateAction<MatrixCellEditorState | null>>;
}) {
  const currentTone = resolveMatrixCellTone(editingCell.currentLevel, editingCell.requiredLevel);
  return (
    <>
      {/* Niveau actuel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Niveau actuel
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-bold",
              editingCell.currentLevel != null
                ? currentTone.badgeClass
                : "border-slate-400/30 bg-slate-500/15 text-slate-300",
            )}
          >
            {editingCell.currentLevel ?? "Non renseigné"}
          </span>
        </div>
        <LevelSelector
          value={editingCell.currentLevel}
          min={scaleMin}
          max={scaleMax}
          requiredLevel={editingCell.requiredLevel}
          onChange={(level) =>
            setEditingCell((prev) => (prev ? { ...prev, currentLevel: level } : prev))
          }
        />
        {editingCell.currentLevel != null && (
          <button
            type="button"
            onClick={() =>
              setEditingCell((prev) => (prev ? { ...prev, currentLevel: null } : prev))
            }
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Niveau cible */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Niveau cible (optionnel)
          </span>
          <span className="rounded-full border border-white/[0.14] bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {editingCell.targetLevel ?? "—"}
          </span>
        </div>
        <LevelSelector
          value={editingCell.targetLevel}
          min={scaleMin}
          max={scaleMax}
          requiredLevel={editingCell.requiredLevel}
          onChange={(level) =>
            setEditingCell((prev) => (prev ? { ...prev, targetLevel: level } : prev))
          }
        />
        {editingCell.targetLevel != null && (
          <button
            type="button"
            onClick={() => setEditingCell((prev) => (prev ? { ...prev, targetLevel: null } : prev))}
            className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Intentions */}
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={editingCell.wantsToProgress}
            onChange={(e) =>
              setEditingCell((prev) =>
                prev ? { ...prev, wantsToProgress: e.target.checked } : prev,
              )
            }
            className="h-4 w-4 shrink-0 accent-cyan-500"
          />
          <span>Je souhaite être formé sur cette compétence</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={editingCell.wantsToMentor}
            onChange={(e) =>
              setEditingCell((prev) => (prev ? { ...prev, wantsToMentor: e.target.checked } : prev))
            }
            className="h-4 w-4 shrink-0 accent-cyan-500"
          />
          <span>Je souhaite former sur cette compétence</span>
        </label>
      </div>
    </>
  );
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
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 font-semibold text-cyan-200">
            {Math.round(model.averageScorePct)}% couvert
          </span>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-1 text-slate-400">
            {completedRatio}% renseigné
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
            Plus la forme est large, plus l'équipe maîtrise les compétences requises.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-3 text-xs text-slate-400">
          Ajoute au moins 3 catégories pour afficher un radar.
        </div>
      )}

      <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {categories.map((category) => {
          const catPct = Math.round(category.scorePct);
          const catColor =
            catPct >= 80 ? "text-emerald-400" : catPct >= 50 ? "text-cyan-400" : "text-amber-400";
          return (
            <div
              key={category.categoryKey}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-100">{category.categoryName}</div>
                <span className={cn("text-[11px] font-bold", catColor)}>{catPct}%</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {category.skills.map((skill) => {
                  const tone = resolveMatrixCellTone(skill.currentLevel, skill.requiredLevel);
                  const isFilled = skill.currentLevel != null;
                  const meetsRequired = isFilled && skill.currentLevel! >= skill.requiredLevel;
                  return (
                    <div
                      key={skill.skillId}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]",
                        tone.surfaceClass,
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-slate-100">
                        {skill.skillName}
                      </span>
                      {isFilled ? (
                        <span className={cn("shrink-0 font-bold", tone.valueClass)}>
                          {meetsRequired ? "✓" : ""} Niv. {skill.currentLevel}
                        </span>
                      ) : (
                        <span className="shrink-0 text-slate-600">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
  const initialParticipantIdFromQuery = (searchParams.get("participantId") || "").trim();
  const templateFromQuery = (searchParams.get("template") || "").trim();
  const initialName = cleanName(searchParams.get("name") || "");
  const rawInitialAvatar = Number(searchParams.get("avatar"));
  const initialAvatar = Number.isFinite(rawInitialAvatar)
    ? Math.max(0, Math.min(AVATARS.length - 1, Math.floor(rawInitialAvatar)))
    : 0;
  const initialAutoSubmit = searchParams.get("auto") === "1";
  const initialDirectAccess = initialAutoSubmit || !!initialCode;
  const initialFreshLaunch = searchParams.get("new") === "1";
  const connectedDisplayName = cleanName(user?.displayName || "");
  const forceProfileBeforeJoin = useMemo(
    () => initialMode === "join" && !!initialCode && !initialAutoSubmit,
    [initialAutoSubmit, initialCode, initialMode],
  );

  const isMobile = useIsMobile();
  const [snapshot, setSnapshot] = useState<SkillsMatrixSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("matrix");
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateFromQuery);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [autoApplyGuard, setAutoApplyGuard] = useState<string | null>(null);
  const [profile, setProfile] = useState(() => ({ name: initialName, avatar: initialAvatar }));
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState(
    () => forceProfileBeforeJoin || (!initialDirectAccess && initialName.length < 2),
  );
  const [connectedLaunchProfileApplied, setConnectedLaunchProfileApplied] = useState(false);

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
  const [mobileMatrixView, setMobileMatrixView] = useState<"me" | "team">("me");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [savingCell, setSavingCell] = useState(false);
  const [selectedRadarParticipantId, setSelectedRadarParticipantId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [endSessionDialogOpen, setEndSessionDialogOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const refreshTicketRef = useRef(0);
  const matrixCaptureRef = useRef<HTMLDivElement | null>(null);
  const roomCode = snapshot?.session.code ?? null;

  useEffect(() => {
    if (user && !profile.name) {
      setProfile((prev) => ({ ...prev, name: cleanName(user.displayName || "Equipe") }));
    }
  }, [profile.name, user]);

  useEffect(() => {
    if (connectedLaunchProfileApplied || authLoading) return;
    if (!connectedDisplayName || initialMode !== "host" || initialDirectAccess || roomCode) return;
    setProfile((prev) => ({ name: connectedDisplayName, avatar: prev.avatar }));
    setShowOnlineOnboarding(true);
    setConnectedLaunchProfileApplied(true);
  }, [
    authLoading,
    connectedDisplayName,
    connectedLaunchProfileApplied,
    initialDirectAccess,
    initialMode,
    roomCode,
  ]);

  const directSubmitRef = useRef(false);

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

  const handleEndSession = useCallback(async () => {
    const code = snapshot?.session.code;
    if (!code || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixEndSession(code, participantId);
      applySnapshot(next);
    });
    setEndSessionDialogOpen(false);
  }, [applySnapshot, participantId, snapshot, withLoading]);

  const handleExportPdf = useCallback(async () => {
    if (!snapshot || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");

      // ── Données ──────────────────────────────────────────────────────
      const assessmentMap = new Map(
        snapshot.assessments.map((a) => [`${a.skillId}:${a.participantId}`, a]),
      );
      const byCategory = new Map<string, { categoryName: string; rows: typeof snapshot.matrix }>();
      for (const row of snapshot.matrix) {
        const key = row.categoryId ?? "__none__";
        if (!byCategory.has(key)) byCategory.set(key, { categoryName: row.categoryName, rows: [] });
        byCategory.get(key)!.rows.push(row);
      }
      const groups = Array.from(byCategory.values());
      const participants = snapshot.participants;

      // ── Dimensions ───────────────────────────────────────────────────
      const PW = 297;
      const PH = 210;
      const M = 10;
      const SKILL_W = 58;
      const REQ_W = 18;
      const FIXED_W = SKILL_W + REQ_W;
      const P_COL_W = 28;
      const HEADER_H = 18;
      const P_HEAD_H = 16;
      const CAT_H = 8;
      const ROW_H = 12;
      const FOOTER_H = 8;
      const CONTENT_W = PW - M * 2;
      const maxPPerPage = Math.max(1, Math.floor((CONTENT_W - FIXED_W) / P_COL_W));

      // ── Couleurs ─────────────────────────────────────────────────────
      type RGB = [number, number, number];
      const BG: RGB = [8, 13, 28];
      const BG2: RGB = [12, 18, 40];
      const BG_CAT: RGB = [14, 22, 52];
      const BG_ROW_ALT: RGB = [11, 17, 36];
      const C_ACCENT: RGB = [34, 211, 238];
      const C_WHITE: RGB = [241, 245, 249];
      const C_MUTED: RGB = [100, 116, 139];
      const C_BORDER: RGB = [24, 32, 56];

      function levelBg(cur: number | null, req: number): RGB {
        if (cur === null) return [22, 30, 52];
        const g = cur - req;
        if (g <= -2) return [100, 20, 20];
        if (g === -1) return [100, 45, 8];
        if (g === 0) return [80, 60, 5];
        if (g === 1) return [15, 70, 35];
        return [5, 65, 48];
      }
      function levelFg(cur: number | null, req: number): RGB {
        if (cur === null) return [60, 75, 100];
        const g = cur - req;
        if (g <= -2) return [252, 165, 165];
        if (g === -1) return [253, 186, 116];
        if (g === 0) return [253, 224, 71];
        if (g === 1) return [190, 242, 100];
        return [110, 231, 183];
      }

      // ── PDF ──────────────────────────────────────────────────────────
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let pageNum = 0;
      const nowStr = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());

      // Découpe les participants en chunks
      const chunks: (typeof participants)[] = [];
      for (let i = 0; i < Math.max(1, participants.length); i += maxPPerPage)
        chunks.push(participants.slice(i, i + maxPPerPage));

      function drawBg() {
        pdf.setFillColor(...BG);
        pdf.rect(0, 0, PW, PH, "F");
      }

      function drawHeader() {
        pdf.setFillColor(...BG2);
        pdf.rect(0, 0, PW, HEADER_H, "F");
        pdf.setDrawColor(...C_ACCENT);
        pdf.setLineWidth(0.4);
        pdf.line(0, HEADER_H, PW, HEADER_H);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(...C_WHITE);
        const title = snapshot.session.title || "Matrice de Compétences";
        pdf.text(title, M, HEADER_H / 2 + 2.5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...C_ACCENT);
        pdf.text(
          `Code : ${snapshot.session.code}  ·  ${nowStr}  ·  Page ${pageNum}`,
          PW - M,
          HEADER_H / 2 + 2.5,
          { align: "right" },
        );
      }

      function drawParticipantHeaders(chunk: typeof participants, y: number) {
        const tableW = FIXED_W + chunk.length * P_COL_W;

        pdf.setFillColor(...BG2);
        pdf.rect(M, y, tableW, P_HEAD_H, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...C_MUTED);
        pdf.text("COMPÉTENCE", M + 3, y + P_HEAD_H / 2 + 2);
        pdf.text("REQ.", M + SKILL_W + REQ_W / 2, y + P_HEAD_H / 2 + 2, { align: "center" });

        chunk.forEach((p, idx) => {
          const x = M + FIXED_W + idx * P_COL_W;
          pdf.setDrawColor(...C_BORDER);
          pdf.setLineWidth(0.2);
          pdf.line(x, y, x, y + P_HEAD_H);

          const name = p.displayName.length > 9 ? p.displayName.slice(0, 8) + "…" : p.displayName;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...C_WHITE);
          pdf.text(name, x + P_COL_W / 2, y + 6.5, { align: "center" });

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6);
          pdf.setTextColor(...C_MUTED);
          pdf.text(p.isAdmin ? "Host" : "Membre", x + P_COL_W / 2, y + 12, { align: "center" });
        });

        pdf.setDrawColor(...C_ACCENT);
        pdf.setLineWidth(0.25);
        pdf.line(M, y + P_HEAD_H, M + tableW, y + P_HEAD_H);
      }

      function newPage(chunk: typeof participants): number {
        if (pageNum > 0) pdf.addPage();
        pageNum++;
        drawBg();
        drawHeader();
        const y = HEADER_H + 3;
        drawParticipantHeaders(chunk, y);
        return y + P_HEAD_H;
      }

      function drawFooter() {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(...C_MUTED);
        pdf.text("Retro Party · Agile Suite", M, PH - 3);
        pdf.text(
          `${participants.length} participant${participants.length !== 1 ? "s" : ""} · Échelle ${snapshot.session.scaleMin}–${snapshot.session.scaleMax}`,
          PW - M,
          PH - 3,
          { align: "right" },
        );
      }

      // ── Rendu par chunk ──────────────────────────────────────────────
      chunks.forEach((chunk) => {
        let curY = newPage(chunk);
        const tableW = FIXED_W + chunk.length * P_COL_W;

        groups.forEach((group) => {
          // Nouvelle page si plus de place pour la ligne catégorie + au moins une compétence
          if (curY + CAT_H + ROW_H > PH - FOOTER_H) {
            drawFooter();
            curY = newPage(chunk);
          }

          // Ligne catégorie
          pdf.setFillColor(...BG_CAT);
          pdf.rect(M, curY, tableW, CAT_H, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...C_ACCENT);
          pdf.text(group.categoryName.toUpperCase(), M + 3, curY + CAT_H / 2 + 2.5);
          curY += CAT_H;

          group.rows.forEach((row, rowIdx) => {
            if (curY + ROW_H > PH - FOOTER_H) {
              drawFooter();
              curY = newPage(chunk);
            }

            const rowBg: RGB = rowIdx % 2 === 0 ? BG : BG_ROW_ALT;
            pdf.setFillColor(...rowBg);
            pdf.rect(M, curY, tableW, ROW_H, "F");

            // Séparateur bas
            pdf.setDrawColor(...C_BORDER);
            pdf.setLineWidth(0.15);
            pdf.line(M, curY + ROW_H, M + tableW, curY + ROW_H);

            // Nom compétence
            const skillLabel =
              row.skillName.length > 25 ? row.skillName.slice(0, 24) + "…" : row.skillName;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(...C_WHITE);
            pdf.text(skillLabel, M + 3, curY + ROW_H / 2 + 2.5);

            // Niveau requis
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            pdf.setTextColor(...C_ACCENT);
            pdf.text(`N${row.requiredLevel}`, M + SKILL_W + REQ_W / 2, curY + ROW_H / 2 + 2.5, {
              align: "center",
            });

            // Cellules participants
            chunk.forEach((p, idx) => {
              const x = M + FIXED_W + idx * P_COL_W;
              const level = assessmentMap.get(`${row.skillId}:${p.id}`)?.currentLevel ?? null;

              pdf.setFillColor(...levelBg(level, row.requiredLevel));
              pdf.rect(x + 1, curY + 1, P_COL_W - 2, ROW_H - 2, "F");

              pdf.setFont("helvetica", "bold");
              pdf.setFontSize(9);
              pdf.setTextColor(...levelFg(level, row.requiredLevel));
              pdf.text(
                level !== null ? String(level) : "—",
                x + P_COL_W / 2,
                curY + ROW_H / 2 + 3,
                { align: "center" },
              );

              pdf.setDrawColor(...C_BORDER);
              pdf.setLineWidth(0.15);
              pdf.line(x, curY, x, curY + ROW_H);
            });

            curY += ROW_H;
          });
        });

        drawFooter();
      });

      const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "h");
      pdf.save(`skills-matrix-${snapshot.session.code.toLowerCase()}-${stamp}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [isExportingPdf, snapshot]);

  const isLobbyStage = !snapshot || snapshot.session.status === "lobby";
  const myParticipantId = participantId || snapshot?.me?.participantId || null;
  const selfParticipant =
    myParticipantId && snapshot
      ? (snapshot.participants.find((participant) => participant.id === myParticipantId) ?? null)
      : null;
  const isAdmin = selfParticipant?.isAdmin === true;
  useEffect(() => {
    setHostSession(
      roomCode
        ? {
            code: roomCode,
            moduleId: "skills-matrix",
            isHost: isAdmin && snapshot?.session.status !== "ended",
            participantId: myParticipantId,
          }
        : null,
    );
    return () => setHostSession(null);
  }, [isAdmin, myParticipantId, roomCode, snapshot?.session.status]);
  const canExportPdf = !!snapshot && snapshot.session.status === "ended";
  const isSessionEnded = snapshot?.session.status === "ended";

  useEffect(() => {
    if (!templateFromQuery) return;
    setSelectedTemplateId(templateFromQuery);
  }, [templateFromQuery]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    const restoreSession = async () => {
      if (initialFreshLaunch) {
        persistSkillsMatrixSession(null);
        if (!cancelled) setIsRestoringSession(false);
        return;
      }

      if (initialCode && initialParticipantIdFromQuery) {
        try {
          const restored = await api.skillsMatrixGetSession(
            initialCode,
            initialParticipantIdFromQuery,
          );
          if (cancelled) return;
          const restoredSelf =
            restored.participants.find(
              (participant) => participant.id === initialParticipantIdFromQuery,
            ) ?? null;
          setParticipantId(initialParticipantIdFromQuery);
          setProfile({
            name:
              initialName || cleanName(restoredSelf?.displayName || user?.displayName || "Equipe"),
            avatar:
              Number.isFinite(rawInitialAvatar) && rawInitialAvatar >= 0
                ? initialAvatar
                : Number.isFinite(restoredSelf?.avatar)
                  ? Number(restoredSelf?.avatar)
                  : 0,
          });
          applySnapshot(restored);
          setShowOnlineOnboarding(false);
          return;
        } catch {
          persistSkillsMatrixSession(null);
          if (!cancelled) {
            setParticipantId("");
            setSnapshot(null);
          }
        } finally {
          if (!cancelled) setIsRestoringSession(false);
        }
        return;
      }

      const persisted = loadPersistedSkillsMatrixSession();
      if (initialCode && (!persisted || persisted.code !== initialCode)) {
        if (!cancelled) setIsRestoringSession(false);
        return;
      }
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
            cleanName(restoredSelf?.displayName || user?.displayName || "Equipe"),
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
  }, [
    applySnapshot,
    authLoading,
    initialAvatar,
    initialCode,
    initialFreshLaunch,
    initialName,
    initialParticipantIdFromQuery,
    rawInitialAvatar,
    user,
  ]);

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
    const requestedTicket = ++refreshTicketRef.current;
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    let activeTicket = requestedTicket;
    try {
      while (true) {
        const next = await api.skillsMatrixGetSession(roomCode, participantId);
        if (activeTicket === refreshTicketRef.current) {
          applySnapshot(next);
        }
        if (!refreshQueuedRef.current) break;
        refreshQueuedRef.current = false;
        activeTicket = refreshTicketRef.current;
      }
    } catch {
      // Keep the latest local snapshot; realtime + polling will retry.
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applySnapshot, participantId, roomCode]);

  useEffect(() => {
    refreshTicketRef.current += 1;
    refreshQueuedRef.current = false;
  }, [participantId, roomCode]);

  useEffect(() => {
    if (!roomCode || !participantId) return;
    const code = roomCode;

    const subscribe = () => socket.emit(C2S_EVENTS.JOIN_SKILLS_MATRIX_ROOM, { code });
    const onConnect = () => {
      subscribe();
      void refreshSession();
    };
    const onSessionUpdate = (payload: { code?: string }) => {
      const updatedCode =
        typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!updatedCode || updatedCode !== code) return;
      void refreshSession();
    };
    const onRoomJoined = (payload: { code?: string }) => {
      const joinedCode = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!joinedCode || joinedCode !== code) return;
      void refreshSession();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      subscribe();
      void refreshSession();
    };
    const onWindowFocus = () => {
      subscribe();
      void refreshSession();
    };

    if (!socket.connected) socket.connect();
    subscribe();
    socket.on("connect", onConnect);
    socket.on(S2C_EVENTS.SKILLS_MATRIX_ROOM_JOINED, onRoomJoined);
    socket.on(S2C_EVENTS.SKILLS_MATRIX_SESSION_UPDATE, onSessionUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("online", onWindowFocus);

    return () => {
      socket.off("connect", onConnect);
      socket.off(S2C_EVENTS.SKILLS_MATRIX_ROOM_JOINED, onRoomJoined);
      socket.off(S2C_EVENTS.SKILLS_MATRIX_SESSION_UPDATE, onSessionUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onWindowFocus);
      socket.emit(C2S_EVENTS.LEAVE_SKILLS_MATRIX_ROOM, { code });
    };
  }, [participantId, refreshSession, roomCode]);

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
      void refreshSession();
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [participantId, refreshSession, roomCode]);

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

  // URL direct join/host (?auto=1 ou ?mode=join&code=…) :
  // si on saute l'IdentityStep, on déclenche createRoom / joinRoom une seule fois.
  // Placé après les déclarations de handleHost / handleJoin pour éviter une TDZ.
  useEffect(() => {
    if (directSubmitRef.current) return;
    if (roomCode || showOnlineOnboarding) return;
    if (!initialAutoSubmit && !initialDirectAccess) return;
    const name = cleanName(profile.name || initialName || connectedDisplayName);
    if (name.length < 2) return;
    directSubmitRef.current = true;
    if (initialMode === "join" && initialCode) {
      handleJoin(initialCode, name, profile.avatar ?? 0);
    } else {
      handleHost(name, profile.avatar ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connectedDisplayName,
    initialAutoSubmit,
    initialCode,
    initialDirectAccess,
    initialMode,
    initialName,
    profile.avatar,
    profile.name,
    roomCode,
    showOnlineOnboarding,
  ]);

  const handleLeaveLobby = useCallback(() => {
    persistSkillsMatrixSession(null);
    setParticipantId("");
    setSnapshot(null);
    setError(null);
    setShowOnlineOnboarding(true);
    navigate("/app");
  }, [navigate]);

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
        averageFiniteNumbers(
          categories.flatMap((category) => category.skills.map((skill) => skill.scorePct)),
        ) ?? 0;

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

  const createCategory = async () => {
    if (!snapshot || !participantId) return;
    await withLoading(async () => {
      const next = await api.skillsMatrixCreateCategory(
        snapshot.session.code,
        { name: categoryNameInput },
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

  const createSkill = async () => {
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

  if (authLoading || isRestoringSession) {
    return (
      <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
        <div className="neon-surface px-4 py-3 text-sm font-semibold text-cyan-100">
          Chargement...
        </div>
      </div>
    );
  }

  if (isLobbyStage) {
    const exp = EXPERIENCE_BY_ID["skills-matrix"];

    if (!roomCode && showOnlineOnboarding) {
      const handleIdentitySubmit = ({ name, avatar }: { name: string; avatar: number }) => {
        // Verrouille l'effet directSubmit pour éviter un double join.
        directSubmitRef.current = true;
        const cleaned = cleanName(name);
        setProfile({ name: cleaned, avatar });
        setShowOnlineOnboarding(false);
        if (initialMode === "join" && initialCode) {
          void handleJoin(initialCode, cleaned, avatar);
        } else {
          void handleHost(cleaned, avatar);
        }
      };
      return (
        <IdentityStep
          connected={true}
          moduleLabel={exp.label}
          moduleIcon={exp.icon}
          accentRgb={exp.accentRgb}
          brandLabel="Matrice de Compétences"
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          overallStepStart={3}
          overallStepTotal={5}
          sessionPreview={
            initialMode === "join" && initialCode ? { code: initialCode, status: "lobby" } : null
          }
          primaryLabel={initialMode === "join" ? "Rejoindre la session" : "Créer la session"}
          onSubmit={handleIdentitySubmit}
          onBack={() => navigate("/")}
        />
      );
    }

    const hostSetupPanel =
      snapshot && isAdmin ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate("/prepare/skills-matrix")}
              className="ds-focus-ring rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            >
              Préparer une partie
            </button>
          </div>

          <section className="space-y-2 rounded-xl border border-[var(--ds-border-faint)] bg-[var(--ds-surface-0)] p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
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
                className="ds-focus-ring h-10 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50"
                style={{
                  borderColor: "rgba(14,165,233,0.35)",
                  background: "rgba(14,165,233,0.12)",
                  color: "rgb(14,165,233)",
                }}
              >
                {applyingTemplate ? "Application..." : "Appliquer"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/prepare/skills-matrix")}
                className="ds-focus-ring h-10 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-xs font-semibold text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
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

          <section className="space-y-2 rounded-xl border border-[var(--ds-border-faint)] bg-[var(--ds-surface-0)] p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
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
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--ds-text-faint)]">
                  <span>Échelle des niveaux</span>
                  <span className="font-semibold text-sky-300">
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

          <section className="space-y-2 rounded-xl border border-[var(--ds-border-faint)] bg-[var(--ds-surface-0)] p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
              Catégories
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createCategory();
              }}
              className="flex flex-wrap gap-2"
            >
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

          <section className="space-y-2 rounded-xl border border-[var(--ds-border-faint)] bg-[var(--ds-surface-0)] p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
              Compétences
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createSkill();
              }}
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
                <div className="mb-1 text-[11px] text-[var(--ds-text-faint)]">
                  Niveau attendu:{" "}
                  <span className="font-semibold text-sky-300">{skillRequiredLevelInput}</span>
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
                      <div className="mb-1 text-[11px] text-[var(--ds-text-faint)]">
                        Niveau attendu:{" "}
                        <span className="font-semibold text-sky-300">
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

    if (roomCode) {
      const selfName = (profile.name || connectedDisplayName || "").trim();
      const v2Participants: PresenceParticipant[] =
        snapshot?.participants.map((p, i) => ({
          id: p.participantId ?? `${p.displayName}-${i}`,
          name: p.displayName,
          avatar: p.avatar,
          isHost: p.isAdmin,
          isSelf: !!selfName && p.displayName.trim().toLowerCase() === selfName.toLowerCase(),
          state: p.isAdmin ? ("ready" as const) : ("idle" as const),
        })) ?? [];
      const hostPlayer = snapshot?.participants.find((p) => p.isAdmin);
      const shareUrl =
        typeof window !== "undefined" ? `${window.location.origin}/join/${roomCode}` : undefined;
      const shareMessage = `Rejoins-moi sur ${exp.label} avec le code ${roomCode} → ${shareUrl ?? ""}`;

      return (
        <>
          {error ? (
            <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          ) : null}
          <SessionLobby
            roomCode={roomCode}
            connected={true}
            moduleLabel={exp.label}
            moduleIcon={exp.icon}
            accentRgb={exp.accentRgb}
            brandLabel="Matrice de Compétences"
            sessionTitle={snapshot?.title ?? null}
            participants={v2Participants}
            isHost={isAdmin}
            canStart={Boolean(roomCode) && isAdmin}
            shareUrl={shareUrl}
            shareMessage={shareMessage}
            waitingHostName={hostPlayer?.displayName}
            onLeave={handleLeaveLobby}
            onStart={() => {
              handleStartSession();
            }}
            hostSetupTitle="Configuration host"
            hostSetupPanel={hostSetupPanel}
          />
        </>
      );
    }

    return (
      <ConnectingState
        accentRgb={exp.accentRgb}
        mode={initialMode === "join" ? "joining" : "creating"}
        code={initialMode === "join" ? initialCode : null}
        error={error}
        onRetry={error ? () => setShowOnlineOnboarding(true) : undefined}
        onBack={() => navigate("/")}
      />
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
        <header className="mb-5">
          {/* Row 1 : badge + code room */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-500 text-sm">
                🧩
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">
                Agile Suite
              </span>
              {roomCode && (
                <div className="inline-flex items-center gap-1 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-cyan-100">
                  <span className="uppercase text-cyan-200/85">Code</span>
                  <span>{roomCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 2 : titre + description */}
          <h1 className="text-[clamp(20px,5vw,32px)] font-extrabold leading-none tracking-tight text-slate-50">
            Matrice de Compétences
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {isSessionEnded
              ? "Session terminée. Consulte les résultats et exporte le rapport PDF."
              : "Session démarrée. Pilote la couverture des compétences et les plans de progression."}
          </p>

          {/* Row 3 : boutons d'action (optionnels) */}
          {canExportPdf && (
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton
                onClick={() => void handleExportPdf()}
                disabled={isExportingPdf}
                className="h-9 min-h-0 rounded-full border-cyan-500/25 bg-cyan-500/10 px-3 text-[11px] font-semibold tracking-[0.08em] text-cyan-100 hover:bg-cyan-500/18"
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" />
                  {isExportingPdf ? "Export..." : "Exporter PDF"}
                </span>
              </SecondaryButton>
            </div>
          )}
        </header>

        {!user && !isSessionEnded && (
          <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200/80">
            <span className="font-semibold text-amber-200">Mode invité</span> — Tes réponses sont
            sauvegardées sur cet appareil et ce navigateur uniquement. Pour retrouver ta session
            depuis un autre appareil ou après un changement de navigateur,{" "}
            <button
              type="button"
              className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
              onClick={() => setAuthModalOpen(true)}
            >
              crée un compte
            </button>
            .
          </div>
        )}

        {error ? (
          <Card className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </Card>
        ) : null}

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(12,18,40,0.97),rgba(14,20,42,0.92))] shadow-[0_8px_32px_rgba(2,6,23,0.35)]">
            {/* Titre + onglets */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-indigo-500/20 text-lg">
                  🧩
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100">
                    {snapshot.session.title || "Matrice de compétences"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-mono tracking-wider text-slate-400">
                      {snapshot.session.code}
                    </span>
                    <span>·</span>
                    <span>
                      {snapshot.participants.length} participant
                      {snapshot.participants.length !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      Niveaux {snapshot.session.scaleMin}–{snapshot.session.scaleMax}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
                {(
                  [
                    "matrix",
                    "dashboard",
                    ...(isAdmin && !isSessionEnded ? (["manage"] as WorkspaceTab[]) : []),
                  ] as WorkspaceTab[]
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      activeTab === tab
                        ? tab === "manage"
                          ? "bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]"
                          : "bg-cyan-500/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                        : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {tab === "matrix" ? (
                      <>
                        <span>🗂️</span>
                        <span>Matrice</span>
                      </>
                    ) : tab === "dashboard" ? (
                      <>
                        <span>📊</span>
                        <span>Bilan</span>
                      </>
                    ) : (
                      <>
                        <span>⚙️</span>
                        <span>Gérer</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] px-5 py-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.06] px-3 py-2.5">
                <span className="shrink-0 text-lg leading-none">✅</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-emerald-100">
                    {snapshot.dashboard.summary.coveredSkillsCount}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">
                      / {snapshot.dashboard.summary.totalSkills}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">couvertes</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.06] px-3 py-2.5">
                <span className="shrink-0 text-lg leading-none">📝</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-cyan-100">{matrixFilling.ratio}%</div>
                  <div className="text-[10px] text-slate-500">complétude</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] px-3 py-2.5">
                <span className="shrink-0 text-lg leading-none">⚠️</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-amber-100">
                    {snapshot.dashboard.summary.riskySkillsCount}
                  </div>
                  <div className="text-[10px] text-slate-500">à risque</div>
                </div>
              </div>
            </div>
          </div>

          {activeTab === "matrix" ? (
            <div>
              {/* ── MOBILE : toggle Moi / Équipe ─────────────────────── */}
              <div className="mb-4 flex rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileMatrixView("me")}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
                    mobileMatrixView === "me"
                      ? "bg-cyan-500/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  Mes compétences
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMatrixView("team")}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
                    mobileMatrixView === "team"
                      ? "bg-cyan-500/25 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  Équipe ({snapshot.participants.length})
                </button>
              </div>

              {/* ── MOBILE : vue "Mes compétences" ───────────────────── */}
              {mobileMatrixView === "me" && (
                <div className="space-y-1 md:hidden">
                  {!myParticipantId ? (
                    <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-100">
                      Profil non associé. Recharge la page ou rejoins à nouveau pour renseigner ta
                      matrice.
                    </div>
                  ) : null}

                  {matrixRowsByCategory.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1021] px-4 py-8 text-center text-sm text-slate-400">
                      Aucune compétence disponible.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {matrixRowsByCategory.map((group) => (
                        <div key={group.categoryId ?? "none"}>
                          <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-400">
                            {group.categoryName}
                          </div>
                          <div className="space-y-2">
                            {group.rows.map((row) => {
                              const myAssessment = myParticipantId
                                ? (assessmentByCellKey.get(
                                    assessmentKey(row.skillId, myParticipantId),
                                  ) ?? null)
                                : null;
                              const isFilled = myAssessment?.currentLevel != null;
                              const tone = resolveMatrixCellTone(
                                isFilled ? (myAssessment!.currentLevel as number) : null,
                                row.requiredLevel,
                              );
                              const levelCount =
                                snapshot.session.scaleMax - snapshot.session.scaleMin + 1;

                              return (
                                <button
                                  key={row.skillId}
                                  type="button"
                                  onClick={() => openCellEditor(row)}
                                  disabled={!myParticipantId}
                                  className={cn(
                                    "w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] disabled:opacity-60",
                                    isFilled
                                      ? tone.surfaceClass
                                      : "border-white/[0.1] bg-white/[0.03]",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold leading-tight text-slate-100">
                                        {row.skillName}
                                      </div>
                                      <div className="mt-0.5 text-[11px] text-slate-400">
                                        Requis : N{row.requiredLevel}
                                      </div>
                                    </div>
                                    <div
                                      className={cn(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
                                        isFilled
                                          ? cn(tone.surfaceClass, tone.valueClass)
                                          : "border-white/[0.15] bg-white/[0.05] text-slate-500",
                                      )}
                                    >
                                      {isFilled ? myAssessment!.currentLevel : "—"}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex gap-1">
                                    {Array.from({ length: levelCount }, (_, i) => {
                                      const lvl = snapshot.session.scaleMin + i;
                                      const isActive =
                                        isFilled && lvl <= (myAssessment!.currentLevel as number);
                                      const isReq = lvl === row.requiredLevel;
                                      return (
                                        <div
                                          key={lvl}
                                          className={cn(
                                            "h-1.5 flex-1 rounded-full",
                                            isActive
                                              ? (myAssessment!.currentLevel as number) >=
                                                row.requiredLevel
                                                ? "bg-emerald-400"
                                                : "bg-cyan-400"
                                              : isReq
                                                ? "bg-white/[0.25]"
                                                : "bg-white/[0.08]",
                                          )}
                                        />
                                      );
                                    })}
                                  </div>
                                  {myAssessment?.wantsToProgress || myAssessment?.wantsToMentor ? (
                                    <div className="mt-2.5 flex gap-1.5">
                                      {myAssessment.wantsToProgress && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300/30 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200">
                                          <span className="text-[13px] leading-none">🌱</span>
                                          Veut apprendre
                                        </span>
                                      )}
                                      {myAssessment.wantsToMentor && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                                          <span className="text-[13px] leading-none">🎓</span>
                                          Peut former
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── MOBILE : vue "Équipe" ─────────────────────────────── */}
              {mobileMatrixView === "team" && (
                <div className="space-y-5 md:hidden">
                  {matrixRowsByCategory.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1021] px-4 py-8 text-center text-sm text-slate-400">
                      Aucune compétence disponible.
                    </div>
                  ) : (
                    matrixRowsByCategory.map((group) => (
                      <div key={group.categoryId ?? "none"}>
                        <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-400">
                          {group.categoryName}
                        </div>
                        <div className="space-y-2">
                          {group.rows.map((row) => {
                            const levelCount =
                              snapshot.session.scaleMax - snapshot.session.scaleMin + 1;
                            return (
                              <div
                                key={row.skillId}
                                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
                              >
                                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                                  <span className="text-sm font-semibold text-slate-100">
                                    {row.skillName}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Requis : N{row.requiredLevel}
                                  </span>
                                </div>
                                <div className="divide-y divide-white/[0.05]">
                                  {snapshot.participants.map((participant) => {
                                    const cell =
                                      assessmentByCellKey.get(
                                        assessmentKey(row.skillId, participant.id),
                                      ) ?? null;
                                    const isFilled = cell?.currentLevel != null;
                                    const tone = resolveMatrixCellTone(
                                      isFilled ? (cell!.currentLevel as number) : null,
                                      row.requiredLevel,
                                    );
                                    const isMe = participant.id === myParticipantId;
                                    return (
                                      <div
                                        key={participant.id}
                                        className={cn(
                                          "flex items-center gap-3 px-4 py-2.5",
                                          isMe && "bg-cyan-500/[0.06]",
                                        )}
                                      >
                                        <span className="text-lg leading-none">
                                          {AVATARS[participant.avatar] ?? "?"}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-xs font-semibold text-slate-200">
                                              {participant.displayName}
                                              {isMe && (
                                                <span className="ml-1.5 text-[10px] font-normal text-cyan-400">
                                                  (moi)
                                                </span>
                                              )}
                                            </span>
                                            <span
                                              className={cn(
                                                "shrink-0 text-xs font-bold",
                                                isFilled ? tone.valueClass : "text-slate-500",
                                              )}
                                            >
                                              {isFilled ? `N${cell!.currentLevel}` : "—"}
                                            </span>
                                          </div>
                                          <div className="mt-1.5 flex gap-0.5">
                                            {Array.from({ length: levelCount }, (_, i) => {
                                              const lvl = snapshot.session.scaleMin + i;
                                              const isActive =
                                                isFilled && lvl <= (cell!.currentLevel as number);
                                              const isReq = lvl === row.requiredLevel;
                                              return (
                                                <div
                                                  key={lvl}
                                                  className={cn(
                                                    "h-1 flex-1 rounded-full",
                                                    isActive
                                                      ? (cell!.currentLevel as number) >=
                                                        row.requiredLevel
                                                        ? "bg-emerald-400"
                                                        : "bg-cyan-400"
                                                      : isReq
                                                        ? "bg-white/[0.22]"
                                                        : "bg-white/[0.07]",
                                                  )}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                        {cell?.wantsToMentor || cell?.wantsToProgress ? (
                                          <div className="flex shrink-0 flex-col items-end gap-1">
                                            {cell.wantsToMentor && (
                                              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200">
                                                <span className="text-[11px] leading-none">🎓</span>
                                                Former
                                              </span>
                                            )}
                                            {cell.wantsToProgress && (
                                              <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-300/30 bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-medium text-indigo-200">
                                                <span className="text-[11px] leading-none">🌱</span>
                                                Apprendre
                                              </span>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── DESKTOP : tableau compétences × membres ─────────── */}
              <div className="hidden md:block">
                {matrixRowsByCategory.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#0a1021] px-4 py-10 text-center text-sm text-slate-400">
                    Aucune compétence disponible.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#080d1c]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          {/* Cellule coin haut-gauche */}
                          <th className="sticky left-0 z-20 w-[150px] min-w-0 border-b border-r border-white/[0.07] bg-[#0c1228] px-3 py-3 text-left align-bottom">
                            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Compétence
                            </div>
                          </th>
                          {/* Colonne requis */}
                          <th className="sticky left-[150px] z-20 w-[120px] min-w-0 border-b border-r border-white/[0.07] bg-[#0c1228] px-2 py-3 text-left align-bottom">
                            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Requis
                            </div>
                          </th>
                          {/* Colonne progression équipe */}
                          <th className="sticky left-[270px] z-20 w-[52px] min-w-0 border-b border-r border-white/[0.07] bg-[#0c1228] px-1 py-3 text-center align-bottom">
                            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Prog.
                            </div>
                          </th>
                          {snapshot.participants.map((participant) => {
                            const model = participantRadarModels.get(participant.id);
                            const coverage = Math.round(model?.averageScorePct ?? 0);
                            const isMe = participant.id === myParticipantId;
                            return (
                              <th
                                key={participant.id}
                                className={cn(
                                  "min-w-[110px] border-b border-white/[0.07] px-3 py-3 text-center align-bottom",
                                  isMe && "bg-cyan-500/[0.06]",
                                )}
                              >
                                <div className="flex flex-col items-center gap-1.5">
                                  <div
                                    className={cn(
                                      "flex h-10 w-10 items-center justify-center rounded-full text-xl",
                                      isMe
                                        ? "ring-2 ring-cyan-400 bg-cyan-500/10"
                                        : "ring-1 ring-white/10 bg-white/[0.04]",
                                    )}
                                  >
                                    {AVATARS[participant.avatar] ?? "?"}
                                  </div>
                                  <div className="max-w-[90px] truncate text-[11px] font-semibold text-slate-100">
                                    {participant.displayName}
                                  </div>
                                  <div className="text-[9px] text-slate-500">
                                    {participant.isAdmin ? "Host" : "Membre"}
                                  </div>
                                  {/* Barre de couverture */}
                                  <div className="w-full px-1">
                                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all",
                                          coverage >= 80
                                            ? "bg-emerald-400"
                                            : coverage >= 50
                                              ? "bg-cyan-400"
                                              : "bg-rose-400",
                                        )}
                                        style={{ width: `${coverage}%` }}
                                      />
                                    </div>
                                    <div className="mt-0.5 text-center text-[9px] text-slate-500">
                                      {coverage}%
                                    </div>
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRowsByCategory.flatMap((group) => [
                          /* Ligne catégorie */
                          <tr key={`cat-${group.categoryId ?? "none"}`}>
                            <td
                              colSpan={snapshot.participants.length + 3}
                              className="sticky left-0 z-10 border-b border-t border-white/[0.07] bg-[#0e1628] px-4 py-2"
                            >
                              <span className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">
                                {group.categoryName}
                              </span>
                            </td>
                          </tr>,
                          /* Lignes compétences */
                          ...group.rows.map((row) => (
                            <tr
                              key={row.skillId}
                              className="border-b border-white/[0.05] transition hover:bg-white/[0.015]"
                            >
                              {/* Colonne nom compétence */}
                              <td className="sticky left-0 z-10 w-[150px] min-w-0 border-r border-white/[0.07] bg-[#080d1c] px-3 py-2.5">
                                <div className="text-xs font-semibold text-slate-100 leading-snug">
                                  {row.skillName}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                  N{row.requiredLevel} requis
                                </div>
                              </td>
                              {/* Colonne requis */}
                              {(() => {
                                const qualifiedParticipants = snapshot.participants.filter((p) => {
                                  const cell = assessmentByCellKey.get(
                                    assessmentKey(row.skillId, p.id),
                                  );
                                  return (
                                    cell?.currentLevel != null &&
                                    cell.currentLevel >= row.requiredLevel
                                  );
                                });
                                const isMet = qualifiedParticipants.length >= row.requiredPeople;
                                return (
                                  <td className="sticky left-[150px] z-10 w-[120px] min-w-0 border-r border-white/[0.07] bg-[#080d1c] px-2 py-2 align-top">
                                    <div className="flex flex-col gap-1">
                                      <span
                                        className={cn(
                                          "text-[11px] font-bold tabular-nums",
                                          isMet ? "text-emerald-400" : "text-amber-400",
                                        )}
                                      >
                                        {qualifiedParticipants.length}/{row.requiredPeople}
                                      </span>
                                      {qualifiedParticipants.length > 0 && (
                                        <div className="flex flex-col gap-0.5">
                                          {qualifiedParticipants.map((p) => (
                                            <div
                                              key={p.id}
                                              className="flex items-center gap-1"
                                              title={p.displayName}
                                            >
                                              <span className="text-sm leading-none shrink-0">
                                                {AVATARS[p.avatar] ?? "?"}
                                              </span>
                                              <span className="truncate text-[9px] text-slate-400 leading-none">
                                                {p.displayName}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })()}
                              {/* Colonne complétion équipe */}
                              {(() => {
                                const total = snapshot.participants.length;
                                const filled = snapshot.participants.filter(
                                  (p) =>
                                    assessmentByCellKey.get(assessmentKey(row.skillId, p.id))
                                      ?.currentLevel != null,
                                ).length;
                                const pct = total > 0 ? filled / total : 0;
                                const r = 13;
                                const circ = 2 * Math.PI * r;
                                const dashOffset = circ * (1 - pct);
                                const strokeColor =
                                  pct >= 0.8
                                    ? "#34d399"
                                    : pct >= 0.5
                                      ? "#22d3ee"
                                      : pct > 0
                                        ? "#fb923c"
                                        : "#374151";
                                return (
                                  <td className="sticky left-[270px] z-10 w-[52px] border-r border-white/[0.07] bg-[#080d1c] px-2 py-2 text-center align-middle">
                                    <div className="flex items-center justify-center">
                                      <svg width="34" height="34" viewBox="0 0 34 34">
                                        <circle
                                          cx="17"
                                          cy="17"
                                          r={r}
                                          fill="none"
                                          stroke="rgba(255,255,255,0.06)"
                                          strokeWidth="3"
                                        />
                                        {pct > 0 && (
                                          <circle
                                            cx="17"
                                            cy="17"
                                            r={r}
                                            fill="none"
                                            stroke={strokeColor}
                                            strokeWidth="3"
                                            strokeDasharray={circ}
                                            strokeDashoffset={dashOffset}
                                            strokeLinecap="round"
                                            transform="rotate(-90 17 17)"
                                          />
                                        )}
                                        <text
                                          x="17"
                                          y="17"
                                          textAnchor="middle"
                                          dominantBaseline="central"
                                          fontSize="7"
                                          fill={pct > 0 ? strokeColor : "#6b7280"}
                                        >
                                          {Math.round(pct * 100)}
                                        </text>
                                      </svg>
                                    </div>
                                  </td>
                                );
                              })()}
                              {/* Cellules participants */}
                              {snapshot.participants.map((participant) => {
                                const cell =
                                  assessmentByCellKey.get(
                                    assessmentKey(row.skillId, participant.id),
                                  ) ?? null;
                                const isFilled = cell?.currentLevel != null;
                                const tone = resolveMatrixCellTone(
                                  isFilled ? (cell!.currentLevel as number) : null,
                                  row.requiredLevel,
                                );
                                const isMe = participant.id === myParticipantId;

                                const cellInner = (
                                  <div
                                    className={cn(
                                      "mx-auto flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl border transition",
                                      isFilled
                                        ? tone.surfaceClass
                                        : "border-white/[0.08] bg-white/[0.02]",
                                      isMe && isFilled && "ring-2 ring-cyan-400/50",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "text-sm font-bold leading-none",
                                        isFilled ? tone.valueClass : "text-slate-600",
                                      )}
                                    >
                                      {isFilled ? cell!.currentLevel : "—"}
                                    </span>
                                    <div className="flex h-3.5 items-center gap-0.5">
                                      {cell?.wantsToMentor && (
                                        <span
                                          className="text-[13px] leading-none"
                                          title="Peut former"
                                        >
                                          🎓
                                        </span>
                                      )}
                                      {cell?.wantsToProgress && (
                                        <span
                                          className="text-[13px] leading-none"
                                          title="Veut apprendre"
                                        >
                                          🌱
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );

                                return (
                                  <td
                                    key={`${row.skillId}-${participant.id}`}
                                    className={cn(
                                      "px-3 py-2.5 text-center align-middle",
                                      isMe && "bg-cyan-500/[0.04]",
                                    )}
                                  >
                                    {isMe && !isSessionEnded ? (
                                      <button
                                        type="button"
                                        onClick={() => openCellEditor(row)}
                                        className="w-full transition hover:scale-105 active:scale-95"
                                        title="Modifier mon niveau"
                                      >
                                        {cellInner}
                                      </button>
                                    ) : (
                                      cellInner
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
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "dashboard" ? (
            <div className="space-y-5">
              {/* ── KPIs ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: "🎯",
                    value: snapshot.dashboard.summary.totalSkills,
                    label: "Compétences",
                    sub: "dans la matrice",
                    border: "border-white/[0.08]",
                    bg: "bg-white/[0.02]",
                    valueColor: "text-slate-100",
                  },
                  {
                    icon: "📊",
                    value: `${matrixFilling.ratio}%`,
                    label: "Complétude",
                    sub: `${matrixFilling.filled} / ${matrixFilling.total} cases`,
                    border: "border-cyan-300/20",
                    bg: "bg-cyan-500/[0.06]",
                    valueColor: "text-cyan-100",
                  },
                  {
                    icon: "✅",
                    value: snapshot.dashboard.summary.coveredSkillsCount,
                    label: "Couvertes",
                    sub: "au niveau requis",
                    border: "border-emerald-300/20",
                    bg: "bg-emerald-500/[0.06]",
                    valueColor: "text-emerald-100",
                  },
                  {
                    icon: "⚠️",
                    value: snapshot.dashboard.summary.riskySkillsCount,
                    label: "À risque",
                    sub: `${snapshot.dashboard.summary.totalMissingPeople} profil${snapshot.dashboard.summary.totalMissingPeople !== 1 ? "s" : ""} manquant${snapshot.dashboard.summary.totalMissingPeople !== 1 ? "s" : ""}`,
                    border: "border-amber-300/20",
                    bg: "bg-amber-500/[0.06]",
                    valueColor: "text-amber-100",
                  },
                ].map(({ icon, value, label, sub, border, bg, valueColor }) => (
                  <div key={label} className={cn("rounded-2xl border p-4", border, bg)}>
                    <div className="text-2xl leading-none">{icon}</div>
                    <div className={cn("mt-3 text-3xl font-extrabold leading-none", valueColor)}>
                      {value}
                    </div>
                    <div className="mt-1.5 text-xs font-semibold text-slate-200">{label}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Radars ────────────────────────────────────────────── */}
              <div className="grid gap-4 2xl:grid-cols-2">
                <div className="rounded-3xl border border-white/[0.08] bg-[#0c1124]/95 p-5">
                  <SkillsRadarPanel
                    title="Vue d'ensemble de l'équipe"
                    subtitle="Couverture moyenne par catégorie — 100 % = niveau requis atteint."
                    model={groupRadarModel}
                  />
                </div>

                <div className="rounded-3xl border border-white/[0.08] bg-[#0c1124]/95 p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-100">Vue individuelle</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Sélectionne un membre pour voir son profil de compétences.
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
                        <span className="text-base leading-none">
                          {AVATARS[participant.avatar] ?? "?"}
                        </span>
                        <span className="max-w-[110px] truncate">{participant.displayName}</span>
                      </button>
                    ))}
                  </div>
                  <SkillsRadarPanel
                    title={selectedRadarParticipant?.displayName ?? "Aucun membre"}
                    subtitle="Niveau par catégorie et compétences."
                    model={selectedParticipantRadarModel}
                  />
                </div>
              </div>

              {/* ── Risques & couvertures ─────────────────────────────── */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Compétences à risque */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#0d1228]/92 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/15 text-xl">
                      ⚠️
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Compétences à risque</h3>
                      <p className="text-[11px] text-slate-400">
                        Pas assez de personnes au niveau requis
                      </p>
                    </div>
                  </div>

                  {snapshot.dashboard.riskySkills.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/[0.06] px-4 py-3">
                      <span className="text-lg">🎉</span>
                      <span className="text-sm text-emerald-300">
                        Toutes les compétences sont suffisamment couvertes !
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.dashboard.riskySkills.map((skill) => (
                        <div
                          key={skill.skillId}
                          className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.06] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {skill.skillName}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {skill.categoryName}
                              </div>
                            </div>
                            <span className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200">
                              {skill.missingCount} manquant{skill.missingCount > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className="mb-1.5 flex justify-between text-[10px] text-slate-400">
                              <span>Couverture</span>
                              <span>
                                {skill.coverageCount} / {skill.requiredPeople} personnes
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all"
                                style={{
                                  width: `${Math.round((skill.coverageCount / Math.max(1, skill.requiredPeople)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compétences couvertes */}
                <div className="rounded-3xl border border-white/[0.08] bg-[#0d1228]/92 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/15 text-xl">
                      ✅
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        Compétences couvertes
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Assez de personnes au niveau requis
                      </p>
                    </div>
                  </div>

                  {snapshot.dashboard.coveredSkills.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
                      Aucune compétence couverte pour le moment.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.dashboard.coveredSkills.map((skill) => (
                        <div
                          key={skill.skillId}
                          className="flex items-center gap-3 rounded-2xl border border-emerald-300/12 bg-emerald-500/[0.05] px-4 py-3"
                        >
                          <span className="shrink-0 text-base text-emerald-400">✓</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-slate-100">
                              {skill.skillName}
                            </div>
                            <div className="text-[11px] text-slate-400">{skill.categoryName}</div>
                          </div>
                          <span className="shrink-0 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            {skill.coverageCount} / {skill.requiredPeople}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Échanges de compétences ───────────────────────────── */}
              {snapshot.dashboard.mentoringBySkill.filter(
                (item) => item.helpers.length > 0 || item.learners.length > 0,
              ).length > 0 && (
                <div className="rounded-3xl border border-white/[0.08] bg-[#0d1228]/92 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/15 text-xl">
                      🤝
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        Échanges de compétences
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Qui peut aider · qui veut apprendre
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {snapshot.dashboard.mentoringBySkill
                      .filter((item) => item.helpers.length > 0 || item.learners.length > 0)
                      .map((item) => (
                        <div
                          key={item.skillId}
                          className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100">
                              {item.skillName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              · {item.categoryName}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                Peuvent aider
                              </div>
                              {item.helpers.length === 0 ? (
                                <span className="text-[11px] text-slate-500">
                                  Personne pour l'instant
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.helpers.map((helper) => (
                                    <span
                                      key={helper.displayName}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[11px]"
                                    >
                                      <span className="font-semibold text-slate-200">
                                        {helper.displayName}
                                      </span>
                                      <span className="font-bold text-emerald-300">
                                        N{helper.currentLevel}
                                      </span>
                                      {helper.wantsToMentor && (
                                        <span
                                          className="text-[12px] leading-none"
                                          title="Formateur volontaire"
                                        >
                                          🎓
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                Veulent apprendre
                              </div>
                              {item.learners.length === 0 ? (
                                <span className="text-[11px] text-slate-500">
                                  Personne pour l'instant
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {item.learners.map((learner) => (
                                    <span
                                      key={learner.displayName}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300/20 bg-indigo-500/[0.08] px-2.5 py-1.5 text-[11px]"
                                    >
                                      <span className="font-semibold text-slate-200">
                                        {learner.displayName}
                                      </span>
                                      {learner.targetLevel && (
                                        <span className="text-indigo-300">
                                          → N{learner.targetLevel}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "manage" && isAdmin ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">⚙️</span>
                <h2 className="text-sm font-bold text-slate-100">Gestion de la matrice</h2>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Host uniquement
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* ── Catégories ───────────────────────────────────── */}
                <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#080d1c] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Catégories
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void createCategory();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={categoryNameInput}
                      onChange={(e) => setCategoryNameInput(e.target.value)}
                      placeholder="Nouvelle catégorie"
                      className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                    />
                    <button
                      type="submit"
                      className="h-10 shrink-0 rounded-xl bg-cyan-500 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
                    >
                      Ajouter
                    </button>
                  </form>

                  <div className="space-y-2">
                    {snapshot.categories.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
                        Aucune catégorie pour le moment.
                      </div>
                    ) : (
                      snapshot.categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#0a1020] px-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                            {category.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => void deleteCategory(category.id)}
                            title="Supprimer"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-sm text-red-300 transition hover:bg-red-500/20"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* ── Compétences ──────────────────────────────────── */}
                <section className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#080d1c] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Compétences
                  </div>

                  {/* Formulaire ajout */}
                  <div className="space-y-2 rounded-xl border border-amber-400/10 bg-amber-500/[0.04] p-3">
                    <input
                      value={skillNameInput}
                      onChange={(e) => setSkillNameInput(e.target.value)}
                      placeholder="Nom de la compétence"
                      className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                          Catégorie
                        </label>
                        <select
                          value={skillCategoryInput}
                          onChange={(e) => setSkillCategoryInput(e.target.value)}
                          className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                        >
                          <option value="">Sans catégorie</option>
                          {snapshot.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
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
                          value={skillRequiredPeopleInput}
                          onChange={(e) => setSkillRequiredPeopleInput(Number(e.target.value))}
                          className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="uppercase tracking-wide text-slate-500">
                          Niveau requis
                        </span>
                        <span className="font-semibold text-cyan-300">
                          N{skillRequiredLevelInput}
                        </span>
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
                        aria-label="Niveau requis nouvelle compétence"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void createSkill()}
                      className="h-9 w-full rounded-xl border border-amber-300/25 bg-amber-500/10 text-xs font-bold text-amber-100 transition hover:bg-amber-500/18"
                    >
                      + Ajouter la compétence
                    </button>
                  </div>

                  {/* Liste des compétences existantes */}
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
                    {snapshot.skills.length === 0 ? (
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
                        Aucune compétence. Ajoute-en une ci-dessus.
                      </div>
                    ) : (
                      matrixRowsByCategory.flatMap((group) => [
                        <div
                          key={`cat-label-${group.categoryId ?? "none"}`}
                          className="pt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-400"
                        >
                          {group.categoryName}
                        </div>,
                        ...group.rows.map((row) => {
                          const draft = skillDrafts[row.skillId];
                          return (
                            <div
                              key={row.skillId}
                              className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#0a1020] p-3"
                            >
                              {/* Nom + supprimer */}
                              <div className="flex gap-2">
                                <input
                                  value={draft?.name ?? row.skillName}
                                  onChange={(e) =>
                                    setSkillDrafts((prev) => ({
                                      ...prev,
                                      [row.skillId]: {
                                        ...(prev[row.skillId] ?? {
                                          name: row.skillName,
                                          categoryId: null,
                                          requiredLevel: row.requiredLevel,
                                          requiredPeople: row.requiredPeople,
                                        }),
                                        name: e.target.value,
                                      },
                                    }))
                                  }
                                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-[#0c1228] px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                                />
                                <button
                                  type="button"
                                  onClick={() => void deleteSkill(row.skillId)}
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
                                    value={draft?.categoryId ?? row.categoryId ?? ""}
                                    onChange={(e) =>
                                      setSkillDrafts((prev) => ({
                                        ...prev,
                                        [row.skillId]: {
                                          ...(prev[row.skillId] ?? {
                                            name: row.skillName,
                                            categoryId: null,
                                            requiredLevel: row.requiredLevel,
                                            requiredPeople: row.requiredPeople,
                                          }),
                                          categoryId: e.target.value || null,
                                        },
                                      }))
                                    }
                                    className="h-9 w-full rounded-lg border border-white/[0.07] bg-[#0c1228] px-2 text-xs text-slate-100 outline-none focus:border-cyan-400/40"
                                  >
                                    <option value="">Sans catégorie</option>
                                    {snapshot.categories.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
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
                                    value={draft?.requiredPeople ?? row.requiredPeople}
                                    onChange={(e) =>
                                      setSkillDrafts((prev) => ({
                                        ...prev,
                                        [row.skillId]: {
                                          ...(prev[row.skillId] ?? {
                                            name: row.skillName,
                                            categoryId: null,
                                            requiredLevel: row.requiredLevel,
                                            requiredPeople: row.requiredPeople,
                                          }),
                                          requiredPeople: Number(e.target.value),
                                        },
                                      }))
                                    }
                                    className="h-9 w-full rounded-lg border border-white/[0.07] bg-[#0c1228] px-2 text-xs text-slate-100 outline-none focus:border-cyan-400/40"
                                  />
                                </div>
                              </div>

                              {/* Niveau requis */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="uppercase tracking-wide text-slate-500">
                                    Niveau requis
                                  </span>
                                  <span className="font-semibold text-cyan-300">
                                    N{draft?.requiredLevel ?? row.requiredLevel}
                                  </span>
                                </div>
                                <Slider
                                  min={snapshot.session.scaleMin}
                                  max={snapshot.session.scaleMax}
                                  step={1}
                                  value={[draft?.requiredLevel ?? row.requiredLevel]}
                                  onValueChange={(values) => {
                                    const next = values[0];
                                    if (!Number.isFinite(next)) return;
                                    setSkillDrafts((prev) => ({
                                      ...prev,
                                      [row.skillId]: {
                                        ...(prev[row.skillId] ?? {
                                          name: row.skillName,
                                          categoryId: null,
                                          requiredLevel: row.requiredLevel,
                                          requiredPeople: row.requiredPeople,
                                        }),
                                        requiredLevel: Math.round(next),
                                      },
                                    }));
                                  }}
                                  aria-label={`Niveau requis ${row.skillName}`}
                                />
                              </div>

                              {/* Enregistrer */}
                              <button
                                type="button"
                                onClick={() => void saveSkillDraft(row.skillId)}
                                className="h-8 w-full rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/18"
                              >
                                Enregistrer les modifications
                              </button>
                            </div>
                          );
                        }),
                      ])
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>

        {loadingAction ? (
          <div className="fixed bottom-4 right-4 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
            Mise à jour...
          </div>
        ) : null}

        {/* Éditeur de compétence : Drawer sur mobile, Dialog sur desktop */}
        {editingCell ? (
          <>
            {/* Contenu partagé via form id */}
            {isMobile ? (
              <Drawer open={true} onOpenChange={(open) => !open && closeCellEditor()}>
                <DrawerContent className="border-white/[0.08] bg-[#0d0d1a] text-slate-100">
                  <DrawerHeader className="border-b border-white/[0.08] bg-gradient-to-r from-cyan-500/[0.14] via-indigo-500/[0.08] to-transparent px-5 py-4 text-left">
                    <DrawerTitle className="text-base font-semibold text-slate-100">
                      {editingCell.skillName}
                    </DrawerTitle>
                    <DrawerDescription className="text-xs text-slate-400">
                      Niveau requis : N{editingCell.requiredLevel} · Point cyan = cible
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="overflow-y-auto">
                    <form
                      id="cell-editor-form"
                      onSubmit={saveCellEditor}
                      className="space-y-5 px-5 py-5"
                    >
                      <CellEditorFormBody
                        editingCell={editingCell}
                        scaleMin={snapshot.session.scaleMin}
                        scaleMax={snapshot.session.scaleMax}
                        setEditingCell={setEditingCell}
                      />
                    </form>
                  </div>
                  <div className="flex gap-3 px-5 pb-8 pt-2">
                    <button
                      type="button"
                      onClick={closeCellEditor}
                      disabled={savingCell}
                      className="h-12 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      form="cell-editor-form"
                      disabled={savingCell}
                      className="h-12 flex-1 rounded-xl bg-cyan-500 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {savingCell ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </DrawerContent>
              </Drawer>
            ) : (
              <Dialog open={true} onOpenChange={(open) => !open && closeCellEditor()}>
                <DialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 text-slate-100 shadow-2xl">
                  <div className="rounded-t-2xl border-b border-white/[0.08] bg-gradient-to-r from-cyan-500/[0.14] via-indigo-500/[0.08] to-transparent px-5 py-4">
                    <DialogHeader>
                      <DialogTitle className="text-base font-semibold text-slate-100">
                        {editingCell.skillName}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-400">
                        Niveau requis : N{editingCell.requiredLevel} · Point cyan = cible
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  <form
                    id="cell-editor-form"
                    onSubmit={saveCellEditor}
                    className="space-y-5 px-5 py-5"
                  >
                    <CellEditorFormBody
                      editingCell={editingCell}
                      scaleMin={snapshot.session.scaleMin}
                      scaleMax={snapshot.session.scaleMax}
                      setEditingCell={setEditingCell}
                    />
                  </form>
                  <div className="flex gap-3 px-5 pb-5 pt-1">
                    <button
                      type="button"
                      onClick={closeCellEditor}
                      disabled={savingCell}
                      className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      form="cell-editor-form"
                      disabled={savingCell}
                      className="h-10 flex-1 rounded-xl bg-cyan-500 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {savingCell ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </>
        ) : null}
      </div>

      {/* ── Modale de confirmation de sortie ─────────────────────── */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.65)] sm:p-6">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base font-semibold text-slate-100">
              Quitter la session ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-400">
              Tu vas quitter la matrice de compétences et revenir à l'accueil. Tes données sont
              sauvegardées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl")}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")}
              onClick={() => {
                persistSkillsMatrixSession(null);
                if (roomCode) {
                  socket.emit(C2S_EVENTS.LEAVE_SKILLS_MATRIX_ROOM, { code: roomCode });
                }
                navigate("/");
              }}
            >
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modale de confirmation de fin de session ─────────────── */}
      <AlertDialog open={endSessionDialogOpen} onOpenChange={setEndSessionDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.65)] sm:p-6">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base font-semibold text-slate-100">
              Terminer la session ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-400">
              La session sera clôturée et plus personne ne pourra modifier ses niveaux. Tu pourras
              ensuite exporter la matrice en PDF depuis cette page ou depuis le Dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl")}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 w-full rounded-xl border border-amber-500/30 bg-amber-500/15 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
              onClick={() => void handleEndSession()}
            >
              Terminer la session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        initialTab="register"
        onSuccess={() => {
          setAuthModalOpen(false);
          // Link the guest participant to the newly authenticated account so that
          // the user can rejoin from any device and recover their assessments.
          if (roomCode && participantId) {
            void api
              .skillsMatrixClaimParticipant(roomCode, participantId)
              .then(applySnapshot)
              .catch(() => void refreshSession());
          }
        }}
      />
    </div>
  );
}
