import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { PlanningPokerReadyScreen } from "@/components/screens/PlanningPokerReadyScreen";
import { PlanningPokerGameScreen } from "@/components/screens/PlanningPokerGameScreen";
import { usePlanningPokerOnlineState } from "@/hooks/usePlanningPokerOnlineState";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { setHostSession } from "@/lib/hostSession";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { fr } from "@/i18n/fr";

const ACCENT = TOOL_ACCENT["planning-poker"];

const cleanDisplayName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 16);

type InitialParams = {
  mode: "host" | "join";
  code: string;
  name: string;
  avatar: number;
  autoSubmit: boolean;
  direct: boolean;
  fromEntry: boolean;
  fresh: boolean;
};

const PlanningPokerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const initialParams = useMemo<InitialParams>(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const code = params.get("code");
    const name = params.get("name");
    const avatar = Number(params.get("avatar"));
    const auto = params.get("auto");
    const from = params.get("from");
    return {
      mode: mode === "join" ? "join" : "host",
      code: code ? code.toUpperCase() : "",
      name: name ? name.trim() : "",
      avatar: Number.isFinite(avatar) ? Math.max(0, Math.floor(avatar)) : 0,
      autoSubmit: auto === "1",
      direct: auto === "1" || !!code,
      fromEntry: from === "entry",
      fresh: params.get("new") === "1",
    };
  }, [location.search]);

  const online = usePlanningPokerOnlineState({
    skipRestore: initialParams.fresh,
    restoreCode: initialParams.mode === "join" ? initialParams.code : null,
  });
  const { leaveRoom } = online;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.key !== "default") return;
    leaveRoom();
    navigate("/?stage=select-experience", { replace: true });
  }, [leaveRoom, location.key, navigate]);

  const connectedDisplayName = cleanDisplayName(user?.displayName || "");
  const [autoSubmitKey, setAutoSubmitKey] = useState<number>(() =>
    initialParams.autoSubmit ? Date.now() : 0,
  );
  const { profile, setProfile } = useProfile(
    "planning-poker",
    initialParams.name || connectedDisplayName || undefined,
    initialParams.avatar,
  );
  const forceProfileBeforeJoin = useMemo(
    () => initialParams.mode === "join" && !!initialParams.code && !initialParams.autoSubmit,
    [initialParams.autoSubmit, initialParams.code, initialParams.mode],
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => forceProfileBeforeJoin || (!profile.name && !initialParams.direct),
  );
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    forceProfileBeforeJoin ? 1 : profile.name ? 2 : 1,
  );
  const [connectedLaunchProfileApplied, setConnectedLaunchProfileApplied] = useState(false);
  const [voteSystem, setVoteSystem] = useState<PlanningPokerVoteSystem>("fibonacci");
  const [role, setRole] = useState<PlanningPokerRole>("player");

  useEffect(() => {
    if (!online.code) {
      setHostSession(null);
      return;
    }
    setHostSession({
      code: online.code,
      moduleId: "planning-poker",
      isHost: online.isHost,
      participantSessionId: online.sessionId,
    });
    return () => setHostSession(null);
  }, [online.code, online.isHost, online.sessionId]);

  useEffect(() => {
    if (connectedLaunchProfileApplied || authLoading) return;
    if (
      !connectedDisplayName ||
      initialParams.mode !== "host" ||
      initialParams.direct ||
      online.code
    ) {
      return;
    }
    setProfile({ name: connectedDisplayName, avatar: profile.avatar });
    setOnboardingInitialStep(2);
    setShowOnboarding(true);
    setConnectedLaunchProfileApplied(true);
  }, [
    authLoading,
    connectedDisplayName,
    connectedLaunchProfileApplied,
    initialParams.direct,
    initialParams.mode,
    online.code,
    profile.avatar,
    setProfile,
  ]);

  const leaveSession = () => {
    online.leaveRoom();
    navigate("/?stage=select-experience");
  };

  if (online.state.phase === "lobby") {
    if (!online.code && showOnboarding) {
      return (
        <OnlineOnboardingScreen
          connected={online.connected}
          brandLabel={fr.planningPoker.gameTitle}
          accentColor={ACCENT.color}
          accentGlow={ACCENT.ambientGlow}
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          initialStep={onboardingInitialStep}
          overallStepStart={3}
          overallStepTotal={5}
          onSubmit={({ name, avatar }) => {
            setProfile({ name, avatar });
            setOnboardingInitialStep(1);
            setShowOnboarding(false);
            setAutoSubmitKey(Date.now());
          }}
          onBack={() => navigate("/")}
        />
      );
    }

    if (!online.code) {
      return (
        <div className="h-full w-full">
          <OnlineLobbyScreen
            connected={online.connected}
            brandLabel={fr.planningPoker.gameTitle}
            accentColor={ACCENT.color}
            accentGlow={ACCENT.ambientGlow}
            roomCode={null}
            lobbyPlayers={[]}
            onHost={(name, avatar) => online.createRoom(name, avatar, "player", voteSystem)}
            onJoin={(code, name, avatar) => online.joinRoom(code, name, avatar, "player")}
            onLeave={leaveSession}
            onEditProfile={() => {
              setOnboardingInitialStep(2);
              setShowOnboarding(true);
            }}
            onStartGame={() => {}}
            canStart={false}
            initialName={profile.name || initialParams.name || connectedDisplayName || undefined}
            initialAvatar={profile.avatar ?? initialParams.avatar}
            initialMode={initialParams.mode}
            initialCode={initialParams.code}
            autoSubmitKey={autoSubmitKey}
            joinOnly={initialParams.mode === "join" && !!initialParams.code}
            stepLabel={`${fr.onlineOnboarding.step} 5/5`}
            stepCurrent={5}
            stepTotal={5}
            titleWhenNoRoomOverride="Créer ou rejoindre une table"
          />
        </div>
      );
    }

    return (
      <PlanningPokerReadyScreen
        connected={online.connected}
        brandLabel={fr.planningPoker.gameTitle}
        roomCode={online.code}
        lobbyPlayers={online.state.players}
        voteSystem={online.state.voteSystem || voteSystem}
        myRole={online.myRole || role}
        isHost={online.isHost}
        onStart={online.startSession}
        onVoteSystemChange={(next) => {
          setVoteSystem(next);
          online.setVoteSystem(next);
        }}
        onRoleChange={(nextRole) => {
          setRole(nextRole);
          online.setRole(nextRole);
        }}
      />
    );
  }

  return (
    <PlanningPokerGameScreen
      state={online.state}
      history={online.history}
      myPlayerId={online.myPlayerId}
      myRole={online.myRole}
      myVote={online.myVote}
      isHost={online.isHost}
      onVoteCard={online.voteCard}
      onOpenVotes={online.openVotes}
      onReopenStoryVote={online.reopenStoryVote}
      onRevealVotes={online.revealVotes}
      onResetVotes={online.resetVotes}
      onRevoteCurrentStory={online.revoteCurrentStory}
      onRoleChange={online.setRole}
      onVoteSystemChange={online.setVoteSystem}
      onStoryTitleChange={online.setStoryTitle}
      onSelectPokerStory={online.selectPokerStory}
      onSelectPokerStoryByTitle={online.selectPokerStoryByTitle}
      onUpdatePreparedStoryTitle={online.updatePreparedStoryTitle}
      onAddPreparedStory={online.addPreparedStory}
    />
  );
};

export default PlanningPokerPage;
