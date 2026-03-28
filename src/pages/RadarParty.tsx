import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RefreshCw, MessageSquareText } from "lucide-react";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { APP_SHELL_SURFACE_SOFT } from "@/lib/uiTokens";
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

type Stage = "lobby" | "questionnaire" | "individual" | "team-radar" | "workshop";

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

const AXIS_ORDER: Array<keyof RadarAxisValues> = ["collaboration", "product", "decision", "organization"];
const AXIS_FR: Record<keyof RadarAxisValues, string> = {
  collaboration: "Collaboration",
  product: "Approche produit",
  decision: "Decision",
  organization: "Organisation",
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
    collaboration: 50,
    product: 50,
    decision: 50,
    organization: 50,
  });
  const [teamInsights, setTeamInsights] = useState<RadarTeamInsights | null>(null);

  const currentQuestion = RADAR_QUESTIONS[questionIndex];
  const progressPct = Math.round(((questionIndex + 1) / RADAR_QUESTIONS.length) * 100);

  const completionCount = useMemo(
    () => RADAR_QUESTIONS.filter((question) => Number.isFinite(answers[question.id])).length,
    [answers]
  );

  const canPublish = Boolean(roomCode && participantId && localResult);

  const refreshSession = async (codeArg?: string) => {
    const code = (codeArg ?? roomCode ?? "").trim().toUpperCase();
    if (!code) return;
    const response = await api.radarGetSession(code);
    setRoomCode(response.session.code);
    setParticipants(response.participants);

    const memberRadars = response.participants
      .map((participant) => participant.result?.radar)
      .filter((radar): radar is RadarAxisValues => Boolean(radar));
    const nextTeamRadar = response.team?.radar ?? computeTeamAverageRadar(memberRadars);
    const nextTeamInsights = response.team?.insights ?? emptyTeamInsights(nextTeamRadar, response.participants);
    setTeamRadar(nextTeamRadar);
    setTeamInsights(nextTeamInsights);
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
      setTeamInsights(null);
      setTeamRadar({ collaboration: 50, product: 50, decision: 50, organization: 50 });
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
            setAnswers({});
            setQuestionIndex(0);
            setLocalResult(null);
            setStage("questionnaire");
          }}
          canStart={Boolean(roomCode)}
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
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-12 pt-4 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex w-full max-w-5xl flex-col gap-4 p-5 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-cyan-200/80">
          <span>Retro Party - Radar Party</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">Module Agile</span>
        </header>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {stage === "questionnaire" ? (
          <section className={cn("rounded-xl p-5", APP_SHELL_SURFACE_SOFT)}>
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
              <p className="mt-3 text-lg text-slate-100">{currentQuestion.text}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelectAnswer(value)}
                  className="rounded-lg border border-cyan-300/30 bg-slate-950/45 p-3 text-left transition hover:border-cyan-300/55 hover:bg-cyan-500/10"
                >
                  <div className="text-base font-semibold text-cyan-100">{value}</div>
                  <div className="mt-1 text-xs text-slate-300">{answerLabels[value - 1]}</div>
                </button>
              ))}
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
          <section className="grid gap-4">
            <RadarChartCard
              title="Radar individuel"
              subtitle="Convention: collaboration = % team, produit = % qualite, decision = % data, organisation = % structure"
              radar={resultToShow.radar}
            />

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h3 className="text-base font-semibold text-cyan-100">Resume individuel</h3>
              <p className="mt-2 text-sm text-slate-200">{resultToShow.insights.summary}</p>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points forts potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.strengths.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Points de vigilance potentiels</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.watchouts.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </Card>
              <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
                <h4 className="text-sm font-semibold text-cyan-100">Questions a se poser</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {resultToShow.insights.workshopQuestions.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={submitToSession} disabled={!canPublish || loading}>
                Publier mon profil dans la session
              </PrimaryButton>
              <SecondaryButton onClick={() => setStage("questionnaire")}>Repasser le questionnaire</SecondaryButton>
              <SecondaryButton onClick={() => setStage("lobby")}>Retour au lobby</SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "team-radar" ? (
          <section className="grid gap-4">
            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-cyan-100">Session equipe</h3>
                  <p className="text-sm text-slate-200">Code de session: {roomCode || "-"}</p>
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
              subtitle="Moyenne des radars individuels soumis"
              radar={teamRadar}
            />

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Vue comparaison equipe</h4>
              <div className="mt-3 overflow-auto">
                <table className="min-w-full text-left text-xs text-slate-200">
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
                        <td className="py-2 pr-3">{participant.displayName}</td>
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
              <p className="mt-2 text-sm text-slate-200">
                {(teamInsights ?? emptyTeamInsights(teamRadar, participants)).summary}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-200">Homogenes</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.homogeneousAxes ?? []).length > 0 ? (
                      (teamInsights?.homogeneousAxes ?? []).map((item) => <li key={item}>- {item}</li>)
                    ) : (
                      <li>Aucun axe fortement homogene pour le moment.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-amber-200">Polarises</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-200">
                    {(teamInsights?.polarizedAxes ?? []).length > 0 ? (
                      (teamInsights?.polarizedAxes ?? []).map((item) => <li key={item}>- {item}</li>)
                    ) : (
                      <li>Aucun axe de divergence forte (&gt; 25 points).</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={() => setStage("workshop")}>Voir insights atelier</PrimaryButton>
              <SecondaryButton onClick={() => setStage("lobby")}>Retour lobby</SecondaryButton>
            </div>
          </section>
        ) : null}

        {stage === "workshop" ? (
          <section className="grid gap-4">
            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-cyan-200" />
                <h3 className="text-base font-semibold text-cyan-100">Insights atelier</h3>
              </div>
              <p className="mt-2 text-sm text-slate-200">{teamInsights?.summary ?? "Aucune donnee equipe disponible."}</p>
            </Card>

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Ecarts par axe (min / max)</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {(teamInsights?.spreads ?? []).map((spread) => (
                  <li key={spread.axis}>
                    {AXIS_FR[spread.axis]}: min {spread.min}, max {spread.max}, ecart {spread.spread}
                    {spread.polarized ? " (divergence forte)" : ""}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="rounded-xl border-cyan-300/30 bg-slate-950/45 p-4">
              <h4 className="text-sm font-semibold text-cyan-100">Questions de discussion</h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {(teamInsights?.workshopQuestions ?? []).map((question) => (
                  <li key={question}>- {question}</li>
                ))}
              </ul>
            </Card>

            <div className="flex flex-wrap gap-2">
              <SecondaryButton onClick={() => setStage("team-radar")}>Retour radar equipe</SecondaryButton>
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
    </div>
  );
};

export default RadarPartyPage;
