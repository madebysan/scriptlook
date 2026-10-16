"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  id: string;
  src: string;
  alt: string;
  title: string;
  description?: string;
  meta?: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  activeId: string | null;
  onActiveIdChange: (id: string | null) => void;
};

export function ImageLightbox({
  images,
  activeId,
  onActiveIdChange,
}: ImageLightboxProps) {
  const activeIndex = images.findIndex((image) => image.id === activeId);
  const activeImage = activeIndex >= 0 ? images[activeIndex] : null;
  const hasMultipleImages = images.length > 1;

  const goToImage = useCallback((direction: -1 | 1) => {
    if (!hasMultipleImages || activeIndex < 0) return;

    const nextIndex = (activeIndex + direction + images.length) % images.length;
    onActiveIdChange(images[nextIndex]?.id ?? null);
  }, [activeIndex, hasMultipleImages, images, onActiveIdChange]);

  useEffect(() => {
    if (!activeImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToImage(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage, goToImage]);

  return (
    <Dialog
      open={Boolean(activeImage)}
      onOpenChange={(isOpen) => {
        if (!isOpen) onActiveIdChange(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="paper no-print grid max-h-[calc(100dvh-1rem)] w-[min(1180px,calc(100vw-1rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-2 border-foreground bg-[var(--paper-sheet)] p-0 text-foreground shadow-[10px_10px_0_rgba(17,17,17,0.38)] [border-radius:0!important] sm:max-w-none"
      >
        {activeImage && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-foreground px-4 py-3 sm:px-5">
              <div className="min-w-0">
                {activeImage.meta && (
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {activeImage.meta}
                  </p>
                )}
                <DialogTitle className="form-sec-head mt-1 truncate text-[18px] leading-tight text-foreground sm:text-[22px]">
                  {activeImage.title}
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => onActiveIdChange(null)}
                data-ui-audio="cancel"
                className="inline-flex size-10 shrink-0 items-center justify-center border border-foreground text-foreground transition-colors hover:bg-[var(--paper-highlight)] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-sheet)]"
                aria-label="Close image viewer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative min-h-0 bg-[#17150f] p-3 sm:p-4">
              <div className="flex h-full min-h-[240px] items-center justify-center border border-white/20 bg-[#0f0e0a] p-2 sm:min-h-[520px] sm:p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImage.src}
                  alt={activeImage.alt}
                  className="max-h-[calc(100dvh-260px)] w-full object-contain sm:max-h-[calc(100dvh-260px)]"
                />
              </div>

              {hasMultipleImages && (
                <>
                  <LightboxNavButton
                    label="Previous image"
                    className="left-4 sm:left-6"
                    onClick={() => goToImage(-1)}
                  >
                    <ArrowLeft size={20} />
                  </LightboxNavButton>
                  <LightboxNavButton
                    label="Next image"
                    className="right-4 sm:right-6"
                    onClick={() => goToImage(1)}
                  >
                    <ArrowRight size={20} />
                  </LightboxNavButton>
                </>
              )}
            </div>

            <div className="grid gap-3 border-t border-foreground px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
              <DialogDescription className="max-w-3xl text-[13px] leading-[1.55] text-foreground/75">
                {activeImage.description || activeImage.alt}
              </DialogDescription>
              {hasMultipleImages && (
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-right">
                  Image {activeIndex + 1} of {images.length}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LightboxNavButton({
  label,
  className,
  children,
  onClick,
}: {
  label: string;
  className: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-ui-audio="select"
      className={cn(
        "absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center border border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[4px_4px_0_rgba(0,0,0,0.4)] transition-colors hover:bg-[var(--paper-highlight)] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#17150f]",
        className,
      )}
    >
      {children}
    </button>
  );
}
