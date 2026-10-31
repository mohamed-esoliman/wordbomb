import { useRef, useState, type FormEvent } from 'react';
import { MAX_TYPING_LENGTH, REJECT_MESSAGES, type RejectReason } from '@wordbomb/shared';

interface WordInputProps {
  prompt: string;
  onTyping: (text: string) => void;
  onSubmit: (word: string) => Promise<{ accepted: boolean; reason?: RejectReason }>;
}

export function WordInput({ prompt, onTyping, onSubmit }: WordInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sendTyping = (text: string) => {
    clearTimeout(pending.current);
    const now = Date.now();
    if (now - lastSent.current > 80) {
      lastSent.current = now;
      onTyping(text);
    } else {
      pending.current = setTimeout(() => {
        lastSent.current = Date.now();
        onTyping(text);
      }, 80);
    }
  };

  const change = (text: string) => {
    const next = text.slice(0, MAX_TYPING_LENGTH);
    setValue(next);
    setError(null);
    sendTyping(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const word = value.trim();
    if (!word) return;
    const result = await onSubmit(word);
    if (result.accepted) {
      setValue('');
      return;
    }
    setError(result.reason ? REJECT_MESSAGES[result.reason] : 'Rejected');
    setShake((n) => n + 1);
    inputRef.current?.select();
  };

  const highlighted = value.toLowerCase().includes(prompt);

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <input
        key={shake}
        ref={inputRef}
        value={value}
        onChange={(e) => change(e.target.value)}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        aria-label="Your word"
        placeholder="Type a word and press Enter"
        className={`w-full rounded-2xl border-2 bg-bg/70 px-4 py-3 text-center font-mono text-xl tracking-wide uppercase focus:outline-none ${
          error
            ? 'animate-shake border-danger'
            : highlighted
              ? 'border-success'
              : 'border-accent focus:ring-2 focus:ring-accent/40'
        }`}
      />
      <p role="status" className="mt-2 h-5 text-center text-sm text-danger">
        {error ?? ''}
      </p>
    </form>
  );
}
