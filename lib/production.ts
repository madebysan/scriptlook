// Production-planning logic shared by the Breakdown, Schedule, and Scriptlook
// viewers. Everything here is pure and derived from the screenplay JSON the app
// already extracts — no new AI calls, no schema migration. Finer element
// categories (extras, vehicles, SFX, set dressing) need a Stage 0 extraction
// change and are tracked in the backlog; this module works with what exists today.

import type { ScreenplayData, Scene } from "@/lib/schema";

export function parseScreenplay(jsonData: string): ScreenplayData | null {
  try {
    const parsed = JSON.parse(jsonData);
    if (!parsed || !Array.isArray(parsed.scenes)) return null;
    return parsed as ScreenplayData;
  } catch {
    return null;
  }
}

// --- Scene length in eighths -------------------------------------------------

// 1 page = 8 eighths. We only have integer page_start/page_end, so a scene that
// opens and closes on the same page is assumed to run a half page (4/8), a sane
// average for a self-contained scene. Real eighths need the extraction to emit
// them directly — until then everything is labeled "est." in the UI.
const SAME_PAGE_EIGHTHS = 4;

export function sceneEighths(
  scene: Pick<Scene, "page_start" | "page_end" | "length_eighths">,
): number {
  // Prefer an explicit length from the extraction; fall back to the page-range
  // estimate for older data that predates the length_eighths field.
  if (typeof scene.length_eighths === "number" && scene.length_eighths > 0) {
    return Math.round(scene.length_eighths);
  }
  const end = Number.isFinite(scene.page_end) ? scene.page_end : scene.page_start;
  const span = end - scene.page_start;
  if (!Number.isFinite(span) || span <= 0) return SAME_PAGE_EIGHTHS;
  return Math.round(span * 8);
}

export function formatEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;
  if (whole === 0) return `${remainder}/8`;
  if (remainder === 0) return `${whole}`;
  return `${whole} ${remainder}/8`;
}

// --- Scene classification ----------------------------------------------------

export function isNight(scene: Pick<Scene, "time_of_day">): boolean {
  const t = (scene.time_of_day || "").toUpperCase();
  return t.includes("NIGHT") || t.includes("DUSK") || t.includes("EVENING");
}

export function isInterior(scene: Pick<Scene, "int_ext">): boolean {
  return (scene.int_ext || "").toUpperCase().includes("INT");
}

export function isExterior(scene: Pick<Scene, "int_ext">): boolean {
  return (scene.int_ext || "").toUpperCase().includes("EXT");
}

// --- Element breakdown -------------------------------------------------------

export type ElementCategory = "cast" | "props" | "wardrobe" | "vfxStunts";

export const ELEMENT_CATEGORY_LABELS: Record<ElementCategory, string> = {
  cast: "Cast",
  props: "Props",
  wardrobe: "Wardrobe",
  vfxStunts: "VFX & Stunts",
};

export const ELEMENT_CATEGORY_ORDER: ElementCategory[] = [
  "cast",
  "props",
  "wardrobe",
  "vfxStunts",
];

export function elementsForScene(scene: Scene, category: ElementCategory): string[] {
  switch (category) {
    case "cast":
      return scene.characters_present ?? [];
    case "props":
      return scene.props ?? [];
    case "wardrobe":
      return scene.wardrobe_notes ?? [];
    case "vfxStunts":
      return scene.vfx_stunts ?? [];
  }
}

export type ElementUsage = { name: string; scenes: number[] };

// Roll a category up across every scene into a deduped list, each element
// carrying the scene numbers it appears in, sorted by frequency then name.
export function aggregateElements(
  scenes: Scene[],
  category: ElementCategory,
): ElementUsage[] {
  const map = new Map<string, { name: string; scenes: Set<number> }>();
  for (const scene of scenes) {
    for (const raw of elementsForScene(scene, category)) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = map.get(key) ?? { name, scenes: new Set<number>() };
      entry.scenes.add(scene.scene_number);
      map.set(key, entry);
    }
  }
  return [...map.values()]
    .map((entry) => ({
      name: entry.name,
      scenes: [...entry.scenes].sort((a, b) => a - b),
    }))
    .sort(
      (a, b) => b.scenes.length - a.scenes.length || a.name.localeCompare(b.name),
    );
}

export function categoryCount(scenes: Scene[], category: ElementCategory): number {
  return aggregateElements(scenes, category).length;
}

// --- Whole-script summary ----------------------------------------------------

export type BreakdownSummary = {
  sceneCount: number;
  totalEighths: number;
  intCount: number;
  extCount: number;
  dayCount: number;
  nightCount: number;
};

export function summarize(scenes: Scene[]): BreakdownSummary {
  const nightCount = scenes.filter(isNight).length;
  return {
    sceneCount: scenes.length,
    totalEighths: scenes.reduce((sum, s) => sum + sceneEighths(s), 0),
    intCount: scenes.filter(isInterior).length,
    extCount: scenes.filter(isExterior).length,
    dayCount: scenes.length - nightCount,
    nightCount,
  };
}

function totalEighths(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + sceneEighths(s), 0);
}

// --- Shoot-day scheduling ----------------------------------------------------

// ~5 script pages a day is a realistic indie/student pace. Used to split a busy
// location across multiple days so the schedule stays plausible.
const TARGET_EIGHTHS_PER_DAY = 40;

const UNSPECIFIED_LOCATION = "Unspecified location";

function sceneLocation(scene: Scene): string {
  return (scene.location || "").trim() || UNSPECIFIED_LOCATION;
}

export type ShootDay = {
  day: number;
  locations: string[];
  scenes: Scene[];
  eighths: number;
  cast: string[];
  hasNight: boolean;
  hasExterior: boolean;
};

type SceneChunk = { scenes: Scene[]; eighths: number };

function minSceneNumber(scenes: Scene[]): number {
  return scenes.reduce((min, s) => Math.min(min, s.scene_number), Infinity);
}

// Suggest a shoot schedule in two passes. First, keep each location's scenes
// together and split it into chunks no longer than the daily page target (so a
// 43-page location becomes several days, not one impossible one). Then bin-pack
// those chunks into days so small locations share a day instead of each wasting
// one — a realistic small-crew compromise on company moves. This is a starting
// suggestion the user can reorder, not a stripboard solver.
export function suggestShootDays(scenes: Scene[]): ShootDay[] {
  const byLocation = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const loc = sceneLocation(scene);
    const list = byLocation.get(loc);
    if (list) list.push(scene);
    else byLocation.set(loc, [scene]);
  }

  const chunks: SceneChunk[] = [];
  for (const locScenes of byLocation.values()) {
    let scenesInChunk: Scene[] = [];
    let eighths = 0;
    for (const scene of locScenes) {
      const e = sceneEighths(scene);
      if (scenesInChunk.length > 0 && eighths + e > TARGET_EIGHTHS_PER_DAY) {
        chunks.push({ scenes: scenesInChunk, eighths });
        scenesInChunk = [];
        eighths = 0;
      }
      scenesInChunk.push(scene);
      eighths += e;
    }
    if (scenesInChunk.length > 0) chunks.push({ scenes: scenesInChunk, eighths });
  }

  // First-fit-decreasing bin packing: largest chunks first, each slotted into
  // the first day it fits, otherwise a new day.
  chunks.sort((a, b) => b.eighths - a.eighths);
  const bins: SceneChunk[] = [];
  for (const chunk of chunks) {
    const bin = bins.find(
      (b) => b.eighths + chunk.eighths <= TARGET_EIGHTHS_PER_DAY,
    );
    if (bin) {
      bin.scenes.push(...chunk.scenes);
      bin.eighths += chunk.eighths;
    } else {
      bins.push({ scenes: [...chunk.scenes], eighths: chunk.eighths });
    }
  }

  // Order days by their earliest scene so the schedule reads front-to-back.
  bins.sort((a, b) => minSceneNumber(a.scenes) - minSceneNumber(b.scenes));
  return bins.map((bin, i) => {
    const ordered = [...bin.scenes].sort(
      (a, b) => a.scene_number - b.scene_number,
    );
    return buildShootDay(i + 1, ordered);
  });
}

function buildShootDay(day: number, scenes: Scene[]): ShootDay {
  const locations = [...new Set(scenes.map(sceneLocation))];
  const cast = [
    ...new Set(
      scenes
        .flatMap((s) => s.characters_present ?? [])
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  return {
    day,
    locations,
    scenes,
    eighths: totalEighths(scenes),
    cast,
    hasNight: scenes.some(isNight),
    hasExterior: scenes.some(isExterior),
  };
}

// --- Suggested call times ----------------------------------------------------

// Call times are pure guesses without a real schedule, so we surface sane,
// clearly-editable defaults. Night-heavy days start in the afternoon; everything
// else starts at dawn. Cast is called after the crew's general call for the
// makeup/wardrobe buffer.
const DAY_GENERAL_CALL_MINUTES = 7 * 60; // 07:00
const NIGHT_GENERAL_CALL_MINUTES = 16 * 60; // 16:00
const CAST_BUFFER_MINUTES = 30;
const FIRST_SHOT_BUFFER_MINUTES = 60;

function formatClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export type CallTimes = {
  generalCall: string;
  castCall: string;
  firstShot: string;
};

export function suggestCallTimes(day: Pick<ShootDay, "hasNight">): CallTimes {
  const base = day.hasNight ? NIGHT_GENERAL_CALL_MINUTES : DAY_GENERAL_CALL_MINUTES;
  return {
    generalCall: formatClock(base),
    castCall: formatClock(base + CAST_BUFFER_MINUTES),
    firstShot: formatClock(base + FIRST_SHOT_BUFFER_MINUTES),
  };
}
