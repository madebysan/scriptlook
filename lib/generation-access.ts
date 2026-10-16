import { normalizeTextProvider, type TextProvider } from "@/lib/ai-providers";
import { z } from "zod";

export type ResolvedTextAccess = {
  apiKey: string;
  provider: TextProvider;
};

export type ResolvedImageAccess = {
  apiKey: string;
};

function requireClientKey(value: unknown): string {
  const clientKey = typeof value === "string" ? value.trim() : "";
  if (!clientKey) throw new Error("Missing API key");
  return clientKey;
}

export function resolveTextGenerationAccess(body: {
  apiKey?: unknown;
  apiProvider?: unknown;
}): ResolvedTextAccess {
  return {
    apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
    provider: normalizeTextProvider(body.apiProvider),
  };
}

export function resolveImageGenerationAccess(body: {
  apiKey?: unknown;
}): ResolvedImageAccess {
  return { apiKey: requireClientKey(body.apiKey) };
}

export function getGenerationAccessErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return 401;
  if (message.includes("Missing API key") || error instanceof z.ZodError) return 400;
  return 500;
}
