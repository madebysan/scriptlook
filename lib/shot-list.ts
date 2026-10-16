// Shot-list logic. The heuristic is the always-on, keyless baseline derived from
// scene data the app already has; the AI prompt + parser power the optional
// per-scene "Generate with AI" upgrade. Pure functions only.

import type { Scene } from "@/lib/schema";

export type ShotSize = "EWS" | "WS" | "MS" | "MCU" | "CU" | "OTS" | "INSERT";
export type ShotSource = "heuristic" | "ai";

export type Shot = {
  id: string;
  size: ShotSize;
  subject: string;
  movement: string;
  description: string;
  source: ShotSource;
};

const SHOT_SIZES: ShotSize[] = ["EWS", "WS", "MS", "MCU", "CU", "OTS", "INSERT"];
const MAX_HEURISTIC_SHOTS = 6;
const MAX_AI_SHOTS = 10;

function isExterior(scene: Scene): boolean {
  return (scene.int_ext || "").toUpperCase().includes("EXT");
}

// Rule-based coverage: an establishing/master, a single per principal in the
// scene, an over-the-shoulder when two are present, an insert for a hero prop,
// and a reaction close-up when the scene carries an emotional beat. Generic but
// sensible, and it works with zero API keys on every scene.
export function suggestShots(scene: Scene): Shot[] {
  const draft: Omit<Shot, "id">[] = [];
  const cast = (scene.characters_present ?? []).map((c) => c.trim()).filter(Boolean);
  const props = (scene.props ?? []).map((p) => p.trim()).filter(Boolean);
  const exterior = isExterior(scene);

  draft.push({
    size: exterior ? "EWS" : "WS",
    subject: scene.location || "Scene",
    movement: exterior ? "Slow push in" : "Static",
    description: exterior
      ? `Establishing wide of ${scene.location || "the location"} to place the action.`
      : `Master covering ${scene.key_visual_moment || scene.slug_line || "the full scene"}.`,
    source: "heuristic",
  });

  for (const name of cast.slice(0, 3)) {
    draft.push({
      size: "MCU",
      subject: name,
      movement: "Static",
      description: `Coverage single on ${name}.`,
      source: "heuristic",
    });
  }

  if (cast.length >= 2) {
    draft.push({
      size: "OTS",
      subject: `${cast[0]} / ${cast[1]}`,
      movement: "Static",
      description: `Over-the-shoulder between ${cast[0]} and ${cast[1]} for the exchange.`,
      source: "heuristic",
    });
  }

  if (props.length > 0) {
    draft.push({
      size: "INSERT",
      subject: props[0],
      movement: "Static",
      description: `Insert on ${props[0]}.`,
      source: "heuristic",
    });
  }

  if (scene.emotional_beat && cast.length > 0) {
    draft.push({
      size: "CU",
      subject: cast[0],
      movement: "Static",
      description: `Reaction close-up on ${cast[0]}: ${scene.emotional_beat}.`,
      source: "heuristic",
    });
  }

  return draft
    .slice(0, MAX_HEURISTIC_SHOTS)
    .map((shot, i) => ({ ...shot, id: `s${scene.scene_number}-${i + 1}` }));
}

export const SHOT_LIST_SYSTEM_PROMPT = `You are an experienced director of photography building a shot list for ONE scene of an indie film shot by a small crew.

Return ONLY a JSON array — no prose, no markdown code fences, no commentary. Each element is an object with exactly these string fields:
- "size": one of "EWS", "WS", "MS", "MCU", "CU", "OTS", "INSERT"
- "subject": who or what the shot is on (short)
- "movement": camera movement, e.g. "Static", "Slow push in", "Handheld follow", "Pan", "Dolly"
- "description": one concise sentence on what the shot captures and why it serves the scene

Propose 4 to 7 shots that cover the scene efficiently and reflect its specific tone, blocking, and emotional beat. Order them as you would shoot or cut them. Output the JSON array only.`;

// Tolerant parser: models often wrap JSON in prose or code fences, so we slice
// to the outermost array, parse, and coerce each entry into a valid Shot.
export function parseAiShots(raw: string, sceneNumber: number): Shot[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const shots: Shot[] = [];
  parsed.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const entry = item as Record<string, unknown>;
    const rawSize = typeof entry.size === "string" ? entry.size.toUpperCase() : "";
    const size = (SHOT_SIZES as string[]).includes(rawSize)
      ? (rawSize as ShotSize)
      : "MS";
    const subject = typeof entry.subject === "string" ? entry.subject.trim() : "";
    const movement =
      typeof entry.movement === "string" && entry.movement.trim()
        ? entry.movement.trim()
        : "Static";
    const description =
      typeof entry.description === "string" ? entry.description.trim() : "";
    if (!subject && !description) return;
    shots.push({
      id: `s${sceneNumber}-ai-${i + 1}`,
      size,
      subject,
      movement,
      description,
      source: "ai",
    });
  });

  return shots.slice(0, MAX_AI_SHOTS);
}
