"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Printer,
  MapPin,
  Moon,
  SunMedium,
} from "lucide-react";
import { DepartmentLens } from "@/components/ui/department-lens";
import {
  parseScreenplay,
  suggestShootDays,
  suggestCallTimes,
  sceneEighths,
  formatEighths,
  isNight,
  isInterior,
  type ShootDay,
} from "@/lib/production";
import type { ReactNode } from "react";

type ShootPlanViewerProps = {
  jsonData: string;
};

export function ShootPlanViewer({ jsonData }: ShootPlanViewerProps) {
  const data = useMemo(() => parseScreenplay(jsonData), [jsonData]);
  const scenes = useMemo(() => data?.scenes ?? [], [data]);
  const days = useMemo(() => suggestShootDays(scenes), [scenes]);

  const [activeDay, setActiveDay] = useState(1);

  if (!data || days.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No scenes to schedule. The shoot plan is built from the scene list.
      </div>
    );
  }

  const day = days.find((d) => d.day === activeDay) ?? days[0];
  const totalEighths = days.reduce((sum, d) => sum + d.eighths, 0);
  const uniqueLocations = new Set(days.flatMap((d) => d.locations)).size;

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="Schedule"
        title="Shoot Plan"
        subtitle="Scenes grouped into shoot days by location, with suggested call times. A starting schedule you can hand to a small crew."
        icon={ClipboardList}
        primaryRole="1st Assistant Director"
        supportRole="Unit Production Manager"
        focus="shoot days, cast needed per day, call times, company moves"
        signals={[
          { label: "Shoot Days", value: days.length },
          { label: "Est. Length", value: `${formatEighths(totalEighths)} pg` },
          { label: "Locations", value: uniqueLocations },
        ]}
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Shooting Days
        </h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Printer size={12} />
          Print / Save PDF
        </button>
      </div>

      <div className="no-print mb-6 flex flex-wrap gap-1.5">
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setActiveDay(d.day)}
            className={`rounded-[6px] border px-3 py-1.5 text-[12px] transition-colors ${
              d.day === day.day
                ? "border-foreground/25 bg-white/[0.07] text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
              Day {d.day}
            </span>
          </button>
        ))}
      </div>

      <ShootPlanDay
        title={data.title}
        dayCount={days.length}
        day={day}
      />

      {/* Print isolates the active day's shoot plan and flips it to ink-on-white,
          mirroring the /app/share print pattern. Only applies under @media print and
          only while this tab (and its style) is mounted. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .shoot-plan-print, .shoot-plan-print * { visibility: visible !important; }
          .shoot-plan-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            --background: #ffffff;
            --foreground: #111111;
            --card: #ffffff;
            --muted: rgba(17, 17, 17, 0.06);
            --muted-foreground: rgba(17, 17, 17, 0.5);
            --border: rgba(17, 17, 17, 0.16);
            background: #ffffff !important;
            color: #111111 !important;
            border-color: rgba(17, 17, 17, 0.16) !important;
          }
          @page { margin: 0.4in; size: letter; }
        }
      `}</style>
    </div>
  );
}

function ShootPlanDay({
  title,
  dayCount,
  day,
}: {
  title: string;
  dayCount: number;
  day: ShootDay;
}) {
  const times = suggestCallTimes(day);

  // Per-day cast numbering keeps each performer easy to scan in the scene strip.
  // gets a number used in the scene strip below.
  const castNumber = new Map<string, number>();
  day.cast.forEach((name, i) => castNumber.set(name, i + 1));

  return (
    <article className="shoot-plan-print overflow-hidden rounded-[12px] border border-border bg-card/35">
      {/* Masthead */}
      <header className="flex flex-col gap-4 border-b border-border bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Shoot Plan
          </div>
          <h2 className="mt-1 font-display text-[26px] leading-none text-foreground">
            {title}
          </h2>
        </div>
        <div className="text-left sm:text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Shoot Day
          </div>
          <div className="mt-1 text-[22px] font-semibold leading-none text-foreground tabular-nums">
            {day.day}
            <span className="text-muted-foreground"> / {dayCount}</span>
          </div>
        </div>
      </header>

      {/* Time + condition band */}
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <Cell label="General Call" value={times.generalCall} />
        <Cell label="Cast Call" value={times.castCall} />
        <Cell label="First Shot" value={times.firstShot} />
        <Cell
          label="Day / Night"
          value={day.hasNight ? "Night work" : "Day work"}
          icon={
            day.hasNight ? <Moon size={12} /> : <SunMedium size={12} />
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
        <Cell label="Date" value="—" muted />
        <Cell label="Sunrise / Sunset" value="—" muted />
        <Cell label="Weather" value="—" muted />
        <Cell label="Nearest Hospital" value="—" muted />
      </div>

      {/* Location */}
      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Location
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {day.locations.map((loc) => (
            <span
              key={loc}
              className="inline-flex items-center gap-1.5 text-[14px] capitalize text-foreground"
            >
              <MapPin size={13} className="text-muted-foreground" />
              {loc}
            </span>
          ))}
        </div>
      </div>

      {/* Scene strip */}
      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Scenes ({day.scenes.length})
        </div>
        <div className="overflow-x-auto rounded-[8px] border border-border">
          <div className="grid min-w-[460px] grid-cols-[40px_46px_46px_1fr_56px] items-center gap-3 border-b border-border bg-white/[0.02] px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <span>Sc</span>
            <span>I/E</span>
            <span>D/N</span>
            <span>Set &amp; Description</span>
            <span className="text-right">Pgs</span>
          </div>
          {day.scenes.map((scene) => (
            <div
              key={scene.scene_number}
              className="grid min-w-[460px] grid-cols-[40px_46px_46px_1fr_56px] items-start gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
            >
              <span className="font-mono text-[11px] text-foreground tabular-nums">
                {scene.scene_number}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                {isInterior(scene) ? "INT" : "EXT"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                {isNight(scene) ? "N" : "D"}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium capitalize text-foreground">
                  {scene.location}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-foreground/62">
                  {scene.key_visual_moment || scene.emotional_beat || scene.slug_line}
                </span>
              </span>
              <span className="text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                {formatEighths(sceneEighths(scene))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cast needed */}
      <div className="border-t border-border px-5 py-4">
        <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Cast Needed ({day.cast.length})
        </div>
        {day.cast.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No named cast tagged in these scenes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-border">
            <div className="grid min-w-[360px] grid-cols-[40px_1fr_88px] items-center gap-3 border-b border-border bg-white/[0.02] px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span>#</span>
              <span>Character</span>
              <span className="text-right">Call</span>
            </div>
            {day.cast.map((name) => (
              <div
                key={name}
                className="grid min-w-[360px] grid-cols-[40px_1fr_88px] items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
              >
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {castNumber.get(name)}
                </span>
                <span className="text-[13px] capitalize text-foreground">
                  {name}
                </span>
                <span className="text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                  {times.castCall}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border px-5 py-3">
        <p className="text-[11px] leading-[1.5] text-muted-foreground">
          Call times, date, weather, and hospital are starting defaults. Page
          counts are estimated from each scene&apos;s page range.
        </p>
      </footer>
    </article>
  );
}

function Cell({
  label,
  value,
  icon,
  muted = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="bg-card/35 px-4 py-3">
      <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 inline-flex items-center gap-1.5 text-[15px] font-semibold leading-none tabular-nums ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </div>
    </div>
  );
}
