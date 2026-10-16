"use client";

import { useEffect, useMemo, useState } from "react";
import { Wind, Tag, BookOpen, Music, Film, Sparkles } from "lucide-react";
import { replaceMarkdownSection } from "@/lib/markdown-utils";
import { SectionHead } from "@/components/ui/section-head";
import { SectionLabelPill } from "@/components/ui/inline-chip";
import { ShuffleButton, useShuffleState } from "@/components/ui/shuffle-button";
import { useApiKeys } from "@/lib/api-keys-context";

type ColorEntry = { name: string; hex: string; description: string };
type ReferenceEntry = { title: string; description: string };
type SimilarMoodEntry = { title: string; year?: number; description: string };
type SoundtrackEntry = {
  title: string;
  year?: number;
  composer: string;
  description: string;
};

type ParsedMoodAndTone = {
  atmosphere: string;
  descriptors: string[];
  palette: ColorEntry[];
  musicProse: string;
  soundtracks: SoundtrackEntry[];
  references: ReferenceEntry[];
  similarMoods: SimilarMoodEntry[];
};

type ResolvedFilm = {
  query: string;
  tmdb_id: number | null;
  title: string | null;
  year: number | null;
  poster_url: string | null;
};

const LIST_SEPARATOR = "(?:\\s*(?:—|–)\\s*|\\s+-\\s+)";

function parseTitleYear(rawTitle: string): { title: string; year?: number } {
  const yearMatch = rawTitle.trim().match(/^(.+?)\s*\((\d{4})\)\s*$/);
  return {
    title: yearMatch ? yearMatch[1].trim() : rawTitle.trim(),
    year: yearMatch ? Number(yearMatch[2]) : undefined,
  };
}

export function parseMoodAndTone(md: string): ParsedMoodAndTone {
  const result: ParsedMoodAndTone = {
    atmosphere: "",
    descriptors: [],
    palette: [],
    musicProse: "",
    soundtracks: [],
    references: [],
    similarMoods: [],
  };

  const sections = md.split(/^## /m).slice(1);

  for (const section of sections) {
    const [heading, ...bodyLines] = section.split("\n");
    const body = bodyLines.join("\n").trim();
    const h = heading.toLowerCase().trim();

    if (h.includes("atmosphere")) {
      result.atmosphere = body.trim();
    } else if (h.includes("tonal descriptor")) {
      const line = body.split("\n").find((l) => l.trim().length > 0) || "";
      result.descriptors = line
        .split(/[·•]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (h.includes("color palette")) {
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(
          new RegExp(`-\\s*\\*\\*([^*]+)\\*\\*\\s*\`(#[0-9a-fA-F]{3,8})\`${LIST_SEPARATOR}(.+)`),
        );
        if (match) {
          result.palette.push({
            name: match[1].trim(),
            hex: match[2].trim(),
            description: match[3].trim(),
          });
        }
      }
    } else if (h.includes("music") || h.includes("sound")) {
      // Split body around the ### Soundtrack References subheading.
      const [prose, ...refBlock] = body.split(/^###\s+soundtrack references?/im);
      result.musicProse = prose.trim();

      if (refBlock.length > 0) {
        const refLines = refBlock
          .join("")
          .split("\n")
          .filter((l) => l.trim().startsWith("-"));
        for (const line of refLines) {
          // Accept both rich rows with a composer and compact local-fixture rows:
          // - **Title (Year)** — Composer — description
          // - **Title (Year)** - description
          const match = line.match(
            new RegExp(`-\\s*\\*\\*([^*]+)\\*\\*${LIST_SEPARATOR}(.+)`),
          );
          if (!match) continue;
          const { title, year } = parseTitleYear(match[1]);
          const parts = match[2].split(new RegExp(LIST_SEPARATOR)).map((part) => part.trim()).filter(Boolean);
          const hasComposer = parts.length > 1;
          result.soundtracks.push({
            title,
            year,
            composer: hasComposer ? parts[0] : "",
            description: hasComposer ? parts.slice(1).join(" - ") : parts[0],
          });
        }
      }
    } else if (h.includes("similar mood") || h.includes("similar films")) {
      // - **Title (Year)** — description
      // Accept both "Similar Moods" and legacy "Similar Films" headings so
      // old cached content still parses.
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(
          new RegExp(`-\\s*\\*\\*([^*]+)\\*\\*${LIST_SEPARATOR}(.+)`),
        );
        if (!match) continue;
        const { title, year } = parseTitleYear(match[1]);
        const description = match[2].trim();
        result.similarMoods.push({ title, year, description });
      }
    } else if (h.includes("reference")) {
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(
          new RegExp(`-\\s*\\*\\*([^*]+(?:\\*[^*]+\\*[^*]*)?)\\*\\*${LIST_SEPARATOR}(.+)`),
        );
        if (match) {
          const { title } = parseTitleYear(match[1].replace(/\*/g, ""));
          result.references.push({
            title,
            description: match[2].trim(),
          });
        }
      }
    }
  }

  return result;
}

function CollapsibleProse({ text, sentenceCount = 3 }: { text: string; sentenceCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const lead = sentences.slice(0, sentenceCount).join(" ").trim();
  const hasMore = sentences.length > sentenceCount;

  return (
    <div className="max-w-[65ch]">
      <p className="text-[16px] leading-[1.75] text-foreground/76">
        {expanded ? text : lead}
      </p>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-[3px] decoration-border"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function AtmosphereSection({
  atmosphere,
  shuffleSlot,
}: {
  atmosphere: string;
  shuffleSlot?: React.ReactNode;
}) {
  return (
    <section>
      <SectionHead index={1} label="Atmosphere" labelIcon={<Wind size={10} />} meta={shuffleSlot}>
        Feel of the film
      </SectionHead>
      <CollapsibleProse text={atmosphere} />
    </section>
  );
}

type MoodAndToneViewerProps = {
  content: string;
  jsonData?: string;
  onContentUpdate?: (newContent: string) => void;
};

export function MoodAndToneViewer({ content, jsonData, onContentUpdate }: MoodAndToneViewerProps) {
  const parsed = useMemo(() => parseMoodAndTone(content), [content]);
  const musicShuffle = useShuffleState();
  const atmosphereShuffle = useShuffleState();
  const referencesShuffle = useShuffleState();
  const similarMoodsShuffle = useShuffleState();
  const { ensureKeys } = useApiKeys();

  // Replace multiple ## sections in one pass. The returned content may contain
  // several ## headings; we split it on those boundaries and replace each in
  // turn. Used by atmosphere (Atmosphere + Tonal Descriptors) and music
  // (Music & Sound Direction includes a sub-### Soundtrack References, but the
  // top-level heading is just one ## so single-replace works for that case).
  function applyMultiSectionReplace(md: string, returnedBlock: string): string {
    const trimmed = returnedBlock.trim();
    if (!trimmed.startsWith("##")) {
      // Doesn't look like our format — bail and let single replace try.
      return md;
    }
    // Split into [headingLine, body] pairs at each ## (top-level only, not ###)
    const sections = trimmed.split(/^##\s+/m).filter((s) => s.trim());
    let result = md;
    for (const section of sections) {
      const lines = section.split("\n");
      const heading = lines[0].trim();
      const body = lines.slice(1).join("\n").trim();
      const fullSection = `## ${heading}\n${body}`;
      result = replaceMarkdownSection(result, heading, fullSection);
    }
    return result;
  }

  async function shuffleSection(
    state: ReturnType<typeof useShuffleState>,
    sectionKey: string,
    primarySectionHeading: string,
  ) {
    if (!jsonData || !onContentUpdate) return;
    const keys = await ensureKeys();
    if (!keys) return;
    await state.run(async () => {
      const res = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey,
          jsonData,
          apiProvider: keys.apiProvider,
          apiKey: keys.apiKey,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { content: newSection } = await res.json();
      // Detect multi-section payload — if Claude returned more than one ##
      // heading, splice each separately. Otherwise standard single replace.
      const headingCount = (newSection.match(/^##\s+/gm) || []).length;
      const updated =
        headingCount > 1
          ? applyMultiSectionReplace(content, newSection)
          : replaceMarkdownSection(content, primarySectionHeading, newSection);
      onContentUpdate(updated);
    });
  }

  return (
    <div className="max-w-5xl space-y-16">
      <header>
        <SectionLabelPill icon={<Sparkles size={11} />} className="mb-4">
          Atmosphere
        </SectionLabelPill>
        <h1 className="font-display text-[40px] font-normal leading-[1.04] tracking-normal text-foreground md:text-[48px]">
          Mood & Tone
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-foreground/62">
          Mood, references, and sound.
        </p>
      </header>

      {parsed.atmosphere && (
        <div
          className={`transition-opacity duration-200 ${
            atmosphereShuffle.state === "loading" ? "opacity-40" : "opacity-100"
          }`}
        >
          <AtmosphereSection
            atmosphere={parsed.atmosphere}
            shuffleSlot={
              onContentUpdate && jsonData ? (
                <ShuffleButton
                  onClick={() =>
                    shuffleSection(atmosphereShuffle, "mood-and-tone/atmosphere", "Atmosphere")
                  }
                  state={atmosphereShuffle.state}
                  title="Rewrite the atmosphere prose and tonal descriptors"
                />
              ) : null
            }
          />
        </div>
      )}

      {parsed.descriptors.length > 0 && (
        <section
          className={`transition-opacity duration-200 ${
            atmosphereShuffle.state === "loading" ? "opacity-40" : "opacity-100"
          }`}
        >
          <SectionHead index={2} label="Tonal" labelIcon={<Tag size={10} />}>
            Tonal Descriptors
          </SectionHead>
          <div className="flex flex-wrap gap-1.5">
            {parsed.descriptors.map((d, i) => (
              <span
                key={`${i}-${d}`}
                className="inline-flex items-center rounded-full border border-border bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] text-foreground/78"
              >
                {d}
              </span>
            ))}
          </div>
        </section>
      )}

      {parsed.references.length > 0 && (
        <section>
          <SectionHead
            index={3}
            label="References"
            labelIcon={<BookOpen size={10} />}
            meta={
              onContentUpdate && jsonData ? (
                <ShuffleButton
                  onClick={() =>
                    shuffleSection(
                      referencesShuffle,
                      "mood-and-tone/reference-points",
                      "Reference Points",
                    )
                  }
                  state={referencesShuffle.state}
                  title="Generate new reference points"
                />
              ) : null
            }
          >
            Reference Points
          </SectionHead>
          <div
            className={`grid grid-cols-1 gap-3 transition-opacity duration-200 ${
              referencesShuffle.state === "loading" ? "opacity-40" : "opacity-100"
            }`}
          >
            {parsed.references.map((r) => (
              <div
                key={r.title}
                className="rounded-[12px] border border-border bg-card/35 p-4 transition-colors hover:border-foreground/20 hover:bg-card/50"
              >
                <div className="text-[13px] font-medium text-foreground leading-snug tracking-normal">
                  {r.title}
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-foreground/68">
                  {r.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(parsed.musicProse || parsed.soundtracks.length > 0) && (
        <section>
          <SectionHead
            index={4}
            label="Sound"
            labelIcon={<Music size={10} />}
            meta={
              onContentUpdate && jsonData ? (
                <ShuffleButton
                  onClick={() =>
                    shuffleSection(musicShuffle, "mood-and-tone/music", "Music & Sound Direction")
                  }
                  state={musicShuffle.state}
                  title="Regenerate music direction"
                />
              ) : null
            }
          >
            Music & Sound
          </SectionHead>

          <div
            className={`transition-opacity duration-200 ${
              musicShuffle.state === "loading" ? "opacity-40" : "opacity-100"
            }`}
          >
            {parsed.musicProse && <CollapsibleProse text={parsed.musicProse} />}

            {parsed.soundtracks.length > 0 && (
              <div className="mt-6">
                <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Soundtrack References
                </h3>
                <SoundtrackGrid tracks={parsed.soundtracks} />
              </div>
            )}
          </div>
        </section>
      )}

      {parsed.similarMoods.length > 0 && (
        <section>
          <SectionHead
            index={5}
            label="Echoes"
            labelIcon={<Film size={10} />}
            meta={
              onContentUpdate && jsonData ? (
                <ShuffleButton
                  onClick={() =>
                    shuffleSection(similarMoodsShuffle, "mood-and-tone/similar-moods", "Similar Moods")
                  }
                  state={similarMoodsShuffle.state}
                  title="Generate new similar films"
                />
              ) : null
            }
          >
            Similar Moods
          </SectionHead>
          <div
            className={`transition-opacity duration-200 ${
              similarMoodsShuffle.state === "loading" ? "opacity-40" : "opacity-100"
            }`}
          >
            <SimilarMoodsGrid films={parsed.similarMoods.slice(0, 4)} />
          </div>
        </section>
      )}
    </div>
  );
}

function SimilarMoodsGrid({ films }: { films: SimilarMoodEntry[] }) {
  const [resolved, setResolved] = useState<Record<string, ResolvedFilm>>({});
  const [loading, setLoading] = useState(true);
  const { tmdbKey } = useApiKeys();

  const queryKey = useMemo(
    () => films.map((f) => `${f.title}|${f.year || ""}`).join("\n"),
    [films],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tmdb-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: films.map((f) => ({ title: f.title, year: f.year })),
        apiKey: tmdbKey,
      }),
    })
      .then((r) => r.json())
      .then((data: { films: ResolvedFilm[] }) => {
        if (cancelled) return;
        const map: Record<string, ResolvedFilm> = {};
        for (const f of data.films || []) map[f.query] = f;
        setResolved(map);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, films, tmdbKey]);

  return (
    <div className="space-y-3">
      {films.map((f) => {
        const r = resolved[f.title];
        return (
          <div
            key={`${f.title}-${f.year || ""}`}
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-[12px] border border-border bg-card/35 p-3 transition-colors hover:border-foreground/20 hover:bg-card/50"
          >
            <div className="relative aspect-[2/3] w-16 overflow-hidden rounded-md border border-border bg-muted/40">
              {loading ? (
                <div className="absolute inset-0 animate-pulse bg-muted/40" />
              ) : r?.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.poster_url}
                  alt={f.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground leading-snug">
                {f.title}
                {f.year && (
                  <span className="text-muted-foreground font-normal font-mono text-[11px] ml-1">· {f.year}</span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-foreground/68">
                {f.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SoundtrackGrid({ tracks }: { tracks: SoundtrackEntry[] }) {
  const [resolved, setResolved] = useState<Record<string, ResolvedFilm>>({});
  const [loading, setLoading] = useState(true);
  const { tmdbKey } = useApiKeys();

  const queryKey = useMemo(
    () => tracks.map((t) => `${t.title}|${t.year || ""}`).join("\n"),
    [tracks],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tmdb-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: tracks.map((t) => ({ title: t.title, year: t.year })),
        apiKey: tmdbKey,
      }),
    })
      .then((r) => r.json())
      .then((data: { films: ResolvedFilm[] }) => {
        if (cancelled) return;
        const map: Record<string, ResolvedFilm> = {};
        for (const f of data.films || []) map[f.query] = f;
        setResolved(map);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, tracks, tmdbKey]);

  return (
    <div className="space-y-3">
      {tracks.map((t) => {
        const r = resolved[t.title];
        return (
          <div
            key={`${t.title}-${t.year || ""}`}
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-4 rounded-[12px] border border-border bg-card/35 p-3 transition-colors hover:border-foreground/20 hover:bg-card/50"
          >
            <div className="relative aspect-[2/3] w-16 overflow-hidden rounded-md border border-border bg-muted/40">
              {loading ? (
                <div className="absolute inset-0 animate-pulse bg-muted/40" />
              ) : r?.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.poster_url}
                  alt={t.title}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-foreground leading-snug">
                {t.title}
                {t.year && (
                  <span className="text-muted-foreground font-normal font-mono text-[11px] ml-1">· {t.year}</span>
                )}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {t.composer || "Soundtrack reference"}
              </div>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-foreground/68">
                {t.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
