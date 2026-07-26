"use client";

import { useMemo, useState } from "react";
import { ModelArena } from "@turing-chat/react";
import { mockProvider, ollamaProvider } from "@turing-chat/core";

/**
 * The arena demo.
 *
 * Defaults to the simulated provider so the page works with nothing installed;
 * untick it to compare the models actually on this machine.
 */
export default function ArenaPage() {
  const [useMock, setUseMock] = useState(true);

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
            onChange={(e) => setUseMock(e.target.checked)}
          />
          Simulated models
        </label>
      </div>

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
