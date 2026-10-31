import { useApp } from '../lib/appContext';
import { useSoundSettings } from '../lib/sound';

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" strokeLinecap="round" />
      ) : (
        <>
          <path d="M16 9a4 4 0 0 1 0 6" strokeLinecap="round" />
          <path d="M18.5 6.5a8 8 0 0 1 0 11" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function SoundControls() {
  const { sound } = useApp();
  const settings = useSoundSettings(sound);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          sound.unlock();
          sound.update({ muted: !settings.muted });
        }}
        className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-text"
        aria-label={settings.muted ? 'Unmute sounds' : 'Mute sounds'}
        aria-pressed={settings.muted}
      >
        <SpeakerIcon muted={settings.muted} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings.volume}
        onChange={(e) => {
          sound.unlock();
          sound.update({ volume: Number(e.target.value), muted: false });
        }}
        className="hidden w-20 accent-accent sm:block"
        aria-label="Sound volume"
      />
    </div>
  );
}
