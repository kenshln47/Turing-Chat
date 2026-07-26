"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SchemeToggle } from "./scheme-toggle";

const LINKS = [
  { href: "/arena", label: "Arena" },
  { href: "/chat", label: "Chat" },
];

/** Site chrome: wordmark plus the two live demos. */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark">
          <Aperture />
          Turing Chat
        </Link>

        <nav className="site-nav">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/kenshln47/Turing-Chat"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <SchemeToggle />
        </nav>
      </div>
    </header>
  );
}

/** The mark: an aperture ring, echoing the arena's idle state. */
function Aperture() {
  return (
    <svg
      className="wordmark__mark"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
      style={{ transform: "translateY(2px)" }}
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
