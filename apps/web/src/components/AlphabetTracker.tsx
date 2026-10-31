import { ALPHABET } from '@wordbomb/shared';

export function AlphabetTracker({ used, label }: { used: string[]; label: string }) {
  const set = new Set(used);
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">
        {label} · {set.size}/26
      </p>
      <div className="flex flex-wrap gap-1">
        {ALPHABET.split('').map((letter) => (
          <span
            key={letter}
            className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs uppercase transition ${
              set.has(letter) ? 'bg-accent text-bg font-bold' : 'bg-surface-2 text-muted'
            }`}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
