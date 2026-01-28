import React, { useMemo } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { useOnlineGameState } from '@/hooks/useOnlineGameState';
import { LobbyScreen } from '@/components/screens/LobbyScreen';
import { OnlineLobbyScreen } from '@/components/screens/OnlineLobbyScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { ResultsScreen } from '@/components/screens/ResultsScreen';

const Index: React.FC = () => {
  const isOnline = useMemo(() => {
    if (typeof window === 'undefined') return false;

    return window.location.hostname !== 'localhost';
  }, []);

  // Local state (single screen)
  const local = useGameState();

  // Online state (rooms + websocket)
  const online = useOnlineGameState();

  if (isOnline) {
    if (online.gameState.phase === 'lobby') {
      return (
        <div className="h-full w-full">
          <OnlineLobbyScreen
            connected={online.connected}
            roomCode={online.code}
            lobbyPlayers={online.lobby as any}
            onHost={online.createRoom}
            onJoin={online.joinRoom}
            onStartGame={online.startGame}
            canStart={online.isHost}
          />
        </div>
      );
    }

    if (online.gameState.phase === 'results') {
      return <ResultsScreen players={online.gameState.players} onPlayAgain={online.resetGame} />;
    }

    return (
      <GameScreen
        gameState={online.gameState}
        myPlayerId={online.myPlayerId}
        onRollDice={online.rollDice}
        onMovePlayer={online.movePlayer}
        onVoteQuestion={online.voteQuestion}
        onValidateQuestion={online.validateQuestion}
      />
    );
  }

  // Local mode
  if (local.gameState.phase === 'lobby') {
    return <LobbyScreen onStartGame={local.startGame} />;
  }

  if (local.gameState.phase === 'results') {
    return <ResultsScreen players={local.gameState.players} onPlayAgain={local.resetGame} />;
  }

  // In local mode we don't have per-player sockets; just let player 1 validate.
  return (
    <GameScreen
      gameState={local.gameState}
      myPlayerId={'local-0'}
      onRollDice={local.rollDice}
      onMovePlayer={local.movePlayer}
      onVoteQuestion={(vote) => local.voteQuestion(vote, 'local-0')}
      onValidateQuestion={local.validateQuestion}
    />
  );
};

export default Index;
