import { describe, expect, it } from "vitest";
import {
  getImageGenerationErrorStatus,
  resolveImageGenerationAccess,
  resolveTextGenerationAccess,
} from "@/lib/generation-access";
import { createFalClientForRequest } from "@/lib/fal-client";

describe("generation access classification", () => {
  it("trims and accepts an explicit text-provider key", () => {
    expect(
      resolveTextGenerationAccess({ apiKey: " user-key ", apiProvider: "anthropic" }),
    ).toEqual({ apiKey: "user-key", provider: "anthropic" });
  });

  it("never treats a server key as implicit public access", () => {
    process.env.FAL_KEY = "server-key";

    expect(() => resolveImageGenerationAccess({ apiKey: undefined })).toThrow(
      "Missing API key",
    );
    expect(createFalClientForRequest(undefined)).toBeNull();
  });

  it("leaves a missing text key empty for route-level validation", () => {
    expect(
      resolveTextGenerationAccess({ apiKey: undefined, apiProvider: "anthropic" }),
    ).toEqual({ apiKey: "", provider: "anthropic" });
  });
});

describe("image generation error status", () => {
  // Same shape the fal.ai client throws: the message is the HTTP status text
  // and the provider's reason, when there is one, sits in `body.detail`.
  const providerError = (status: number, message: string, detail?: string) =>
    Object.assign(new Error(message), { status, body: detail ? { detail } : undefined });

  it("reports an empty fal.ai balance as 402 so the image queue can stop", () => {
    expect(
      getImageGenerationErrorStatus(
        providerError(
          403,
          "Forbidden",
          "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing.",
        ),
      ),
    ).toBe(402);
    expect(getImageGenerationErrorStatus(providerError(402, "Payment Required"))).toBe(402);
  });

  it("passes a rejected key and a rate limit through", () => {
    expect(getImageGenerationErrorStatus(providerError(401, "Unauthorized request"))).toBe(401);
    expect(getImageGenerationErrorStatus(providerError(403, "Forbidden"))).toBe(401);
    expect(getImageGenerationErrorStatus(providerError(429, "Too Many Requests"))).toBe(429);
  });

  it("keeps a missing key at 400 and everything else at 500", () => {
    expect(getImageGenerationErrorStatus(new Error("Missing API key"))).toBe(400);
    expect(getImageGenerationErrorStatus(providerError(422, "Unprocessable Entity"))).toBe(500);
    expect(getImageGenerationErrorStatus(new Error("No image returned from FLUX"))).toBe(500);
  });
});
