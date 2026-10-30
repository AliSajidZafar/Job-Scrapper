"use client";

import { useState } from "react";

// Sign-in and create-account forms. Both POST JSON to /api/auth/* and, on
// success, do a full navigation so the server renders with the new session.

const inputClass =
  "h-11 w-full rounded-lg border border-line bg-card pl-10 pr-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-brand focus:ring-4 focus:ring-brand/15";

const ICONS = {
  user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

function Field(props: {
  label: string;
  type: string;
  icon: keyof typeof ICONS;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  hint?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const isPassword = props.type === "password";

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{props.label}</span>
      <span className="relative block">
        <Icon name={props.icon} />
        <input
          type={isPassword && shown ? "text" : props.type}
          required
          autoFocus={props.autoFocus}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className={`${inputClass} ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            title={shown ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {shown ? (
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" />
              ) : (
                <>
                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        )}
      </span>
      {props.hint && <span className="mt-1.5 block text-xs text-muted">{props.hint}</span>}
    </label>
  );
}

// 0–4 score: length plus character variety. Only a nudge — the server enforces 8+.
function strength(pw: string) {
  if (!pw) return 0;
  let s = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH = [
  { label: "Too short", bar: "bg-crit", text: "text-crit" },
  { label: "Weak", bar: "bg-crit", text: "text-crit" },
  { label: "Fair", bar: "bg-warn", text: "text-warn" },
  { label: "Good", bar: "bg-good", text: "text-good" },
  { label: "Strong", bar: "bg-good", text: "text-good" },
];

function StrengthMeter({ password }: { password: string }) {
  if (!password) return <>At least 8 characters.</>;
  const score = strength(password);
  const s = STRENGTH[score];
  return (
    <span className="flex items-center gap-3">
      <span className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 rounded-full ${i <= score ? s.bar : "bg-line"}`} />
        ))}
      </span>
      <span className={`w-16 text-right font-medium ${s.text}`}>{s.label}</span>
    </span>
  );
}

function useSubmit(url: string, redirectTo: string) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(payload: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        window.location.assign(redirectTo);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return { error, setError, busy, submit };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-crit/30 bg-crit/10 px-3 py-2.5 text-[13px] text-crit">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {error}
    </p>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
    >
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {busy ? busyLabel : label}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { error, busy, submit } = useSubmit("/api/auth/login", next);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({ email, password });
      }}
      className="space-y-5"
    >
      <Field label="Email" type="email" icon="mail" autoComplete="username" value={email} onChange={setEmail} placeholder="you@company.com" autoFocus />
      <Field label="Password" type="password" icon="lock" autoComplete="current-password" value={password} onChange={setPassword} placeholder="Your password" />
      <ErrorNote error={error} />
      <SubmitButton busy={busy} label="Sign in" busyLabel="Signing in…" />
    </form>
  );
}

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { error, setError, busy, submit } = useSubmit("/api/auth/signup", "/");
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password !== confirm) {
          setError("The two passwords don't match.");
          return;
        }
        submit({ name, email, password });
      }}
      className="space-y-5"
    >
      <Field label="Full name" type="text" icon="user" autoComplete="name" value={name} onChange={setName} placeholder="Your name" autoFocus />
      <Field label="Email" type="email" icon="mail" autoComplete="email" value={email} onChange={setEmail} placeholder="you@company.com" />
      <Field
        label="Password"
        type="password"
        icon="lock"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        placeholder="Create a password"
        hint={<StrengthMeter password={password} />}
      />
      <Field
        label="Confirm password"
        type="password"
        icon="lock"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Type it again"
        hint={mismatch ? <span className="text-crit">Passwords don&apos;t match yet.</span> : undefined}
      />
      <ErrorNote error={error} />
      <SubmitButton busy={busy} label="Create account" busyLabel="Creating account…" />
    </form>
  );
}
