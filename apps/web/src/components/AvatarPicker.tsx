import { AVATAR_IDS, MEMBER_COLORS } from '@wordbomb/shared';
import { Avatar } from './Avatar';

interface AvatarPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div
      className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 sm:gap-2"
      role="radiogroup"
      aria-label="Avatar"
    >
      {AVATAR_IDS.map((id, i) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={id === value}
          onClick={() => onChange(id)}
          className={`rounded-xl p-1 transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            id === value ? 'bg-surface-2 ring-2 ring-accent' : ''
          }`}
        >
          <Avatar id={id} color={MEMBER_COLORS[i % MEMBER_COLORS.length]!} size={36} />
        </button>
      ))}
    </div>
  );
}
