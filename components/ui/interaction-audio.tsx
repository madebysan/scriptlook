"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  playUiAudio,
  readUiAudioEnabled,
  setUiAudioEnabled,
  syncUiAudioEnabledFromStorage,
  type UiAudioCue,
} from "@/lib/ui-audio";

const UI_AUDIO_ATTRIBUTE = "data-ui-audio";
const UI_AUDIO_HOVER_ATTRIBUTE = "data-ui-audio-hover";
const HOVER_GAP_MS = 180;
const LINK_CLICK_SUPPRESSION_MS = 500;
const CUES = new Set<UiAudioCue>([
  "soft",
  "open",
  "select",
  "toggle",
  "success",
  "confirm",
  "cancel",
]);

const pointerPlayedAt = new WeakMap<HTMLElement, number>();
let lastHoverAudioAt = -Infinity;

export function InteractionAudio() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const syncTimeout = window.setTimeout(() => {
      setEnabled(syncUiAudioEnabledFromStorage());
    }, 0);

    return () => window.clearTimeout(syncTimeout);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(`[${UI_AUDIO_ATTRIBUTE}]`);
      if (!target || isDisabledControl(target) || !isNavigationalLink(target)) return;

      pointerPlayedAt.set(target, performance.now());
      playUiAudio(resolveCue(target.getAttribute(UI_AUDIO_ATTRIBUTE)));
    };

    const onPointerOver = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!isFinePointer(event)) return;

      const target = event.target.closest<HTMLElement>(`[${UI_AUDIO_HOVER_ATTRIBUTE}]`);
      if (!target || isDisabledControl(target)) return;

      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return;

      const now = performance.now();
      if (now - lastHoverAudioAt < HOVER_GAP_MS) return;
      lastHoverAudioAt = now;
      playUiAudio(resolveCue(target.getAttribute(UI_AUDIO_HOVER_ATTRIBUTE)));
    };

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>(`[${UI_AUDIO_ATTRIBUTE}]`);
      if (!target || isDisabledControl(target)) return;
      if (wasJustPlayedOnPointerDown(target)) return;

      playUiAudio(resolveCue(target.getAttribute(UI_AUDIO_ATTRIBUTE)));
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const toggleAudio = () => {
    const nextEnabled = !readUiAudioEnabled();
    setUiAudioEnabled(nextEnabled);
    setEnabled(nextEnabled);

    if (nextEnabled) {
      playUiAudio("success");
    }
  };

  return (
    <button
      type="button"
      onClick={toggleAudio}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn interface sounds off" : "Turn interface sounds on"}
      title={enabled ? "Interface sounds on" : "Interface sounds off"}
      className="no-print fixed bottom-3 right-3 z-[120] inline-flex h-9 w-9 items-center justify-center border border-foreground/40 bg-background/90 text-foreground shadow-[3px_3px_0_rgba(0,0,0,0.22)] backdrop-blur transition-colors hover:bg-[var(--paper-highlight)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}

function resolveCue(value: string | null): UiAudioCue {
  if (value && CUES.has(value as UiAudioCue)) {
    return value as UiAudioCue;
  }

  return "soft";
}

function isDisabledControl(target: HTMLElement): boolean {
  if (target.getAttribute("aria-disabled") === "true") return true;
  if (target instanceof HTMLButtonElement) return target.disabled;
  return false;
}

function isNavigationalLink(target: HTMLElement): boolean {
  return Boolean(target.closest("a[href]"));
}

function isFinePointer(event: PointerEvent): boolean {
  return (
    event.pointerType === "mouse" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

function wasJustPlayedOnPointerDown(target: HTMLElement): boolean {
  const playedAt = pointerPlayedAt.get(target);
  if (playedAt === undefined) return false;
  return performance.now() - playedAt < LINK_CLICK_SUPPRESSION_MS;
}
