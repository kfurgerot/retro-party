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

    // Dev override (no URL params): set VITE_FORCE_ONLINE=1 in .env.development
    const force = (import.meta.env.VITE_FORCE_ONLINE as string | undefined) === '1';
    if (force) return true;

    // Auto mode:
// - In dev (`vite`), localhost => local (unless forced by VITE_FORCE_ONLINE)
// - In production build served on localhost (e.g. docker/preview), treat as online
const host = window.location.hostname;
if (host === 'localhost' || host === '127.0.0.1') {
  return import.meta.env.PROD;
}
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
  return (
    <GameScreen
      gameState={local.gameState}
      myPlayerId={'local-0'}
      onRollDice={local.rollDice}
      onMovePlayer={local.movePlayer}
      onOpenQuestionCard={() => local.openQuestionCard('local-0')}
      onVoteQuestion={(vote) => local.voteQuestion(vote, 'local-0')}
      onValidateQuestion={local.validateQuestion}
    />
  );
};

export default Index;
