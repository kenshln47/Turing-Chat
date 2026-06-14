"use client";

import { TuringChat, type ExecutableTool } from "@turing-chat/react";

const playgroundTools: Record<string, ExecutableTool> = {
  calculator: {
    name: 'calculator',
    description: 'Perform basic arithmetic calculations (add, subtract, multiply, divide).',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The math operation to perform.'
        },
        a: { type: 'number', description: 'The first number operand.' },
        b: { type: 'number', description: 'The second number operand.' }
      },
      required: ['operation', 'a', 'b']
    },
    execute: async (args: Record<string, any>) => {
      const { operation, a, b } = args;
      // Simulate a small network / computation delay so the spinner renders
      await new Promise((resolve) => setTimeout(resolve, 1500));
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          if (b === 0) return 'Error: Division by zero';
          return a / b;
        default:
          return 'Error: Unknown operation';
      }
    }
  },
  get_weather: {
    name: 'get_weather',
    description: 'Retrieve current meteorological weather conditions for a given city.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'The city name (e.g. "San Francisco", "London").' },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          default: 'celsius',
          description: 'Temperature unit.'
        }
      },
      required: ['location']
    },
    execute: async (args: Record<string, any>) => {
      const { location, unit = 'celsius' } = args;
      // Simulate delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const temp = Math.floor(Math.random() * 15) + 15; // 15 to 30
      const conditions = ['Sunny', 'Rainy', 'Cloudy', 'Overcast', 'Clear Sky'];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      return {
        location,
        temperature: `${temp}°${unit === 'celsius' ? 'C' : 'F'}`,
        condition,
        humidity: '58%',
        windSpeed: '14 km/h'
      };
    }
  }
};

export default function Home() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      padding: "16px",
      boxSizing: "border-box",
      background: "#0a0a0f",
      margin: 0,
      overflow: "hidden"
    }}>
      <TuringChat 
        showThreadList={true}
        showModelSelector={true}
        theme="vigilante" 
        tools={playgroundTools}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          boxSizing: "border-box"
        }}
        height="100%"
      />
    </main>
  );
}
