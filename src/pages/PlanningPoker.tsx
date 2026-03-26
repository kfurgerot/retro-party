import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OnlineOnboardingScreen } from "@/components/screens/OnlineOnboardingScreen";
import { OnlineLobbyScreen } from "@/components/screens/OnlineLobbyScreen";
import { PlanningPokerReadyScreen } from "@/components/screens/PlanningPokerReadyScreen";
import { PlanningPokerGameScreen } from "@/components/screens/PlanningPokerGameScreen";
import { usePlanningPokerOnlineState } from "@/hooks/usePlanningPokerOnlineState";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { fr } from "@/i18n/fr";

const PlanningPokerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialParams = useMemo(() => {
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
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !initialParams.name && !initialParams.direct);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    initialParams.name ? 2 : 1
  );
  const [profile, setProfile] = useState(() => ({
    name: initialParams.name,
    avatar: initialParams.avatar,
  }));
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
          onBack={() => {
            navigate("/?stage=entry&experience=planning-poker");
          }}
          />
      );
    }

    if (!online.code) {
      return (
        <div className="h-full w-full">
          <OnlineLobbyScreen
            connected={online.connected}
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
            shellStyle="transparent"
            titleWhenNoRoomOverride={online.state.phase === "lobby" ? "Creer ou rejoindre une table" : undefined}
          />
        </div>
      );
    }

    return (
      <PlanningPokerReadyScreen
        connected={online.connected}
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
      onRevealVotes={online.revealVotes}
      onResetVotes={online.resetVotes}
      onLeave={leaveSession}
      onRoleChange={online.setRole}
      onVoteSystemChange={online.setVoteSystem}
      onStoryTitleChange={online.setStoryTitle}
    />
  );
};

export default PlanningPokerPage;
