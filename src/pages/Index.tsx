import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { useOnlineGameState } from "@/hooks/useOnlineGameState";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { LobbyScreen } from "@/components/screens/LobbyScreen";
import { IdentityStep, SessionLobby, ConnectingState } from "@/components/app-shell-v2/pre-game";
import type { PresenceParticipant } from "@/components/app-shell-v2/pre-game";
import { Slider } from "@/components/ui/slider";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { GameScreen } from "@/components/screens/GameScreen";
import { ResultsScreen } from "@/components/screens/ResultsScreen";
import { perfLog, perfMark, perfMeasure } from "@/lib/perf";
import { fr } from "@/i18n/fr";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { setHostSession } from "@/lib/hostSession";
import PlanningPokerPage from "@/pages/PlanningPoker";

type InitialParams = {
  mode: "host" | "join";
  code: string;
  name: string;
  avatar: number;
  autoSubmit: boolean;
  direct: boolean;
  fromEntry: boolean;
  fresh: boolean;
  experience: "planning-poker" | "retro-party";
};

const cleanDisplayName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 16);

const Index: React.FC = () => {
  const location = useLocation();
  const initialParams = useMemo<InitialParams>(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const code = params.get("code");
    const name = params.get("name");
    const avatar = Number(params.get("avatar"));
    const auto = params.get("auto");
    const from = params.get("from");
    const experience = params.get("experience");
    return {
      mode: mode === "join" ? "join" : "host",
      code: code ? code.toUpperCase() : "",
      name: name ? name.trim() : "",
      avatar: Number.isFinite(avatar) ? Math.max(0, Math.floor(avatar)) : 0,
      autoSubmit: auto === "1",
      direct: auto === "1" || !!code,
      fromEntry: from === "entry",
      fresh: params.get("new") === "1",
      experience: experience === "planning-poker" ? "planning-poker" : "retro-party",
    };
  }, [location.search]);

  if (initialParams.experience === "planning-poker") {
    return <PlanningPokerPage />;
  }

  return <RetroPartyPage initialParams={initialParams} />;
};

const RetroPartyPage: React.FC<{ initialParams: InitialParams }> = ({ initialParams }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const isOnline = useMemo(() => {
    if (typeof window === "undefined") return false;

    // Legacy override (optional): ?online=1 or ?online=0
    const params = new URLSearchParams(window.location.search);
    const override = params.get("online");
    if (override === "1") return true;
    if (override === "0") return false;

    // Default to online on every platform (desktop + mobile).
    // Use ?online=0 when local mode is explicitly needed.
    return true;
  }, []);

  // Local state (single screen)
  const local = useGameState();

  // Online state (rooms + websocket)
  const online = useOnlineGameState({
    skipRestore: initialParams.fresh,
    restoreCode: initialParams.mode === "join" ? initialParams.code : null,
  });
  const connectedDisplayName = cleanDisplayName(user?.displayName || "");
  const [screenTransitionStartMark] = useState(() => `screen-transition-start-${Date.now()}`);
  const { profile: onboardingProfile, setProfile: setOnboardingProfile } = useProfile(
    "retro-party",
    initialParams.name || connectedDisplayName || undefined,
    initialParams.avatar,
  );
  const forceProfileBeforeJoin = useMemo(
    () => initialParams.mode === "join" && !!initialParams.code && !initialParams.autoSubmit,
    [initialParams.autoSubmit, initialParams.code, initialParams.mode],
  );
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState<boolean>(
    () => forceProfileBeforeJoin || (!onboardingProfile.name && !initialParams.direct),
  );
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<1 | 2>(() =>
    forceProfileBeforeJoin ? 1 : onboardingProfile.name ? 2 : 1,
  );
  const [connectedLaunchProfileApplied, setConnectedLaunchProfileApplied] = useState(false);
  const [v2MaxRounds, setV2MaxRounds] = useState(12);
  const accent = TOOL_ACCENT["retro-party"];

  React.useEffect(() => {
    if (connectedLaunchProfileApplied || authLoading) return;
    if (
      !connectedDisplayName ||
      initialParams.mode !== "host" ||
      initialParams.direct ||
      online.code
    ) {
      return;
    }
    setOnboardingProfile({ name: connectedDisplayName, avatar: onboardingProfile.avatar });
    setOnboardingInitialStep(2);
    setShowOnlineOnboarding(true);
    setConnectedLaunchProfileApplied(true);
  }, [
    authLoading,
    connectedDisplayName,
    connectedLaunchProfileApplied,
    initialParams.direct,
    initialParams.mode,
    onboardingProfile.avatar,
    online.code,
    setOnboardingProfile,
  ]);

  React.useEffect(() => {
    perfMark(screenTransitionStartMark);
  }, [screenTransitionStartMark]);

  // URL direct join/host bypass (?auto=1 ou ?mode=join&code=…) :
  // si on saute l'IdentityStep, on déclenche createRoom / joinRoom une seule fois.
  const directSubmitRef = React.useRef(false);
  React.useEffect(() => {
    if (directSubmitRef.current) return;
    if (online.code || showOnlineOnboarding) return;
    if (!initialParams.autoSubmit && !initialParams.direct) return;
    const name = (onboardingProfile.name || initialParams.name || connectedDisplayName).trim();
    if (name.length < 2) return;
    directSubmitRef.current = true;
    if (initialParams.mode === "join" && initialParams.code) {
      online.joinRoom(initialParams.code, name, onboardingProfile.avatar ?? initialParams.avatar);
    } else {
      online.createRoom(name, onboardingProfile.avatar ?? initialParams.avatar);
    }
  }, [
    connectedDisplayName,
    initialParams.autoSubmit,
    initialParams.avatar,
    initialParams.code,
    initialParams.direct,
    initialParams.mode,
    initialParams.name,
    onboardingProfile.avatar,
    onboardingProfile.name,
    online,
    online.code,
    showOnlineOnboarding,
  ]);

  React.useEffect(() => {
    if (!online.code) {
      setHostSession(null);
      return;
    }
    const isPoker = new URLSearchParams(location.search).get("experience") === "planning-poker";
    setHostSession({
      code: online.code,
      moduleId: isPoker ? "planning-poker" : "retro-party",
      isHost: online.isHost,
      participantSessionId: online.sessionId,
    });
    return () => setHostSession(null);
  }, [online.code, online.isHost, online.sessionId, location.search]);

  React.useEffect(() => {
    const view = isOnline ? online.gameState.phase : local.gameState.phase;
    const endMark = `screen-transition-end-${Date.now()}`;
    perfMark(endMark);
    const duration = perfMeasure(`screen-transition-${view}`, screenTransitionStartMark, endMark);
    perfLog("screen-transition", {
      view,
      durationMs: duration != null ? Math.round(duration) : null,
    });
    perfMark(screenTransitionStartMark);
  }, [isOnline, online.gameState.phase, local.gameState.phase, screenTransitionStartMark]);

  const leaveOnlineSession = () => {
    online.leaveRoom();
    navigate("/app");
  };

  if (isOnline) {
    if (online.gameState.phase === "lobby") {
      const exp = EXPERIENCE_BY_ID["retro-party"];

      if (!online.code && showOnlineOnboarding) {
        const handleIdentitySubmit = ({ name, avatar }: { name: string; avatar: number }) => {
          setOnboardingProfile({ name, avatar });
          setOnboardingInitialStep(1);
          setShowOnlineOnboarding(false);
          if (initialParams.mode === "join" && initialParams.code) {
            online.joinRoom(initialParams.code, name, avatar);
          } else {
            online.createRoom(name, avatar);
          }
        };
        const handleIdentityBack = () => {
          navigate("/");
        };

        return (
          <IdentityStep
            connected={online.connected}
            moduleLabel={exp.label}
            moduleIcon={exp.icon}
            accentRgb={exp.accentRgb}
            brandLabel={fr.home.title}
            initialName={onboardingProfile.name || undefined}
            initialAvatar={onboardingProfile.avatar}
            overallStepStart={3}
            overallStepTotal={5}
            sessionPreview={
              initialParams.mode === "join" && initialParams.code
                ? { code: initialParams.code, status: "lobby" }
                : null
            }
            primaryLabel={
              initialParams.mode === "join" ? "Rejoindre la session" : "Créer la session"
            }
            onSubmit={handleIdentitySubmit}
            onBack={handleIdentityBack}
          />
        );
      }

      if (online.code) {
        const selfName = (onboardingProfile.name || connectedDisplayName || "").trim();
        const participants: PresenceParticipant[] = online.lobby.map((p, i) => ({
          id: p.socketId ?? `${p.name}-${i}`,
          name: p.name,
          avatar: p.avatar,
          isHost: p.isHost,
          isSelf: !!selfName && p.name.trim().toLowerCase() === selfName.toLowerCase(),
          state: p.connected === false ? "offline" : p.isHost ? "ready" : "idle",
        }));
        const hostPlayer = online.lobby.find((p) => p.isHost);
        const shareUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/join/${online.code}`
            : undefined;
        const shareMessage = `Rejoins-moi sur ${exp.label} avec le code ${online.code} → ${shareUrl ?? ""}`;

        return (
          <SessionLobby
            roomCode={online.code}
            connected={online.connected}
            moduleLabel={exp.label}
            moduleIcon={exp.icon}
            accentRgb={exp.accentRgb}
            brandLabel={fr.home.title}
            sessionTitle={null}
            participants={participants}
            isHost={online.isHost}
            canStart={online.isHost}
            shareUrl={shareUrl}
            shareMessage={shareMessage}
            waitingHostName={hostPlayer?.name}
            onLeave={leaveOnlineSession}
            onStart={() => online.startGame(v2MaxRounds)}
            hostSetupPanel={
              online.isHost ? (
                <RetroPartyHostControls
                  rounds={v2MaxRounds}
                  onRoundsChange={setV2MaxRounds}
                  accentRgb={exp.accentRgb}
                />
              ) : null
            }
          />
        );
      }

      // !online.code && !showOnlineOnboarding → connexion en cours
      // (URL direct join `?auto=1` ou retour de l'IdentityStep en attente du roomCode)
      return (
        <ConnectingState
          accentRgb={exp.accentRgb}
          mode={initialParams.mode === "join" ? "joining" : "creating"}
          code={initialParams.mode === "join" ? initialParams.code : null}
          onBack={() => navigate("/")}
        />
      );
    }

    if (online.gameState.phase === "results") {
      return (
        <ResultsScreen
          players={online.gameState.players}
          questionHistory={online.gameState.questionHistory}
          accentColor={accent.color}
          onPlayAgain={online.resetGame}
        />
      );
    }

    if (
      online.gameState.phase === "playing" &&
      (online.gameState.players.length === 0 || online.gameState.tiles.length === 0)
    ) {
      return (
        <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
          <div className="neon-surface w-full max-w-md p-5 text-center">
            <div className="text-sm font-semibold text-cyan-100">
              {fr.onlineOnboarding.connecting}
            </div>
            <div className="mt-2 text-xs text-slate-300">Initialisation de la partie...</div>
          </div>
        </div>
      );
    }

    return (
      <GameScreen
        gameState={online.gameState}
        roomCode={online.code}
        roomNotice={online.roomNotice}
        myPlayerId={online.myPlayerId}
        onRollDice={online.rollDice}
        onMovePlayer={online.movePlayer}
        onChoosePath={online.choosePath}
        onResolveKudoPurchase={online.resolveKudoPurchase}
        onBuyShopItem={online.buyShopItem}
        onCloseShop={online.closeShop}
        onResolvePreRollChoice={online.resolvePreRollChoice}
        onOpenQuestionCard={online.openQuestionCard}
        onVoteQuestion={online.voteQuestion}
        onValidateQuestion={online.validateQuestion}
        onCompleteBugSmash={online.completeBugSmash}
        onBugSmashProgress={online.updateBugSmashProgress}
        whoSaidItState={online.whoSaidIt}
        onWhoSaidItSubmit={online.submitWhoSaidIt}
        onBuzzwordSubmit={online.submitBuzzwordDuel}
        onPointDuelRoll={online.rollPointDuel}
      />
    );
  }

  // Local mode
  if (local.gameState.phase === "lobby") {
    return <LobbyScreen onStartGame={local.startGame} />;
  }

  if (local.gameState.phase === "results") {
    return (
      <ResultsScreen
        players={local.gameState.players}
        questionHistory={local.gameState.questionHistory}
        onPlayAgain={local.resetGame}
      />
    );
  }

  if (
    local.gameState.phase === "playing" &&
    (local.gameState.players.length === 0 || local.gameState.tiles.length === 0)
  ) {
    return (
      <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
        <div className="neon-surface w-full max-w-md p-5 text-center">
          <div className="text-sm font-semibold text-cyan-100">
            {fr.onlineOnboarding.connecting}
          </div>
          <div className="mt-2 text-xs text-slate-300">Initialisation de la partie...</div>
        </div>
      </div>
    );
  }

  // In local mode we don't have per-player sockets; just let player 1 validate.
  const localCurrentPlayerId =
    local.gameState.players[local.gameState.currentPlayerIndex]?.id ?? "local-0";
  return (
    <GameScreen
      gameState={local.gameState}
      myPlayerId={localCurrentPlayerId}
      onRollDice={local.rollDice}
      onMovePlayer={local.movePlayer}
      onChoosePath={(nextTileId) => local.choosePath(nextTileId, localCurrentPlayerId)}
      onResolveKudoPurchase={(buyKudo) => local.resolveKudoPurchase(buyKudo, localCurrentPlayerId)}
      onOpenQuestionCard={() => local.openQuestionCard(localCurrentPlayerId)}
      onVoteQuestion={(vote) => local.voteQuestion(vote, localCurrentPlayerId)}
      onValidateQuestion={local.validateQuestion}
      onCompleteBugSmash={(score) => {
        const current = local.gameState.players[local.gameState.currentPlayerIndex];
        if (!current) return;
        local.completeBugSmash(score, current.id);
      }}
      onBugSmashProgress={(score) => {
        const current = local.gameState.players[local.gameState.currentPlayerIndex];
        if (!current) return;
        local.updateBugSmashProgress(score, current.id);
      }}
      onBuzzwordSubmit={(category) => {
        local.submitBuzzwordAnswer(localCurrentPlayerId, category);
      }}
    />
  );
};

export default Index;

const RetroPartyHostControls: React.FC<{
  rounds: number;
  onRoundsChange: (next: number) => void;
  accentRgb: string;
}> = ({ rounds, onRoundsChange, accentRgb }) => {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="text-[13px] font-semibold text-[var(--ds-text-secondary)]">
          Nombre de manches
        </label>
        <span
          className="rounded-lg border px-2.5 py-1 text-[13px] font-bold"
          style={{
            borderColor: `rgba(${accentRgb},0.35)`,
            background: `rgba(${accentRgb},0.12)`,
            color: `rgb(${accentRgb})`,
          }}
        >
          {rounds}
        </span>
      </div>
      <Slider
        min={1}
        max={30}
        step={1}
        value={[rounds]}
        onValueChange={(vals) => {
          const n = vals[0];
          if (Number.isFinite(n)) onRoundsChange(Math.max(1, Math.min(30, Math.round(n))));
        }}
        aria-label="Nombre de manches"
      />
      <div className="mt-2 flex justify-between text-[10px] text-[var(--ds-text-faint)]">
        <span>1</span>
        <span>30</span>
      </div>
    </div>
  );
};
