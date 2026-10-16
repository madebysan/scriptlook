"use client";

import { Frame } from "lucide-react";
import { PosterConceptsViewer } from "@/components/viewers/poster-concepts-viewer";
import { SectionLabelPill } from "@/components/ui/inline-chip";
import type { SavedImage } from "@/lib/reports";

type PostersViewerProps = {
  posterContent: string | null;
  posterImages: Record<number, SavedImage>;
  onPosterImagesChange: (images: Record<number, SavedImage>) => void;
};

export function PostersViewer({
  posterContent,
  posterImages,
  onPosterImagesChange,
}: PostersViewerProps) {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <SectionLabelPill icon={<Frame size={10} />} className="mb-3">
          Key Art
        </SectionLabelPill>
        <h1 className="mb-3 font-display text-[38px] font-normal leading-[1.05] tracking-normal text-foreground md:text-[46px]">
          Posters
        </h1>
        <p className="max-w-[62ch] text-[16px] leading-[1.65] text-foreground/62">
          Key-art directions for briefs or image prompts.
        </p>
      </div>

      {posterContent ? (
        <PosterConceptsViewer
          content={posterContent}
          savedImages={posterImages}
          onImagesChange={onPosterImagesChange}
        />
      ) : (
        <p className="text-sm text-muted-foreground py-12 text-center tracking-normal">
          Poster concepts are still waiting on generation.
        </p>
      )}
    </div>
  );
}
