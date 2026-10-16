export const REPORT_SECTION_IDS = [
  "overview",
  "mood-and-tone",
  "scenes",
  "locations",
  "cast-and-crew",
  "production",
  "identity",
  "posters",
  "breakdown",
  "schedule",
  "shoot-plan",
  "shoot-brief",
] as const;

export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];
export type DeliverableId = ReportSectionId | "storyboards";
export type DeliverablePresetId = "director" | "visual" | "production" | "full" | "custom";

export type DeliverableOption = {
  id: DeliverableId;
  label: string;
  description: string;
  source: "creative text" | "extraction" | "image briefs";
};

export type DeliverablePreset = {
  id: Exclude<DeliverablePresetId, "custom">;
  label: string;
  description: string;
  deliverables: readonly DeliverableId[];
};

export type GeneratedDocumentDefinition = {
  name: string;
  slug: "overview" | "mood-and-tone" | "scene-breakdown" | "storyboard-prompts" | "poster-concepts";
};

export const DELIVERABLE_OPTIONS: readonly DeliverableOption[] = [
  { id: "overview", label: "Overview", description: "Logline, synopsis, themes, identity, and production footprint.", source: "creative text" },
  { id: "mood-and-tone", label: "Mood & Tone", description: "Atmosphere, references, palette, music, and visual language.", source: "creative text" },
  { id: "scenes", label: "Scenes", description: "Creative scene analysis, beats, coverage, and sequence.", source: "creative text" },
  { id: "storyboards", label: "Storyboard briefs", description: "A visual prompt for every scene. Images remain optional and are confirmed later.", source: "image briefs" },
  { id: "locations", label: "Locations", description: "Location inventory, requirements, scene usage, and risks.", source: "extraction" },
  { id: "cast-and-crew", label: "Cast & Crew", description: "Characters, casting direction, and suggested crew roles.", source: "extraction" },
  { id: "production", label: "Production Design", description: "Props, wardrobe, set requirements, and continuity.", source: "extraction" },
  { id: "identity", label: "Title & Palette", description: "Title treatment, typography, and palette derived from Mood & Tone.", source: "creative text" },
  { id: "posters", label: "Poster Concepts", description: "Campaign directions, compositions, taglines, and image prompts.", source: "creative text" },
  { id: "breakdown", label: "Breakdown", description: "Scene elements, page load, interiors, exteriors, and production flags.", source: "extraction" },
  { id: "schedule", label: "Schedule", description: "Suggested shooting order and production grouping.", source: "extraction" },
  { id: "shoot-plan", label: "Shoot Plan", description: "Shoot days, call times, cast needs, and company moves.", source: "extraction" },
  { id: "shoot-brief", label: "Shoot Brief", description: "A compact producer-facing summary of vision and scope.", source: "extraction" },
];

export const DELIVERABLE_PRESETS: readonly DeliverablePreset[] = [
  {
    id: "director",
    label: "Director's deck",
    description: "The strongest creative deck without storyboard volume.",
    deliverables: ["overview", "mood-and-tone", "scenes", "identity", "posters"],
  },
  {
    id: "visual",
    label: "Visual pitch",
    description: "Mood, identity, and poster development for pitching the film.",
    deliverables: ["overview", "mood-and-tone", "identity", "posters"],
  },
  {
    id: "production",
    label: "Production breakdown",
    description: "Practical planning derived mostly from the screenplay extraction.",
    deliverables: ["scenes", "locations", "cast-and-crew", "production", "breakdown", "schedule", "shoot-plan", "shoot-brief"],
  },
  {
    id: "full",
    label: "Full deck",
    description: "Every report section. Storyboard briefs remain optional.",
    deliverables: REPORT_SECTION_IDS,
  },
];

export const DEFAULT_DELIVERABLES: readonly DeliverableId[] = DELIVERABLE_PRESETS[0].deliverables;
export const LEGACY_DELIVERABLES: readonly DeliverableId[] = [...REPORT_SECTION_IDS, "storyboards"];

const DOCUMENT_DEFINITIONS: readonly GeneratedDocumentDefinition[] = [
  { name: "Overview", slug: "overview" },
  { name: "Mood & Tone", slug: "mood-and-tone" },
  { name: "Scenes", slug: "scene-breakdown" },
  { name: "Storyboards", slug: "storyboard-prompts" },
  { name: "Poster Concepts", slug: "poster-concepts" },
];

export function normalizeDeliverables(
  value: unknown,
  fallback: readonly DeliverableId[] = LEGACY_DELIVERABLES,
): DeliverableId[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<DeliverableId>([...REPORT_SECTION_IDS, "storyboards"]);
  const normalized = value.filter((item): item is DeliverableId =>
    typeof item === "string" && allowed.has(item as DeliverableId),
  );
  return normalized.length > 0 ? [...new Set(normalized)] : [...fallback];
}

export function resolveDeliverableDependencies(value: readonly DeliverableId[]): DeliverableId[] {
  const selected = new Set(value);
  if (selected.has("storyboards")) selected.add("scenes");
  return [...selected];
}

export function getGeneratedDocuments(
  value: readonly DeliverableId[],
): GeneratedDocumentDefinition[] {
  const selected = new Set(resolveDeliverableDependencies(value));
  return DOCUMENT_DEFINITIONS.filter((document) => {
    if (document.slug === "overview") return selected.has("overview");
    if (document.slug === "mood-and-tone") {
      return selected.has("mood-and-tone") || selected.has("identity");
    }
    if (document.slug === "scene-breakdown") return selected.has("scenes");
    if (document.slug === "storyboard-prompts") return selected.has("storyboards");
    return selected.has("posters");
  });
}

export function getReportSections(value: readonly DeliverableId[]): ReportSectionId[] {
  const selected = new Set(resolveDeliverableDependencies(value));
  return REPORT_SECTION_IDS.filter((section) => selected.has(section));
}

export function hasImageDeliverables(value: readonly DeliverableId[]): boolean {
  const selected = new Set(value);
  return ["storyboards", "locations", "cast-and-crew", "production", "posters"]
    .some((id) => selected.has(id as DeliverableId));
}
