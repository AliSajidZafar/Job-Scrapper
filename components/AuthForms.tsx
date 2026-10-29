"use client";

import { useState } from "react";

// Sign-in and create-account forms. Both POST JSON to /api/auth/* and, on
// success, do a full navigation so the server renders with the new session.

const inputClass =
  "w-full rounded-lg border border-line bg-plane px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-brand";

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-sub">{props.label}</span>
      <input
        type={props.type}
        required
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={inputClass}
      />
      {props.hint && <span className="mt-1 block text-[11px] text-muted">{props.hint}</span>}
    </label>
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
    <p role="alert" className="rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">
      {error}
    </p>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-60"
    >
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
      className="space-y-4"
    >
      <Field label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} placeholder="you@company.com" />
      <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
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
      className="space-y-4"
    >
      <Field label="Full name" type="text" autoComplete="name" value={name} onChange={setName} placeholder="Your name" />
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@company.com" />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint="At least 8 characters."
      />
      <Field label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      <ErrorNote error={error} />
      <SubmitButton busy={busy} label="Create account" busyLabel="Creating account…" />
    </form>
  );
}
