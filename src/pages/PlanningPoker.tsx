import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { PlanningPokerReadyScreen } from "@/components/screens/PlanningPokerReadyScreen";
import { PlanningPokerGameScreen } from "@/components/screens/PlanningPokerGameScreen";
import { usePlanningPokerOnlineState } from "@/hooks/usePlanningPokerOnlineState";
import { useProfile } from "@/hooks/useProfile";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { fr } from "@/i18n/fr";

const ACCENT = TOOL_ACCENT["planning-poker"];

type InitialParams = {
  mode: "host" | "join";
  code: string;
  name: string;
  avatar: number;
  autoSubmit: boolean;
  direct: boolean;
  fromEntry: boolean;
};

const PlanningPokerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

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
    };
  }, [location.search]);

  const online = usePlanningPokerOnlineState();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.key !== "default") return;
    online.leaveRoom();
    navigate("/?stage=select-experience", { replace: true });
  }, [location.key, navigate, online.leaveRoom]);

  const [autoSubmitKey] = useState<number>(() => (initialParams.autoSubmit ? Date.now() : 0));
  const { profile, setProfile } = useProfile(initialParams.name || undefined, initialParams.avatar);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => !profile.name && !initialParams.direct,
  );
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    profile.name ? 2 : 1,
  );
  const [voteSystem, setVoteSystem] = useState<PlanningPokerVoteSystem>("fibonacci");
  const [role, setRole] = useState<PlanningPokerRole>("player");

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
            initialName={profile.name || initialParams.name || undefined}
            initialAvatar={profile.avatar ?? initialParams.avatar}
            initialMode={initialParams.mode}
            initialCode={initialParams.code}
            autoSubmitKey={autoSubmitKey}
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
        onLeave={leaveSession}
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
      onLeave={leaveSession}
      onRoleChange={online.setRole}
      onVoteSystemChange={online.setVoteSystem}
      onStoryTitleChange={online.setStoryTitle}
    />
  );
};

export default PlanningPokerPage;
