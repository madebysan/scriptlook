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

const IMAGE_BILLING_ERROR_RE =
  /(exhausted balance|insufficient|billing|payment|quota|top up|locked)/i;

// Status for a failed image request. fal.ai errors carry the provider's HTTP
// status, and the reason in `body.detail` (the message is only the status
// text). An empty balance arrives as a 403 whose detail reads "User is locked.
// Reason: Exhausted balance", not as a 402. Report it as 402 so the image queue
// can stop and tell the user, instead of failing every remaining image one by
// one. A rejected key (401) and a rate limit (429) pass through; everything
// else stays 500.
export function getImageGenerationErrorStatus(error: unknown): number {
  const accessStatus = getGenerationAccessErrorStatus(error);
  if (accessStatus !== 500) return accessStatus;

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : null;
  const message = error instanceof Error ? error.message : "";
  const reason = `${message} ${readProviderDetail(error)}`;

  if (status === 402 || ((status === 401 || status === 403) && IMAGE_BILLING_ERROR_RE.test(reason))) {
    return 402;
  }
  if (status === 401 || status === 403) return 401;
  if (status === 429) return 429;
  return 500;
}

function readProviderDetail(error: unknown): string {
  if (typeof error !== "object" || error === null || !("body" in error)) return "";
  const body = (error as { body: unknown }).body;
  if (typeof body !== "object" || body === null || !("detail" in body)) return "";
  const detail = (body as { detail: unknown }).detail;
  return typeof detail === "string" ? detail : "";
}

export function getGenerationAccessErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return 401;
  if (message.includes("Missing API key") || error instanceof z.ZodError) return 400;
  return 500;
}
