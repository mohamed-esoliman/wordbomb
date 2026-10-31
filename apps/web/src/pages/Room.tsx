import { useCallback, useEffect } from 'react';
import { NameGate } from '../components/NameGate';
import { Button, Logo, Panel } from '../components/ui';
import { WinnerOverlay } from '../components/WinnerOverlay';
import { useApp } from '../lib/appContext';
import { isValidName } from '../lib/profile';
import { useClientState } from '../lib/roomClient';
import { navigate } from '../lib/router';
import { GameScreen } from './GameScreen';
import { Lobby } from './Lobby';

export function Room({ roomId }: { roomId: string }) {
  const { client, sound, profile, setProfile } = useApp();
  const state = useClientState(client);
  const hasName = isValidName(profile.name);

  useEffect(() => client.on('game:finished', () => sound.play('win')), [client, sound]);

  useEffect(() => {
    if (!hasName) return;
    client.join(roomId, profile);
    return () => client.scheduleLeave();
    // joining is keyed on the room; profile edits are sent through updateProfile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, roomId, hasName]);

  const leave = useCallback(() => {
    client.leave();
    navigate('/');
  }, [client]);
  const dismissFinished = useCallback(() => client.dismissFinished(), [client]);

  if (!hasName) return <NameGate profile={profile} roomId={roomId} onDone={setProfile} />;

  if (state.joinError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo />
        <Panel className="w-full">
          <p className="text-lg font-semibold">{state.joinError.message}</p>
          <p className="mt-1 text-sm text-muted">
            Room <span className="font-mono">{roomId}</span>
          </p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Back home
          </Button>
        </Panel>
      </main>
    );
  }

  const { room, myId } = state;
  if (!room || !myId) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        {state.connection === 'reconnecting' ? 'Reconnecting...' : 'Joining room...'}
      </main>
    );
  }

  const playing = room.game?.status === 'playing';
  return (
    <>
      {state.connection === 'reconnecting' && (
        <div className="fixed inset-x-0 top-0 z-40 bg-danger/90 py-1 text-center text-xs font-semibold text-white">
          Connection lost, reconnecting...
        </div>
      )}
      {state.notice && (
        <div
          role="alert"
          className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-surface-2 px-4 py-2 text-sm shadow-xl"
        >
          {state.notice.message}
        </div>
      )}
      {playing ? (
        <GameScreen room={room} myId={myId} typing={state.typing} onLeave={leave} />
      ) : (
        <Lobby room={room} myId={myId} onLeave={leave} />
      )}
      {state.finished && (
        <WinnerOverlay
          winner={room.members.find((m) => m.id === state.finished?.winnerId)}
          me={state.finished.winnerId === myId}
          onDismiss={dismissFinished}
        />
      )}
    </>
  );
}
