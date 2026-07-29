# Turing Chat

> **Find out which of your local models is actually best — with your prompts, on your hardware.**

[![Live demo](https://img.shields.io/badge/demo-turing--chat--gold.vercel.app-BF3B12.svg)](https://turing-chat-gold.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://github.com/kenshln47/Turing-Chat/actions/workflows/ci.yml/badge.svg)](https://github.com/kenshln47/Turing-Chat/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)

**→ [Try the live demo](https://turing-chat-gold.vercel.app/arena)** — runs on simulated models,
nothing to install.

You have eight models pulled in Ollama. Which one should you use for code? Which is fastest on
your GPU? Public benchmarks can't tell you — they didn't test your prompts or your machine.

Turing Chat is a React library that answers the question directly. Send one prompt to every local
model at once, watch them answer side by side with real timings, and pick a winner **without
seeing which model wrote which answer**. Your judgements build a persistent Elo leaderboard, and
saved prompt suites let you re-run the whole comparison after you swap a model or change
quantisation.

It ships a complete chat UI too — the arena is built on it.

<!-- TODO: add a screenshot of the arena mid-comparison, and one of the leaderboard.
     Put the files in docs/ and reference them here:
     ![The arena](docs/arena.png)
-->

---

## What it does

- **N-way comparison.** One prompt runs through every model you select, one at a time so they
  never compete for the same GPU while being measured.
- **Blind judging.** Answers appear under shuffled labels; names are revealed only after you vote.
- **Real timings.** Time-to-first-token, decode throughput, and total duration for every response.
- **Persistent standings.** Each pick becomes a pairwise vote feeding an Elo table that survives
  a reload.
- **Prompt suites.** Save the prompts you care about and re-run them after any change — regression
  testing for models.
- **Fully local.** Everything runs in the browser against your own server. No account, no upload,
  no backend.

---

## Project status

**Alpha, and not yet on npm.** The API still moves between versions.

The [live demo](https://turing-chat-gold.vercel.app) deploys from `main` on every push. To run it
locally:

```bash
git clone https://github.com/kenshln47/Turing-Chat.git
cd Turing-Chat
pnpm install
pnpm build
pnpm --filter nextjs-chat dev   # http://localhost:3000
```

The demo runs on a simulated provider by default, so it works with nothing installed.

To use the packages in your own app before they are published, reference them from the workspace
(`"@turing-chat/react": "workspace:*"` in a pnpm monorepo) or `pnpm link` the built package.

---

## Usage

### The arena

```tsx
import { ModelArena } from "@turing-chat/react";
import "@turing-chat/react/themes/instrument.css";

export default function Page() {
  return <ModelArena baseUrl="http://localhost:11434" />;
}
```

Models are discovered from your local server automatically. Ask a question, get every model's
answer side by side, pick the best one.

**No local models installed?** Use the built-in mock provider — three simulated models with
different speeds and answer styles, no downloads:

```tsx
import { ModelArena } from "@turing-chat/react";
import { mockProvider } from "@turing-chat/core";

<ModelArena provider={mockProvider()} />
```

### The chat

```tsx
import { TuringChat } from "@turing-chat/react";
import "@turing-chat/react/themes/instrument.css";

export default function ChatPage() {
  return <TuringChat model="llama3.2" showThreadList showModelSelector />;
}
```

Conversations persist to IndexedDB by default and are restored on reload.

---

## What gets measured

Every response is timed client-side so the numbers stay comparable across providers:

| Metric | Meaning |
|---|---|
| **TTFT** | Time to first token — how long before the model started answering |
| **Speed** | Decode throughput in tokens/sec, *excluding* the wait for the first token |
| **Total** | Wall-clock time for the whole response |
| **Tokens** | Completion tokens, as reported by the provider |

Two deliberate choices keep these numbers honest:

**Models run one at a time by default.** Local models share one GPU. Running them concurrently
makes them compete for memory bandwidth and inflates every measurement. Pass `concurrency={n}` if
you'd rather finish quickly than measure accurately.

**Standings report medians, not means.** The first request after a model is swapped into VRAM is
dramatically slower than steady state, and a single cold load would dominate an average.

---

## Blind judging

Model names are hidden until you vote, and the columns are shuffled so position doesn't leak
identity either. Knowing an answer came from the 14B model is enough to bias the judgement it's
supposed to receive.

A single pick expands into one pairwise vote against each other model, which is what Elo consumes.
Votes are replayed in chronological order, so standings are identical no matter what order runs
are loaded in.

---

## Prompt suites — regression testing for models

Save the prompts you actually care about, then re-run them whenever something changes:

```ts
import { createSuite, runSuite, ollamaProvider } from "@turing-chat/core";

const suite = createSuite("My work", [
  { name: "Refactor", prompt: "Simplify this reducer: …" },
  { name: "SQL", prompt: "Write a query that finds duplicate emails." },
]);

const runs = await runSuite({
  provider: ollamaProvider(),
  suite,
  models: ["llama3.2", "qwen2.5-coder", "phi4"],
});
```

`createStarterSuite()` gives you five prompts covering instruction-following, code generation,
reasoning, summarisation, and hallucination resistance.

Export results as Markdown, CSV, or a JSON backup:

```ts
import { toMarkdownReport, toLeaderboardCsv, computeLeaderboard } from "@turing-chat/core";

const report = toMarkdownReport(runs);
const csv = toLeaderboardCsv(computeLeaderboard(runs));
```

---

## Packages

| Package | Contents |
|:---|:---|
| [`@turing-chat/core`](./packages/core) | Providers (Ollama, LM Studio, mock), streaming parsers, metrics, the eval engine, memory backends, presets |
| [`@turing-chat/react`](./packages/react) | `ModelArena`, `TuringChat`, `Leaderboard`, and the hooks behind them |
| [`@turing-chat/nextjs`](./packages/nextjs) | Route handlers, request validation, rate limiting |
| [`examples/nextjs-chat`](./examples/nextjs-chat) | Deployable demo site: landing page, arena (`/arena`), chat (`/chat`) |

### Hooks

```ts
const arena = useArena({ models: ["llama3.2", "phi4"] });
await arena.start("Explain closures.");
await arena.vote(arena.run!.entries[0].id);
arena.standings; // ranked, persisted
```

`useTuringAgent`, `useConversation`, `useModelManager`, and `useArena` are all usable on their own
if you'd rather build your own UI.

---

## Chat features

- **Markdown with GFM** — tables, strikethrough, task lists, autolinks
- **Syntax highlighting** across 20+ languages, with per-block copy buttons
- **Human-in-the-loop tool calling** — inspect arguments, approve or decline, results stream back
- **Agent presets** — swappable personas with their own prompts and temperatures
- **Persistent threads** — IndexedDB by default, auto-titled from your first message
- **Three themes** — Instrument (paper & ink), Minimal, Corporate

---

## Development

```bash
pnpm install     # Node 18+, pnpm 9
pnpm build       # build all packages
pnpm test        # 229 tests across core and react
pnpm typecheck
pnpm --filter nextjs-chat dev
```

The demo site runs on the simulated provider by default, so it works with nothing installed.

### Known gaps

Honest list of what is not done yet:

- `@turing-chat/nextjs` has no test coverage.
- Prompt suites work through the API but have no UI yet — `runSuite()` is code-only.

## Architecture

See the [System Architecture Guide](./docs/architecture.md) for package relationships, stream
processing, and tool-execution sequence diagrams.

## License

MIT — see [LICENSE](./LICENSE).
