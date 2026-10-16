"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parsePosterConcepts } from "./poster-concepts-viewer";
import type { SavedImage } from "@/lib/reports";

type PosterCarouselProps = {
  posterContent: string | null;
  posterImages: Record<number, SavedImage>;
};

// Cycles through any generated poster images attached to the current project.
// Renders nothing if nothing has been generated yet — keeps Overview clean for
// fresh runs and reaches its full impact on the demo path.
export function PosterCarousel({ posterContent, posterImages }: PosterCarouselProps) {
  const concepts = useMemo(() => {
    if (!posterContent) return [];
    return parsePosterConcepts(posterContent).concepts;
  }, [posterContent]);

  // Only show concepts that have an actual generated image
  const generated = useMemo(
    () =>
      concepts
        .map((c) => ({ concept: c, image: posterImages[c.number] }))
        .filter((p) => p.image?.url),
    [concepts, posterImages],
  );

  const [index, setIndex] = useState(0);

  if (generated.length === 0) return null;

  const safeIndex = Math.min(index, generated.length - 1);
  const current = generated[safeIndex];

  const next = () => setIndex((i) => (i + 1) % generated.length);
  const prev = () => setIndex((i) => (i - 1 + generated.length) % generated.length);

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
      <div className="aspect-[2/3] relative bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.image!.url}
          alt={current.concept.name}
          className="w-full h-full object-cover"
        />

        {generated.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 backdrop-blur transition-opacity"
              title="Previous poster"
              style={{ opacity: 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur transition-opacity"
              title="Next poster"
              style={{ opacity: 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/60">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-foreground truncate">
              {current.concept.name}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate mt-0.5">
              {current.concept.category}
            </div>
          </div>
          <div className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
            {safeIndex + 1} / {generated.length}
          </div>
        </div>
      </div>
    </div>
  );
}
