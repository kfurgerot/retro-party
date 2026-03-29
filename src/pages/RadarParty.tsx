import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AVATARS } from "@/types/game";
import {
  APP_SHELL_SURFACE_SOFT,
  CTA_NEON_DANGER,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
} from "@/lib/uiTokens";
import { RadarChartCard } from "@/components/radar-party/RadarChartCard";
import {
  RADAR_DIMENSION_LABELS,
  RADAR_QUESTIONS,
} from "@/features/radarParty/questions";
import { buildIndividualInsights, buildTeamInsights } from "@/features/radarParty/insights";
import {
  createNeutralRadar,
  computeRadarScores,
  computeTeamAverageRadar,
  type RadarAnswers,
  type RadarAxisValues,
} from "@/features/radarParty/scoring";
import { api, type RadarParticipant, type RadarTeamInsights } from "@/net/api";
import { socket } from "@/net/socket";
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

type LocalResult = {
  radar: RadarAxisValues;
  polesPercent: ReturnType<typeof computeRadarScores>["polesPercent"];
  insights: ReturnType<typeof buildIndividualInsights>;
};

const answerLabels = [
  "Pas du tout d'accord",
  "Plutot pas d'accord",
  "Neutre",
  "Plutot d'accord",
  "Tout a fait d'accord",
];
const likertScale = [
  { uiId: "disagree-strong", score: 1, size: "h-12 w-12 sm:h-16 sm:w-16" },
  { uiId: "disagree", score: 2, size: "h-10 w-10 sm:h-14 sm:w-14" },
  { uiId: "neutral", score: 3, size: "h-8 w-8 sm:h-11 sm:w-11" },
  { uiId: "agree", score: 4, size: "h-10 w-10 sm:h-14 sm:w-14" },
  { uiId: "agree-strong", score: 5, size: "h-12 w-12 sm:h-16 sm:w-16" },
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

function emptyTeamInsights(teamRadar: RadarAxisValues, participants: RadarParticipant[]): RadarTeamInsights {
  return buildTeamInsights(
    teamRadar,
    participants
      .map((participant) => participant.result?.radar)
      .filter((radar): radar is RadarAxisValues => Boolean(radar))
  );
}

const RadarPartyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialMode = params.get("mode") === "join" ? "join" : "host";
  const fromEntry = params.get("from") === "entry";

  const [stage, setStage] = useState<Stage>("lobby");
  const [answers, setAnswers] = useState<RadarAnswers>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [localResult, setLocalResult] = useState<LocalResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [participants, setParticipants] = useState<RadarParticipant[]>([]);
  const [profile, setProfile] = useState({ name: "", avatar: 0 });
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState(true);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(1);

  const [teamRadar, setTeamRadar] = useState<RadarAxisValues>(createNeutralRadar());
  const [teamInsights, setTeamInsights] = useState<RadarTeamInsights | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"lobby" | "started">("lobby");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [hostParticipates, setHostParticipates] = useState(true);
  const [resultPublished, setResultPublished] = useState(false);
  const publishInFlightRef = useRef(false);

  const currentQuestion = RADAR_QUESTIONS[questionIndex];
  const progressPct = Math.round(((questionIndex + 1) / RADAR_QUESTIONS.length) * 100);

  const completionCount = useMemo(
    () => RADAR_QUESTIONS.filter((question) => Number.isFinite(answers[question.id])).length,
    [answers]
  );

  const canPublish = Boolean(roomCode && participantId && localResult);
  const isHost = useMemo(
    () => participants.some((participant) => participant.id === participantId && participant.isHost),
    [participants, participantId]
  );
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
    [progressRows]
  );
  const completedResponders = useMemo(
    () => progressRows.filter((row) => !row.exempted && row.participant.submittedAt).length,
    [progressRows]
  );
  const teamCompletionPct = expectedResponders > 0 ? Math.round((completedResponders / expectedResponders) * 100) : 0;

  const refreshSession = async (codeArg?: string) => {
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
    const nextTeamInsights = response.team?.insights ?? emptyTeamInsights(nextTeamRadar, response.participants);
    setTeamRadar(nextTeamRadar);
    setTeamInsights(nextTeamInsights);
    const self = response.participants.find((participant) => participant.id === participantId);
    setResultPublished(Boolean(self?.submittedAt));

    if (response.session.status === "started" && stage === "lobby") {
      const shouldOpenProgressMenu = Boolean(self?.isHost) && response.session.hostParticipates === false;
      setAnswers({});
      setQuestionIndex(0);
      setLocalResult(null);
      setResultPublished(false);
      setStage(shouldOpenProgressMenu ? "team-progress" : "questionnaire");
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    const code = roomCode.trim().toUpperCase();
    if (!code) return;

    const canLiveSync = stage === "lobby" || stage === "team-progress" || stage === "team-radar";
    const subscribe = () => socket.emit("join_radar_room", { code });

    const onConnect = () => {
      subscribe();
      if (canLiveSync) {
        void refreshSession(code);
      }
    };
    const onRadarSessionUpdate = (payload: { code?: string }) => {
      const updatedCode = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
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
    socket.on("radar_session_update", onRadarSessionUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("online", onWindowFocus);

    return () => {
      socket.off("connect", onConnect);
      socket.off("radar_session_update", onRadarSessionUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("online", onWindowFocus);
      socket.emit("leave_radar_room", { code });
    };
  }, [roomCode, stage, participantId]);

  useEffect(() => {
    if (!roomCode || (stage !== "lobby" && stage !== "team-progress" && stage !== "team-radar")) return;
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

  const pushProgressUpdate = async (nextAnswers: RadarAnswers) => {
    if (!roomCode || !participantId) return;
    const answeredCount = RADAR_QUESTIONS.filter((question) => Number.isFinite(nextAnswers[question.id])).length;
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
            : participant
        )
      );
    } catch {
      // Keep questionnaire flow resilient if progress sync fails transiently.
    }
  };

  const publishAnswersToSession = async (answersToPublish: RadarAnswers, options?: { silent?: boolean }) => {
    if (!roomCode || !participantId) return false;
    if (publishInFlightRef.current) return false;

    const silent = options?.silent === true;
    publishInFlightRef.current = true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await api.radarSubmitAnswers(roomCode, { participantId, answers: answersToPublish });
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
    void pushProgressUpdate(nextAnswers);

    if (questionIndex === RADAR_QUESTIONS.length - 1) {
      computeLocalResult(nextAnswers);
      setStage("individual");
      void publishAnswersToSession(nextAnswers, { silent: true });
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
      setResultPublished(false);
      setShowOnlineOnboarding(false);
      setStage("lobby");
      await refreshSession(joined.session.code);
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
      setShowOnlineOnboarding(false);
      setResultPublished(false);
      setStage("lobby");
      await refreshSession(joined.session.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    if (roomCode) {
      socket.emit("leave_radar_room", { code: roomCode });
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
    if (roomCode) {
      socket.emit("leave_radar_room", { code: roomCode });
    }
    setLeaveDialogOpen(false);
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

  if (stage === "lobby") {
    if (!roomCode && showOnlineOnboarding) {
      return (
        <OnlineOnboardingScreen
          connected={true}
          brandLabel="Radar Party"
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialStep={onboardingInitialStep}
          overallStepStart={3}
          overallStepTotal={5}
          onSubmit={({ name, avatar }) => {
            setProfile({ name, avatar });
            setShowOnlineOnboarding(false);
            setOnboardingInitialStep(1);
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
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialMode={initialMode}
          autoSubmitKey={0}
          stepLabel="Etape 5/5"
          stepCurrent={5}
          stepTotal={5}
          shellStyle="transparent"
          hideRoundsControl
          hostSetupPanel={
            roomCode && isHost ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.1em] text-cyan-100/90">
                  Participation de l'hote
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/25 bg-slate-950/35 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-cyan-50">
                      {hostParticipates ? "L'hote repond au questionnaire" : "L'hote n'a pas besoin de repondre"}
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
                    className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-slate-700"
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

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center px-4 pb-12 pt-4 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-cyan-200/80">
          <span>Retro Party - Radar Party</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {roomCode ? (
              <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-cyan-50">
                <span className="uppercase text-cyan-100/85">Code</span>
                <span className="truncate">{roomCode}</span>
              </div>
            ) : null}
          </div>
        </header>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {stage === "questionnaire" ? (
          <section className={cn("min-w-0 rounded-3xl p-4 sm:p-5", APP_SHELL_SURFACE_SOFT)}>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Question {questionIndex + 1} / {RADAR_QUESTIONS.length}
              </span>
              <span>{completionCount} reponses enregistrees</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
              <div className="h-full rounded bg-cyan-400/90 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="mt-6 rounded-3xl border border-cyan-300/25 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-cyan-200/80">{AXIS_FR[currentQuestion.dimension]}</p>
              <p className="mt-3 break-words text-lg text-slate-100">{currentQuestion.text}</p>
            </div>

            <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-slate-950/45 px-3 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-red-300">Pas du tout d'accord</span>
                <span className="font-medium text-emerald-300">Tout a fait d'accord</span>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-3">
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
                        likertColorByScore[item.score]
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-5 gap-1 text-center text-[10px] text-slate-300 sm:text-xs">
                {likertScale.map((item) => (
                  <span key={`${item.uiId}-label`} className="block break-words">
                    {answerLabels[item.score - 1]}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <SecondaryButton
                disabled={questionIndex === 0}
                onClick={() => setQuestionIndex((prev) => Math.max(0, prev - 1))}
              >
                Question precedente
              </SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "individual" && resultToShow ? (
          <section className="grid min-w-0 gap-4">
            <RadarChartCard
              title="Radar individuel"
              subtitle="Projection sur les 10 themes (score de 0 a 100)"
              radar={resultToShow.radar}
              detailScores={resultToShow.polesPercent}
            />

            <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h3 className="text-base font-semibold text-cyan-100">Resume individuel</h3>
              <p className="mt-2 break-words text-sm text-slate-200">{resultToShow.insights.summary}</p>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points forts potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.strengths.map((item) => (
                    <li key={item} className="break-words">- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points de vigilance potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.watchouts.map((item) => (
                    <li key={item} className="break-words">- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Questions a se poser</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.workshopQuestions.map((item) => (
                    <li key={item} className="break-words">- {item}</li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={submitToSession} disabled={!canPublish || loading}>
                Comparer avec l'equipe
              </PrimaryButton>
            </div>
          </section>
        ) : null}

        {stage === "team-radar" ? (
          <section className="grid min-w-0 gap-4">
            <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-cyan-100">Session equipe</h3>
                  <p className="break-words text-sm text-slate-200">Code de session: {roomCode || "-"}</p>
                </div>
              </div>
            </Card>

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

            <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Axes homogenes et axes polarises</h4>
              <p className="mt-2 break-words text-sm text-slate-200">
                {(teamInsights ?? emptyTeamInsights(teamRadar, participants)).summary}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-200">Homogenes</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.homogeneousAxes ?? []).length > 0 ? (
                      (teamInsights?.homogeneousAxes ?? []).map((item) => <li key={item} className="break-words">- {item}</li>)
                    ) : (
                      <li>Aucun axe fortement homogene pour le moment.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-amber-200">Polarises</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.polarizedAxes ?? []).length > 0 ? (
                      (teamInsights?.polarizedAxes ?? []).map((item) => <li key={item} className="break-words">- {item}</li>)
                    ) : (
                      <li>Aucun axe de divergence forte (&gt; 25 points).</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex w-full items-center justify-between gap-2">
              {resultToShow ? (
                <SecondaryButton onClick={() => setStage("individual")}>Retour a mon radar</SecondaryButton>
              ) : (
                <span />
              )}
              <SecondaryButton className={cn(CTA_NEON_DANGER)} onClick={() => setLeaveDialogOpen(true)}>
                Quitter
              </SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "team-progress" ? (
          <section className="grid min-w-0 gap-4">
            <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-cyan-100">Suivi d'avancement equipe</h3>
                  <p className="break-words text-sm text-slate-200">Code de session: {roomCode || "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => setStage("team-radar")}>Voir radar equipe</SecondaryButton>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <span>
                    Progression globale ({completedResponders}/{expectedResponders} participants attendus)
                  </span>
                  <span>{teamCompletionPct}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
                  <div className="h-full rounded bg-cyan-400/90 transition-all duration-300" style={{ width: `${teamCompletionPct}%` }} />
                </div>
                {!hostParticipates ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Configuration active: l'hote ne repond pas au questionnaire.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card className="rounded-3xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Progression par joueur</h4>
              <div className="mt-3 space-y-3">
                {progressRows.map((row) => (
                  <div key={row.participant.id} className="rounded-2xl border border-cyan-300/20 bg-slate-900/45 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/30 bg-slate-950/65 text-lg">
                          {AVATARS[row.participant.avatar] ?? "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-cyan-50">
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
                      <span className="text-xs text-cyan-100">{row.exempted ? "N/A" : `${row.progressPct}%`}</span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
                      <div
                        className={cn(
                          "h-full rounded transition-all duration-300",
                          row.exempted ? "bg-slate-600/70" : row.participant.submittedAt ? "bg-emerald-400/90" : "bg-cyan-400/90"
                        )}
                        style={{ width: `${row.exempted ? 100 : row.progressPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {isHost && hostParticipates ? (
              <div className="flex w-full justify-start">
                <SecondaryButton onClick={() => setStage("questionnaire")}>Reprendre le questionnaire</SecondaryButton>
              </div>
            ) : null}
          </section>
        ) : null}

        {stage === "questionnaire" ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {isHost && roomCode && sessionStatus === "started" ? (
                <SecondaryButton onClick={() => setStage("team-progress")}>Suivi equipe</SecondaryButton>
              ) : null}
            </div>
            <SecondaryButton className={cn(CTA_NEON_DANGER)} onClick={() => setLeaveDialogOpen(true)}>
              Quitter
            </SecondaryButton>
          </div>
        ) : null}
      </Card>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent
          className={cn(
            GAME_DIALOG_CONTENT,
            "max-w-md rounded-2xl border-cyan-300/40 p-5 sm:p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_14px_40px_rgba(2,6,23,0.6)]"
          )}
        >
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base uppercase tracking-[0.08em] text-cyan-100">
              Quitter Radar Party ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              Tu vas quitter la session en cours et revenir a la selection des experiences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel className={cn(CTA_NEON_SECONDARY_SUBTLE, "h-11 w-full rounded-xl text-cyan-100")}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction className={cn(CTA_NEON_DANGER, "h-11 w-full rounded-xl")} onClick={confirmQuitSession}>
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RadarPartyPage;
