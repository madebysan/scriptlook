"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Camera,
  ChevronDown,
  Images,
  Loader2,
  MapPin,
  Moon,
  RefreshCw,
  Route,
  SunMedium,
  X,
} from "lucide-react";
import { DepartmentLens, EvidencePill, ReportPanel } from "@/components/ui/department-lens";
import { getStylePrefix } from "@/lib/image-prompts";
import {
  buildLocationImagePrompt,
  getLocationImageKey,
  getPriorityLocations,
  getScenesForLocation,
  PRIORITY_LOCATION_LIMIT,
  type LocationForImage,
  type SceneForLocationImage,
} from "@/lib/location-images";
import type { SavedImage } from "@/lib/reports";
import { useApiKeys } from "@/lib/api-keys-context";

type LocationData = LocationForImage & {
  name: string;
  description: string;
  scenes: number[];
  int_ext: string;
  time_variations: string[];
};

type SceneData = SceneForLocationImage & {
  scene_number: number;
  slug_line: string;
  location: string;
  key_visual_moment: string;
  time_of_day: string;
  int_ext: string;
};

type LocationImageState = {
  status: "idle" | "generating" | "done" | "error";
  url?: string;
};

type LocationsViewerProps = {
  jsonData: string;
  locationImages: Record<string, SavedImage>;
  onLocationImagesChange: (images: Record<string, SavedImage>) => void;
};

function parseLocations(jsonData: string): { locations: LocationData[]; scenes: SceneData[] } {
  try {
    const parsed = JSON.parse(jsonData);
    return {
      locations: parsed.locations || [],
      scenes: parsed.scenes || [],
    };
  } catch {
    return { locations: [], scenes: [] };
  }
}

export function LocationsViewer({
  jsonData,
  locationImages,
  onLocationImagesChange,
}: LocationsViewerProps) {
  const { locations, scenes } = parseLocations(jsonData);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(locations[0]?.name ? [locations[0].name] : []),
  );
  const [localLocationImages, setLocalLocationImages] = useState<Record<string, LocationImageState>>({});
  const [generatingPriority, setGeneratingPriority] = useState(false);
  const [priorityProgress, setPriorityProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);
  const { ensureKeys } = useApiKeys();

  const mergedLocationImages: Record<string, LocationImageState> = useMemo(() => {
    const merged: Record<string, LocationImageState> = {};
    for (const [key, image] of Object.entries(locationImages)) {
      merged[key] = { status: "done", url: image.url };
    }
    for (const [key, image] of Object.entries(localLocationImages)) {
      merged[key] = image;
    }
    return merged;
  }, [locationImages, localLocationImages]);

  const priorityLocationRefs = useMemo(
    () => getPriorityLocations(locations, scenes, PRIORITY_LOCATION_LIMIT),
    [locations, scenes],
  );
  const scoutReadLocations = priorityLocationRefs.slice(0, 3);

  const expandAll = () => setExpanded(new Set(locations.map((l) => l.name)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (name: string) => {
    const next = new Set(expanded);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpanded(next);
  };

  const fetchLocationImage = async (
    location: LocationData,
    falKey: string,
  ): Promise<{ key: string; url: string } | null> => {
    const key = getLocationImageKey(location);
    setLocalLocationImages((prev) => ({ ...prev, [key]: { status: "generating" } }));
    try {
      const res = await fetch("/api/generate-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: location.name,
          prompt: buildLocationImagePrompt(location, scenes),
          stylePrefix: getStylePrefix("location"),
          apiKey: falKey,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      setLocalLocationImages((prev) => ({ ...prev, [key]: { status: "done", url } }));
      return { key, url };
    } catch {
      setLocalLocationImages((prev) => ({ ...prev, [key]: { status: "error" } }));
      return null;
    }
  };

  const generateSingleLocation = async (location: LocationData) => {
    const keys = await ensureKeys({ requireFal: true });
    if (!keys) return;
    const result = await fetchLocationImage(location, keys.falKey);
    if (result) {
      onLocationImagesChange({
        ...locationImages,
        [result.key]: { status: "done", url: result.url },
      });
    }
  };

  const generatePriorityLocationImages = async () => {
    const toGenerate = priorityLocationRefs.filter((loc) => !locationImages[getLocationImageKey(loc)]);
    if (toGenerate.length === 0) return;
    const keys = await ensureKeys({ requireFal: true });
    if (!keys) return;

    cancelRef.current = false;
    setGeneratingPriority(true);
    setPriorityProgress({ done: 0, total: toGenerate.length });

    let accumulated: Record<string, SavedImage> = { ...locationImages };
    for (let i = 0; i < toGenerate.length; i++) {
      if (cancelRef.current) break;
      const location = toGenerate[i];
      const result = await fetchLocationImage(location, keys.falKey);
      if (result) {
        accumulated = {
          ...accumulated,
          [result.key]: { status: "done", url: result.url },
        };
        onLocationImagesChange(accumulated);
      }
      setPriorityProgress({ done: i + 1, total: toGenerate.length });
    }
    setGeneratingPriority(false);
  };

  const cancelPriorityGeneration = () => {
    cancelRef.current = true;
  };

  const nightSceneCount = scenes.filter((scene) => scene.time_of_day === "NIGHT").length;
  const exteriorSceneCount = scenes.filter((scene) => scene.int_ext === "EXT" || scene.int_ext === "BOTH").length;
  const companyMoveCount = Math.max(0, locations.length - 1);
  const missingPriorityImages = priorityLocationRefs.filter(
    (loc) => !locationImages[getLocationImageKey(loc)],
  ).length;

  if (locations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        No locations found in the screenplay data.
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="Geography"
        title="Locations"
        subtitle="Places, moves, nights, and exteriors."
        icon={MapPin}
        primaryRole="Location Scout"
        supportRole="Line Producer"
        focus="location personality, company moves, exterior/night risk"
        signals={[
          { label: "Locations", value: locations.length },
          { label: "Priority Refs", value: priorityLocationRefs.length },
          { label: "Night Scenes", value: nightSceneCount },
        ]}
      />

      <div className="mb-8 space-y-3">
        <ReportPanel eyebrow="Scout Read" title="Places With the Most Story Weight">
          <div className="space-y-3">
            {scoutReadLocations.map((loc) => (
              <div
                key={loc.name}
                className="grid gap-3 border-t border-border/70 py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(150px,220px)_1fr_auto] md:items-start"
              >
                <div className="min-w-0">
                  <h2 className="text-[14px] font-medium capitalize tracking-normal text-foreground">
                    {loc.name}
                  </h2>
                </div>
                <p className="text-[13px] leading-[1.6] tracking-normal text-foreground/70">
                  {loc.description}
                </p>
                <div className="md:justify-self-end">
                  <EvidencePill>{loc.scenes?.length ?? 0} scenes</EvidencePill>
                </div>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel eyebrow="Risk" title="Schedule Pressure">
          <div className="grid gap-3 md:grid-cols-3">
            <RiskLine icon={<Route size={13} />} label="Moves" value={`${companyMoveCount} estimated`} />
            <RiskLine icon={<Moon size={13} />} label="Night" value={`${nightSceneCount} scenes`} />
            <RiskLine icon={<SunMedium size={13} />} label="Exterior" value={`${exteriorSceneCount} scenes`} />
          </div>
        </ReportPanel>
      </div>

      <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Location Cards
          </h2>
          <p className="mt-1 text-[12px] leading-[1.5] text-foreground/58">
            Priority refs are capped at {PRIORITY_LOCATION_LIMIT}; individual scout plates stay manual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {generatingPriority ? (
            <>
              <span className="text-xs text-muted-foreground tabular-nums">
                {priorityProgress.done}/{priorityProgress.total}
              </span>
              <button
                onClick={cancelPriorityGeneration}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <X size={14} />
                Cancel
              </button>
            </>
          ) : (
            missingPriorityImages > 0 && (
              <button
                onClick={generatePriorityLocationImages}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <Images size={14} />
                Generate {missingPriorityImages} priority refs
              </button>
            )
          )}
          <button
            onClick={expanded.size === locations.length ? collapseAll : expandAll}
            className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded.size === locations.length ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {locations.map((loc) => {
          const sceneCount = loc.scenes?.length || 0;
          const locScenes = getScenesForLocation(loc, scenes);
          const isExpanded = expanded.has(loc.name);
          const imageKey = getLocationImageKey(loc);
          const imageState = mergedLocationImages[imageKey] || { status: "idle" };

          return (
            <div
              key={loc.name}
              className={`report-motion-card rounded-[12px] border ${
                isExpanded
                  ? "border-foreground/18 bg-card/45"
                  : "border-border bg-card/25 hover:border-foreground/18 hover:bg-card/40"
              }`}
            >
              <button
                onClick={() => toggle(loc.name)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-[15px] font-medium capitalize tracking-normal text-foreground">
                    <ChevronDown
                      size={14}
                      className={`report-expand-icon text-muted-foreground ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    {loc.name}
                  </h2>
                  {!isExpanded && (
                    <p className="report-motion-content mt-1 line-clamp-1 pl-5 text-[12px] text-foreground/65">
                      {loc.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="rounded-full border border-border bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {loc.int_ext}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                    {sceneCount} {sceneCount === 1 ? "scene" : "scenes"}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="report-motion-content space-y-4 px-5 pb-5 pl-[2.75rem]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="min-w-0 space-y-4">
                      <p className="text-[13px] leading-[1.6] text-foreground/70">
                        {loc.description}
                      </p>

                      {loc.time_variations && loc.time_variations.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {loc.time_variations.map((time) => (
                            <span
                              key={time}
                              className="rounded-[5px] border border-border bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                            >
                              {time}
                            </span>
                          ))}
                        </div>
                      )}

                      {loc.set_requirements && loc.set_requirements.length > 0 && (
                        <div className="border-t border-border/60 pt-4">
                          <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            Set Requirements
                          </h3>
                          <ul className="space-y-1.5 text-[13px] text-foreground/80">
                            {loc.set_requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="mt-[3px] text-muted-foreground">·</span>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <LocationReference
                      locationName={loc.name}
                      imageState={imageState}
                      onGenerate={() => generateSingleLocation(loc)}
                      disabled={generatingPriority}
                    />
                  </div>

                  {locScenes.length > 0 && (
                    <div className="border-t border-border/60 pt-4">
                      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        Scoutable Visual Moments
                      </h3>
                      <ul className="space-y-2 text-[13px] text-foreground/80">
                        {locScenes.map((s) => (
                          <li key={s.scene_number} className="flex items-start gap-3">
                            <span className="mt-[1px] shrink-0 rounded-[4px] bg-muted px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              S{s.scene_number}
                            </span>
                            <span className="leading-[1.55]">{s.key_visual_moment}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocationReference({
  locationName,
  imageState,
  onGenerate,
  disabled,
}: {
  locationName: string;
  imageState: LocationImageState;
  onGenerate: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="group relative aspect-video w-full overflow-hidden rounded-md border border-border/70 bg-white/[0.03]">
        {imageState.status === "done" && imageState.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageState.url} alt={`${locationName} scout plate`} className="h-full w-full object-cover" />
        ) : imageState.status === "generating" ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground motion-reduce:animate-none" />
          </div>
        ) : imageState.status === "error" ? (
          <button
            onClick={onGenerate}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-destructive/80 hover:text-destructive"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={disabled}
            className="report-motion-status flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Generate location reference"
          >
            <Camera size={16} />
            Scout plate
          </button>
        )}

        {imageState.status === "done" && (
          <button
            onClick={onGenerate}
            disabled={disabled}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
            title="Regenerate location reference"
          >
            <RefreshCw size={16} className="text-white" />
          </button>
        )}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Location reference
      </p>
    </div>
  );
}

function RiskLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-white/[0.02] px-3 py-2">
      <span className="inline-flex items-center gap-2 text-[12px] tracking-normal text-foreground/72">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
