"use client";

import { useMemo } from "react";
import { CalendarRange, MapPin, Moon, SunMedium, Users } from "lucide-react";
import { DepartmentLens } from "@/components/ui/department-lens";
import {
  parseScreenplay,
  suggestShootDays,
  summarize,
  formatEighths,
  type ShootDay,
} from "@/lib/production";

type ScheduleViewerProps = {
  jsonData: string;
};

export function ScheduleViewer({ jsonData }: ScheduleViewerProps) {
  const data = useMemo(() => parseScreenplay(jsonData), [jsonData]);
  const scenes = useMemo(() => data?.scenes ?? [], [data]);
  const days = useMemo(() => suggestShootDays(scenes), [scenes]);
  const summary = useMemo(() => summarize(scenes), [scenes]);

  if (!data || days.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No scenes to schedule.
      </div>
    );
  }

  const uniqueLocations = new Set(days.flatMap((d) => d.locations)).size;

  return (
    <div className="max-w-5xl">
      <DepartmentLens
        eyebrow="Order"
        title="Schedule"
        subtitle="A suggested shooting order, grouped by location to keep company moves down. A starting board to reorder around cast and crew availability."
        icon={CalendarRange}
        primaryRole="1st Assistant Director"
        supportRole="Line Producer"
        focus="shooting order, days, page load, day/night balance"
        signals={[
          { label: "Shoot Days", value: days.length },
          { label: "Est. Length", value: `${formatEighths(summary.totalEighths)} pg` },
          { label: "Locations", value: uniqueLocations },
        ]}
      />

      <div className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Shooting Order
      </div>

      <div className="space-y-2.5">
        {days.map((day) => (
          <ScheduleStrip key={day.day} day={day} />
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-[1.5] text-muted-foreground">
        Days are packed to roughly five pages and grouped by location. Page
        counts are estimated from each scene&apos;s page range. Treat this as a
        first pass to reorder, not a locked schedule.
      </p>
    </div>
  );
}

function ScheduleStrip({ day }: { day: ShootDay }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-stretch gap-3 rounded-[12px] border border-border bg-card/30 p-3 transition-colors hover:border-foreground/18 hover:bg-card/45 sm:grid-cols-[64px_1fr_auto] sm:gap-4 sm:p-4">
      <div className="flex flex-col items-center justify-center rounded-[8px] border border-border bg-white/[0.03] py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          Day
        </span>
        <span className="text-[22px] font-semibold leading-none text-foreground tabular-nums">
          {day.day}
        </span>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {day.locations.map((loc) => (
            <span
              key={loc}
              className="inline-flex items-center gap-1.5 text-[14px] font-medium capitalize text-foreground"
            >
              <MapPin size={12} className="text-muted-foreground" />
              {loc}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {day.scenes.map((scene) => (
            <span
              key={scene.scene_number}
              className="rounded-[4px] border border-border bg-white/[0.03] px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground tabular-nums"
            >
              S{scene.scene_number}
            </span>
          ))}
        </div>
      </div>

      <div className="col-start-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 text-left sm:col-start-auto sm:flex-col sm:items-end sm:justify-center sm:text-right">
        <span className="font-mono text-[11px] text-foreground tabular-nums">
          {formatEighths(day.eighths)} pg
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {day.hasNight ? <Moon size={11} /> : <SunMedium size={11} />}
          {day.hasNight ? "Night" : "Day"}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
          <Users size={11} />
          {day.cast.length}
        </span>
      </div>
    </div>
  );
}
