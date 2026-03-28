import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  APP_SHELL_SURFACE_SOFT,
  CTA_NEON_DANGER,
  CTA_NEON_SECONDARY_SUBTLE,
  GAME_DIALOG_CONTENT,
} from "@/lib/uiTokens";
import { RadarChartCard } from "@/components/radar-party/RadarChartCard";
import { RADAR_QUESTIONS } from "@/features/radarParty/questions";
import { buildIndividualInsights, buildTeamInsights } from "@/features/radarParty/insights";
import {
  computeRadarScores,
  computeTeamAverageRadar,
  type RadarAnswers,
  type RadarAxisValues,
} from "@/features/radarParty/scoring";
import { api, type RadarParticipant, type RadarTeamInsights } from "@/net/api";
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

type Stage = "lobby" | "questionnaire" | "individual" | "team-radar";

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
  { uiId: "agree-strong", score: 5, size: "h-12 w-12 sm:h-16 sm:w-16", side: "agree" as const },
  { uiId: "agree", score: 4, size: "h-10 w-10 sm:h-14 sm:w-14", side: "agree" as const },
  { uiId: "neutral", score: 3, size: "h-8 w-8 sm:h-11 sm:w-11", side: "neutral" as const },
  { uiId: "disagree", score: 2, size: "h-10 w-10 sm:h-14 sm:w-14", side: "disagree" as const },
  { uiId: "disagree-strong", score: 1, size: "h-12 w-12 sm:h-16 sm:w-16", side: "disagree" as const },
] as const;

const AXIS_ORDER: Array<keyof RadarAxisValues> = ["visionStrategy", "planning", "execution", "mindsetBehaviors"];
const AXIS_FR: Record<keyof RadarAxisValues, string> = {
  visionStrategy: "Vision & Strategie",
  planning: "Planification",
  execution: "Execution",
  mindsetBehaviors: "Mindset",
};

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

  const [teamRadar, setTeamRadar] = useState<RadarAxisValues>({
    visionStrategy: 50,
    planning: 50,
    execution: 50,
    mindsetBehaviors: 50,
  });
  const [teamInsights, setTeamInsights] = useState<RadarTeamInsights | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"lobby" | "started">("lobby");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

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

  const refreshSession = async (codeArg?: string) => {
    const code = (codeArg ?? roomCode ?? "").trim().toUpperCase();
    if (!code) return;
    const response = await api.radarGetSession(code);
    setRoomCode(response.session.code);
    setSessionStatus(response.session.status);
    setParticipants(response.participants);

    const memberRadars = response.participants
      .map((participant) => participant.result?.radar)
      .filter((radar): radar is RadarAxisValues => Boolean(radar));
    const nextTeamRadar = response.team?.radar ?? computeTeamAverageRadar(memberRadars);
    const nextTeamInsights = response.team?.insights ?? emptyTeamInsights(nextTeamRadar, response.participants);
    setTeamRadar(nextTeamRadar);
    setTeamInsights(nextTeamInsights);

    if (response.session.status === "started" && stage === "lobby") {
      setAnswers({});
      setQuestionIndex(0);
      setLocalResult(null);
      setStage("questionnaire");
    }
  };

  useEffect(() => {
    if (!roomCode || stage !== "lobby") return;
    const interval = window.setInterval(() => {
      void refreshSession(roomCode);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [roomCode, stage]);

  const computeLocalResult = (allAnswers: RadarAnswers) => {
    const scoring = computeRadarScores(allAnswers);
    const insights = buildIndividualInsights(scoring.radar);
    const result = { radar: scoring.radar, polesPercent: scoring.polesPercent, insights };
    setLocalResult(result);
    return result;
  };

  const handleSelectAnswer = (value: number) => {
    const nextAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(nextAnswers);

    if (questionIndex === RADAR_QUESTIONS.length - 1) {
      computeLocalResult(nextAnswers);
      setStage("individual");
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
      setRoomCode(null);
      setParticipants([]);
      setParticipantId("");
      setSessionStatus("lobby");
      setTeamInsights(null);
      setTeamRadar({ visionStrategy: 50, planning: 50, execution: 50, mindsetBehaviors: 50 });
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
    setLoading(true);
    setError(null);
    try {
      const response = await api.radarSubmitAnswers(roomCode, { participantId, answers });
      setTeamRadar(response.team.radar);
      setTeamInsights(response.team.insights);
      await refreshSession(roomCode);
      setStage("team-radar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!roomCode || !participantId || !isHost) return;
    setLoading(true);
    setError(null);
    try {
      await api.radarStartSession(roomCode, { participantId });
      await refreshSession(roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  const confirmQuitSession = () => {
    setLeaveDialogOpen(false);
    setRoomCode(null);
    setParticipantId("");
    setParticipants([]);
    setSessionStatus("lobby");
    setAnswers({});
    setQuestionIndex(0);
    setLocalResult(null);
    setTeamInsights(null);
    setTeamRadar({ visionStrategy: 50, planning: 50, execution: 50, mindsetBehaviors: 50 });
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
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
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
          titleWhenNoRoomOverride="Creer ou rejoindre une session Radar"
        />
      </div>
    );
  }

  const resultToShow = localResult;

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-x-hidden px-4 pb-12 pt-4 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex w-full max-w-5xl min-w-0 flex-col gap-4 overflow-x-hidden p-4 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-cyan-200/80">
          <span>Retro Party - Radar Party</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">Module Agile</span>
        </header>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {stage === "questionnaire" ? (
          <section className={cn("min-w-0 overflow-x-hidden rounded-xl p-4 sm:p-5", APP_SHELL_SURFACE_SOFT)}>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                Question {questionIndex + 1} / {RADAR_QUESTIONS.length}
              </span>
              <span>{completionCount} reponses enregistrees</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-slate-900/80">
              <div className="h-full rounded bg-cyan-400/90 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="mt-6 rounded-lg border border-cyan-300/25 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-cyan-200/80">{AXIS_FR[currentQuestion.dimension]}</p>
              <p className="mt-3 break-words text-lg text-slate-100">{currentQuestion.text}</p>
            </div>

            <div className="mt-6 rounded-lg border border-cyan-300/20 bg-slate-950/45 px-3 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-emerald-300">D'accord</span>
                <span className="font-medium text-fuchsia-300">En desaccord</span>
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
                        item.side === "agree" && "border-emerald-400/90 bg-emerald-500/10",
                        item.side === "neutral" && "border-slate-400/80 bg-slate-500/10",
                        item.side === "disagree" && "border-fuchsia-400/90 bg-fuchsia-500/10"
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
          <section className="grid min-w-0 gap-4 overflow-x-hidden">
            <RadarChartCard
              title="Radar individuel"
              subtitle="Axe moyen + sous-categories integrees (0 a 100)"
              radar={resultToShow.radar}
              detailScores={resultToShow.polesPercent}
            />

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h3 className="text-base font-semibold text-cyan-100">Resume individuel</h3>
              <p className="mt-2 break-words text-sm text-slate-200">{resultToShow.insights.summary}</p>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points forts potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.strengths.map((item) => (
                    <li key={item} className="break-words">- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points de vigilance potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.watchouts.map((item) => (
                    <li key={item} className="break-words">- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
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
          <section className="grid min-w-0 gap-4 overflow-x-hidden">
            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-cyan-100">Session equipe</h3>
                  <p className="break-words text-sm text-slate-200">Code de session: {roomCode || "-"}</p>
                </div>
                <div className="flex gap-2">
                  <SecondaryButton disabled={loading} onClick={() => refreshSession()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualiser
                  </SecondaryButton>
                </div>
              </div>
            </Card>

            <RadarChartCard
              title="Radar equipe"
              subtitle="Moyenne des axes + sous-categories equipe"
              radar={teamRadar}
              detailScores={teamDetailScores}
            />

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Vue comparaison equipe</h4>
              <div className="mt-3 max-w-full overflow-x-auto">
                <table className="w-full table-fixed text-left text-xs text-slate-200">
                  <thead>
                    <tr className="border-b border-cyan-300/20 text-cyan-100">
                      <th className="py-2 pr-3">Participant</th>
                      {AXIS_ORDER.map((axis) => (
                        <th key={axis} className="py-2 pr-3">{AXIS_FR[axis]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={participant.id} className="border-b border-cyan-300/10">
                        <td className="break-words py-2 pr-3">{participant.displayName}</td>
                        {AXIS_ORDER.map((axis) => (
                          <td key={axis} className="py-2 pr-3">
                            {participant.result?.radar ? participant.result.radar[axis] : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
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

            <div className="flex flex-wrap gap-2">
              <SecondaryButton className={cn(CTA_NEON_DANGER)} onClick={() => setLeaveDialogOpen(true)}>
                Quitter
              </SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "questionnaire" ? (
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setStage("individual")} disabled={completionCount < RADAR_QUESTIONS.length}>
              Voir mon resultat
            </PrimaryButton>
            <SecondaryButton onClick={() => setStage("lobby")}>Retour lobby</SecondaryButton>
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
