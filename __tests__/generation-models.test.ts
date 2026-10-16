import { describe, expect, it } from "vitest";
import { getTextProviderOption, normalizeTextModel } from "@/lib/ai-providers";
import {
  DEFAULT_DECK_IMAGE_MODEL,
  normalizeImageModel,
} from "@/lib/image-models";
import {
  DEFAULT_DELIVERABLES,
  getGeneratedDocuments,
  getReportSections,
  normalizeDeliverables,
  resolveDeliverableDependencies,
} from "@/lib/deliverables";

describe("generation model selection", () => {
  it("keeps an allowed text model for its provider", () => {
    expect(normalizeTextModel("openai", "gpt-5.6-luna")).toBe("gpt-5.6-luna");
  });

  it("rejects a model from a different provider", () => {
    expect(normalizeTextModel("anthropic", "gpt-5.6-sol")).toBe(
      getTextProviderOption("anthropic").model,
    );
  });

  it("keeps a supported image model", () => {
    expect(normalizeImageModel("nano-banana-2")).toBe("nano-banana-2");
  });

  it("falls back safely for an unknown image model", () => {
    expect(normalizeImageModel("unknown-model")).toBe(DEFAULT_DECK_IMAGE_MODEL);
  });

  it("keeps storyboards opt-in for the default director deck", () => {
    expect(DEFAULT_DELIVERABLES).not.toContain("storyboards");
    expect(getGeneratedDocuments(DEFAULT_DELIVERABLES).map((document) => document.slug)).toEqual([
      "overview",
      "mood-and-tone",
      "scene-breakdown",
      "poster-concepts",
    ]);
  });

  it("adds the scenes dependency when storyboard briefs are selected", () => {
    expect(resolveDeliverableDependencies(["storyboards"])).toEqual([
      "storyboards",
      "scenes",
    ]);
  });

  it("can produce extraction-only reports without creative text calls", () => {
    const selection = ["locations", "breakdown", "schedule"] as const;
    expect(getGeneratedDocuments(selection)).toEqual([]);
    expect(getReportSections(selection)).toEqual(selection);
  });

  it("preserves the full legacy deck when older projects have no selection", () => {
    expect(normalizeDeliverables(undefined)).toContain("storyboards");
    expect(normalizeDeliverables(undefined)).toContain("shoot-brief");
  });
});
