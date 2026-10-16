"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  pickRandomDisplay,
  pickRandomSecondary,
  resolveDisplayFont,
  resolveSecondaryFont,
  googleFontsUrl,
  TOTAL_FONT_COUNT,
  type FontChoice,
} from "@/lib/title-fonts";
import { migrateLegacyStorageKeys } from "@/lib/storage-migration";

type TitleTreatmentProps = {
  title: string;
  tagline?: string;
};

const STORAGE_KEY = "scriptlook-title-fonts";

// Track which font stylesheet URLs we've already injected this session so we
// never re-request or mutate an in-flight <link> (which would abort it).
const injectedFontHrefs = new Set<string>();

type StoredFonts = { display: string; secondary: string };

function loadStoredFonts(): StoredFonts | null {
  if (typeof window === "undefined") return null;
  try {
    migrateLegacyStorageKeys();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.display === "string" && typeof parsed?.secondary === "string") {
      return parsed;
    }
  } catch {
    // malformed localStorage — fall through to random
  }
  return null;
}

function saveStoredFonts(display: FontChoice, secondary: FontChoice) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ display: display.family, secondary: secondary.family }),
    );
  } catch {
    // storage full — ignore
  }
}


export function TitleTreatment({ title, tagline }: TitleTreatmentProps) {
  // Seed from whatever's in the useState initializer; stable across SSR and
  // the first client render (no random number calls at mount).
  const [displayFont, setDisplayFont] = useState<FontChoice>(() => pickRandomDisplay());
  const [secondaryFont, setSecondaryFont] = useState<FontChoice>(() =>
    pickRandomSecondary(),
  );

  // Hydrate from localStorage on mount. If a pair is saved, restore it.
  // Otherwise, pick a random pair AND persist it so the next mount matches.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = loadStoredFonts();
    if (stored) {
      const d = resolveDisplayFont(stored.display);
      const s = resolveSecondaryFont(stored.secondary);
      if (d && s) {
        setDisplayFont(d);
        setSecondaryFont(s);
        return;
      }
    }
    const d = pickRandomDisplay();
    const s = pickRandomSecondary();
    setDisplayFont(d);
    setSecondaryFont(s);
    saveStoredFonts(d, s);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Build the Google Fonts URL for the two selected families.
  const href = useMemo(
    () => googleFontsUrl([displayFont.urlSpec, secondaryFont.urlSpec]),
    [displayFont, secondaryFont],
  );

  // Inject one deduped <link> per unique font URL and never remove or mutate it.
  // Reassigning a shared link's href cancels the prior request (net::ERR_ABORTED);
  // appending fresh links lets each request finish and stay cached, so switching
  // fonts back is instant and the console stays quiet. The curated font pool is
  // small, so the number of links over a session stays bounded.
  useEffect(() => {
    if (!href || injectedFontHrefs.has(href)) return;
    injectedFontHrefs.add(href);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-scriptlook-title-font", "");
    document.head.appendChild(link);
  }, [href]);

  const shuffleBoth = () => {
    const d = pickRandomDisplay(displayFont);
    const s = pickRandomSecondary(secondaryFont);
    setDisplayFont(d);
    setSecondaryFont(s);
    saveStoredFonts(d, s);
  };

  const shuffleDisplay = () => {
    const d = pickRandomDisplay(displayFont);
    setDisplayFont(d);
    saveStoredFonts(d, secondaryFont);
  };

  const shuffleSecondary = () => {
    const s = pickRandomSecondary(secondaryFont);
    setSecondaryFont(s);
    saveStoredFonts(displayFont, s);
  };

  const displayName = title || "The Film";
  const secondaryLine = tagline || "A story you can't look away from";

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card/25">
      {/* Preview */}
      <div className="flex flex-col items-center justify-center border-b border-border bg-white/[0.02] px-8 py-12 text-center md:py-16">
        <div
          className="max-w-full break-words leading-[0.95] tracking-normal text-foreground"
          style={{
            fontFamily: `"${displayFont.family}", serif`,
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
          }}
        >
          {displayName}
        </div>
        <div
          className="mt-5 max-w-[52ch] text-foreground/70"
          style={{
            fontFamily: `"${secondaryFont.family}", sans-serif`,
            fontWeight: 400,
            fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
            lineHeight: 1.4,
            letterSpacing: "0.005em",
          }}
        >
          {secondaryLine}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 items-center gap-3 p-4 md:grid-cols-[1fr_auto_1fr] md:gap-5">
        <FontChip label="Display" font={displayFont} onShuffle={shuffleDisplay} />
        <button
          onClick={shuffleBoth}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground px-3 py-2 rounded-md border border-border hover:border-foreground/30 transition-colors justify-center"
          title={`Shuffle from ${TOTAL_FONT_COUNT.display + TOTAL_FONT_COUNT.secondary} Google Fonts`}
        >
          <RefreshCw size={12} />
          Shuffle both
        </button>
        <FontChip label="Secondary" font={secondaryFont} onShuffle={shuffleSecondary} />
      </div>
    </div>
  );
}

function FontChip({
  label,
  font,
  onShuffle,
}: {
  label: string;
  font: FontChoice;
  onShuffle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span
            className="text-[13px] text-foreground truncate"
            style={{ fontFamily: `"${font.family}", system-ui` }}
          >
            {font.family}
          </span>
          <span className="text-[10px] text-muted-foreground/70 truncate">
            {font.category.toLowerCase()}
          </span>
        </div>
      </div>
      <button
        onClick={onShuffle}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        title={`Shuffle ${label.toLowerCase()} font`}
      >
        <RefreshCw size={12} />
      </button>
    </div>
  );
}
