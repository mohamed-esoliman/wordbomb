import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-bg font-semibold hover:bg-accent-soft shadow-[0_0_24px_rgba(249,115,22,0.35)]',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${variants[variant]} ${className}`}
    />
  );
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-border bg-bg/60 px-3.5 py-2.5 text-text placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 ${className}`}
    />
  );
}

export function Panel({
  title,
  children,
  className = '',
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-border bg-surface/80 p-4 shadow-xl shadow-black/20 backdrop-blur ${className}`}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-5xl' : 'text-xl';
  const icon = size === 'lg' ? 44 : 22;
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${text}`}
    >
      <svg viewBox="0 0 48 48" width={icon} height={icon} aria-hidden="true">
        <circle cx="22" cy="28" r="16" fill="#1c2235" stroke="#f97316" strokeWidth="3" />
        <path d="M30 14l6-8" stroke="#fdba74" strokeWidth="3" strokeLinecap="round" />
        <circle cx="37" cy="5" r="3" fill="#f97316" />
        <circle cx="17" cy="23" r="4" fill="#ffffff" opacity="0.25" />
      </svg>
      <span>
        Word<span className="text-accent">Bomb</span>
      </span>
    </span>
  );
}
