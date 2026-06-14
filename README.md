# Turing Chat 🎯

> **Local-First AI Agent UI Library for React & Next.js**

Turing Chat is a premium, developer-first React component library designed to connect local AI models (like Ollama and LM Studio) directly to your web application. It features a stunning Midnight Violet hacker-themed chat console, side-by-side model comparison, dynamic agent presets, and an interactive developer terminal for client-executable function calling.

---

## Key Features

* 🎨 **Vigilante Aesthetics** — Sleek midnight-slate interface with neon accents, dynamic pulsing radar animations, and interactive action card suggestions.
* 🔌 **Human-In-The-Loop Tool Calling** — Collapsible console terminal nested in message bubbles to inspect arguments, execute local functions, and stream results back automatically.
* 📊 **Multi-Model Compare Mode** — Split-screen view to stream and test completions side-by-side with independent model selectors and stream abort controllers.
* 🎭 **Dynamic Agent Presets** — Swappable personas (Operative, Coder, Analyst) that change agent system instructions, temperatures, and layouts on the fly.
* 🔒 **Local-First & Secure** — Runs entirely on the client or proxied through a rate-limited Next.js route, keeping data secure and private.
* 🧠 **Persistent Memory** — IndexedDB and InMemory engines to persist and search conversation histories.

---

## Monorepo Workspace Structure

| Package | Description |
|:---|:---|
| [`@turing-chat/core`](./packages/core) | Framework-agnostic engine (Ollama/LM Studio provider implementations, stream parsers, memory persistence, presets). |
| [`@turing-chat/react`](./packages/react) | React hook integrations (`useTuringAgent`, `useModelManager`) and high-fidelity chat component layouts. |
| [`@turing-chat/nextjs`](./packages/nextjs) | Next.js API handlers (`createTuringHandler`), validator middlewares, and request rate-limiters. |
| [`examples/nextjs-chat`](./examples/nextjs-chat) | Reference playground chat application utilizing the package stack. |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install @turing-chat/react @turing-chat/core
```

### 2. Drop-in Chat Component
Create a chat interface with presets, custom branding, and type safety in a single line of code:

```tsx
import { TuringChat } from "@turing-chat/react";
import "@turing-chat/react/dist/themes/vigilante.css";

export default function ChatPage() {
  return (
    <TuringChat 
      model="llama3.2" 
      theme="vigilante"
      title="Turing Chat"
      showModelSelector={true}
      showThreadList={true}
    />
  );
}
```

### 3. Registering Client-Executable Tools
You can easily register functions (tools) that the agent can execute on the user's machine after verification:

```tsx
import { TuringChat, type ExecutableTool } from "@turing-chat/react";

const customTools: Record<string, ExecutableTool> = {
  calculator: {
    name: "calculator",
    description: "Perform arithmetic calculations.",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["add", "multiply"] },
        a: { type: "number" },
        b: { type: "number" }
      },
      required: ["operation", "a", "b"]
    },
    execute: async ({ operation, a, b }) => {
      return operation === "add" ? a + b : a * b;
    }
  }
};

// Pass customTools to the chat component
<TuringChat tools={customTools} />
```

---

## Architecture Guide & Diagrams

For an in-depth breakdown of package relationships, stream processing loops, and sequence diagrams for tool execution, please refer to the [System Architecture Guide](./C:/Users/Administrator/.gemini/antigravity/brain/9d4866e3-2907-4b27-8937-d208209e61a9/architecture_guide.md).

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
