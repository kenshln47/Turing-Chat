import { ollamaProvider } from "@turing-chat/core";

export function createOllamaProvider(baseUrl?: string) {
  return ollamaProvider({ baseUrl });
}
