"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. Initial state follows the OS unless the viewer has
// chosen before (persisted in localStorage); the choice sets data-theme on
// <html>, which the token system in globals.css reads.
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const forced = document.documentElement.dataset.theme;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(forced ? forced === "dark" : sysDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode / blocked storage — ignore */
    }
  }

  // Reserve space until mounted so the header doesn't shift.
  if (dark === null) return <span className="h-9 w-9" aria-hidden />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-card text-sub transition-colors hover:text-ink hover:border-brand"
    >
      {dark ? (
        // sun — filled core for weight, evenly spaced rays
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.1 5.1l1.7 1.7M17.2 17.2l1.7 1.7M18.9 5.1l-1.7 1.7M6.8 17.2l-1.7 1.7" />
        </svg>
      ) : (
        // moon — clean filled crescent
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M12.5 3a.9.9 0 0 0-.86 1.17 7 7 0 0 1-8.8 8.8A.9.9 0 0 0 1.7 14.1 9 9 0 1 0 12.5 3Z" />
        </svg>
      )}
    </button>
  );
}
