"use client";

import { useState, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Star, Camera, Loader2, RefreshCw, Images, X, Package } from "lucide-react";
import { DepartmentLens, EvidencePill, ReportPanel } from "@/components/ui/department-lens";
import { getStylePrefix } from "@/lib/image-prompts";
import type { SavedImage } from "@/lib/reports";
import { useApiKeys } from "@/lib/api-keys-context";

type SubTab = "props" | "wardrobe";

type PropImageState = { status: "idle" | "generating" | "done" | "error"; url?: string };

type PropMaster = {
  item: string;
  scenes: number[];
  hero_prop?: boolean;
  notes?: string;
};

type SceneData = {
  scene_number: number;
  slug_line: string;
  characters_present?: string[];
  props?: string[];
  wardrobe_notes?: string[];
  vfx_stunts?: string[];
};

type CharacterData = {
  name: string;
  wardrobe_changes?: number;
  special_requirements?: string[];
};

type ScreenplayData = {
  scenes?: SceneData[];
  characters?: CharacterData[];
  props_master?: PropMaster[];
};

const EMPTY_SCENES: SceneData[] = [];
const EMPTY_CHARACTERS: CharacterData[] = [];
const EMPTY_PROPS: PropMaster[] = [];

type ProductionViewerProps = {
  jsonData: string;
  propImages: Record<string, SavedImage>;
  onPropImagesChange: (images: Record<string, SavedImage>) => void;
};

function parseData(jsonData: string): ScreenplayData {
  try {
    return JSON.parse(jsonData) as ScreenplayData;
  } catch {
    return {};
  }
}

type WardrobeEntry = { scene: number; note: string };

export function ProductionViewer({
  jsonData,
  propImages,
  onPropImagesChange,
}: ProductionViewerProps) {
  const data = parseData(jsonData);
  const scenes = data.scenes ?? EMPTY_SCENES;
  const characters = data.characters ?? EMPTY_CHARACTERS;
  const propsMaster = data.props_master ?? EMPTY_PROPS;

  const [tab, setTab] = useState<SubTab>("props");
  const [localPropImages, setLocalPropImages] = useState<Record<string, PropImageState>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [genAllProgress, setGenAllProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);
  const { ensureKeys } = useApiKeys();

  const mergedPropImages: Record<string, PropImageState> = useMemo(() => {
    const merged: Record<string, PropImageState> = {};
    for (const [k, v] of Object.entries(propImages)) {
      merged[k] = { status: "done", url: v.url };
    }
    for (const [k, v] of Object.entries(localPropImages)) {
      merged[k] = v;
    }
    return merged;
  }, [propImages, localPropImages]);

  const fetchPropImage = async (
    prop: PropMaster,
    falKey: string,
  ): Promise<{ url: string } | null> => {
    setLocalPropImages((prev) => ({ ...prev, [prop.item]: { status: "generating" } }));
    try {
      const res = await fetch("/api/generate-prop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prop.item,
          notes: prop.notes,
          stylePrefix: getStylePrefix("prop"),
          apiKey: falKey,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      setLocalPropImages((prev) => ({ ...prev, [prop.item]: { status: "done", url } }));
      return { url };
    } catch {
      setLocalPropImages((prev) => ({ ...prev, [prop.item]: { status: "error" } }));
      return null;
    }
  };

  const generateSingleProp = async (prop: PropMaster) => {
    const keys = await ensureKeys({ requireFal: true });
    if (!keys) return;
    const result = await fetchPropImage(prop, keys.falKey);
    if (result) {
      onPropImagesChange({ ...propImages, [prop.item]: { status: "done", url: result.url } });
    }
  };

  const generateAllPropImages = async () => {
    const toGenerate = propsMaster.filter((p) => !propImages[p.item]);
    if (toGenerate.length === 0) return;
    const keys = await ensureKeys({ requireFal: true });
    if (!keys) return;
    cancelRef.current = false;
    setGeneratingAll(true);
    setGenAllProgress({ done: 0, total: toGenerate.length });

    let accumulated: Record<string, SavedImage> = { ...propImages };
    for (let i = 0; i < toGenerate.length; i++) {
      if (cancelRef.current) break;
      const prop = toGenerate[i];
      const result = await fetchPropImage(prop, keys.falKey);
      if (result) {
        accumulated = { ...accumulated, [prop.item]: { status: "done", url: result.url } };
        onPropImagesChange(accumulated);
      }
      setGenAllProgress({ done: i + 1, total: toGenerate.length });
    }
    setGeneratingAll(false);
  };

  const cancelBulkProps = () => { cancelRef.current = true; };

  const missingPropImages = propsMaster.filter((p) => !propImages[p.item]).length;

  const wardrobeByCharacter = useMemo(() => {
    type NoteRecord = WardrobeEntry & { scenePresent: string[] };
    const allNotes: NoteRecord[] = [];
    for (const s of scenes) {
      const present = s.characters_present || [];
      for (const note of s.wardrobe_notes || []) {
        allNotes.push({ scene: s.scene_number, note, scenePresent: present });
      }
    }
    if (allNotes.length === 0) return { byCharacter: [], general: [] };

    // Attribute wardrobe notes to characters using scene-co-presence first,
    // then text matching as a tiebreaker. The old approach was substring-only
    // and collided badly: "JOE" matched "JOEL", "GONG" matched both "GONG GONG"
    // and "ALPHA GONG GONG", and short tokens ("JOY") fired on prose like
    // "joyful" inside a wardrobe note. Co-presence avoids all of that — a note
    // can only be attributed to a character who's actually in that scene.

    const charNames = characters.map((c) => c.name);
    const upperToCanonical = new Map<string, string>();
    for (const name of charNames) upperToCanonical.set(name.toUpperCase(), name);

    function findInNote(note: string, candidates: string[]): string | null {
      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];
      const upper = note.toUpperCase();
      // Prefer candidates whose full name appears in the note text. Use full
      // name (not single-word tokens) so "JOY" doesn't match "JOY WANG" inside
      // a sentence about something else.
      const textMatch = candidates.find((c) => upper.includes(c.toUpperCase()));
      return textMatch || null;
    }

    const byChar: Record<string, WardrobeEntry[]> = {};
    const general: WardrobeEntry[] = [];

    for (const entry of allNotes) {
      // Resolve scene's present characters to canonical character names.
      const candidates = entry.scenePresent
        .map((p) => upperToCanonical.get(p.toUpperCase()))
        .filter((c): c is string => Boolean(c));

      const matched = findInNote(entry.note, candidates);
      if (matched) {
        if (!byChar[matched]) byChar[matched] = [];
        byChar[matched].push({ scene: entry.scene, note: entry.note });
      } else {
        general.push({ scene: entry.scene, note: entry.note });
      }
    }

    const byCharacter = characters
      .filter((c) => byChar[c.name] || (c.wardrobe_changes && c.wardrobe_changes > 0))
      .map((c) => ({
        name: c.name,
        changes: c.wardrobe_changes ?? 0,
        notes: byChar[c.name] || [],
      }));

    return { byCharacter, general };
  }, [scenes, characters]);

  const heroPropsCount = propsMaster.filter((p) => p.hero_prop).length;
  const totalWardrobeChanges = characters.reduce((sum, c) => sum + (c.wardrobe_changes || 0), 0);
  const uniqueSceneLocations = new Set(scenes.map((s) => s.slug_line)).size;
  const heroProps = propsMaster.filter((p) => p.hero_prop).slice(0, 4);
  const vfxCueCount = scenes.reduce((sum, scene) => sum + (scene.vfx_stunts?.length || 0), 0);
  const wardrobeNoteCount = scenes.reduce((sum, scene) => sum + (scene.wardrobe_notes?.length || 0), 0);

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="Art Department"
        title="Production Design"
        subtitle="Props, wardrobe, and continuity."
        icon={Package}
        primaryRole="Production Designer"
        supportRole="Costume Designer / Prop Master"
        focus="material world, set dressing rules, hero objects, wardrobe logic"
        signals={[
          { label: "Hero Props", value: heroPropsCount },
          { label: "Wardrobe Notes", value: wardrobeNoteCount },
          { label: "VFX / Stunt Cues", value: vfxCueCount },
        ]}
      />

      <div className="mb-8 grid gap-3 md:grid-cols-[1fr_280px]">
        <ReportPanel eyebrow="Material World" title="Objects the Film Keeps Tracking">
          {heroProps.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {heroProps.map((prop) => (
                <div key={prop.item} className="rounded-[10px] border border-border bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="truncate text-[13px] font-medium capitalize tracking-normal text-foreground">
                      {prop.item}
                    </h2>
                    <EvidencePill>{prop.scenes.length} scenes</EvidencePill>
                  </div>
                  <p className="line-clamp-3 text-[12px] leading-[1.55] tracking-normal text-foreground/66">
                    {prop.notes || "Hero prop without notes. Keep continuity photos tight across appearances."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] leading-[1.6] text-foreground/68">
              No hero props are flagged yet. The prop list can still add texture,
              but nothing reads as an object the audience must track.
            </p>
          )}
        </ReportPanel>

        <ReportPanel eyebrow="Continuity" title="Design Load">
          <div className="space-y-3">
            <DesignLoadLine label="Tracked props" value={propsMaster.length} />
            <DesignLoadLine label="Wardrobe changes" value={totalWardrobeChanges} />
            <DesignLoadLine label="Scene setups" value={uniqueSceneLocations} />
          </div>
        </ReportPanel>
      </div>

      <div className="flex items-center gap-0 border-b border-border/60 mb-6">
        <SubTabButton active={tab === "props"} onClick={() => setTab("props")}>
          Props ({propsMaster.length})
        </SubTabButton>
        <SubTabButton active={tab === "wardrobe"} onClick={() => setTab("wardrobe")}>
          Wardrobe ({wardrobeByCharacter.byCharacter.length})
        </SubTabButton>

        {tab === "props" && propsMaster.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {generatingAll ? (
              <>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {genAllProgress.done}/{genAllProgress.total}
                </span>
                <button
                  onClick={cancelBulkProps}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:border-foreground/20 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </>
            ) : (
              missingPropImages > 0 && (
                <button
                  onClick={generateAllPropImages}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border hover:border-foreground/20 transition-colors"
                >
                  <Images size={14} />
                  Generate {missingPropImages === propsMaster.length ? "all" : `${missingPropImages} missing`} prop refs
                </button>
              )
            )}
          </div>
        )}
      </div>

      {tab === "props" && (
        <div className="space-y-3">
          {propsMaster.length === 0 ? (
            <Empty message="No prop list found in the screenplay data." />
          ) : (
            propsMaster.map((p) => (
              <PropCard
                key={p.item}
                prop={p}
                imageState={mergedPropImages[p.item] || { status: "idle" }}
                onGenerate={() => generateSingleProp(p)}
                generatingAll={generatingAll}
              />
            ))
          )}
        </div>
      )}

      {tab === "wardrobe" && (
        <div className="space-y-4">
          {wardrobeByCharacter.byCharacter.length === 0 && wardrobeByCharacter.general.length === 0 ? (
            <Empty message="No wardrobe notes across the screenplay." />
          ) : (
            <>
              {wardrobeByCharacter.byCharacter.map((c) => (
                <div key={c.name} className="rounded-[12px] border border-border bg-card/35 p-5 transition-all hover:border-foreground/18 hover:bg-card/45">
                  <div className="flex items-baseline justify-between gap-2 mb-3">
                    <span className="text-[14px] font-medium uppercase tracking-[0.04em] text-foreground">
                      {c.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
                      {c.changes} {c.changes === 1 ? "change" : "changes"}
                    </span>
                  </div>
                  {c.notes.length > 0 ? (
                    <div className="space-y-2">
                      {c.notes.map((w, i) => (
                        <div key={`${w.scene}-${i}`} className="flex items-start gap-3">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-[4px] bg-muted text-muted-foreground shrink-0">
                            S{w.scene}
                          </span>
                          <span className="text-[13px] leading-[1.6] text-foreground/80">{w.note}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground italic">No specific wardrobe descriptions in the script.</p>
                  )}
                </div>
              ))}

              {wardrobeByCharacter.general.length > 0 && (
                <div>
                  <SectionLabel>General Notes</SectionLabel>
                  <div className="space-y-2">
                    {wardrobeByCharacter.general.map((w, i) => (
                      <div
                        key={`gen-${w.scene}-${i}`}
                        className="flex items-start gap-3 rounded-[12px] border border-border bg-card/35 px-4 py-3 transition-all hover:border-foreground/18 hover:bg-card/45"
                      >
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-[4px] bg-muted text-muted-foreground shrink-0">
                          S{w.scene}
                        </span>
                        <span className="text-[13px] leading-[1.6] text-foreground/80">{w.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
      {children}
    </h3>
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-3 text-[12px] font-medium tracking-normal transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-px left-2 right-2 h-px bg-foreground" />
      )}
    </button>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{message}</p>;
}

function DesignLoadLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border bg-white/[0.02] px-3 py-2">
      <span className="text-[12px] tracking-normal text-foreground/72">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.11em] text-muted-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function PropCard({
  prop,
  imageState,
  onGenerate,
  generatingAll,
}: {
  prop: PropMaster;
  imageState: PropImageState;
  onGenerate: () => void;
  generatingAll: boolean;
}) {
  return (
    <div className="report-motion-card flex flex-col gap-4 rounded-[12px] border border-border bg-card/35 p-4 hover:border-foreground/18 hover:bg-card/45 sm:flex-row sm:gap-5 sm:p-5">
      <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-white/[0.03]">
        {imageState.status === "done" && imageState.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageState.url} alt={prop.item} className="w-full h-full object-cover" />
        ) : imageState.status === "generating" ? (
          <Loader2 size={20} className="text-muted-foreground animate-spin motion-reduce:animate-none" />
        ) : imageState.status === "error" ? (
          <button
            onClick={onGenerate}
            className="flex flex-col items-center justify-center gap-1 text-[10px] text-destructive/80 hover:text-destructive"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={generatingAll}
            className="report-motion-status flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate prop reference"
          >
            <Camera size={16} />
            Reference
          </button>
        )}

        {imageState.status === "done" && !generatingAll && (
          <button
            onClick={onGenerate}
            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
            title="Regenerate prop reference"
          >
            <RefreshCw size={16} className="text-white" />
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-2 mb-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold capitalize text-foreground tracking-normal">{prop.item}</h2>
            {prop.hero_prop && (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-border bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Star size={10} className="fill-current" />
                Hero
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0 tabular-nums">
            {prop.scenes.length} {prop.scenes.length === 1 ? "scene" : "scenes"}
          </span>
        </div>
        {prop.notes && (
          <p className="text-[13px] leading-[1.6] text-foreground/80 mt-1">{prop.notes}</p>
        )}
        {prop.scenes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {prop.scenes.map((sn) => (
              <span
                key={sn}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-[3px] rounded-[4px] bg-muted text-muted-foreground"
              >
                S{sn}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
