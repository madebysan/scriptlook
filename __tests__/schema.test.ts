import { describe, it, expect } from "vitest";
import { validateScreenplayJson } from "../lib/schema";

const VALID_JSON = JSON.stringify({
  title: "Test Movie",
  genre: ["Drama"],
  setting_period: "Contemporary",
  total_pages: 100,
  scenes: [
    {
      scene_number: 1,
      slug_line: "INT. OFFICE - DAY",
      location: "office",
      int_ext: "INT",
      time_of_day: "DAY",
      page_start: 1,
      page_end: 3,
      characters_present: ["JOHN"],
      key_visual_moment: "John stares at his phone",
      emotional_beat: "anticipation",
      props: ["phone"],
      wardrobe_notes: [],
      vfx_stunts: [],
      music_cue: "",
      notes: "",
    },
  ],
  characters: [
    {
      name: "JOHN",
      description: "30s, tired",
      arc_summary: "From doubt to confidence",
      scenes_present: [1],
      special_requirements: [],
      wardrobe_changes: 1,
    },
  ],
  locations: [
    {
      name: "office",
      description: "Cramped corner office",
      scenes: [1],
      int_ext: "INT",
      time_variations: ["DAY"],
      set_requirements: [],
    },
  ],
  props_master: [
    {
      item: "phone",
      scenes: [1],
      hero_prop: false,
      notes: "",
    },
  ],
  themes: ["ambition"],
  tone: "quiet drama",
});

describe("validateScreenplayJson", () => {
  it("accepts valid JSON", () => {
    const result = validateScreenplayJson(VALID_JSON);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.title).toBe("Test Movie");
  });

  it("rejects malformed JSON", () => {
    const result = validateScreenplayJson("not json");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  it("rejects JSON array", () => {
    const result = validateScreenplayJson("[]");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Expected a JSON object");
  });

  it("rejects empty object", () => {
    const result = validateScreenplayJson("{}");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects missing title", () => {
    const data = JSON.parse(VALID_JSON);
    delete data.title;
    const result = validateScreenplayJson(JSON.stringify(data));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("title"))).toBe(true);
  });

  it("rejects empty scenes", () => {
    const data = JSON.parse(VALID_JSON);
    data.scenes = [];
    const result = validateScreenplayJson(JSON.stringify(data));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("scenes"))).toBe(true);
  });

  it("rejects empty characters", () => {
    const data = JSON.parse(VALID_JSON);
    data.characters = [];
    const result = validateScreenplayJson(JSON.stringify(data));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("characters"))).toBe(true);
  });
});
