"use client";

import { useMemo } from "react";
import { FileText, Printer } from "lucide-react";
import { DepartmentLens } from "@/components/ui/department-lens";
import { parseOverview } from "@/components/viewers/overview-viewer";
import {
  parseScreenplay,
  summarize,
  suggestShootDays,
  formatEighths,
} from "@/lib/production";

type ShootBriefViewerProps = {
  jsonData: string;
  overviewContent: string | null;
};

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

export function ShootBriefViewer({
  jsonData,
  overviewContent,
}: ShootBriefViewerProps) {
  const data = useMemo(() => parseScreenplay(jsonData), [jsonData]);
  const scenes = useMemo(() => data?.scenes ?? [], [data]);
  const overview = useMemo(
    () => (overviewContent ? parseOverview(overviewContent) : null),
    [overviewContent],
  );

  const summary = useMemo(() => summarize(scenes), [scenes]);
  const shootDays = useMemo(() => suggestShootDays(scenes), [scenes]);

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No screenplay data loaded.
      </div>
    );
  }

  const logline =
    overview?.logline ||
    overview?.taglines[0] ||
    (overview?.synopsis ? firstSentence(overview.synopsis) : "") ||
    `${data.genre.join(" · ")}. ${data.tone}`;

  const keyLocations = [...(data.locations ?? [])]
    .sort((a, b) => (b.scenes?.length ?? 0) - (a.scenes?.length ?? 0))
    .slice(0, 5);

  const principalCast = [...(data.characters ?? [])]
    .sort(
      (a, b) => (b.scenes_present?.length ?? 0) - (a.scenes_present?.length ?? 0),
    )
    .slice(0, 6);

  const meta = [
    data.genre?.join(" · "),
    data.setting_period,
    `${formatEighths(summary.totalEighths)} pages est.`,
  ]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="The Pitch"
        title="Shoot Brief"
        subtitle="The one-page summary you hand a DP, a producer, or a collaborator — the vision and the production reality on a single sheet."
        icon={FileText}
        primaryRole="Producer"
        supportRole="Director"
        focus="logline, tone, scope, key locations, principal cast"
        signals={[
          { label: "Scenes", value: summary.sceneCount },
          { label: "Shoot Days", value: shootDays.length },
          { label: "Principal Cast", value: principalCast.length },
        ]}
      />

      <div className="mb-5 flex items-center justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Printer size={12} />
          Print / Save PDF
        </button>
      </div>

      <article className="brief-print overflow-hidden rounded-[12px] border border-border bg-card/35 px-8 py-8">
        {/* Masthead */}
        <header className="border-b border-border pb-6">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Shoot Brief
          </div>
          <h2 className="mt-2 font-display text-[44px] leading-[1.02] text-foreground">
            {data.title}
          </h2>
          {meta && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {meta}
            </p>
          )}
        </header>

        {/* Logline */}
        <section className="border-b border-border py-6">
          <SheetLabel>Logline</SheetLabel>
          <p className="mt-3 max-w-[60ch] font-display text-[22px] leading-[1.4] text-foreground/90">
            {logline}
          </p>
        </section>

        {/* Vision + production snapshot */}
        <div className="grid gap-8 border-b border-border py-6 md:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <div>
              <SheetLabel>Tone</SheetLabel>
              <p className="mt-2 text-[14px] leading-[1.6] text-foreground/78">
                {data.tone}
              </p>
            </div>
            {data.themes?.length > 0 && (
              <div>
                <SheetLabel>Themes</SheetLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-[5px] border border-border bg-white/[0.03] px-2 py-[3px] text-[12px] capitalize text-foreground/80"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[10px] border border-border bg-white/[0.02] p-4">
            <SheetLabel>Production Snapshot</SheetLabel>
            <dl className="mt-3 space-y-2.5">
              <SnapshotRow label="Scenes" value={String(summary.sceneCount)} />
              <SnapshotRow
                label="Est. Length"
                value={`${formatEighths(summary.totalEighths)} pg`}
              />
              <SnapshotRow label="Shoot Days" value={String(shootDays.length)} />
              <SnapshotRow
                label="Locations"
                value={String((data.locations ?? []).length)}
              />
              <SnapshotRow
                label="Int / Ext"
                value={`${summary.intCount} / ${summary.extCount}`}
              />
              <SnapshotRow
                label="Day / Night"
                value={`${summary.dayCount} / ${summary.nightCount}`}
              />
            </dl>
          </div>
        </div>

        {/* Key locations + principal cast */}
        <div className="grid gap-8 py-6 md:grid-cols-2">
          <div>
            <SheetLabel>Key Locations</SheetLabel>
            <ul className="mt-3 space-y-2">
              {keyLocations.map((loc) => (
                <li
                  key={loc.name}
                  className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-b-0"
                >
                  <span className="text-[14px] capitalize text-foreground/85">
                    {loc.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                    {loc.scenes?.length ?? 0} sc
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SheetLabel>Principal Cast</SheetLabel>
            <ul className="mt-3 space-y-2">
              {principalCast.map((char) => (
                <li
                  key={char.name}
                  className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-b-0"
                >
                  <span className="text-[14px] capitalize text-foreground/85">
                    {char.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                    {char.scenes_present?.length ?? 0} sc
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="border-t border-border pt-4">
          <p className="text-[11px] leading-[1.5] text-muted-foreground">
            Generated from the screenplay as a starting point. Scene length and
            shoot-day estimates are derived from page ranges.
          </p>
        </footer>

        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .brief-print, .brief-print * { visibility: visible !important; }
            .brief-print {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              --foreground: #111111;
              --card: #ffffff;
              --muted-foreground: rgba(17, 17, 17, 0.5);
              --border: rgba(17, 17, 17, 0.16);
              background: #ffffff !important;
              color: #111111 !important;
              border-color: rgba(17, 17, 17, 0.16) !important;
            }
            @page { margin: 0.5in; size: letter; }
          }
        `}</style>
      </article>
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-foreground/65">{label}</dt>
      <dd className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}
