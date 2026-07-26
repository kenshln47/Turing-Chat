"use client";

import { useEffect, useState } from "react";

type Scheme = "system" | "light" | "dark";

const STORAGE_KEY = "turing-scheme";

/**
 * Light/dark switch.
 *
 * The theme follows the operating system until you say otherwise; picking a
 * side writes `data-turing-scheme` on <html>, which the stylesheet honours over
 * the media query. The choice is remembered, and `layout.tsx` replays it before
 * first paint so the page never flashes the wrong scheme.
 */
export function SchemeToggle() {
  const [scheme, setScheme] = useState<Scheme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(STORAGE_KEY) as Scheme | null;
    if (stored === "light" || stored === "dark") setScheme(stored);
  }, []);

  function choose(next: Scheme) {
    setScheme(next);
    const root = document.documentElement;
    if (next === "system") {
      root.removeAttribute("data-turing-scheme");
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-turing-scheme", next);
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }

  // Rendered inert until mounted so the server and client markup agree.
  const active = mounted ? scheme : "system";

  return (
    <div className="scheme-toggle" role="group" aria-label="Colour scheme">
      <button
        type="button"
        onClick={() => choose(active === "light" ? "system" : "light")}
        aria-pressed={active === "light"}
        title="Light"
      >
        <SunIcon />
        <span className="sr-only">Light</span>
      </button>
      <button
        type="button"
        onClick={() => choose(active === "dark" ? "system" : "dark")}
        aria-pressed={active === "dark"}
        title="Dark"
      >
        <MoonIcon />
        <span className="sr-only">Dark</span>
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  );
}
