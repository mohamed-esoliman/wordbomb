import {
  PROMPT_DIFFICULTIES,
  SETTINGS_BOUNDS,
  type GameSettings,
  type PromptDifficulty,
} from '@wordbomb/shared';

interface SettingsPanelProps {
  settings: GameSettings;
  editable: boolean;
  onChange: (settings: GameSettings) => void;
}

type NumericKey = keyof typeof SETTINGS_BOUNDS;

const numericFields: { key: NumericKey; label: string; unit?: string }[] = [
  { key: 'maxPlayers', label: 'Max players' },
  { key: 'startingLives', label: 'Starting lives' },
  { key: 'maxLives', label: 'Max lives' },
  { key: 'minTurnSeconds', label: 'Min turn', unit: 's' },
  { key: 'bombMinSeconds', label: 'Bomb min', unit: 's' },
  { key: 'bombMaxSeconds', label: 'Bomb max', unit: 's' },
  { key: 'minWordLength', label: 'Min word length' },
];

export function normalizeSettings(
  settings: GameSettings,
  changed: keyof GameSettings,
): GameSettings {
  const next = { ...settings };
  if (next.maxLives < next.startingLives) {
    if (changed === 'maxLives') next.startingLives = next.maxLives;
    else next.maxLives = next.startingLives;
  }
  if (next.bombMaxSeconds < next.bombMinSeconds) {
    if (changed === 'bombMaxSeconds') next.bombMinSeconds = next.bombMaxSeconds;
    else next.bombMaxSeconds = next.bombMinSeconds;
  }
  return next;
}

export function SettingsPanel({ settings, editable, onChange }: SettingsPanelProps) {
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    onChange(normalizeSettings({ ...settings, [key]: value }, key));

  return (
    <div className="space-y-3">
      {numericFields.map(({ key, label, unit }) => (
        <label key={key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted">{label}</span>
          <span className="w-10 text-right font-mono text-text">
            {settings[key]}
            {unit}
          </span>
          {editable && (
            <input
              type="range"
              className="col-span-2 accent-accent"
              min={SETTINGS_BOUNDS[key].min}
              max={SETTINGS_BOUNDS[key].max}
              value={settings[key]}
              onChange={(e) => set(key, Number(e.target.value))}
              aria-label={label}
            />
          )}
        </label>
      ))}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Prompt difficulty</span>
        {editable ? (
          <select
            value={settings.promptDifficulty}
            onChange={(e) => set('promptDifficulty', e.target.value as PromptDifficulty)}
            className="rounded-lg border border-border bg-bg/60 px-2 py-1 text-text"
            aria-label="Prompt difficulty"
          >
            {PROMPT_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono capitalize">{settings.promptDifficulty}</span>
        )}
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Alphabet bonus life</span>
        {editable ? (
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={settings.alphabetBonus}
            onChange={(e) => set('alphabetBonus', e.target.checked)}
            aria-label="Alphabet bonus life"
          />
        ) : (
          <span className="font-mono">{settings.alphabetBonus ? 'on' : 'off'}</span>
        )}
      </label>
    </div>
  );
}
