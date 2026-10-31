import { useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH } from '@wordbomb/shared';
import { ProfileForm } from '../components/ProfileForm';
import { PublicRooms } from '../components/PublicRooms';
import { Button, Logo, Panel, TextInput } from '../components/ui';
import { useApp } from '../lib/appContext';
import { isValidName } from '../lib/profile';
import { navigate, roomPath } from '../lib/router';

export function Home() {
  const { client, profile, setProfile } = useApp();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOk = isValidName(profile.name);

  const createRoom = async () => {
    if (!nameOk) return setError('Pick a name first');
    setBusy(true);
    setError(null);
    const reply = await client.create({ ...profile, name: profile.name.trim() });
    setBusy(false);
    if (reply.ok) navigate(roomPath(reply.roomId));
    else setError(reply.error.message);
  };

  const joinRoom = (id: string) => {
    if (!nameOk) return setError('Pick a name first');
    navigate(roomPath(id.toUpperCase()));
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== ROOM_CODE_LENGTH) return setError('Room codes are 6 characters');
    joinRoom(trimmed);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="text-center">
        <Logo size="lg" />
        <p className="mt-3 text-balance text-muted">
          Type a word containing the letters before the bomb goes off. Pass it on. Last one standing
          wins.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <Panel title="Play">
          <ProfileForm
            name={profile.name}
            avatar={profile.avatar}
            onNameChange={(name) => setProfile({ ...profile, name })}
            onAvatarChange={(avatar) => setProfile({ ...profile, avatar })}
          />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={createRoom}
              disabled={busy || !nameOk}
              className="flex-1 py-3 text-base"
            >
              Create a room
            </Button>
            <form onSubmit={submitCode} className="flex flex-1 gap-2">
              <TextInput
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH}
                placeholder="Room code"
                aria-label="Room code"
                className="font-mono uppercase tracking-[0.3em]"
                autoComplete="off"
              />
              <Button type="submit" variant="secondary" disabled={busy || !nameOk}>
                Join
              </Button>
            </form>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Public rooms">
            <PublicRooms onJoin={joinRoom} disabled={busy || !nameOk} />
          </Panel>
          <Panel title="How to play">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>Share the room link with friends. The host starts the game.</li>
              <li>
                When you hold the bomb, type any word that contains the prompt, like{' '}
                <span className="font-mono text-text">ING</span>.
              </li>
              <li>The fuse keeps burning as the bomb is passed. Be quick, or lose a life.</li>
              <li>Use every letter of the alphabet across your words to earn a life back.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </main>
  );
}
