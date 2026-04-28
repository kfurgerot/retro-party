import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, Frown, Meh, Smile } from "lucide-react";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { Card, SecondaryButton } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { setHostSession } from "@/lib/hostSession";
import { AVATARS } from "@/types/game";
import {
  APP_SHELL_SURFACE_SOFT,
  CTA_NEON_DANGER,
  CTA_NEON_SECONDARY_SUBTLE,
  TOOL_ACCENT,
} from "@/lib/uiTokens";

const RADAR_DIALOG =
  "rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.65)] sm:p-6";
const RADAR_ACCENT = TOOL_ACCENT["radar-party"];
import { RadarChartCard } from "@/components/radar-party/RadarChartCard";
import { IndividualRecommendationsSection } from "@/components/radar-party/IndividualRecommendationsSection";
import {
  RADAR_DIMENSIONS,
  RADAR_DIMENSION_LABELS,
  RADAR_QUESTIONS,
  type RadarDimension,
} from "@/features/radarParty/questions";
import { buildIndividualInsights, buildTeamInsights } from "@/features/radarParty/insights";
import { buildIndividualRecommendations } from "@/features/radarParty/individualRecommendations";
import {
  createNeutralRadar,
  computeRadarScores,
  computeTeamAverageRadar,
  type RadarAnswers,
  type RadarAxisValues,
} from "@/features/radarParty/scoring";
import { api, type RadarParticipant, type RadarTeamInsights } from "@/net/api";
import { socket } from "@/net/socket";
import { C2S_EVENTS, S2C_EVENTS } from "@shared/contracts/socketEvents.js";
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

type Stage = "lobby" | "questionnaire" | "individual" | "team-radar" | "team-progress";
const RADAR_STAGES: Stage[] = [
  "lobby",
  "questionnaire",
  "individual",
  "team-radar",
  "team-progress",
];
const RADAR_SESSION_STORAGE_KEY = "retro-party:radar-party:session";

type LocalResult = {
  radar: RadarAxisValues;
  polesPercent: ReturnType<typeof computeRadarScores>["polesPercent"];
  insights: ReturnType<typeof buildIndividualInsights>;
};

type RadarPersistedSession = {
  code: string;
  participantId: string;
  profile: { name: string; avatar: number };
  stage: Stage;
  answers: RadarAnswers;
  questionIndex: number;
  hostParticipates: boolean;
  resultPublished: boolean;
  updatedAt: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePersistedAnswers(raw: unknown): RadarAnswers {
  if (!isPlainObject(raw)) return {};
  const normalized: RadarAnswers = {};
  Object.entries(raw).forEach(([rawKey, rawValue]) => {
    const key = Number(rawKey);
    const value = Number(rawValue);
    if (!Number.isFinite(key) || !Number.isFinite(value)) return;
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 5) return;
    normalized[key] = rounded;
  });
  return normalized;
}

function loadPersistedRadarSession(): RadarPersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RADAR_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;

    const code = typeof parsed.code === "string" ? parsed.code.trim().toUpperCase() : "";
    const participantId =
      typeof parsed.participantId === "string" ? parsed.participantId.trim() : "";
    if (!code || !participantId) return null;

    const profileRaw = isPlainObject(parsed.profile) ? parsed.profile : {};
    const stageRaw = typeof parsed.stage === "string" ? parsed.stage : "";
    const stage = RADAR_STAGES.includes(stageRaw as Stage) ? (stageRaw as Stage) : "lobby";
    const questionIndexRaw = Number(parsed.questionIndex);
    const questionIndex = Number.isFinite(questionIndexRaw)
      ? Math.max(0, Math.round(questionIndexRaw))
      : 0;

    return {
      code,
      participantId,
      profile: {
        name: typeof profileRaw.name === "string" ? profileRaw.name : "",
        avatar: Number.isFinite(Number(profileRaw.avatar)) ? Number(profileRaw.avatar) : 0,
      },
      stage,
      answers: normalizePersistedAnswers(parsed.answers),
      questionIndex,
      hostParticipates: parsed.hostParticipates !== false,
      resultPublished: parsed.resultPublished === true,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

function persistRadarSession(session: RadarPersistedSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(RADAR_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(RADAR_SESSION_STORAGE_KEY, JSON.stringify(session));
}

const answerLabels = [
  "Pas du tout d'accord",
  "Plutot pas d'accord",
  "Neutre",
  "Plutot d'accord",
  "Tout a fait d'accord",
];
const likertScale = [
  { uiId: "disagree-strong", score: 1, size: "h-10 w-10 sm:h-16 sm:w-16" },
  { uiId: "disagree", score: 2, size: "h-9 w-9 sm:h-14 sm:w-14" },
  { uiId: "neutral", score: 3, size: "h-7 w-7 sm:h-11 sm:w-11" },
  { uiId: "agree", score: 4, size: "h-9 w-9 sm:h-14 sm:w-14" },
  { uiId: "agree-strong", score: 5, size: "h-10 w-10 sm:h-16 sm:w-16" },
] as const;

const likertColorByScore: Record<number, string> = {
  1: "border-red-500/95 bg-red-500/12",
  2: "border-orange-400/95 bg-orange-500/12",
  3: "border-yellow-300/95 bg-yellow-400/12",
  4: "border-lime-400/95 bg-lime-500/12",
  5: "border-emerald-500/95 bg-emerald-600/15",
};

const AXIS_FR: Record<keyof RadarAxisValues, string> = RADAR_DIMENSION_LABELS;
const TOTAL_QUESTIONS = RADAR_QUESTIONS.length;
const RADAR_FALLBACK_SYNC_MS = 12000;

function cleanDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 16);
}

type ThemeCardMeta = {
  title: string;
  description: string;
  high: string;
  medium: string;
  low: string;
};

const THEME_CARD_META: Record<RadarDimension, ThemeCardMeta> = {
  collaboration: {
    title: "Collaboration",
    description: "La communication et l'entraide rendent l'execution collective plus fluide.",
    high: "Le collectif est un vrai levier. Continuez les feedbacks croises et la co-construction.",
    medium: "La base est bonne, mais certains moments de coordination peuvent etre renforces.",
    low: "Risque de silos. Clarifiez les attentes et augmentez les temps de synchronisation.",
  },
  fun: {
    title: "Fun (Ambiance)",
    description: "L'energie de l'equipe soutient la motivation et la resilience.",
    high: "Ambiance tres favorable. Capitalisez avec des rituels de celebration.",
    medium: "Climat correct mais inconstant. Preservez des temps de respiration.",
    low: "Moral fragile. Traitez les irritants et recreez des moments de cohesion.",
  },
  learning: {
    title: "Apprentissages",
    description: "L'equipe transforme ses retours en progression continue.",
    high: "Excellente dynamique d'apprentissage. Partagez davantage les bonnes pratiques.",
    medium: "La progression existe mais manque parfois de regularite.",
    low: "Peu d'apprentissage visible. Planifiez des actions d'amelioration concretes.",
  },
  alignment: {
    title: "Alignement",
    description: "Les objectifs et priorites sont compris pour orienter les decisions.",
    high: "Alignement tres fort. Gardez ce cap avec une priorisation explicite.",
    medium: "Vision partagee partielle. Revalidez regulierement objectifs et perimetre.",
    low: "Manque de cap commun. Reposez les objectifs et les criteres de valeur.",
  },
  ownership: {
    title: "Ownership (Responsabilite)",
    description: "L'equipe assume ses decisions et la responsabilite du resultat.",
    high: "Ownership eleve. Continuez a proteger l'autonomie de l'equipe.",
    medium: "Responsabilites globalement claires mais parfois hesitantes.",
    low: "Dependance externe forte. Clarifiez qui decide quoi et jusqu'ou.",
  },
  process: {
    title: "Processus",
    description: "Les pratiques et rituels soutiennent l'efficacite sans lourdeur.",
    high: "Processus utiles et adaptables. Conservez ce niveau d'ajustement.",
    medium: "Les rituels aident mais peuvent etre mieux calibres.",
    low: "Processus subis ou inefficaces. Simplifiez et mesurez la valeur de chaque pratique.",
  },
  resources: {
    title: "Ressources",
    description: "Outils, support et temps permettent de livrer dans de bonnes conditions.",
    high: "Ressources bien maitrisees. Profitez-en pour accelerer la qualite de delivery.",
    medium: "Les moyens sont presents mais pas toujours fluides.",
    low: "Contraintes fortes. Traitez les blocages de support et de dependances en priorite.",
  },
  roles: {
    title: "Roles",
    description: "Les roles et responsabilites structurent la collaboration.",
    high: "Roles tres lisibles. Maintenez cette clarte lors des changements.",
    medium: "Repartition comprise avec quelques zones de flou.",
    low: "Ambiguite des roles. Redefinissez les responsabilites et interfaces.",
  },
  speed: {
    title: "Vitesse",
    description: "Le flux de delivery reste soutenable et previsible.",
    high: "Bonne cadence. Conservez le rythme sans degrader la qualite.",
    medium: "Vitesse correcte mais fragile face aux imprevus.",
    low: "Flux ralenti ou instable. Traitez les goulots et le travail en attente.",
  },
  value: {
    title: "Valeur",
    description: "La valeur livree est reliee aux besoins metier et utilisateurs.",
    high: "Orientation valeur tres forte. Continuez a piloter avec les retours utilisateurs.",
    medium: "Valeur visible mais encore inegalement mesuree.",
    low: "Valeur peu lisible. Reconnectez priorisation, impact et apprentissages client.",
  },
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getThemeTone(score: number) {
  if (score >= 75) {
    return {
      Icon: Smile,
      cardClass: "border-emerald-300/60 bg-emerald-500/12",
      badgeClass: "border-emerald-300/70 bg-emerald-600/20 text-emerald-100",
      iconClass: "text-emerald-300",
      level: "Tres fort",
      messageKey: "high" as const,
    };
  }
  if (score >= 55) {
    return {
      Icon: Smile,
      cardClass: "border-lime-300/60 bg-lime-500/12",
      badgeClass: "border-lime-300/70 bg-lime-600/18 text-lime-100",
      iconClass: "text-lime-300",
      level: "Solide",
      messageKey: "medium" as const,
    };
  }
  if (score >= 35) {
    return {
      Icon: Meh,
      cardClass: "border-amber-300/60 bg-amber-500/12",
      badgeClass: "border-amber-300/70 bg-amber-600/18 text-amber-100",
      iconClass: "text-amber-300",
      level: "A consolider",
      messageKey: "medium" as const,
    };
  }
  return {
    Icon: Frown,
    cardClass: "border-red-300/60 bg-red-500/12",
    badgeClass: "border-red-300/70 bg-red-600/18 text-red-100",
    iconClass: "text-red-300",
    level: "Prioritaire",
    messageKey: "low" as const,
  };
}

function emptyTeamInsights(
  teamRadar: RadarAxisValues,
  participants: RadarParticipant[],
): RadarTeamInsights {
  return buildTeamInsights(
    teamRadar,
    participants
      .map((participant) => participant.result?.radar)
      .filter((radar): radar is RadarAxisValues => Boolean(radar)),
  );
}

const RadarPartyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialMode = params.get("mode") === "join" ? "join" : "host";
  const initialCode = (params.get("code") || "").toUpperCase();
  const initialName = cleanDisplayName(params.get("name") || "");
  const rawInitialAvatar = Number(params.get("avatar"));
  const initialAvatar = Number.isFinite(rawInitialAvatar)
    ? Math.max(0, Math.min(AVATARS.length - 1, Math.floor(rawInitialAvatar)))
    : 0;
  const initialAutoSubmit = params.get("auto") === "1";
  const initialDirectAccess = initialAutoSubmit || !!initialCode;
  const forceProfileBeforeJoin = initialMode === "join" && !!initialCode && !initialAutoSubmit;
  const fromEntry = params.get("from") === "entry";
  const connectedDisplayName = cleanDisplayName(user?.displayName || "");

  const [stage, setStage] = useState<Stage>("lobby");
  const [answers, setAnswers] = useState<RadarAnswers>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [localResult, setLocalResult] = useState<LocalResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [participants, setParticipants] = useState<RadarParticipant[]>([]);
  const [profile, setProfile] = useState(() => ({ name: initialName, avatar: initialAvatar }));
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState(
    () => forceProfileBeforeJoin || (!initialDirectAccess && initialName.length < 2),
  );
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    forceProfileBeforeJoin ? 1 : initialName.length >= 2 ? 2 : 1,
  );
  const [autoSubmitKey, setAutoSubmitKey] = useState<number>(() =>
    initialAutoSubmit ? Date.now() : 0,
  );
  const [connectedLaunchProfileApplied, setConnectedLaunchProfileApplied] = useState(false);

  const [teamRadar, setTeamRadar] = useState<RadarAxisValues>(createNeutralRadar());
  const [teamInsights, setTeamInsights] = useState<RadarTeamInsights | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"lobby" | "live" | "ended" | "abandoned">(
    "lobby",
  );
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [questionNavMessage, setQuestionNavMessage] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [hostParticipates, setHostParticipates] = useState(true);
  const [resultPublished, setResultPublished] = useState(false);
  const publishInFlightRef = useRef(false);
  const individualRadarCaptureRef = useRef<HTMLDivElement | null>(null);
  const teamRadarCaptureRef = useRef<HTMLDivElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const currentQuestion = RADAR_QUESTIONS[questionIndex];
  const progressPct = Math.round(((questionIndex + 1) / RADAR_QUESTIONS.length) * 100);

  const completionCount = useMemo(
    () => RADAR_QUESTIONS.filter((question) => Number.isFinite(answers[question.id])).length,
    [answers],
  );
  const currentAnswer = answers[currentQuestion.id];
  const isCurrentAnswered = Number.isFinite(currentAnswer);
  const isLastQuestion = questionIndex === RADAR_QUESTIONS.length - 1;
  const allQuestionsAnswered = completionCount === RADAR_QUESTIONS.length;

  const canPublish = Boolean(roomCode && participantId && localResult);
  const isHost = useMemo(
    () =>
      participants.some((participant) => participant.id === participantId && participant.isHost),
    [participants, participantId],
  );
  useEffect(() => {
    setHostSession(
      roomCode
        ? {
            code: roomCode,
            moduleId: "radar-party",
            isHost: isHost && sessionStatus !== "ended" && sessionStatus !== "abandoned",
            participantId,
          }
        : null,
    );
    return () => setHostSession(null);
  }, [isHost, participantId, roomCode, sessionStatus]);
  const selfParticipant = useMemo(
    () => participants.find((participant) => participant.id === participantId) ?? null,
    [participants, participantId],
  );
  const hostHasSubmitted = Boolean(selfParticipant?.submittedAt);
  const canResumeHostQuestionnaire = isHost && hostParticipates && !hostHasSubmitted;
  const teamDetailScores = useMemo(() => {
    const keys = Array.from(new Set(RADAR_QUESTIONS.map((question) => question.subdimension)));
    const aggregated: Record<string, number> = {};
    keys.forEach((key) => {
      const values = participants
        .map((participant) => participant.result?.polesPercent?.[key])
        .filter((value): value is number => Number.isFinite(value));
      if (values.length > 0) {
        aggregated[key] = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      }
    });
    return aggregated;
  }, [participants]);

  useEffect(() => {
    if (connectedLaunchProfileApplied || authLoading) return;
    if (!connectedDisplayName || initialMode !== "host" || initialDirectAccess || roomCode) return;
    setProfile((prev) => ({ name: connectedDisplayName, avatar: prev.avatar }));
    setOnboardingInitialStep(2);
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
  const progressRows = useMemo(() => {
    return participants.map((participant) => {
      const exempted = participant.isHost && !hostParticipates;
      const total = Math.max(1, participant.progressTotal ?? TOTAL_QUESTIONS);
      const answered = exempted
        ? 0
        : participant.submittedAt
          ? total
          : Math.max(0, Math.min(total, participant.progressAnswered ?? 0));
      const progressPct = exempted
        ? 0
        : participant.submittedAt
          ? 100
          : Math.max(0, Math.min(100, Math.round((answered / total) * 100)));

      return {
        participant,
        exempted,
        answered,
        total,
        progressPct,
      };
    });
  }, [participants, hostParticipates]);
  const expectedResponders = useMemo(
    () => progressRows.filter((row) => !row.exempted).length,
    [progressRows],
  );
  const completedResponders = useMemo(
    () => progressRows.filter((row) => !row.exempted && row.participant.submittedAt).length,
    [progressRows],
  );
  const teamCompletionPct =
    expectedResponders > 0 ? Math.round((completedResponders / expectedResponders) * 100) : 0;
  const resolvedTeamInsights = useMemo(
    () => teamInsights ?? emptyTeamInsights(teamRadar, participants),
    [teamInsights, teamRadar, participants],
  );

  const renderThemeCardsBlock = (
    radarValues: RadarAxisValues,
    options?: { title?: string; helperText?: string },
  ) => {
    const title = options?.title ?? "Cartes thematiques";
    const helperText =
      options?.helperText ??
      "Lecture rapide par theme avec tonalite visuelle, score et interpretation.";

    return (
      <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
        <h3 className="text-base font-semibold text-emerald-200">{title}</h3>
        <p className="mt-1 text-xs text-slate-300">{helperText}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {RADAR_DIMENSIONS.map((dimension) => {
            const score = clampPercent(Number(radarValues?.[dimension] ?? 0));
            const tone = getThemeTone(score);
            const meta = THEME_CARD_META[dimension];
            const Icon = tone.Icon;
            const scoreOnFive = (score / 20).toFixed(1);

            return (
              <div key={dimension} className={cn("rounded-3xl border p-4", tone.cardClass)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-100">{meta.title}</p>
                    <p className="mt-1 text-xs text-slate-200/90">{meta.description}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      tone.badgeClass,
                    )}
                  >
                    {scoreOnFive}/5
                  </span>
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", tone.iconClass)} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-100/90">
                      {tone.level}
                    </p>
                    <p className="mt-1 text-sm text-slate-100/90">{meta[tone.messageKey]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  const buildPdfThemeRows = (radarValues: RadarAxisValues) =>
    RADAR_DIMENSIONS.map((dimension) => {
      const score = clampPercent(Number(radarValues?.[dimension] ?? 0));
      const shortTitles: Record<RadarDimension, string> = {
        collaboration: "Collaboration",
        fun: "Fun",
        learning: "Apprentissages",
        alignment: "Alignement",
        ownership: "Ownership",
        process: "Processus",
        resources: "Ressources",
        roles: "Roles",
        speed: "Vitesse",
        value: "Valeur",
      };
      const color =
        score >= 75
          ? [16, 185, 129]
          : score >= 55
            ? [132, 204, 22]
            : score >= 35
              ? [245, 158, 11]
              : [239, 68, 68];
      return {
        dimension,
        score,
        title: shortTitles[dimension],
        color,
      };
    }).sort((a, b) => b.score - a.score);

  const refreshSession = async (codeArg?: string, participantIdOverride?: string) => {
    const code = (codeArg ?? roomCode ?? "").trim().toUpperCase();
    if (!code) return;
    const response = await api.radarGetSession(code);
    setRoomCode(response.session.code);
    setSessionStatus(response.session.status);
    setHostParticipates(response.session.hostParticipates !== false);
    setParticipants(response.participants);

    const memberRadars = response.participants
      .map((participant) => participant.result?.radar)
      .filter((radar): radar is RadarAxisValues => Boolean(radar));
    const nextTeamRadar = response.team?.radar ?? computeTeamAverageRadar(memberRadars);
    const nextTeamInsights =
      response.team?.insights ?? emptyTeamInsights(nextTeamRadar, response.participants);
    setTeamRadar(nextTeamRadar);
    setTeamInsights(nextTeamInsights);
    const currentParticipantId = participantIdOverride ?? participantId;
    const self = response.participants.find(
      (participant) => participant.id === currentParticipantId,
    );
    const submitted = Boolean(self?.submittedAt);
    setResultPublished(submitted);
    if (submitted && self?.result) {
      setLocalResult({
        radar: self.result.radar,
        polesPercent: self.result.polesPercent,
        insights: self.result.insights,
      });
    }

    if (response.session.status === "live" && stage === "lobby") {
      const shouldOpenProgressMenu =
        Boolean(self?.isHost) && response.session.hostParticipates === false;
      if (submitted) {
        setStage("individual");
      } else {
        setStage(shouldOpenProgressMenu ? "team-progress" : "questionnaire");
      }
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    const code = roomCode.trim().toUpperCase();
    if (!code) return;

    const canLiveSync = stage === "lobby" || stage === "team-progress" || stage === "team-radar";
    const subscribe = () => socket.emit(C2S_EVENTS.JOIN_RADAR_ROOM, { code });

    const onConnect = () => {
      subscribe();
      if (canLiveSync) {
        void refreshSession(code);
      }
    };
    const onRadarSessionUpdate = (payload: { code?: string }) => {
      const updatedCode =
        typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      if (!updatedCode || updatedCode !== code) return;
      if (!canLiveSync) return;
      void refreshSession(code);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      subscribe();
      if (canLiveSync) {
        void refreshSession(code);
      }
    };
    const onWindowFocus = () => {
      subscribe();
      if (canLiveSync) {
        void refreshSession(code);
      }
    };

    if (!socket.connected) socket.connect();
    subscribe();
    if (canLiveSync) {
      void refreshSession(code);
    }
    socket.on("connect", onConnect);
    socket.on(S2C_EVENTS.RADAR_SESSION_UPDATE, onRadarSessionUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("online", onWindowFocus);

    return () => {
      socket.off("connect", onConnect);
      socket.off(S2C_EVENTS.RADAR_SESSION_UPDATE, onRadarSessionUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onWindowFocus);
      socket.emit(C2S_EVENTS.LEAVE_RADAR_ROOM, { code });
    };
  }, [roomCode, stage, participantId]);

  useEffect(() => {
    if (!roomCode || (stage !== "lobby" && stage !== "team-progress" && stage !== "team-radar"))
      return;
    const interval = window.setInterval(() => {
      void refreshSession(roomCode);
    }, RADAR_FALLBACK_SYNC_MS);
    return () => window.clearInterval(interval);
  }, [roomCode, stage, participantId]);

  const computeLocalResult = (allAnswers: RadarAnswers) => {
    const scoring = computeRadarScores(allAnswers);
    const insights = buildIndividualInsights(scoring.radar);
    const result = { radar: scoring.radar, polesPercent: scoring.polesPercent, insights };
    setLocalResult(result);
    return result;
  };

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const persisted = loadPersistedRadarSession();
      if (!persisted) {
        if (!cancelled) setIsRestoringSession(false);
        return;
      }

      try {
        const response = await api.radarGetSession(persisted.code);
        if (cancelled) return;

        if (response.session.status === "ended" || response.session.status === "abandoned") {
          persistRadarSession(null);
          setError("Cette session Radar Party est terminée.");
          setIsRestoringSession(false);
          return;
        }

        const self = response.participants.find(
          (participant) => participant.id === persisted.participantId,
        );
        if (!self) {
          persistRadarSession(null);
          if (!cancelled) setIsRestoringSession(false);
          return;
        }

        const memberRadars = response.participants
          .map((participant) => participant.result?.radar)
          .filter((radar): radar is RadarAxisValues => Boolean(radar));
        const nextTeamRadar = response.team?.radar ?? computeTeamAverageRadar(memberRadars);
        const nextTeamInsights =
          response.team?.insights ?? emptyTeamInsights(nextTeamRadar, response.participants);

        const restoredAnswers = persisted.answers ?? {};
        const restoredCompletionCount = RADAR_QUESTIONS.filter((question) =>
          Number.isFinite(restoredAnswers[question.id]),
        ).length;
        const restoredAllAnswered = restoredCompletionCount === RADAR_QUESTIONS.length;
        const boundedQuestionIndex = Math.max(
          0,
          Math.min(RADAR_QUESTIONS.length - 1, persisted.questionIndex),
        );

        setRoomCode(response.session.code);
        setParticipantId(self.id);
        setProfile({
          name: persisted.profile.name || self.displayName,
          avatar: Number.isFinite(persisted.profile.avatar)
            ? persisted.profile.avatar
            : self.avatar,
        });
        setShowOnlineOnboarding(false);
        setOnboardingInitialStep(1);
        setParticipants(response.participants);
        setSessionStatus(response.session.status);
        setHostParticipates(response.session.hostParticipates !== false);
        setTeamRadar(nextTeamRadar);
        setTeamInsights(nextTeamInsights);
        setAnswers(restoredAnswers);
        setQuestionIndex(boundedQuestionIndex);
        setQuestionNavMessage(null);

        const submitted = Boolean(self.submittedAt);
        setResultPublished(submitted);

        if (submitted && self.result) {
          setLocalResult({
            radar: self.result.radar,
            polesPercent: self.result.polesPercent,
            insights: self.result.insights,
          });
        } else if (!submitted && restoredAllAnswered) {
          const scoring = computeRadarScores(restoredAnswers);
          setLocalResult({
            radar: scoring.radar,
            polesPercent: scoring.polesPercent,
            insights: buildIndividualInsights(scoring.radar),
          });
        } else {
          setLocalResult(null);
        }

        if (response.session.status === "lobby") {
          setStage("lobby");
        } else if (submitted) {
          if (persisted.stage === "team-progress" && self.isHost) {
            setStage("team-progress");
          } else if (persisted.stage === "team-radar") {
            setStage("team-radar");
          } else {
            setStage("individual");
          }
        } else if (self.isHost && response.session.hostParticipates === false) {
          setStage("team-progress");
        } else if (restoredAllAnswered && persisted.stage === "individual") {
          setStage("individual");
        } else {
          setStage("questionnaire");
        }
      } catch {
        persistRadarSession(null);
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isRestoringSession) return;
    if (!roomCode || !participantId) {
      persistRadarSession(null);
      return;
    }

    persistRadarSession({
      code: roomCode,
      participantId,
      profile: {
        name: profile.name ?? "",
        avatar: Number.isFinite(profile.avatar) ? profile.avatar : 0,
      },
      stage,
      answers,
      questionIndex: Math.max(0, Math.min(RADAR_QUESTIONS.length - 1, questionIndex)),
      hostParticipates,
      resultPublished,
      updatedAt: Date.now(),
    });
  }, [
    answers,
    hostParticipates,
    isRestoringSession,
    participantId,
    profile.avatar,
    profile.name,
    questionIndex,
    resultPublished,
    roomCode,
    stage,
  ]);

  const findFirstUnansweredIndex = (sourceAnswers: RadarAnswers) =>
    RADAR_QUESTIONS.findIndex((question) => !Number.isFinite(sourceAnswers[question.id]));

  const finalizeQuestionnaire = () => {
    computeLocalResult(answers);
    setSubmitDialogOpen(false);
    setQuestionNavMessage(null);
    setStage("individual");
    void publishAnswersToSession(answers, { silent: true });
  };

  const goToPreviousQuestion = () => {
    setQuestionNavMessage(null);
    setQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextQuestion = () => {
    setQuestionNavMessage(null);
    if (questionIndex < RADAR_QUESTIONS.length - 1) {
      setQuestionIndex((prev) => Math.min(RADAR_QUESTIONS.length - 1, prev + 1));
      return;
    }
    const firstUnanswered = findFirstUnansweredIndex(answers);
    if (firstUnanswered !== -1) {
      setQuestionNavMessage(
        "Il reste des questions sans reponse. Completons-les avant validation.",
      );
      setQuestionIndex(firstUnanswered);
      return;
    }
    setSubmitDialogOpen(true);
  };

  const pushProgressUpdate = async (nextAnswers: RadarAnswers) => {
    if (!roomCode || !participantId) return;
    const answeredCount = RADAR_QUESTIONS.filter((question) =>
      Number.isFinite(nextAnswers[question.id]),
    ).length;
    try {
      const updated = await api.radarUpdateProgress(roomCode, { participantId, answeredCount });
      setParticipants((previous) =>
        previous.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                progressAnswered: updated.participant.progressAnswered,
                progressTotal: updated.participant.progressTotal,
                progressPct: updated.participant.progressPct,
              }
            : participant,
        ),
      );
    } catch {
      // Keep questionnaire flow resilient if progress sync fails transiently.
    }
  };

  const publishAnswersToSession = async (
    answersToPublish: RadarAnswers,
    options?: { silent?: boolean },
  ) => {
    if (!roomCode || !participantId) return false;
    if (publishInFlightRef.current) return false;

    const silent = options?.silent === true;
    publishInFlightRef.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await api.radarSubmitAnswers(roomCode, {
        participantId,
        answers: answersToPublish,
      });
      setTeamRadar(response.team.radar);
      setTeamInsights(response.team.insights);
      setResultPublished(true);
      return true;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Erreur serveur");
      }
      return false;
    } finally {
      publishInFlightRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleSelectAnswer = (value: number) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(nextAnswers);
    setQuestionNavMessage(null);
    void pushProgressUpdate(nextAnswers);

    if (questionIndex === RADAR_QUESTIONS.length - 1) {
      const firstUnanswered = findFirstUnansweredIndex(nextAnswers);
      if (firstUnanswered === -1) {
        setSubmitDialogOpen(true);
      } else {
        setQuestionNavMessage(
          "Il reste des questions sans reponse. Completons-les avant validation.",
        );
        setQuestionIndex(firstUnanswered);
      }
      return;
    }
    setQuestionIndex((prev) => prev + 1);
  };

  const handleHost = async (name: string, avatar: number) => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.radarCreateSession({
        title: "Session Radar Party",
        facilitatorName: name,
        hostParticipates,
      });
      const joined = await api.radarJoinSession(created.session.code, {
        displayName: name,
        avatar,
      });
      setProfile({ name, avatar });
      setParticipantId(joined.participant.id);
      setRoomCode(joined.session.code);
      setSessionStatus(joined.session.status);
      setParticipants([joined.participant]);
      setAnswers({});
      setQuestionIndex(0);
      setLocalResult(null);
      setQuestionNavMessage(null);
      setResultPublished(false);
      setShowOnlineOnboarding(false);
      setStage("lobby");
      await refreshSession(joined.session.code, joined.participant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (code: string, name: string, avatar: number) => {
    setLoading(true);
    setError(null);
    try {
      const joined = await api.radarJoinSession(code, {
        displayName: name,
        avatar,
      });
      setProfile({ name, avatar });
      setParticipantId(joined.participant.id);
      setRoomCode(joined.session.code);
      setSessionStatus(joined.session.status);
      setAnswers({});
      setQuestionIndex(0);
      setLocalResult(null);
      setQuestionNavMessage(null);
      setShowOnlineOnboarding(false);
      setResultPublished(false);
      setStage("lobby");
      await refreshSession(joined.session.code, joined.participant.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    persistRadarSession(null);
    if (roomCode) {
      socket.emit(C2S_EVENTS.LEAVE_RADAR_ROOM, { code: roomCode });
      setRoomCode(null);
      setParticipants([]);
      setParticipantId("");
      setSessionStatus("lobby");
      setHostParticipates(true);
      setTeamInsights(null);
      setTeamRadar(createNeutralRadar());
      setResultPublished(false);
      return;
    }
    if (showOnlineOnboarding) {
      if (fromEntry) {
        navigate("/?stage=entry&experience=agile-radar");
        return;
      }
      navigate("/?stage=select-experience");
      return;
    }
    setOnboardingInitialStep(2);
    setShowOnlineOnboarding(true);
  };

  const submitToSession = async () => {
    if (!canPublish || !roomCode) return;
    if (resultPublished) {
      await refreshSession(roomCode);
      setStage("team-radar");
      return;
    }

    const ok = await publishAnswersToSession(answers, { silent: false });
    if (!ok) return;
    await refreshSession(roomCode);
    setStage("team-radar");
  };

  const handleExportTeamPdf = async () => {
    if (!isHost || stage !== "team-radar") return;
    if (isExportingPdf) return;

    const captureElement = teamRadarCaptureRef.current;
    if (!captureElement) {
      setError("Export PDF indisponible: radar equipe introuvable.");
      return;
    }

    setIsExportingPdf(true);
    setError(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const screenshot = await html2canvas(captureElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020617",
      });

      const radarImage = screenshot.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const hostName =
        participants.find((participant) => participant.isHost)?.displayName ?? "Hote";
      const sessionCode = roomCode || "-";
      const generatedAt = new Date().toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const themeRows = buildPdfThemeRows(teamRadar);

      const addPageBackground = (subtitle: string) => {
        pdf.setFillColor(2, 6, 23);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setDrawColor(34, 211, 238);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 3, 3, "S");

        pdf.setFillColor(8, 145, 178);
        pdf.roundedRect(margin, margin, contentWidth, 21, 3, 3, "F");
        pdf.setTextColor(236, 254, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Retro Party - Radar Party", margin + 4, margin + 8);
        pdf.setFontSize(9);
        pdf.setTextColor(186, 230, 253);
        pdf.text(subtitle, margin + 4, margin + 14);
      };

      const drawWrappedParagraph = (text: string, x: number, y: number, width: number) => {
        const lines = pdf.splitTextToSize(text, width);
        pdf.text(lines, x, y);
        return y + lines.length * 4.8;
      };
      const drawMetaCard = (
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        value: string,
        color: [number, number, number],
      ) => {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "F");
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "S");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(7.8);
        pdf.text(label, x + 3, y + 4.2);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(236, 254, 255);
        pdf.setFontSize(12.4);
        pdf.text(value, x + 3, y + height - 3.7);
      };

      addPageBackground("Rapport equipe - export atelier");

      let cursorY = margin + 26;
      const cardGap = 4;
      const halfCardWidth = (contentWidth - cardGap) / 2;
      drawMetaCard(margin, cursorY, halfCardWidth, 16, "CODE SESSION", sessionCode, [56, 189, 248]);
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "HOTE",
        hostName,
        [34, 197, 94],
      );
      cursorY += 18;
      drawMetaCard(
        margin,
        cursorY,
        halfCardWidth,
        16,
        "PARTICIPANTS",
        `${participants.length} (${completedResponders}/${expectedResponders} completes)`,
        [14, 165, 233],
      );
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "PROGRESSION",
        `${teamCompletionPct}%`,
        [250, 204, 21],
      );
      cursorY += 18;
      drawMetaCard(margin, cursorY, contentWidth, 13.5, "GENERE LE", generatedAt, [125, 211, 252]);
      cursorY += 17;

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, cursorY, contentWidth, 108, 3, 3, "F");
      const imageMaxWidth = contentWidth - 8;
      const imageMaxHeight = 100;
      const imageRatio = screenshot.width / screenshot.height;
      let imageWidth = imageMaxWidth;
      let imageHeight = imageWidth / imageRatio;
      if (imageHeight > imageMaxHeight) {
        imageHeight = imageMaxHeight;
        imageWidth = imageHeight * imageRatio;
      }
      const imageX = margin + (contentWidth - imageWidth) / 2;
      const imageY = cursorY + (108 - imageHeight) / 2;
      pdf.addImage(radarImage, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");

      cursorY += 114;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(236, 254, 255);
      pdf.setFontSize(11);
      pdf.text("Lecture rapide par themes (equipe)", margin, cursorY);
      cursorY += 4;

      themeRows.forEach((row) => {
        const rowHeight = 8.1;
        const pillWidth = 21;
        const rowTop = cursorY;
        const barX = margin + 53;
        const barWidth = contentWidth - (barX - margin) - pillWidth - 6;
        const barHeight = 2.3;
        const scoreWidth = (barWidth * row.score) / 100;
        const pillX = margin + contentWidth - pillWidth - 2;

        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, rowTop, contentWidth, rowHeight - 0.9, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.7);
        pdf.setTextColor(226, 232, 240);
        pdf.text(row.title, margin + 3, rowTop + 3.4);

        pdf.setFillColor(30, 41, 59);
        pdf.roundedRect(barX, rowTop + 4.1, barWidth, barHeight, 1.4, 1.4, "F");
        pdf.setFillColor(row.color[0], row.color[1], row.color[2]);
        pdf.roundedRect(barX, rowTop + 4.1, Math.max(2, scoreWidth), barHeight, 1.4, 1.4, "F");

        pdf.setFillColor(row.color[0], row.color[1], row.color[2]);
        pdf.roundedRect(pillX, rowTop + 1.1, pillWidth, 5.1, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.3);
        pdf.setTextColor(2, 6, 23);
        pdf.text(`${row.score}%`, pillX + pillWidth / 2, rowTop + 4.8, { align: "center" });
        cursorY += rowHeight;
      });

      pdf.addPage();
      addPageBackground("Insights atelier");
      cursorY = margin + 27;

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, cursorY, contentWidth, 36, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(236, 254, 255);
      pdf.setFontSize(11);
      pdf.text("Resume equipe", margin + 4, cursorY + 7);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(203, 213, 225);
      cursorY =
        drawWrappedParagraph(
          resolvedTeamInsights.summary,
          margin + 4,
          cursorY + 13,
          contentWidth - 8,
        ) + 5;

      const homogeneousLines =
        resolvedTeamInsights.homogeneousAxes.length > 0
          ? resolvedTeamInsights.homogeneousAxes
          : ["Aucun axe fortement homogene pour le moment."];
      const polarizedLines =
        resolvedTeamInsights.polarizedAxes.length > 0
          ? resolvedTeamInsights.polarizedAxes
          : ["Aucun axe de divergence forte (> 25 points)."];

      const drawBulletSection = (
        title: string,
        items: string[],
        tone: [number, number, number],
      ) => {
        const estimatedHeight = 12 + items.length * 9;
        if (cursorY + estimatedHeight > pageHeight - margin) {
          pdf.addPage();
          addPageBackground("Insights atelier");
          cursorY = margin + 18;
        }
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, cursorY, contentWidth, estimatedHeight, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(tone[0], tone[1], tone[2]);
        pdf.text(title, margin + 4, cursorY + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(226, 232, 240);
        let itemY = cursorY + 12;
        items.forEach((item) => {
          itemY = drawWrappedParagraph(`- ${item}`, margin + 4, itemY, contentWidth - 8);
        });
        cursorY = itemY + 2;
      };

      drawBulletSection("Axes homogenes", homogeneousLines, [52, 211, 153]);
      drawBulletSection("Axes polarises", polarizedLines, [251, 191, 36]);

      const topThemes = themeRows.slice(0, 3).map((theme) => `${theme.title} (${theme.score}%)`);
      const focusThemes = [...themeRows]
        .reverse()
        .slice(0, 3)
        .map((theme) => `${theme.title} (${theme.score}%)`);
      drawBulletSection("Themes les plus solides", topThemes, [34, 211, 238]);
      drawBulletSection("Themes a consolider", focusThemes, [248, 113, 113]);

      const stamp = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}`;
      const filename = `retro-party-radar-equipe-${(roomCode || "session").toLowerCase()}-${stamp}.pdf`;
      pdf.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportIndividualPdf = async () => {
    if (stage !== "individual" || !localResult) return;
    if (isExportingPdf) return;

    const captureElement = individualRadarCaptureRef.current;
    if (!captureElement) {
      setError("Export PDF indisponible: radar individuel introuvable.");
      return;
    }

    setIsExportingPdf(true);
    setError(null);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const screenshot = await html2canvas(captureElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#020617",
      });

      const radarImage = screenshot.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const participantName =
        profile.name ||
        participants.find((participant) => participant.id === participantId)?.displayName ||
        "Participant";
      const sessionCode = roomCode || "-";
      const progressPercent = Math.round((completionCount / Math.max(1, TOTAL_QUESTIONS)) * 100);
      const generatedAt = new Date().toLocaleString("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const themeRows = buildPdfThemeRows(localResult.radar);
      const recommendationCards = buildIndividualRecommendations(localResult.radar).cards;
      const recommendationToneMeta: Record<
        "reinforce" | "next-lever" | "preserve",
        { label: string; color: [number, number, number] }
      > = {
        reinforce: { label: "A renforcer", color: [248, 113, 113] },
        "next-lever": { label: "Prochain levier", color: [251, 191, 36] },
        preserve: { label: "A preserver", color: [52, 211, 153] },
      };

      const addPageBackground = (subtitle: string) => {
        pdf.setFillColor(2, 6, 23);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        pdf.setDrawColor(34, 211, 238);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(6, 6, pageWidth - 12, pageHeight - 12, 3, 3, "S");

        pdf.setFillColor(8, 145, 178);
        pdf.roundedRect(margin, margin, contentWidth, 21, 3, 3, "F");
        pdf.setTextColor(236, 254, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Retro Party - Radar Party", margin + 4, margin + 8);
        pdf.setFontSize(9);
        pdf.setTextColor(186, 230, 253);
        pdf.text(subtitle, margin + 4, margin + 14);
      };

      const drawWrappedParagraph = (text: string, x: number, y: number, width: number) => {
        const lines = pdf.splitTextToSize(text, width);
        pdf.text(lines, x, y);
        return y + lines.length * 4.8;
      };
      const estimateBulletSectionHeight = (items: string[]) => {
        const bulletWidth = contentWidth - 8;
        const totalLines = items.reduce((acc, item) => {
          const wrapped = pdf.splitTextToSize(`- ${item}`, bulletWidth);
          return acc + Math.max(1, wrapped.length);
        }, 0);
        return 12 + totalLines * 4.8 + 2;
      };
      const drawMetaCard = (
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        value: string,
        color: [number, number, number],
      ) => {
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "F");
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, width, height, 2.5, 2.5, "S");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(7.8);
        pdf.text(label, x + 3, y + 4.2);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(236, 254, 255);
        pdf.setFontSize(12.4);
        pdf.text(value, x + 3, y + height - 3.7);
      };

      addPageBackground("Rapport individuel - export atelier");
      let cursorY = margin + 26;
      const cardGap = 4;
      const halfCardWidth = (contentWidth - cardGap) / 2;
      drawMetaCard(margin, cursorY, halfCardWidth, 16, "CODE SESSION", sessionCode, [56, 189, 248]);
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "PROFIL",
        participantName,
        [34, 197, 94],
      );
      cursorY += 18;
      drawMetaCard(
        margin,
        cursorY,
        halfCardWidth,
        16,
        "REPONSES",
        `${completionCount}/${TOTAL_QUESTIONS}`,
        [14, 165, 233],
      );
      drawMetaCard(
        margin + halfCardWidth + cardGap,
        cursorY,
        halfCardWidth,
        16,
        "PROGRESSION",
        `${progressPercent}%`,
        [250, 204, 21],
      );
      cursorY += 18;
      drawMetaCard(margin, cursorY, contentWidth, 13.5, "GENERE LE", generatedAt, [125, 211, 252]);
      cursorY += 17;

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, cursorY, contentWidth, 108, 3, 3, "F");
      const imageMaxWidth = contentWidth - 8;
      const imageMaxHeight = 100;
      const imageRatio = screenshot.width / screenshot.height;
      let imageWidth = imageMaxWidth;
      let imageHeight = imageWidth / imageRatio;
      if (imageHeight > imageMaxHeight) {
        imageHeight = imageMaxHeight;
        imageWidth = imageHeight * imageRatio;
      }
      const imageX = margin + (contentWidth - imageWidth) / 2;
      const imageY = cursorY + (108 - imageHeight) / 2;
      pdf.addImage(radarImage, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");

      cursorY += 114;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(236, 254, 255);
      pdf.setFontSize(11);
      pdf.text("Lecture rapide par themes (individuel)", margin, cursorY);
      cursorY += 4;

      themeRows.forEach((row) => {
        const rowHeight = 8.1;
        const pillWidth = 21;
        const rowTop = cursorY;
        const barX = margin + 53;
        const barWidth = contentWidth - (barX - margin) - pillWidth - 6;
        const barHeight = 2.3;
        const scoreWidth = (barWidth * row.score) / 100;
        const pillX = margin + contentWidth - pillWidth - 2;

        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, rowTop, contentWidth, rowHeight - 0.9, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.7);
        pdf.setTextColor(226, 232, 240);
        pdf.text(row.title, margin + 3, rowTop + 3.4);

        pdf.setFillColor(30, 41, 59);
        pdf.roundedRect(barX, rowTop + 4.1, barWidth, barHeight, 1.4, 1.4, "F");
        pdf.setFillColor(row.color[0], row.color[1], row.color[2]);
        pdf.roundedRect(barX, rowTop + 4.1, Math.max(2, scoreWidth), barHeight, 1.4, 1.4, "F");

        pdf.setFillColor(row.color[0], row.color[1], row.color[2]);
        pdf.roundedRect(pillX, rowTop + 1.1, pillWidth, 5.1, 2, 2, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.3);
        pdf.setTextColor(2, 6, 23);
        pdf.text(`${row.score}%`, pillX + pillWidth / 2, rowTop + 4.8, { align: "center" });
        cursorY += rowHeight;
      });

      pdf.addPage();
      addPageBackground("Insights atelier");
      cursorY = margin + 27;

      pdf.setFillColor(15, 23, 42);
      pdf.roundedRect(margin, cursorY, contentWidth, 36, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(236, 254, 255);
      pdf.setFontSize(11);
      pdf.text("Resume individuel", margin + 4, cursorY + 7);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(203, 213, 225);
      cursorY =
        drawWrappedParagraph(
          localResult.insights.summary,
          margin + 4,
          cursorY + 13,
          contentWidth - 8,
        ) + 5;

      const drawBulletSection = (
        title: string,
        items: string[],
        tone: [number, number, number],
      ) => {
        const estimatedHeight = estimateBulletSectionHeight(items);
        if (cursorY + estimatedHeight > pageHeight - margin) {
          pdf.addPage();
          addPageBackground("Insights atelier");
          cursorY = margin + 18;
        }
        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, cursorY, contentWidth, estimatedHeight, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(tone[0], tone[1], tone[2]);
        pdf.text(title, margin + 4, cursorY + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(226, 232, 240);
        let itemY = cursorY + 12;
        items.forEach((item) => {
          itemY = drawWrappedParagraph(`- ${item}`, margin + 4, itemY, contentWidth - 8);
        });
        cursorY = itemY + 2;
      };

      const estimateRecommendationCardHeight = (card: (typeof recommendationCards)[number]) => {
        const cardContentWidth = contentWidth - 8;
        const toneLabel = recommendationToneMeta[card.kind].label;
        const fields = [
          `${toneLabel} - ${card.axisLabel} (${card.score}/100)`,
          `Constat: ${card.observation}`,
          `Suggestion: ${card.suggestion}`,
          `Premier pas: ${card.firstStep}`,
          `Indicateur (2 semaines): ${card.indicator}`,
        ];
        const lineCount = fields.reduce((acc, field) => {
          const lines = pdf.splitTextToSize(field, cardContentWidth);
          return acc + Math.max(1, lines.length);
        }, 0);
        return 8 + lineCount * 4.8 + 4;
      };

      const drawRecommendationSection = () => {
        if (recommendationCards.length === 0) return;

        const sectionHeight = 18;
        if (cursorY + sectionHeight > pageHeight - margin) {
          pdf.addPage();
          addPageBackground("Insights atelier");
          cursorY = margin + 18;
        }

        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, cursorY, contentWidth, sectionHeight, 3, 3, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(56, 189, 248);
        pdf.text("Recommandations suggerees (2 semaines)", margin + 4, cursorY + 7);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.6);
        pdf.setTextColor(186, 230, 253);
        pdf.text(
          "Suggestions automatiques (sans IA externe), a adapter a votre contexte.",
          margin + 4,
          cursorY + 12,
        );
        cursorY += sectionHeight + 2;

        recommendationCards.forEach((card, index) => {
          const tone = recommendationToneMeta[card.kind];
          const cardHeight = estimateRecommendationCardHeight(card);

          if (cursorY + cardHeight > pageHeight - margin) {
            pdf.addPage();
            addPageBackground("Insights atelier");
            cursorY = margin + 18;
          }

          pdf.setFillColor(15, 23, 42);
          pdf.roundedRect(margin, cursorY, contentWidth, cardHeight, 3, 3, "F");
          pdf.setDrawColor(tone.color[0], tone.color[1], tone.color[2]);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin, cursorY, contentWidth, cardHeight, 3, 3, "S");

          let textY = cursorY + 6;
          const drawRecommendationField = (
            text: string,
            color: [number, number, number],
            font: "bold" | "normal",
          ) => {
            pdf.setFont("helvetica", font);
            pdf.setFontSize(9.2);
            pdf.setTextColor(color[0], color[1], color[2]);
            const lines = pdf.splitTextToSize(text, contentWidth - 8);
            pdf.text(lines, margin + 4, textY);
            textY += lines.length * 4.8;
          };

          drawRecommendationField(
            `${index + 1}. ${tone.label} - ${card.axisLabel} (${card.score}/100)`,
            tone.color,
            "bold",
          );
          drawRecommendationField(`Constat: ${card.observation}`, [226, 232, 240], "normal");
          drawRecommendationField(`Suggestion: ${card.suggestion}`, [186, 230, 253], "normal");
          drawRecommendationField(`Premier pas: ${card.firstStep}`, [226, 232, 240], "normal");
          drawRecommendationField(
            `Indicateur (2 semaines): ${card.indicator}`,
            [226, 232, 240],
            "normal",
          );

          cursorY += cardHeight + 2;
        });
      };

      const countBulletLines = (items: string[], width: number) =>
        items.reduce((acc, item) => {
          const lines = pdf.splitTextToSize(`- ${item}`, width);
          return acc + Math.max(1, lines.length);
        }, 0);

      const estimateWorkshopThemesSectionHeight = (
        questions: string[],
        strongestThemes: string[],
        weakestThemes: string[],
      ) => {
        const questionItems =
          questions.length > 0 ? questions : ["Aucune question atelier generee."];
        const strongestItems =
          strongestThemes.length > 0 ? strongestThemes : ["Aucun theme solide identifie."];
        const weakestItems =
          weakestThemes.length > 0 ? weakestThemes : ["Aucun theme a consolider identifie."];
        const availableWidth = contentWidth - 8;
        const columnGap = 4;
        const columnWidth = (availableWidth - columnGap) / 2;
        const questionLines = countBulletLines(questionItems, availableWidth);
        const strongestLines = countBulletLines(strongestItems, columnWidth);
        const weakestLines = countBulletLines(weakestItems, columnWidth);
        const themeLines = Math.max(strongestLines, weakestLines);
        return 31 + questionLines * 4.8 + themeLines * 4.8;
      };

      const drawWorkshopThemesSection = (
        questions: string[],
        strongestThemes: string[],
        weakestThemes: string[],
      ) => {
        const questionItems =
          questions.length > 0 ? questions : ["Aucune question atelier generee."];
        const strongestItems =
          strongestThemes.length > 0 ? strongestThemes : ["Aucun theme solide identifie."];
        const weakestItems =
          weakestThemes.length > 0 ? weakestThemes : ["Aucun theme a consolider identifie."];
        const sectionHeight = estimateWorkshopThemesSectionHeight(
          questionItems,
          strongestItems,
          weakestItems,
        );

        if (cursorY + sectionHeight > pageHeight - margin) {
          pdf.addPage();
          addPageBackground("Insights atelier");
          cursorY = margin + 18;
        }

        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(margin, cursorY, contentWidth, sectionHeight, 3, 3, "F");
        pdf.setDrawColor(56, 189, 248);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, cursorY, contentWidth, sectionHeight, 3, 3, "S");

        let sectionY = cursorY + 7;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.3);
        pdf.setTextColor(56, 189, 248);
        pdf.text("Cloture atelier", margin + 4, sectionY);

        sectionY += 4.8;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.6);
        pdf.setTextColor(186, 230, 253);
        pdf.text("Questions et priorites themes pour preparer la suite.", margin + 4, sectionY);

        sectionY += 6.2;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.6);
        pdf.setTextColor(56, 189, 248);
        pdf.text("Questions atelier", margin + 4, sectionY);

        sectionY += 4.3;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(226, 232, 240);
        questionItems.forEach((item) => {
          sectionY = drawWrappedParagraph(`- ${item}`, margin + 4, sectionY, contentWidth - 8);
        });

        sectionY += 1.2;
        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(0.25);
        pdf.line(margin + 4, sectionY, margin + contentWidth - 4, sectionY);

        sectionY += 5;
        const columnGap = 4;
        const columnWidth = (contentWidth - 8 - columnGap) / 2;
        const leftX = margin + 4;
        const rightX = leftX + columnWidth + columnGap;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.4);
        pdf.setTextColor(52, 211, 153);
        pdf.text("Themes les plus solides", leftX, sectionY);
        pdf.setTextColor(248, 113, 113);
        pdf.text("Themes a consolider", rightX, sectionY);

        let leftY = sectionY + 4.3;
        let rightY = sectionY + 4.3;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.2);
        pdf.setTextColor(226, 232, 240);
        strongestItems.forEach((item) => {
          leftY = drawWrappedParagraph(`- ${item}`, leftX, leftY, columnWidth);
        });
        weakestItems.forEach((item) => {
          rightY = drawWrappedParagraph(`- ${item}`, rightX, rightY, columnWidth);
        });

        cursorY = Math.max(leftY, rightY) + 2;
      };

      if (recommendationCards.length > 0) {
        drawRecommendationSection();
      }
      drawBulletSection("Points forts", localResult.insights.strengths, [52, 211, 153]);
      drawBulletSection("Points de vigilance", localResult.insights.watchouts, [251, 191, 36]);
      const topThemes = themeRows.slice(0, 3).map((theme) => `${theme.title} (${theme.score}%)`);
      const focusThemes = [...themeRows]
        .reverse()
        .slice(0, 3)
        .map((theme) => `${theme.title} (${theme.score}%)`);
      drawWorkshopThemesSection(localResult.insights.workshopQuestions, topThemes, focusThemes);

      const stamp = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}`;
      const filename = `retro-party-radar-individuel-${(roomCode || "session").toLowerCase()}-${stamp}.pdf`;
      pdf.save(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'export PDF individuel.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleStartSession = async () => {
    if (!roomCode || !participantId || !isHost) return;
    setLoading(true);
    setError(null);
    try {
      await api.radarStartSession(roomCode, { participantId, hostParticipates });
      await refreshSession(roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const confirmQuitSession = () => {
    persistRadarSession(null);
    if (roomCode) {
      socket.emit(C2S_EVENTS.LEAVE_RADAR_ROOM, { code: roomCode });
    }
    setLeaveDialogOpen(false);
    setSubmitDialogOpen(false);
    setRoomCode(null);
    setParticipantId("");
    setParticipants([]);
    setSessionStatus("lobby");
    setAnswers({});
    setQuestionIndex(0);
    setLocalResult(null);
    setTeamInsights(null);
    setHostParticipates(true);
    setTeamRadar(createNeutralRadar());
    setResultPublished(false);
    if (fromEntry) {
      navigate("/?stage=entry&experience=agile-radar");
      return;
    }
    navigate("/?stage=select-experience");
  };

  if (authLoading || isRestoringSession) {
    return (
      <div
        className="relative flex min-h-svh w-full items-start justify-center px-4 pb-12 pt-6"
        style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
      >
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)",
          }}
        />
        <Card className="relative z-10 flex w-full max-w-xl flex-col gap-2 rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">Radar Party</p>
          <h2 className="text-lg font-semibold text-slate-100">Reconnexion en cours</h2>
          <p className="text-sm text-slate-400">
            Nous restaurons ta session pour reprendre la partie.
          </p>
        </Card>
      </div>
    );
  }

  if (stage === "lobby") {
    if (!roomCode && showOnlineOnboarding) {
      return (
        <OnlineOnboardingScreen
          connected={true}
          brandLabel="Radar Party"
          accentColor={RADAR_ACCENT.color}
          accentGlow={RADAR_ACCENT.ambientGlow}
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialStep={onboardingInitialStep}
          overallStepStart={3}
          overallStepTotal={5}
          onSubmit={({ name, avatar }) => {
            setProfile({ name, avatar });
            setShowOnlineOnboarding(false);
            setOnboardingInitialStep(1);
            setAutoSubmitKey(Date.now());
          }}
          onBack={() => {
            if (fromEntry) {
              navigate("/?stage=entry&experience=agile-radar");
              return;
            }
            navigate("/?stage=select-experience");
          }}
        />
      );
    }

    return (
      <div>
        {error ? (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}
        <OnlineLobbyScreen
          connected={true}
          brandLabel="Radar Party"
          accentColor={RADAR_ACCENT.color}
          accentGlow={RADAR_ACCENT.ambientGlow}
          roomCode={roomCode}
          lobbyPlayers={participants.map((participant) => ({
            name: participant.displayName,
            avatar: participant.avatar,
            isHost: participant.isHost,
            connected: true,
          }))}
          onHost={handleHost}
          onJoin={handleJoin}
          onLeave={handleLeaveLobby}
          onEditProfile={() => {
            setOnboardingInitialStep(2);
            setShowOnlineOnboarding(true);
          }}
          onStartGame={() => {
            void handleStartSession();
          }}
          canStart={Boolean(roomCode) && isHost}
          initialName={profile.name || initialName || connectedDisplayName || undefined}
          initialAvatar={profile.avatar}
          initialMode={initialMode}
          initialCode={initialCode}
          autoSubmitKey={autoSubmitKey}
          stepLabel="Etape 5/5"
          stepCurrent={5}
          stepTotal={5}
          shellStyle="transparent"
          hideRoundsControl
          joinOnly={initialMode === "join" && !!initialCode}
          hostSetupPanel={
            roomCode && isHost ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.1em] text-emerald-200/90">
                  Participation de l'hote
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-slate-950/35 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100">
                      {hostParticipates
                        ? "L'hote repond au questionnaire"
                        : "L'hote n'a pas besoin de repondre"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-300">
                      {hostParticipates
                        ? "L'hote voit le questionnaire et peut aussi suivre l'avancement."
                        : "L'hote ouvre directement le menu de suivi quand la partie demarre."}
                    </p>
                  </div>
                  <Switch
                    checked={hostParticipates}
                    onCheckedChange={setHostParticipates}
                    aria-label="L'hote participe au questionnaire"
                    className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-700"
                  />
                </div>
              </div>
            ) : null
          }
          titleWhenNoRoomOverride="Creer ou rejoindre une session Radar"
        />
      </div>
    );
  }

  const resultToShow = localResult;
  const individualRecommendations = resultToShow
    ? buildIndividualRecommendations(resultToShow.radar).cards
    : [];
  const canExportIndividualPdf = stage === "individual" && Boolean(resultToShow);
  const canExportTeamPdf = stage === "team-radar" && isHost;
  const hasRadarStickyFooter = stage === "individual" || stage === "team-radar";

  return (
    <div
      className={cn(
        "relative flex min-h-svh w-full items-start justify-center px-4 pt-4 sm:pt-6",
        hasRadarStickyFooter
          ? "pb-28 sm:pb-32"
          : stage === "questionnaire"
            ? "pb-4 sm:pb-12"
            : "pb-12",
      )}
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)",
        }}
      />

      <Card
        className={cn(
          "relative z-10 flex w-full max-w-5xl min-w-0 flex-col",
          stage === "questionnaire" ? "gap-3 p-3 sm:gap-4 sm:p-8" : "gap-4 p-4 sm:p-8",
        )}
      >
        <header className="text-xs uppercase tracking-[0.14em] text-emerald-300/80">
          <div className="flex items-start justify-between gap-2 sm:hidden">
            <span className="min-w-0 truncate pr-2">Retro Party - Radar Party</span>
            {roomCode ? (
              <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-emerald-100">
                <span className="uppercase text-emerald-200/85">Code</span>
                <span>{roomCode}</span>
              </div>
            ) : null}
          </div>
          {canExportIndividualPdf || canExportTeamPdf ? (
            <div className="mt-2 flex justify-end sm:hidden">
              <SecondaryButton
                onClick={() =>
                  void (canExportTeamPdf ? handleExportTeamPdf() : handleExportIndividualPdf())
                }
                disabled={isExportingPdf}
                className="h-8 rounded-full border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-semibold tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/18"
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" />
                  {isExportingPdf
                    ? "Export PDF..."
                    : canExportTeamPdf
                      ? "Exporter PDF equipe"
                      : "Exporter PDF"}
                </span>
              </SecondaryButton>
            </div>
          ) : null}
          <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
            <span>Retro Party - Radar Party</span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canExportIndividualPdf || canExportTeamPdf ? (
                <SecondaryButton
                  onClick={() =>
                    void (canExportTeamPdf ? handleExportTeamPdf() : handleExportIndividualPdf())
                  }
                  disabled={isExportingPdf}
                  className="h-8 rounded-full border-emerald-500/25 bg-emerald-500/10 px-3 text-[11px] font-semibold tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/18"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FileDown className="h-3.5 w-3.5" />
                    {isExportingPdf
                      ? "Export PDF..."
                      : canExportTeamPdf
                        ? "Exporter PDF equipe"
                        : "Exporter PDF"}
                  </span>
                </SecondaryButton>
              ) : null}
              {roomCode ? (
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-emerald-100">
                  <span className="uppercase text-emerald-200/85">Code</span>
                  <span className="truncate">{roomCode}</span>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {stage === "questionnaire" ? (
          <section
            className={cn(
              "min-w-0 rounded-3xl p-3 sm:p-5",
              APP_SHELL_SURFACE_SOFT,
              "flex min-h-0 flex-col",
            )}
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Question {questionIndex + 1} / {RADAR_QUESTIONS.length}
              </span>
              <div className="hidden sm:flex items-center gap-2">
                <span>{completionCount} reponses enregistrees</span>
              </div>
              <div className="flex items-center gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={goToPreviousQuestion}
                  disabled={questionIndex === 0}
                  aria-label="Question precedente"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-slate-900/70 text-emerald-200 transition disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToNextQuestion}
                  aria-label="Question suivante"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-slate-900/70 text-emerald-200 transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-300 sm:hidden">
              {completionCount} reponses enregistrees
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
              <div
                className="h-full rounded bg-emerald-400/90 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-4 rounded-3xl border border-emerald-500/15 bg-slate-950/45 p-4 sm:mt-6">
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">
                {AXIS_FR[currentQuestion.dimension]}
              </p>
              <div className="mt-2 min-h-[5.5rem] max-h-[5.5rem] overflow-y-auto pr-1 sm:mt-3 sm:min-h-0 sm:max-h-none sm:overflow-visible sm:pr-0">
                <p className="break-words text-lg text-slate-100">{currentQuestion.text}</p>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-emerald-500/15 bg-slate-950/45 px-3 py-3 sm:mt-6 sm:px-6 sm:py-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-red-300">Pas du tout d'accord</span>
                <span className="font-medium text-emerald-300">Tout a fait d'accord</span>
              </div>
              <p className="mt-2 min-h-4 text-xs text-slate-300">
                {isCurrentAnswered
                  ? `Reponse enregistree: ${answerLabels[(currentAnswer as number) - 1]}`
                  : "Selectionne une reponse pour cette question."}
              </p>
              <div className="mt-3 grid grid-cols-5 gap-1 sm:mt-4 sm:gap-3">
                {likertScale.map((item) => (
                  <button
                    key={item.uiId}
                    type="button"
                    onClick={() => handleSelectAnswer(item.score)}
                    title={answerLabels[item.score - 1]}
                    aria-label={answerLabels[item.score - 1]}
                    className="group inline-flex min-w-0 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "rounded-full border-4 transition-transform duration-150 group-hover:scale-105",
                        item.size,
                        likertColorByScore[item.score],
                        currentAnswer === item.score
                          ? "scale-105 ring-2 ring-emerald-300/80 ring-offset-2 ring-offset-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
                          : "opacity-80",
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[9px] text-slate-300 sm:mt-4 sm:text-xs">
                {likertScale.map((item) => (
                  <span
                    key={`${item.uiId}-label`}
                    className={cn(
                      "block break-words",
                      currentAnswer === item.score ? "font-semibold text-emerald-200" : undefined,
                    )}
                  >
                    {answerLabels[item.score - 1]}
                  </span>
                ))}
              </div>
            </div>

            <p
              className={cn(
                "mt-3 min-h-4 text-xs",
                questionNavMessage ? "text-amber-200" : "text-transparent",
              )}
            >
              {questionNavMessage ?? "."}
            </p>

            <div className="mt-2 flex items-center gap-2 sm:hidden">
              {isHost && roomCode && sessionStatus === "live" ? (
                <SecondaryButton
                  className="h-9 px-3 text-xs"
                  onClick={() => setStage("team-progress")}
                >
                  Progression
                </SecondaryButton>
              ) : null}
            </div>

            <div className="mt-6 hidden flex-wrap justify-between gap-2 sm:flex">
              <SecondaryButton disabled={questionIndex === 0} onClick={goToPreviousQuestion}>
                Precedent
              </SecondaryButton>
              <SecondaryButton onClick={goToNextQuestion}>Suivante</SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "individual" && resultToShow ? (
          <section className="grid min-w-0 gap-4">
            <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
              <h3 className="text-base font-semibold text-emerald-200">Resume individuel</h3>
              <p className="mt-2 break-words text-sm text-slate-200">
                {resultToShow.insights.summary}
              </p>
            </Card>

            <div ref={individualRadarCaptureRef} className="min-w-0">
              <RadarChartCard
                title="Radar individuel"
                subtitle="Projection sur les 10 themes (score de 0 a 100)"
                radar={resultToShow.radar}
                detailScores={resultToShow.polesPercent}
              />
            </div>

            {renderThemeCardsBlock(resultToShow.radar)}

            <IndividualRecommendationsSection cards={individualRecommendations} />

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">Points forts potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.strengths.map((item) => (
                    <li key={item} className="break-words">
                      - {item}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">
                  Points de vigilance potentiels
                </h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.watchouts.map((item) => (
                    <li key={item} className="break-words">
                      - {item}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-emerald-200">Questions a se poser</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.workshopQuestions.map((item) => (
                    <li key={item} className="break-words">
                      - {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </section>
        ) : null}

        {stage === "team-radar" ? (
          <section className="grid min-w-0 gap-4">
            <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-emerald-200">Resume equipe</h3>
                  <p className="mt-1 break-words text-sm text-slate-200">
                    {resolvedTeamInsights.summary}
                  </p>
                </div>
              </div>
            </Card>

            <div ref={teamRadarCaptureRef} className="min-w-0">
              <RadarChartCard
                title="Radar equipe"
                subtitle="Moyenne des themes de l'equipe (mise a jour temps reel)"
                radar={resultToShow?.radar ?? teamRadar}
                detailScores={resultToShow ? resultToShow.polesPercent : teamDetailScores}
                compareRadar={resultToShow ? teamRadar : undefined}
                compareDetailScores={resultToShow ? teamDetailScores : undefined}
                primaryLabel={resultToShow ? "Mon profil" : "Equipe"}
                compareLabel="Equipe"
              />
            </div>

            {renderThemeCardsBlock(teamRadar, {
              title: "Cartes thematiques equipe",
              helperText: "Lecture par theme basee sur la moyenne des reponses de l'equipe.",
            })}

            <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-emerald-200">
                Axes homogenes et axes polarises
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-200">Homogenes</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.homogeneousAxes ?? []).length > 0 ? (
                      (teamInsights?.homogeneousAxes ?? []).map((item) => (
                        <li key={item} className="break-words">
                          - {item}
                        </li>
                      ))
                    ) : (
                      <li>Aucun axe fortement homogene pour le moment.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-amber-200">Polarises</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.polarizedAxes ?? []).length > 0 ? (
                      (teamInsights?.polarizedAxes ?? []).map((item) => (
                        <li key={item} className="break-words">
                          - {item}
                        </li>
                      ))
                    ) : (
                      <li>Aucun axe de divergence forte (&gt; 25 points).</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          </section>
        ) : null}

        {stage === "team-progress" ? (
          <section className="grid min-w-0 gap-4">
            <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-emerald-200">
                    Suivi d'avancement equipe
                  </h3>
                  <p className="break-words text-sm text-slate-200">
                    Code de session: {roomCode || "-"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    Progression globale ({completedResponders}/{expectedResponders} participants
                    attendus)
                  </span>
                  <span>{teamCompletionPct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
                  <div
                    className="h-full rounded bg-emerald-400/90 transition-all duration-300"
                    style={{ width: `${teamCompletionPct}%` }}
                  />
                </div>
                {!hostParticipates ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Configuration active: l'hote ne repond pas au questionnaire.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card className="rounded-3xl border-emerald-500/20 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-emerald-200">Progression par joueur</h4>
              <div className="mt-3 space-y-3">
                {progressRows.map((row) => (
                  <div
                    key={row.participant.id}
                    className="rounded-2xl border border-emerald-500/15 bg-slate-900/45 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-slate-950/65 text-lg">
                          {AVATARS[row.participant.avatar] ?? "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-100">
                            {row.participant.displayName}
                            {row.participant.isHost ? " (hote)" : ""}
                          </p>
                          <p className="text-xs text-slate-300">
                            {row.exempted
                              ? "Ne participe pas au questionnaire"
                              : row.participant.submittedAt
                                ? "Questionnaire termine"
                                : `${row.answered}/${row.total} reponses`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-emerald-200">
                        {row.exempted ? "N/A" : `${row.progressPct}%`}
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
                      <div
                        className={cn(
                          "h-full rounded transition-all duration-300",
                          row.exempted
                            ? "bg-slate-600/70"
                            : row.participant.submittedAt
                              ? "bg-emerald-400/90"
                              : "bg-emerald-400/90",
                        )}
                        style={{ width: `${row.exempted ? 100 : row.progressPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex w-full justify-start">
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={() => setStage("team-radar")}>
                  Radar equipe
                </SecondaryButton>
                {canResumeHostQuestionnaire ? (
                  <SecondaryButton onClick={() => setStage("questionnaire")}>
                    Reprendre le questionnaire
                  </SecondaryButton>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {stage === "questionnaire" ? (
          <div className="hidden w-full flex-wrap items-center gap-2 sm:flex">
            <div className="flex flex-wrap gap-2">
              {isHost && roomCode && sessionStatus === "live" ? (
                <SecondaryButton onClick={() => setStage("team-progress")}>
                  Progression
                </SecondaryButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      {hasRadarStickyFooter ? (
        <>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
            <Card className="pointer-events-auto mx-auto w-full max-w-5xl border-emerald-500/25 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_8px_28px_rgba(2,6,23,0.55)]">
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {stage === "individual" ? (
                    <SecondaryButton onClick={submitToSession} disabled={!canPublish || loading}>
                      Radar equipe
                    </SecondaryButton>
                  ) : null}
                  {stage === "team-radar" && resultToShow ? (
                    <SecondaryButton onClick={() => setStage("individual")}>
                      Mon radar
                    </SecondaryButton>
                  ) : null}
                  {isHost && roomCode && sessionStatus === "live" ? (
                    <SecondaryButton onClick={() => setStage("team-progress")}>
                      Progression
                    </SecondaryButton>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
            <Card className="pointer-events-auto mx-auto w-full max-w-5xl border-cyan-300/40 bg-slate-950/92 p-2.5 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
              <div className="grid grid-cols-2 gap-2">
                {stage === "individual" ? (
                  <SecondaryButton
                    className="h-10 px-2 text-[11px]"
                    onClick={submitToSession}
                    disabled={!canPublish || loading}
                  >
                    Radar equipe
                  </SecondaryButton>
                ) : (
                  <SecondaryButton
                    className="h-10 px-2 text-[11px]"
                    onClick={() => setStage("individual")}
                    disabled={!resultToShow}
                  >
                    Mon radar
                  </SecondaryButton>
                )}
                {isHost && roomCode && sessionStatus === "live" ? (
                  <SecondaryButton
                    className="h-10 px-2 text-[11px]"
                    onClick={() => setStage("team-progress")}
                  >
                    Progression
                  </SecondaryButton>
                ) : (
                  <SecondaryButton
                    className="h-10 px-2 text-[11px] opacity-0 pointer-events-none"
                    aria-hidden
                  >
                    Progression
                  </SecondaryButton>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className={cn(RADAR_DIALOG, "max-w-md")}>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base uppercase tracking-[0.08em] text-emerald-200">
              Quitter Radar Party ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              Tu vas quitter la session en cours et revenir a la selection des experiences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-emerald-200")}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")}
              onClick={confirmQuitSession}
            >
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent className={cn(RADAR_DIALOG, "max-w-md")}>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base uppercase tracking-[0.08em] text-emerald-200">
              Valider le questionnaire ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              Tu vas finaliser tes reponses et acceder a ton radar individuel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel
              className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-emerald-200")}
            >
              Continuer a verifier
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn("h-11 w-full rounded-xl")}
              onClick={finalizeQuestionnaire}
            >
              Valider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RadarPartyPage;
