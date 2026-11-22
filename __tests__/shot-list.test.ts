import { describe, expect, it } from "vitest";
import { suggestShots } from "@/lib/shot-list";
import type { Scene } from "@/lib/schema";

const BASE_SCENE: Scene = {
  scene_number: 4,
  slug_line: "INT. KITCHEN - DAY",
  location: "Kitchen",
  int_ext: "INT",
  time_of_day: "DAY",
  page_start: 3,
  page_end: 4,
  characters_present: ["MARA", "JON"],
  key_visual_moment: "Mara pours coffee and lets it overflow.",
  emotional_beat: "numb, then furious.",
  props: ["coffee pot"],
  wardrobe_notes: [],
  vfx_stunts: [],
  music_cue: "",
  notes: "",
};

describe("suggestShots", () => {
  it("does not double the full stop when scene text already ends a sentence", () => {
    const shots = suggestShots(BASE_SCENE);
    expect(shots[0].description).toBe(
      "Master covering Mara pours coffee and lets it overflow.",
    );
    for (const shot of shots) expect(shot.description).not.toMatch(/[.!?]\./);
  });

  it("falls back to a generic master when the scene has no visual moment", () => {
    const [master] = suggestShots({ ...BASE_SCENE, key_visual_moment: "", slug_line: "" });
    expect(master.description).toBe("Master covering the full scene.");
  });

  it("opens exteriors on an establishing wide", () => {
    const [first] = suggestShots({ ...BASE_SCENE, int_ext: "EXT", location: "Harbour" });
    expect(first.size).toBe("EWS");
    expect(first.description).toBe("Establishing wide of Harbour to place the action.");
  });
});
