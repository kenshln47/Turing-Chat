import type { ChatRequestBody } from "../types";

export interface ValidationConfig {
  allowedModels?: string[];
  maxMessages?: number;
  maxContentLength?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateChatRequest(
  body: Partial<ChatRequestBody>,
  config?: ValidationConfig
): ValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, error: "Messages array is required and cannot be empty" };
  }

  if (config?.maxMessages && body.messages.length > config.maxMessages) {
    return { valid: false, error: `Too many messages. Maximum allowed is ${config.maxMessages}` };
  }

  if (config?.maxContentLength) {
    for (const msg of body.messages) {
      if (msg.content && msg.content.length > config.maxContentLength) {
        return { valid: false, error: `Message content exceeds maximum length of ${config.maxContentLength} characters` };
      }
    }
  }

  if (!body.model || typeof body.model !== "string") {
    return { valid: false, error: "Model identifier is required" };
  }

  if (config?.allowedModels && !config.allowedModels.includes(body.model)) {
    return { valid: false, error: `Model '${body.model}' is not allowed` };
  }

  return { valid: true };
}
