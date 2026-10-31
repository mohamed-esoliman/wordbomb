import { MAX_NAME_LENGTH } from '@wordbomb/shared';
import { AvatarPicker } from './AvatarPicker';
import { TextInput } from './ui';

interface ProfileFormProps {
  name: string;
  avatar: string;
  onNameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
  autoFocus?: boolean;
}

export function ProfileForm({
  name,
  avatar,
  onNameChange,
  onAvatarChange,
  autoFocus,
}: ProfileFormProps) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Your name</span>
        <TextInput
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Pick a name"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="Your name"
        />
      </label>
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">Avatar</span>
        <AvatarPicker value={avatar} onChange={onAvatarChange} />
      </div>
    </div>
  );
}
