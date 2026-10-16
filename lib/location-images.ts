export const PRIORITY_LOCATION_LIMIT = 5;

export type LocationForImage = {
  name: string;
  description?: string;
  scenes?: number[];
  int_ext?: string;
  time_variations?: string[];
  set_requirements?: string[];
};

export type SceneForLocationImage = {
  scene_number: number;
  location?: string;
  key_visual_moment?: string;
  time_of_day?: string;
  int_ext?: string;
  vfx_stunts?: string[];
};

export function getLocationImageKey(location: Pick<LocationForImage, "name">): string {
  return location.name;
}

export function getScenesForLocation(
  location: LocationForImage,
  scenes: SceneForLocationImage[],
): SceneForLocationImage[] {
  const sceneNumbers = new Set(location.scenes ?? []);
  if (sceneNumbers.size > 0) {
    return scenes.filter((scene) => sceneNumbers.has(scene.scene_number));
  }

  const normalizedName = location.name.trim().toLowerCase();
  return scenes.filter((scene) => scene.location?.trim().toLowerCase() === normalizedName);
}

export function getPriorityLocations<T extends LocationForImage>(
  locations: T[],
  scenes: SceneForLocationImage[],
  limit = PRIORITY_LOCATION_LIMIT,
): T[] {
  return [...locations]
    .map((location) => ({
      location,
      score: getLocationPriorityScore(location, scenes),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.location.name.localeCompare(b.location.name);
    })
    .slice(0, limit)
    .map((item) => item.location);
}

export function buildLocationImagePrompt(
  location: LocationForImage,
  scenes: SceneForLocationImage[],
): string {
  const locationScenes = getScenesForLocation(location, scenes);
  const moments = locationScenes
    .map((scene) => scene.key_visual_moment?.trim())
    .filter((moment): moment is string => Boolean(moment))
    .slice(0, 4);
  const timeVariations = new Set([
    ...(location.time_variations ?? []),
    ...locationScenes.map((scene) => scene.time_of_day).filter((time): time is string => Boolean(time)),
  ]);
  const intExt = location.int_ext || summarizeIntExt(locationScenes);

  return [
    `Location: ${location.name}`,
    location.description ? `Scout read: ${location.description}` : "",
    intExt ? `Interior/exterior profile: ${intExt}` : "",
    timeVariations.size > 0 ? `Time variations: ${Array.from(timeVariations).join(", ")}` : "",
    location.set_requirements?.length
      ? `Set requirements: ${location.set_requirements.slice(0, 6).join("; ")}`
      : "",
    moments.length ? `Story moments to imply: ${moments.join(" / ")}` : "",
    "Create one cinematic environment reference plate for this place, not an exact real-world scouting photo.",
  ]
    .filter(Boolean)
    .join(". ");
}

function getLocationPriorityScore(
  location: LocationForImage,
  scenes: SceneForLocationImage[],
): number {
  const locationScenes = getScenesForLocation(location, scenes);
  const sceneCount = location.scenes?.length || locationScenes.length;
  const exteriorScore = isExteriorLocation(location, locationScenes) ? 12 : 0;
  const nightScore = isNightLocation(location, locationScenes) ? 10 : 0;
  const setRequirementScore = Math.min(location.set_requirements?.length ?? 0, 5) * 4;
  const stuntScore = Math.min(
    locationScenes.reduce((count, scene) => count + (scene.vfx_stunts?.length ?? 0), 0),
    4,
  ) * 5;

  return sceneCount * 100 + exteriorScore + nightScore + setRequirementScore + stuntScore;
}

function isExteriorLocation(
  location: LocationForImage,
  scenes: SceneForLocationImage[],
): boolean {
  const locationValue = location.int_ext?.toUpperCase() ?? "";
  if (locationValue.includes("EXT")) return true;
  return scenes.some((scene) => scene.int_ext?.toUpperCase().includes("EXT"));
}

function isNightLocation(
  location: LocationForImage,
  scenes: SceneForLocationImage[],
): boolean {
  const values = [
    ...(location.time_variations ?? []),
    ...scenes.map((scene) => scene.time_of_day ?? ""),
  ];
  return values.some((value) => {
    const normalized = value.toUpperCase();
    return normalized.includes("NIGHT") || normalized.includes("DUSK") || normalized.includes("DAWN");
  });
}

function summarizeIntExt(scenes: SceneForLocationImage[]): string {
  const values = new Set(
    scenes.map((scene) => scene.int_ext).filter((value): value is string => Boolean(value)),
  );
  return Array.from(values).join(" / ");
}
