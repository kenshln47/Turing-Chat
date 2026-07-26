"use client";

import { useEffect, useState } from "react";

/** What we know about the visitor's local Ollama. */
type Status = "checking" | "connected" | "unreachable" | "blocked";

const OLLAMA_URL = "http://localhost:11434";

/**
 * Probes the visitor's local Ollama and explains how to fix whatever is wrong.
 *
 * The two failure modes look identical to `fetch` — both surface as
 * "Failed to fetch" — so they are told apart with a `no-cors` retry. If that
 * succeeds, the request physically reached Ollama and only the CORS policy
 * refused it, which is a completely different fix from "the server is not
 * running". Getting this wrong sends people hunting for the wrong problem.
 */
export function useOllamaStatus(): { status: Status; models: string[] } {
  const [status, setStatus] = useState<Status>("checking");
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, {
          signal: AbortSignal.timeout(4000),
        });
        const data = await res.json();
        if (cancelled) return;
        setModels((data.models ?? []).map((m: { name: string }) => m.name));
        setStatus("connected");
      } catch {
        if (cancelled) return;
        try {
          // Reached the port but was refused by policy → CORS, not downtime.
          await fetch(`${OLLAMA_URL}/api/tags`, {
            mode: "no-cors",
            signal: AbortSignal.timeout(4000),
          });
          if (!cancelled) setStatus("blocked");
        } catch {
          if (!cancelled) setStatus("unreachable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, models };
}

/** Props for {@link OllamaNotice}. */
export interface OllamaNoticeProps {
  /** Current probe result. */
  status: Status;
  /** Models discovered, when connected. */
  models: string[];
  /** Whether the demo is currently showing simulated models. */
  usingMock: boolean;
  /** Switches between simulated and real models. */
  onUseMock: (useMock: boolean) => void;
}

/** Explains the current connection and, when broken, exactly how to fix it. */
export function OllamaNotice({
  status,
  models,
  usingMock,
  onUseMock,
}: OllamaNoticeProps) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (status === "checking") {
    return (
      <div className="notice">
        <span className="notice__dot notice__dot--idle" />
        Looking for Ollama on this machine…
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="notice notice--ok">
        <span className="notice__dot notice__dot--ok" />
        <div>
          <strong>Connected to Ollama.</strong> Found {models.length}{" "}
          {models.length === 1 ? "model" : "models"}: <code>{models.join(", ")}</code>
          {usingMock && (
            <>
              {" — "}
              <button type="button" className="linkish" onClick={() => onUseMock(false)}>
                compare your real models instead
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const isBlocked = status === "blocked";

  return (
    <div className="notice notice--warn">
      <span className="notice__dot notice__dot--warn" />
      <div>
        <strong>
          {isBlocked
            ? "Ollama is running, but it is refusing this page."
            : "No Ollama found on this machine."}
        </strong>

        {isBlocked ? (
          <>
            <p>
              Ollama only accepts browser requests from origins it has been told to
              trust. Allow this one, then reload:
            </p>
            <pre className="notice__cmd">
              <code>{`setx OLLAMA_ORIGINS "${origin || "https://…"}"`}</code>
            </pre>
            <p className="notice__hint">
              Windows — then quit Ollama from the tray and start it again. On macOS or
              Linux use{" "}
              <code>{`OLLAMA_ORIGINS="${origin || "https://…"}" ollama serve`}</code>.
            </p>
          </>
        ) : (
          <>
            <p>
              Install it from <a href="https://ollama.com">ollama.com</a>, pull a model,
              and reload this page:
            </p>
            <pre className="notice__cmd">
              <code>ollama pull llama3.2</code>
            </pre>
          </>
        )}

        {!usingMock && (
          <button type="button" className="linkish" onClick={() => onUseMock(true)}>
            Or preview the interface with simulated models →
          </button>
        )}
      </div>
    </div>
  );
}
