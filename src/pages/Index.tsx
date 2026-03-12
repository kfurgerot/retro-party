import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { useGameState } from '@/hooks/useGameState';
import { useOnlineGameState } from '@/hooks/useOnlineGameState';
import { LobbyScreen } from '@/components/screens/LobbyScreen';
import { OnlineLobbyScreen } from '@/components/screens/OnlineLobbyScreen';
import { OnlineOnboardingScreen } from '@/components/screens/OnlineOnboardingScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';
import { perfLog, perfMark, perfMeasure } from "@/lib/perf";
import { fr } from "@/i18n/fr";

const Index: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const code = params.get("code");
    const name = params.get("name");
    const avatar = Number(params.get("avatar"));
    const auto = params.get("auto");
    return {
      mode: mode === "join" ? "join" : "host",
      code: code ? code.toUpperCase() : "",
      name: name ? name.trim() : "",
      avatar: Number.isFinite(avatar) ? Math.max(0, Math.floor(avatar)) : 0,
      autoSubmit: auto === "1",
      direct: auto === "1" || !!code,
    };
  }, [location.search]);

  const isOnline = useMemo(() => {
    if (typeof window === 'undefined') return false;

    // Legacy override (optional): ?online=1 or ?online=0
    const params = new URLSearchParams(window.location.search);
    const override = params.get('online');
    if (override === '1') return true;
    if (override === '0') return false;

    // Default to online on every platform (desktop + mobile).
    // Use ?online=0 when local mode is explicitly needed.
    return true;
  }, []);

  // Local state (single screen)
  const local = useGameState();

  // Online state (rooms + websocket)
  const online = useOnlineGameState();
  const [autoSubmitKey] = useState<number>(() => (initialParams.autoSubmit ? Date.now() : 0));
  const [screenTransitionStartMark] = useState(() => `screen-transition-start-${Date.now()}`);
  const [onboardingProfile, setOnboardingProfile] = useState(() => ({
    name: initialParams.name,
    avatar: initialParams.avatar,
  }));
  const [showOnlineOnboarding, setShowOnlineOnboarding] = useState<boolean>(
    () => !initialParams.name && !initialParams.direct
  );

  React.useEffect(() => {
    perfMark(screenTransitionStartMark);
  }, [screenTransitionStartMark]);

  React.useEffect(() => {
    const view = isOnline ? online.gameState.phase : local.gameState.phase;
    const endMark = `screen-transition-end-${Date.now()}`;
    perfMark(endMark);
    const duration = perfMeasure(`screen-transition-${view}`, screenTransitionStartMark, endMark);
    perfLog("screen-transition", { view, durationMs: duration != null ? Math.round(duration) : null });
    perfMark(screenTransitionStartMark);
  }, [isOnline, online.gameState.phase, local.gameState.phase, screenTransitionStartMark]);

  const leaveOnlineSession = () => {
    online.leaveRoom();
    navigate("/");
  };

  if (isOnline) {
    if (online.gameState.phase === 'lobby') {
      if (!online.code && showOnlineOnboarding) {
        return (
          <OnlineOnboardingScreen
            connected={online.connected}
            initialName={onboardingProfile.name || undefined}
            initialAvatar={onboardingProfile.avatar}
            onSubmit={({ name, avatar }) => {
              setOnboardingProfile({ name, avatar });
              setShowOnlineOnboarding(false);
            }}
            onBack={() => navigate("/")}
          />
        );
      }

      return (
        <div className="h-full w-full">
          <OnlineLobbyScreen
            connected={online.connected}
            roomCode={online.code}
            lobbyPlayers={online.lobby}
            onHost={online.createRoom}
            onJoin={online.joinRoom}
            onLeave={() => {
              leaveOnlineSession();
            }}
            onStartGame={online.startGame}
            canStart={online.isHost}
            initialName={onboardingProfile.name || initialParams.name || undefined}
            initialAvatar={onboardingProfile.avatar ?? initialParams.avatar}
            initialMode={initialParams.mode}
            initialCode={initialParams.code}
            autoSubmitKey={autoSubmitKey}
          />
        </div>
      );
    }

    if (online.gameState.phase === 'results') {
      return (
        <ResultsScreen
          players={online.gameState.players}
          questionHistory={online.gameState.questionHistory}
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
            <div className="text-sm font-semibold text-cyan-100">{fr.onlineOnboarding.connecting}</div>
            <div className="mt-2 text-xs text-slate-300">
              Initialisation de la partie...
            </div>
          </div>
        </div>
      );
    }

    return (
      <GameScreen
        gameState={online.gameState}
        myPlayerId={online.myPlayerId}
        onLeave={leaveOnlineSession}
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
  if (local.gameState.phase === 'lobby') {
    return <LobbyScreen onStartGame={local.startGame} />;
  }

  if (local.gameState.phase === 'results') {
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
          <div className="text-sm font-semibold text-cyan-100">{fr.onlineOnboarding.connecting}</div>
          <div className="mt-2 text-xs text-slate-300">
            Initialisation de la partie...
          </div>
        </div>
      </div>
    );
  }

  // In local mode we don't have per-player sockets; just let player 1 validate.
  const localCurrentPlayerId =
    local.gameState.players[local.gameState.currentPlayerIndex]?.id ?? 'local-0';
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
