import { describe, it, expect } from "vitest";
import { STAGE_0_PROMPT } from "../lib/prompts/stage-0";
import { OVERVIEW_PROMPT } from "../lib/prompts/overview";
import { MOOD_AND_TONE_PROMPT } from "../lib/prompts/mood-and-tone";
import { SCENE_BREAKDOWN_PROMPT } from "../lib/prompts/scene-breakdown";
import { STORYBOARD_PROMPTS_PROMPT } from "../lib/prompts/storyboard-prompts";
import { POSTER_CONCEPTS_PROMPT } from "../lib/prompts/poster-concepts";

describe("Prompts", () => {
  it("Stage 0 prompt includes JSON schema keywords", () => {
    expect(STAGE_0_PROMPT).toContain("scenes");
    expect(STAGE_0_PROMPT).toContain("characters");
    expect(STAGE_0_PROMPT).toContain("locations");
    expect(STAGE_0_PROMPT).toContain("props_master");
    expect(STAGE_0_PROMPT).toContain("slug_line");
  });

  it("Overview prompt includes all sections", () => {
    expect(OVERVIEW_PROMPT).toContain("Logline");
    expect(OVERVIEW_PROMPT).toContain("Synopsis");
    expect(OVERVIEW_PROMPT).toContain("Film Identity");
    expect(OVERVIEW_PROMPT).toContain("Themes");
    expect(OVERVIEW_PROMPT).toContain("Scope at a Glance");
  });

  it("Mood & Tone prompt includes all sections", () => {
    expect(MOOD_AND_TONE_PROMPT).toContain("Atmosphere");
    expect(MOOD_AND_TONE_PROMPT).toContain("Tonal Descriptors");
    expect(MOOD_AND_TONE_PROMPT).toContain("Color Palette");
    expect(MOOD_AND_TONE_PROMPT).toContain("Music & Sound Direction");
    expect(MOOD_AND_TONE_PROMPT).toContain("Reference Points");
    expect(MOOD_AND_TONE_PROMPT).toContain("Similar Moods");
  });

  it("Scene breakdown prompt asks for scene-by-scene output", () => {
    expect(SCENE_BREAKDOWN_PROMPT).toContain("Scene");
    expect(SCENE_BREAKDOWN_PROMPT).toContain("markdown");
  });

  it("Storyboard prompts prompt asks for per-scene outputs", () => {
    expect(STORYBOARD_PROMPTS_PROMPT).toContain("Scene");
    expect(STORYBOARD_PROMPTS_PROMPT).toContain("Camera");
    expect(STORYBOARD_PROMPTS_PROMPT).toContain("Lighting");
  });

  it("Poster concepts prompt asks for many concepts", () => {
    expect(POSTER_CONCEPTS_PROMPT).toContain("12-15");
    expect(POSTER_CONCEPTS_PROMPT).toContain("Character-Driven");
    expect(POSTER_CONCEPTS_PROMPT).toContain("Minimalist");
    expect(POSTER_CONCEPTS_PROMPT).toContain("Symbolic");
  });

  it("All prompts are non-empty strings", () => {
    const prompts = [
      STAGE_0_PROMPT,
      OVERVIEW_PROMPT,
      MOOD_AND_TONE_PROMPT,
      SCENE_BREAKDOWN_PROMPT,
      STORYBOARD_PROMPTS_PROMPT,
      POSTER_CONCEPTS_PROMPT,
    ];
    for (const p of prompts) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(100);
    }
  });
});
