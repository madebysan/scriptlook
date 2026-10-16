"use client";

import { Clapperboard, Sparkles, Loader2 } from "lucide-react";
import type { Shot } from "@/lib/shot-list";

type ShotListSectionProps = {
  shots: Shot[];
  isAi: boolean;
  loading: boolean;
  onGenerateAi: () => void;
};

export function ShotListSection({
  shots,
  isAi,
  loading,
  onGenerateAi,
}: ShotListSectionProps) {
  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <Clapperboard size={12} />
          Shot List
          <span className="opacity-60">{isAi ? "· AI" : "· suggested"}</span>
        </h4>
        <button
          type="button"
          onClick={onGenerateAi}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Sparkles size={11} />
          )}
          {loading ? "Generating" : isAi ? "Regenerate" : "Generate with AI"}
        </button>
      </div>

      <ol className="space-y-1.5">
        {shots.map((shot, i) => (
          <li
            key={shot.id}
            className="grid grid-cols-[22px_54px_1fr] items-baseline gap-3 border-b border-border/40 pb-1.5 last:border-b-0"
          >
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground/80">
              {shot.size}
            </span>
            <span className="text-[12px] leading-[1.5]">
              <span className="text-foreground/90 capitalize">{shot.subject}</span>
              {shot.movement && shot.movement.toLowerCase() !== "static" && (
                <span className="text-muted-foreground"> · {shot.movement}</span>
              )}
              {shot.description && (
                <span className="block text-foreground/60">{shot.description}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
