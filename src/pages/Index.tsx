import React, { useMemo, useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { useOnlineGameState } from '@/hooks/useOnlineGameState';
import { LobbyScreen } from '@/components/screens/LobbyScreen';
import { OnlineLobbyScreen } from '@/components/screens/OnlineLobbyScreen';
import { OnlineOnboardingScreen } from '@/components/screens/OnlineOnboardingScreen';
import { PressStartScreen } from '@/components/screens/PressStartScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';

type OnlineSetup = {
  name: string;
  avatar: number;
  mode: 'host' | 'join';
  code: string;
};

const Index: React.FC = () => {
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
  const [hasEnteredOnlineLobby, setHasEnteredOnlineLobby] = useState(false);
  const [onlineSetup, setOnlineSetup] = useState<OnlineSetup | null>(null);
  const [autoSubmitKey, setAutoSubmitKey] = useState(0);

  if (isOnline) {
    if (online.gameState.phase === 'lobby') {
      if (!hasEnteredOnlineLobby) {
        return <PressStartScreen onStart={() => setHasEnteredOnlineLobby(true)} />;
      }

      if (!online.code && !onlineSetup) {
        return (
          <OnlineOnboardingScreen
            connected={online.connected}
            onBack={() => setHasEnteredOnlineLobby(false)}
            onSubmit={({ name, avatar, mode, code }) => {
              setOnlineSetup({ name, avatar, mode, code });
              setAutoSubmitKey((k) => k + 1);
            }}
          />
        );
      }

      return (
        <div className="h-full w-full">
          <OnlineLobbyScreen
            connected={online.connected}
            roomCode={online.code}
            lobbyPlayers={online.lobby as any}
            onHost={online.createRoom}
            onJoin={online.joinRoom}
            onLeave={() => {
              online.leaveRoom();
              setOnlineSetup(null);
            }}
            onStartGame={online.startGame}
            canStart={online.isHost}
            initialName={onlineSetup?.name}
            initialAvatar={onlineSetup?.avatar}
            initialMode={onlineSetup?.mode}
            initialCode={onlineSetup?.code}
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

    return (
      <GameScreen
        gameState={online.gameState}
        myPlayerId={online.myPlayerId}
        onLeave={online.leaveRoom}
        onRollDice={online.rollDice}
        onMovePlayer={online.movePlayer}
        onOpenQuestionCard={online.openQuestionCard}
        onVoteQuestion={online.voteQuestion}
        onValidateQuestion={online.validateQuestion}
        onCompleteBugSmash={online.completeBugSmash}
        onBugSmashProgress={online.updateBugSmashProgress}
        whoSaidItState={online.whoSaidIt}
        onWhoSaidItSubmit={online.submitWhoSaidIt}
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

  // In local mode we don't have per-player sockets; just let player 1 validate.
  const localCurrentPlayerId =
    local.gameState.players[local.gameState.currentPlayerIndex]?.id ?? 'local-0';
  return (
    <GameScreen
      gameState={local.gameState}
      myPlayerId={localCurrentPlayerId}
      onRollDice={local.rollDice}
      onMovePlayer={local.movePlayer}
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
    />
  );
};

export default Index;
