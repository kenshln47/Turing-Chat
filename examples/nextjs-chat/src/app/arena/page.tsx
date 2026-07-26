"use client";

import { useEffect, useMemo, useState } from "react";
import { ModelArena } from "@turing-chat/react";
import { mockProvider, ollamaProvider } from "@turing-chat/core";
import { OllamaNotice, useOllamaStatus } from "../ollama-status";

/**
 * The arena demo.
 *
 * Points at the visitor's own Ollama by default — comparing your real models is
 * the entire purpose, and defaulting to a simulation made the tool look like a
 * mock-up. The simulated provider stays available as a fallback so someone
 * without Ollama can still see how it works.
 */
export default function ArenaPage() {
  const { status, models } = useOllamaStatus();
  const [useMock, setUseMock] = useState(false);

  // Fall back to the simulation only once we know Ollama is not usable, and
  // only if the visitor has not already chosen for themselves.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && (status === "unreachable" || status === "blocked")) {
      setUseMock(true);
    }
  }, [status, touched]);

  function choose(next: boolean) {
    setTouched(true);
    setUseMock(next);
  }

  // Rebuilt only when the source changes — a new provider every render would
  // restart model discovery continuously.
  const provider = useMemo(
    () => (useMock ? mockProvider() : ollamaProvider()),
    [useMock],
  );

  return (
    <main className="wrap demo">
      <div className="demo__head">
        <div>
          <h1>Arena</h1>
          <p>
            One prompt, every selected model, real timings. Names stay hidden until you
            pick a winner.
          </p>
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => choose(e.target.checked)}
          />
          Simulated models
        </label>
      </div>

      <OllamaNotice
        status={status}
        models={models}
        usingMock={useMock}
        onUseMock={choose}
      />

      {/* Height is capped rather than filling the viewport: on a tall window
          `100vh` stretched the columns hundreds of pixels past their content. */}
      <ModelArena
        key={useMock ? "mock" : "ollama"}
        provider={provider}
        height="min(760px, calc(100vh - 190px))"
      />
    </main>
  );
}
