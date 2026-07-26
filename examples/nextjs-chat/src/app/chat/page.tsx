"use client";

import { useMemo, useState } from "react";
import { TuringChat, type ExecutableTool } from "@turing-chat/react";
import { mockProvider, ollamaProvider } from "@turing-chat/core";

/**
 * Tools the assistant may call, executed here in the browser.
 *
 * Nothing runs without approval — each call surfaces its arguments in the
 * message and waits for you to accept or decline.
 */
const playgroundTools: Record<string, ExecutableTool> = {
  calculator: {
    name: "calculator",
    description: "Perform basic arithmetic (add, subtract, multiply, divide).",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The math operation to perform.",
        },
        a: { type: "number", description: "The first operand." },
        b: { type: "number", description: "The second operand." },
      },
      required: ["operation", "a", "b"],
    },
    execute: async (args: Record<string, any>) => {
      const { operation, a, b } = args;
      // A short delay so the running state is actually visible.
      await new Promise((resolve) => setTimeout(resolve, 900));
      switch (operation) {
        case "add":
          return a + b;
        case "subtract":
          return a - b;
        case "multiply":
          return a * b;
        case "divide":
          return b === 0 ? "Error: division by zero" : a / b;
        default:
          return `Error: unknown operation "${operation}"`;
      }
    },
  },
  get_weather: {
    name: "get_weather",
    description: "Retrieve current weather conditions for a city.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: 'City name, e.g. "Riyadh".' },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          default: "celsius",
          description: "Temperature unit.",
        },
      },
      required: ["location"],
    },
    execute: async (args: Record<string, any>) => {
      const { location, unit = "celsius" } = args;
      await new Promise((resolve) => setTimeout(resolve, 900));
      const temp = Math.floor(Math.random() * 15) + 15;
      const conditions = ["Sunny", "Rainy", "Cloudy", "Overcast", "Clear"];
      return {
        location,
        temperature: `${temp}°${unit === "celsius" ? "C" : "F"}`,
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        humidity: "58%",
        windSpeed: "14 km/h",
        note: "Simulated reading from the demo tool.",
      };
    },
  },
};

export default function ChatPage() {
  const [useMock, setUseMock] = useState(true);

  const provider = useMemo(
    () => (useMock ? mockProvider() : ollamaProvider()),
    [useMock],
  );

  return (
    <main className="wrap demo">
      <div className="demo__head">
        <div>
          <h1>Chat</h1>
          <p>
            Markdown, syntax highlighting, approved tool calls, and threads that survive a
            reload. Switch on compare mode to put two models side by side.
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

      <TuringChat
        key={useMock ? "mock" : "ollama"}
        provider={provider}
        model={useMock ? "mock-sage:14b" : "llama3.2"}
        compareModel={useMock ? "mock-swift:3b" : undefined}
        tools={playgroundTools}
        showThreadList
        showModelSelector
        height="min(720px, calc(100vh - 190px))"
      />
    </main>
  );
}
