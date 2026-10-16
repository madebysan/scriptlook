import { describe, expect, it } from "vitest";
import {
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
