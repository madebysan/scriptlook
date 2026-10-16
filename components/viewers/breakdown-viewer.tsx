"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Layers, Moon, SunMedium, Building2 } from "lucide-react";
import {
  DepartmentLens,
  EvidencePill,
  ReportPanel,
} from "@/components/ui/department-lens";
import {
  parseScreenplay,
  sceneEighths,
  formatEighths,
  isNight,
  isInterior,
  aggregateElements,
  categoryCount,
  elementsForScene,
  summarize,
  ELEMENT_CATEGORY_LABELS,
  ELEMENT_CATEGORY_ORDER,
  type ElementCategory,
} from "@/lib/production";
import type { ReactNode } from "react";

type BreakdownViewerProps = {
  jsonData: string;
};

export function BreakdownViewer({ jsonData }: BreakdownViewerProps) {
  const data = useMemo(() => parseScreenplay(jsonData), [jsonData]);
  const scenes = useMemo(() => data?.scenes ?? [], [data]);

  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(scenes[0] ? [scenes[0].scene_number] : []),
  );
  const [activeCategory, setActiveCategory] = useState<ElementCategory>("cast");

  const summary = useMemo(() => summarize(scenes), [scenes]);
  const elements = useMemo(
    () => aggregateElements(scenes, activeCategory),
    [scenes, activeCategory],
  );

  if (!data || scenes.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No scene data found in the screenplay. The breakdown is derived from the
        scene list.
      </div>
    );
  }

  const expandAll = () =>
    setExpanded(new Set(scenes.map((s) => s.scene_number)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (n: number) => {
    const next = new Set(expanded);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setExpanded(next);
  };
  const allExpanded = expanded.size === scenes.length;

  const estPages = formatEighths(summary.totalEighths);

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="Elements"
        title="Breakdown"
        subtitle="Every scene tagged by what it needs to shoot — cast, props, wardrobe, and effects, with estimated length."
        icon={Layers}
        primaryRole="1st Assistant Director"
        supportRole="Line Producer"
        focus="elements per scene, page count, day/night and interior/exterior load"
        signals={[
          { label: "Scenes", value: summary.sceneCount },
          { label: "Est. Length", value: `${estPages} pg` },
          { label: "Speaking Cast", value: categoryCount(scenes, "cast") },
        ]}
      />

      <div className="mb-8 space-y-3">
        <ReportPanel eyebrow="Load" title="What the Schedule Has to Carry">
          <div className="grid gap-3 md:grid-cols-3">
            <LoadLine
              icon={<Building2 size={13} />}
              label="Interior / Exterior"
              value={`${summary.intCount} INT · ${summary.extCount} EXT`}
            />
            <LoadLine
              icon={<Moon size={13} />}
              label="Day / Night"
              value={`${summary.dayCount} day · ${summary.nightCount} night`}
            />
            <LoadLine
              icon={<SunMedium size={13} />}
              label="Est. Length"
              value={`${estPages} pages`}
            />
          </div>
          <p className="mt-3 text-[11px] leading-[1.5] text-muted-foreground">
            Length uses scene eighths from the extraction when available,
            otherwise it&apos;s estimated from each scene&apos;s page range.
          </p>
        </ReportPanel>
      </div>

      {/* Element roll-up across the whole script */}
      <div className="mb-10">
        <h2 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Element Roll-Up
        </h2>

        <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-border/70">
          {ELEMENT_CATEGORY_ORDER.map((category) => {
            const count = categoryCount(scenes, category);
            const active = category === activeCategory;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`-mb-px border-b-2 pb-2.5 text-[13px] transition-colors ${
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {ELEMENT_CATEGORY_LABELS[category]}
                <span className="ml-1.5 font-mono text-[10px] tabular-nums opacity-60">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {elements.length === 0 ? (
          <p className="py-6 text-[13px] text-muted-foreground">
            Nothing tagged under {ELEMENT_CATEGORY_LABELS[activeCategory]} in this
            script.
          </p>
        ) : (
          <div className="space-y-2.5">
            {elements.map((el) => (
              <div
                key={el.name}
                className="grid gap-3 border-t border-border/60 py-3 first:border-t-0 first:pt-0 md:grid-cols-[minmax(160px,260px)_1fr] md:items-baseline"
              >
                <h3 className="text-[14px] font-medium capitalize tracking-normal text-foreground">
                  {el.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {el.scenes.map((sceneNumber) => (
                    <EvidencePill key={sceneNumber}>S{sceneNumber}</EvidencePill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-scene breakdown sheets */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Scene Breakdown Sheets
        </h2>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="space-y-3">
        {scenes.map((scene) => {
          const open = expanded.has(scene.scene_number);
          const night = isNight(scene);
          const interior = isInterior(scene);
          return (
            <div
              key={scene.scene_number}
              className={`report-motion-card rounded-[12px] border ${
                open
                  ? "border-foreground/18 bg-card/45"
                  : "border-border bg-card/25 hover:border-foreground/18 hover:bg-card/40"
              }`}
            >
              <button
                onClick={() => toggle(scene.scene_number)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <ChevronDown
                    size={14}
                    className={`report-expand-icon mt-[3px] text-muted-foreground ${
                      open ? "" : "-rotate-90"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-[4px] bg-muted px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                        S{scene.scene_number}
                      </span>
                      <h3 className="truncate text-[14px] font-medium text-foreground">
                        {scene.slug_line || scene.location}
                      </h3>
                    </div>
                    {!open && (
                      <p className="report-motion-content mt-1 line-clamp-1 pl-[3.1rem] text-[12px] text-foreground/60">
                        {scene.key_visual_moment || scene.emotional_beat}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <MetaBadge>{interior ? "INT" : "EXT"}</MetaBadge>
                    <MetaBadge>{night ? "NIGHT" : "DAY"}</MetaBadge>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground tabular-nums">
                    {formatEighths(sceneEighths(scene))} pg · est
                  </span>
                </div>
              </button>

              {open && (
                <div className="report-motion-content space-y-4 px-5 pb-5 pl-[2.75rem]">
                  {(scene.key_visual_moment || scene.emotional_beat) && (
                    <p className="text-[13px] leading-[1.6] text-foreground/72">
                      {scene.key_visual_moment || scene.emotional_beat}
                    </p>
                  )}

                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {ELEMENT_CATEGORY_ORDER.map((category) => {
                      const items = elementsForScene(scene, category).filter(
                        (i) => i.trim(),
                      );
                      if (items.length === 0) return null;
                      return (
                        <div key={category}>
                          <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                            {ELEMENT_CATEGORY_LABELS[category]}
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item, i) => (
                              <span
                                key={`${item}-${i}`}
                                className="rounded-[5px] border border-border bg-white/[0.03] px-2 py-[3px] text-[12px] capitalize text-foreground/80"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetaBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </span>
  );
}

function LoadLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
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
