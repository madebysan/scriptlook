// Validates the Stage 0 JSON schema structure.
// Not using Zod to keep dependencies minimal — just manual checks.

export type ScreenplayData = {
  title: string;
  genre: string[];
  setting_period: string;
  total_pages: number;
  scenes: Scene[];
  characters: Character[];
  locations: Location[];
  props_master: Prop[];
  themes: string[];
  tone: string;
};

export type Scene = {
  scene_number: number;
  slug_line: string;
  location: string;
  int_ext: string;
  time_of_day: string;
  page_start: number;
  page_end: number;
  length_eighths?: number;
  characters_present: string[];
  key_visual_moment: string;
  emotional_beat: string;
  props: string[];
  wardrobe_notes: string[];
  vfx_stunts: string[];
  music_cue: string;
  notes: string;
};

export type Character = {
  name: string;
  description: string;
  arc_summary: string;
  scenes_present: number[];
  special_requirements: string[];
  wardrobe_changes: number;
};

export type Location = {
  name: string;
  description: string;
  scenes: number[];
  int_ext: string;
  time_variations: string[];
  set_requirements: string[];
};

export type Prop = {
  item: string;
  scenes: number[];
  hero_prop: boolean;
  notes: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  data: ScreenplayData | null;
};

export function validateScreenplayJson(input: string): ValidationResult {
  const errors: string[] = [];

  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}`],
      data: null,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ["Expected a JSON object, not an array or primitive"],
      data: null,
    };
  }

  const obj = parsed as Record<string, unknown>;

  // Step 2: Check required top-level fields
  if (typeof obj.title !== "string" || !obj.title) {
    errors.push('Missing or empty "title" field');
  }

  if (!Array.isArray(obj.genre) || obj.genre.length === 0) {
    errors.push('Missing or empty "genre" array');
  }

  if (typeof obj.total_pages !== "number") {
    errors.push('"total_pages" must be a number');
  }

  // Step 3: Check scenes array
  if (!Array.isArray(obj.scenes)) {
    errors.push('Missing "scenes" array');
  } else if (obj.scenes.length === 0) {
    errors.push('"scenes" array is empty — no scenes found');
  } else {
    // Spot-check first scene
    const first = obj.scenes[0] as Record<string, unknown>;
    if (typeof first.scene_number !== "number") {
      errors.push("First scene missing scene_number");
    }
    if (typeof first.slug_line !== "string") {
      errors.push("First scene missing slug_line");
    }
  }

  // Step 4: Check characters array
  if (!Array.isArray(obj.characters)) {
    errors.push('Missing "characters" array');
  } else if (obj.characters.length === 0) {
    errors.push('"characters" array is empty — no characters found');
  }

  // Step 5: Check locations array
  if (!Array.isArray(obj.locations)) {
    errors.push('Missing "locations" array');
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data: obj as unknown as ScreenplayData };
}

// Defensively merge duplicate entries the extraction can still emit (same
// location name, character name, or prop item). Keeps the UI's name-based
// React keys collision-free and removes redundant cards; scene lists are
// merged. Returns the input unchanged if it does not parse. Applied at the
// app's entry points (submit + loadProject) so every viewer sees clean data.
export function normalizeScreenplayData(jsonData: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    return jsonData;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return jsonData;
  }
  const obj = parsed as Record<string, unknown>;

  const dedupe = (arr: unknown, keyField: string, sceneField: string): unknown => {
    if (!Array.isArray(arr)) return arr;
    const byKey = new Map<string, Record<string, unknown>>();
    let anon = 0;
    for (const raw of arr) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as Record<string, unknown>;
      const key = String(item[keyField] ?? "").trim().toLowerCase();
      if (!key) {
        byKey.set(`__anon_${anon++}`, item);
        continue;
      }
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        continue;
      }
      const a = Array.isArray(existing[sceneField]) ? (existing[sceneField] as number[]) : [];
      const b = Array.isArray(item[sceneField]) ? (item[sceneField] as number[]) : [];
      existing[sceneField] = Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
    }
    return Array.from(byKey.values());
  };

  obj.locations = dedupe(obj.locations, "name", "scenes");
  obj.characters = dedupe(obj.characters, "name", "scenes_present");
  obj.props_master = dedupe(obj.props_master, "item", "scenes");

  return JSON.stringify(obj);
}
