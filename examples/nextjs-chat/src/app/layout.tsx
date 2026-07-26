import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@turing-chat/react/themes/instrument.css";
import "./globals.css";
import { SiteHeader } from "./site-header";

const DESCRIPTION =
  "Run one prompt through every model on your machine, watch them answer side by side with real timings, and judge them blind. Your votes build a leaderboard that persists.";

export const metadata: Metadata = {
  title: {
    default: "Turing Chat — which local model is actually best?",
    template: "%s · Turing Chat",
  },
  description: DESCRIPTION,
  applicationName: "Turing Chat",
  keywords: [
    "local LLM",
    "Ollama",
    "LM Studio",
    "model comparison",
    "benchmark",
    "React",
    "chat UI",
  ],
  openGraph: {
    title: "Turing Chat — which local model is actually best?",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Turing Chat — which local model is actually best?",
    description: DESCRIPTION,
  },
  // An inline SVG favicon: a vermilion aperture on paper, matching the
  // wordmark. No binary asset to keep in sync.
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
              '<rect width="32" height="32" rx="5" fill="#FBF8F1"/>' +
              '<circle cx="16" cy="16" r="10" fill="none" stroke="#BF3B12" stroke-width="2" stroke-dasharray="3 3"/>' +
              '<circle cx="16" cy="16" r="4.5" fill="none" stroke="#BF3B12" stroke-width="2"/>' +
              '<circle cx="16" cy="16" r="1.5" fill="#BF3B12"/>' +
              "</svg>",
          ),
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF8F1" },
    { media: "(prefers-color-scheme: dark)", color: "#15130E" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The theme attribute lives on <html> so the marketing pages and the
    // embedded components share one set of tokens.
    //
    // suppressHydrationWarning: the scheme script below stamps
    // `data-turing-scheme` onto this element before React hydrates, so the
    // client tree legitimately differs from the server HTML here.
    <html lang="en" data-turing-theme="instrument" suppressHydrationWarning>
      <body>
        {/*
          Replays a pinned colour scheme before first paint. Without it the page
          renders at the system preference and then snaps to the stored choice —
          a visible flash on every navigation. `beforeInteractive` is the
          supported way to run this early; a bare <script> in the tree is never
          executed on client navigations.
        */}
        <Script id="turing-scheme" strategy="beforeInteractive">
          {`try{var s=localStorage.getItem('turing-scheme');if(s==='light'||s==='dark'){document.documentElement.setAttribute('data-turing-scheme',s)}}catch(e){}`}
        </Script>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="wrap site-footer__inner">
            <span>Local-first model evaluation for React. MIT licensed.</span>
            <a
              href="https://github.com/kenshln47/Turing-Chat"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub →
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
