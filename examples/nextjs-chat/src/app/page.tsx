import Link from "next/link";

export default function Home() {
  return (
    <main>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Local model evaluation</p>
          <h1>
            Which of your models is <em>actually</em> best?
          </h1>
          <p className="lede">
            You have eight models pulled in Ollama. Public benchmarks tested none of your
            prompts on none of your hardware. Turing Chat asks all of them the same
            question, times every response, and hides the names until you have picked a
            winner.
          </p>
          <div className="cta-row">
            <Link href="/arena" className="btn btn--primary">
              Open the Arena
            </Link>
            <Link href="/chat" className="btn btn--ghost">
              Try the chat
            </Link>
          </div>
        </div>
      </section>

      {/* ── How ─────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <p className="section__label">How it works</p>
          <div className="steps">
            <div className="step">
              <span className="step__n">01</span>
              <h3>Ask once</h3>
              <p>
                One prompt goes to every model you selected. They run one at a time, so
                they never compete for the same GPU while being measured.
              </p>
            </div>
            <div className="step">
              <span className="step__n">02</span>
              <h3>Judge blind</h3>
              <p>
                Answers appear under shuffled labels. You cannot tell which came from the
                14B model, so you grade the writing instead of the parameter count.
              </p>
            </div>
            <div className="step">
              <span className="step__n">03</span>
              <h3>Keep the score</h3>
              <p>
                Each pick becomes a pairwise vote. An Elo table builds up across every
                comparison you run and survives a reload.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Measurements ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <p className="section__label">What gets measured</p>
          <h2>Timings you can trust</h2>
          <p>
            Everything is measured client-side so the numbers stay comparable between
            providers, and the interface throttles its own redraws so rendering never
            leaks into the results.
          </p>
          <div className="spec-scroll">
            <table className="spec">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>What it tells you</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TTFT</td>
                  <td>
                    Time to first token — how long the model sat there before saying
                    anything. Dominated by prompt evaluation and cold model loads.
                  </td>
                </tr>
                <tr>
                  <td>tok/s</td>
                  <td>
                    Decode throughput, measured after the first token arrives so a slow
                    start does not disguise itself as slow generation.
                  </td>
                </tr>
                <tr>
                  <td>Total</td>
                  <td>Wall-clock time for the complete response.</td>
                </tr>
                <tr>
                  <td>Elo</td>
                  <td>
                    Rating from your own pairwise votes, replayed in chronological order
                    so the standings never depend on load order.
                  </td>
                </tr>
                <tr>
                  <td>Median</td>
                  <td>
                    Performance is reported as a median, not a mean — one cold load would
                    otherwise poison the average for a model.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Install ─────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <p className="section__label">In your own app</p>
          <h2>Two components, no backend</h2>
          <p>
            Everything runs in the browser against your local server. Nothing is uploaded,
            and there is no service to sign up for.
          </p>
          <pre className="snippet">
            <code>
              <span className="c">{"// npm install @turing-chat/react @turing-chat/core"}</span>
              {"\n\n"}
              <span className="k">import</span>
              {" { ModelArena } "}
              <span className="k">from</span>
              {' "@turing-chat/react";\n'}
              <span className="k">import</span>
              {' "@turing-chat/react/themes/instrument.css";\n\n'}
              <span className="k">export default function</span>
              {" Page() {\n  "}
              <span className="k">return</span>
              {' <ModelArena baseUrl="http://localhost:11434" />;\n}'}
            </code>
          </pre>
        </div>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap">
          <p className="section__label">No models installed?</p>
          <h2>The demo runs on nothing at all</h2>
          <p>
            Both demos ship with a simulated provider — three models with different speeds
            and answering styles — so you can try the whole flow without downloading a
            single weight.
          </p>
          <div className="cta-row" style={{ marginTop: 24 }}>
            <Link href="/arena" className="btn btn--primary">
              Open the Arena
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
