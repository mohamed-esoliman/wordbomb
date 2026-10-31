import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_CHAT_LENGTH, type ChatMessage } from '@wordbomb/shared';
import { Button, TextInput } from './ui';

interface ChatProps {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
  className?: string;
}

export function Chat({ messages, myId, onSend, className = '' }: ChatProps) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <ul
        ref={listRef}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm"
        aria-live="polite"
      >
        {messages.length === 0 && <li className="text-muted">Say hi.</li>}
        {messages.map((m) => (
          <li key={m.id} className="break-words">
            <span
              className={`font-semibold ${m.playerId === myId ? 'text-accent-soft' : 'text-text'}`}
            >
              {m.name}
            </span>
            <span className="text-muted">: </span>
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Message"
          aria-label="Chat message"
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
