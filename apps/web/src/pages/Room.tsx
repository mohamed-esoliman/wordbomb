import { useEffect } from 'react';
import { NameGate } from '../components/NameGate';
import { Button, Logo, Panel } from '../components/ui';
import { useApp } from '../lib/appContext';
import { isValidName } from '../lib/profile';
import { useClientState } from '../lib/roomClient';
import { navigate } from '../lib/router';

export function Room({ roomId }: { roomId: string }) {
  const { client, profile, setProfile } = useApp();
  const state = useClientState(client);
  const hasName = isValidName(profile.name);

  useEffect(() => {
    if (!hasName) return;
    client.join(roomId, profile);
    return () => {
      client.leave();
    };
    // joining is keyed on the room; profile edits are sent through updateProfile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, roomId, hasName]);

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

  if (!state.room || !state.myId) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-muted">
        {state.connection === 'reconnecting' ? 'Reconnecting...' : 'Joining room...'}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Logo />
      <Panel title={state.room.name} className="mt-4">
        <ul>
          {state.room.members.map((m) => (
            <li key={m.id}>
              {m.name}
              {m.id === state.room?.hostId ? ' (host)' : ''}
              {m.id === state.myId ? ' (you)' : ''}
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
