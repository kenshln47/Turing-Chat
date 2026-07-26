# Turing AI Architecture & Technical Documentation

This document describes the architectural layout, components, and data-flow sequences of the `@turing-ai` monorepo. It serves as the primary system design reference for building, extending, and utilizing the local-first React component library.

---

## 1. System Architecture Diagram

The codebase is organized as a Turborepo monorepo with three core packages and an example application playground. The following dependency graph illustrates the relationships between packages and external services (Ollama, LM Studio):

```mermaid
graph TD
    %% Packages
    subgraph Monorepo ["Turing AI Monorepo"]
        core["@turing-ai/core<br>(Core Engine)"]
        nextjs["@turing-ai/nextjs<br>(Server Utilities)"]
        react["@turing-ai/react<br>(Hooks & UI Components)"]
        example["examples/nextjs-chat<br>(Next.js Playground App)"]
    end

    %% External
    ollama["Local Ollama Service<br>(localhost:11434)"]
    lmstudio["Local LM Studio Service<br>(localhost:1234)"]

    %% Dependencies
    nextjs --> core
    react --> core
    example --> react
    example --> nextjs

    %% External Interactions
    core --> ollama
    core --> lmstudio
    nextjs --> ollama
```

### Monorepo Packages Breakdown
1. **`@turing-ai/core`**: Framework-agnostic typescript package. Contains providers (`ollamaProvider`, `lmStudioProvider`), conversation memory layer (`IndexedDB`, `InMemory`), stream parsing helpers (`parseNDJSON`), and model preset definitions.
2. **`@turing-ai/react`**: React package exporting hooks (`useTuringAgent`, `useModelManager`, `useConversation`) and components (`TuringChat`, `MessageBubble`, `InputBar`, `ModelSelector`, `ThreadList`). Integrates CSS themes like `instrument.css`.
3. **`@turing-ai/nextjs`**: Next.js proxy route handler (`createTuringHandler`) allowing requests to go through a secure, rate-limited backend instead of connecting directly from the client.

---

## 2. Message Streaming & Tool Execution Lifecycle

The sequence diagram below shows how a message flows from the user interface, streams tokens, requests a local tool execution, waits for human approval, runs the tool, and automatically feeds the output back into the AI model for completion:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Chat as TuringChat Component
    participant Hook as useTuringAgent Hook
    participant Proxy as Next.js API Proxy / Ollama
    participant Tool as Registered Local Tool

    User->>Chat: Type message and press Enter
    Chat->>Hook: send(messageContent)
    Note over Hook: Create 'user' message & 'assistant' placeholder
    Hook->>Proxy: provider.chat({ model, messages, tools })
    Proxy-->>Hook: Stream NDJSON chunks

    loop Processing stream chunks
        alt chunk.type === 'token'
            Hook->>Chat: Update assistant message text content
        else chunk.type === 'tool_call'
            Hook->>Chat: Render ToolInvocationConsole (PENDING)
        end
    end

    Note over Chat: Stream closes. Terminal Console shows 'Run Tool' button.
    User->>Chat: Clicks 'Run Tool'
    Chat->>Hook: executeTool(messageId, toolCallId)
    Note over Hook: State set to RUNNING (show spinner)
    Hook->>Tool: execute(arguments)
    Tool-->>Hook: Returns tool execution result
    Note over Hook: Create 'tool' role message in thread
    Hook->>Chat: Render ToolInvocationConsole (COMPLETED)
    Hook->>Proxy: provider.chat(updatedHistoryWithToolResult)
    Proxy-->>Hook: Stream follow-up text tokens
    Hook->>Chat: Update assistant message text
```

---

## 3. Advanced Features Walkthrough

### 3.1 Preset Selector (Persona Configuration)
Selecting a preset persona dynamically changes the agent's behavior. When a user selects a preset (e.g. Coder, Analyst, Operative) from the header select box:
1. **Context Update**: `activePreset` state updates in `<TuringChat>`.
2. **System Prompt Alignment**: `useTuringAgent` resolves the system prompt and temperature associated with the preset.
3. **Suggestion Grid Swap**: The suggestion action card grid (e.g., Code Audit, Security Scan) swaps options to align with the new model goals.

### 3.2 Human-In-The-Loop Tool Console
Designed as a collapsible, high-fidelity developer terminal inside the message bubble:
* **Interactive Approvals**: Displays inputs in formatted, colorized JSON syntax blocks.
* **Badges & Spinners**: Renders status badges (`PENDING` in violet, `RUNNING` in yellow with a CSS keyframe-spinner, `COMPLETED` in emerald green, `FAILED` / `DECLINED` in red or slate).
* **Safe Resuming**: Once executed, the result is appended as a `tool` role message in the chat history, and generator streaming starts again to produce the final textual explanation.

### 3.3 Multi-Model Compare Mode
When Compare Mode is active, `<TuringChat>` splits the page container into two parallel columns:
* **Dual Hook Instances**: Instantiates two independent instances of `useTuringAgent` (Agent A and Agent B).
* **Parallel Streaming**: Sends prompt commands concurrently to both hooks, triggering parallel `fetch` streaming calls to the AI backend.
* **Independent Controls**: Includes two isolated `<ModelSelector>` dropdowns in the header, letting developers compare model behaviors side-by-side.

---

## 4. CSS Theme Variables (`instrument.css`)

Structure lives in `variables.css` (scale, rhythm, motion, shared primitives); colour lives in the
theme. `instrument.css` is built on warm paper, black ink, and a single vermilion signal, with a
darkroom variant that keeps the same identity:

```css
[data-turing-theme="instrument"] {
  /* Surfaces — warm greys throughout, so nothing reads as dirty next to paper */
  --tur-color-bg: #fbf8f1;
  --tur-color-surface: #fffdf8;

  /* Ink — never pure black on warm paper */
  --tur-color-text: #17140f;
  --tur-color-text-muted: #8a8271;

  /* One signal colour, used only where the interface speaks to you */
  --tur-color-accent: #bf3b12;

  /* Structure is carried by hairlines, not shadow */
  --tur-color-border: #e3dbc7;

  /* Status hues are distinct from the signal, so "fastest" is never the accent */
  --tur-color-success: #1f6f43;
  --tur-color-error: #a11c1c;
}
```

Components reference tokens and never hardcode a colour, so a theme swap changes the entire
interface without touching component code. Three typographic voices are assigned by role: a serif
for prose, a sans for controls, and a monospace for every number and identifier.

The scheme follows the operating system and can be pinned with
`data-turing-scheme="light" | "dark"` on any ancestor.
