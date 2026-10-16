import { createFalClient } from "@fal-ai/client";

export function createFalClientForRequest(clientKey: unknown) {
  const apiKey = typeof clientKey === "string" ? clientKey.trim() : "";
  if (!apiKey) return null;
  return createFalClient({ credentials: apiKey });
}

export function createFalClientWithCredentials(credentials: string) {
  const normalizedCredentials = credentials.trim();
  if (!normalizedCredentials) return null;
  return createFalClient({ credentials: normalizedCredentials });
}
