import { useState, type FormEvent } from 'react';
import { Button, Logo, Panel } from './ui';
import { ProfileForm } from './ProfileForm';
import { isValidName, type Profile } from '../lib/profile';

export function NameGate({
  profile,
  roomId,
  onDone,
}: {
  profile: Profile;
  roomId: string;
  onDone: (profile: Profile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isValidName(name)) onDone({ ...profile, name: name.trim(), avatar });
  };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <Logo />
        <p className="mt-2 text-muted">
          You are joining room <span className="font-mono text-text">{roomId}</span>
        </p>
      </div>
      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <ProfileForm
            name={name}
            avatar={avatar}
            onNameChange={setName}
            onAvatarChange={setAvatar}
            autoFocus
          />
          <Button type="submit" disabled={!isValidName(name)} className="w-full py-3">
            Join room
          </Button>
        </form>
      </Panel>
    </main>
  );
}
