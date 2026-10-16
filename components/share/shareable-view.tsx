"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Star } from "lucide-react";
import { ImageLightbox, type LightboxImage } from "@/components/share/image-lightbox";
import type { SavedImage, SavedProject } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { parseOverview, getLeadingNumber, splitCommaList } from "@/components/viewers/overview-viewer";
import { parseMoodAndTone } from "@/components/viewers/mood-and-tone-viewer";
import { parseSceneBreakdown } from "@/components/viewers/scene-breakdown-viewer";
import {
  parseStoryboardPrompts,
  type StoryboardScene,
} from "@/components/viewers/storyboard-viewer";
import { parsePosterConcepts } from "@/components/viewers/poster-concepts-viewer";
import { useApiKeys } from "@/lib/api-keys-context";
import {
  getReportSections,
  normalizeDeliverables,
} from "@/lib/deliverables";

// Full bible. Every section, every card, every scene — expanded, no tabs and
// no collapsibles. Images can open a screen-only inspection lightbox, while
// the inline layout still prints cleanly to a multi-page PDF.

type ScreenplayData = {
  title?: string;
  writer?: string;
  genre?: string[];
  characters?: {
    name: string;
    description?: string;
    arc_summary?: string;
    scenes_present?: number[];
    wardrobe_changes?: number;
  }[];
  locations?: {
    name: string;
    description: string;
    scenes?: number[];
    int_ext?: string;
    time_variations?: string[];
    set_requirements?: string[];
  }[];
  props_master?: {
    item: string;
    scenes: number[];
    hero_prop?: boolean;
    notes?: string;
  }[];
  scenes?: {
    scene_number: number;
    slug_line: string;
    key_visual_moment?: string;
  }[];
};

const EMPTY_NUMBERED_IMAGES: Record<number, SavedImage> = {};
const EMPTY_NAMED_IMAGES: Record<string, SavedImage> = {};
const EMPTY_CHARACTERS: NonNullable<ScreenplayData["characters"]> = [];
const EMPTY_LOCATIONS: NonNullable<ScreenplayData["locations"]> = [];
const EMPTY_PROPS_MASTER: NonNullable<ScreenplayData["props_master"]> = [];
const EMPTY_SCENES: NonNullable<ScreenplayData["scenes"]> = [];

type ResolvedFilm = {
  query: string;
  tmdb_id: number | null;
  title: string | null;
  year: number | null;
  poster_url: string | null;
};

type ShareableViewProps = {
  project: SavedProject;
  showControls?: boolean;
  showIntro?: boolean;
  contentClassName?: string;
  // Section ids the host already renders elsewhere (e.g. the demo dossier
  // shows taglines + film identity in its cover), so the full deck skips
  // them to avoid printing the same block twice.
  skipSections?: string[];
};

export function ShareableView({
  project,
  showControls = true,
  showIntro = true,
  contentClassName = "",
  skipSections = [],
}: ShareableViewProps) {
  const { tmdbKey } = useApiKeys();
  const skip = useMemo(() => new Set(skipSections), [skipSections]);
  const includedSections = useMemo(
    () => new Set(getReportSections(normalizeDeliverables(project.deliverables))),
    [project.deliverables],
  );
  const includeOverview = includedSections.has("overview");
  const includeMood = includedSections.has("mood-and-tone");
  const includeIdentity = includedSections.has("identity");
  const includePosters = includedSections.has("posters");
  const includeCast = includedSections.has("cast-and-crew");
  const includeLocations = includedSections.has("locations");
  const includeProduction = includedSections.has("production");
  const includeScenes = includedSections.has("scenes");
  const parsedJson = useMemo((): ScreenplayData => {
    try {
      return JSON.parse(project.jsonData || "{}");
    } catch {
      return {};
    }
  }, [project.jsonData]);

  const overviewDoc = project.documents.find((d) => d.slug === "overview");
  const moodDoc = project.documents.find((d) => d.slug === "mood-and-tone");
  const sceneDoc = project.documents.find((d) => d.slug === "scene-breakdown");
  const storyboardDoc = project.documents.find(
    (d) => d.slug === "storyboard-prompts",
  );
  const posterDoc = project.documents.find((d) => d.slug === "poster-concepts");

  const overview = useMemo(
    () => (overviewDoc?.content ? parseOverview(overviewDoc.content) : null),
    [overviewDoc?.content],
  );
  const mood = useMemo(
    () => (moodDoc?.content ? parseMoodAndTone(moodDoc.content) : null),
    [moodDoc?.content],
  );
  const sceneBreakdown = useMemo(
    () => (sceneDoc?.content ? parseSceneBreakdown(sceneDoc.content) : null),
    [sceneDoc?.content],
  );
  const storyboardByScene = useMemo((): Record<number, StoryboardScene> => {
    if (!storyboardDoc?.content) return {};
    const { acts } = parseStoryboardPrompts(storyboardDoc.content);
    const out: Record<number, StoryboardScene> = {};
    for (const act of acts) for (const s of act.scenes) out[s.number] = s;
    return out;
  }, [storyboardDoc?.content]);
  const posterConcepts = useMemo(
    () => (posterDoc?.content ? parsePosterConcepts(posterDoc.content) : null),
    [posterDoc?.content],
  );

  const portraits = project.portraits ?? EMPTY_NAMED_IMAGES;
  const propImages = project.propImages ?? EMPTY_NAMED_IMAGES;
  const locationImages = project.locationImages ?? EMPTY_NAMED_IMAGES;
  const storyboardImages = project.images ?? EMPTY_NUMBERED_IMAGES;
  const posterImages = project.posterImages ?? EMPTY_NUMBERED_IMAGES;

  const title =
    overview?.title || parsedJson.title || project.title || "Untitled";
  const logline = overview?.logline || "";

  // Resolve TMDB posters for soundtracks + similar moods in one batch
  const tmdbQueries = useMemo(() => {
    const queries: { title: string; year?: number; kind: "soundtrack" | "mood" }[] = [];
    for (const t of mood?.soundtracks || []) {
      queries.push({ title: t.title, year: t.year, kind: "soundtrack" });
    }
    for (const f of mood?.similarMoods || []) {
      queries.push({ title: f.title, year: f.year, kind: "mood" });
    }
    return queries;
  }, [mood]);

  const [tmdbResolved, setTmdbResolved] = useState<Record<string, ResolvedFilm>>({});
  useEffect(() => {
    if (tmdbQueries.length === 0) return;
    let cancelled = false;
    fetch("/api/tmdb-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: tmdbQueries.map((q) => ({ title: q.title, year: q.year })),
        apiKey: tmdbKey || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { films: ResolvedFilm[] }) => {
        if (cancelled) return;
        const map: Record<string, ResolvedFilm> = {};
        for (const f of data.films || []) map[f.query] = f;
        setTmdbResolved(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tmdbKey, tmdbQueries]);

  const scenes = parsedJson.scenes ?? EMPTY_SCENES;
  const characters = parsedJson.characters ?? EMPTY_CHARACTERS;
  const locations = parsedJson.locations ?? EMPTY_LOCATIONS;
  const propsMaster = parsedJson.props_master ?? EMPTY_PROPS_MASTER;
  const lightboxImages = useMemo(
    () =>
      buildLightboxImages({
        sceneBreakdownScenes: sceneBreakdown?.scenes || [],
        storyboardByScene,
        storyboardImages,
        locations,
        locationImages,
        characters,
        portraits,
        propsMaster,
        propImages,
        posterConcepts: posterConcepts?.concepts || [],
        posterImages,
      }),
    [
      characters,
      locationImages,
      locations,
      posterConcepts?.concepts,
      posterImages,
      propImages,
      propsMaster,
      portraits,
      sceneBreakdown?.scenes,
      storyboardByScene,
      storyboardImages,
    ],
  );
  const [activeLightboxId, setActiveLightboxId] = useState<string | null>(null);

  const openLightbox = (imageId: string) => {
    if (lightboxImages.some((image) => image.id === imageId)) {
      setActiveLightboxId(imageId);
    }
  };

  const handleScrollToTop = () => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  // Build the table of contents based on which sections actually have content.
  // This stays in sync automatically — sections without data get skipped in
  // rendering below and also get filtered out here.
  const toc: { id: string; label: string; count?: number }[] = [];
  if (includeOverview && overview && overview.taglines.length > 0)
    toc.push({ id: "taglines", label: "Taglines" });
  if (includeOverview && overview?.synopsis) toc.push({ id: "synopsis", label: "Synopsis" });
  if (includeOverview && overview && overview.identity.length > 0)
    toc.push({ id: "film-identity", label: "Film Identity" });
  if (includeOverview && overview && overview.themes.length > 0)
    toc.push({ id: "themes", label: "Themes", count: overview.themes.length });
  if (includeOverview && overview && (overview.stats.length > 0 || overview.complexity))
    toc.push({ id: "scope", label: "Scope at a Glance" });
  if (includeMood && mood?.atmosphere) toc.push({ id: "atmosphere", label: "Atmosphere" });
  if (includeMood && mood && mood.descriptors.length > 0)
    toc.push({
      id: "tonal-descriptors",
      label: "Tonal Descriptors",
      count: mood.descriptors.length,
    });
  if (includeMood && mood && mood.references.length > 0)
    toc.push({
      id: "reference-points",
      label: "Reference Points",
      count: mood.references.length,
    });
  if (includeMood && mood && (mood.musicProse || mood.soundtracks.length > 0))
    toc.push({ id: "music-sound", label: "Music & Sound" });
  if ((includeMood || includeIdentity) && mood && mood.palette.length > 0)
    toc.push({
      id: "color-palette",
      label: "Color Palette",
      count: mood.palette.length,
    });
  if (includeMood && mood && mood.similarMoods.length > 0)
    toc.push({
      id: "similar-moods",
      label: "Similar Moods",
      count: Math.min(mood.similarMoods.length, 4),
    });
  if (includePosters && posterConcepts && posterConcepts.concepts.length > 0)
    toc.push({
      id: "poster-concepts",
      label: "Poster Concepts",
      count: posterConcepts.concepts.length,
    });
  if (includeCast && characters.length > 0)
    toc.push({ id: "cast", label: "Cast", count: characters.length });
  if (includeLocations && locations.length > 0)
    toc.push({ id: "locations", label: "Locations", count: locations.length });
  if (includeProduction && propsMaster.length > 0)
    toc.push({
      id: "props",
      label: "Production Design · Props",
      count: propsMaster.length,
    });
  if (includeScenes && sceneBreakdown && sceneBreakdown.scenes.length > 0)
    toc.push({
      id: "scenes",
      label: "Scenes",
      count: sceneBreakdown.scenes.length,
    });

  return (
    <>
      <PrintStyles />

      {/* Controls bar — hidden when printing */}
      {showControls && (
      <div className="no-print sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 sm:px-6">
          <Link
            href="/app"
            data-ui-audio="open"
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Scriptlook
          </Link>
          <button
            onClick={() => window.print()}
            data-ui-audio="success"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-md border border-border hover:border-foreground/30 transition-colors"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </div>
      </div>
      )}

      <div className={`shareable-page max-w-5xl mx-auto px-4 py-10 space-y-12 sm:px-6 md:px-10 md:py-16 md:space-y-16 ${contentClassName}`}>
        {showIntro && (
        <>
        {/* HERO */}
        <header className="break-inside-avoid">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-4">
            First-Pass Breakdown
          </div>
          <h1 className="text-[40px] md:text-6xl font-semibold tracking-normal leading-[1.02] text-foreground">
            {title}
          </h1>
          {parsedJson.writer && (
            <p className="text-[13px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-4">
              Written by <span className="text-foreground/80">{parsedJson.writer}</span>
            </p>
          )}
          {logline && (
            <p className="text-[17px] leading-[1.55] text-foreground/85 mt-6 font-medium max-w-[72ch]">
              {logline}
            </p>
          )}
          {parsedJson.genre && parsedJson.genre.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-6">
              {parsedJson.genre.map((g) => (
                <span
                  key={g}
                  className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* TABLE OF CONTENTS */}
        <Section label="Contents">
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
            {toc.map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-baseline gap-3 border-b border-dotted border-border/40 pb-1.5"
              >
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <a
                  href={`#${entry.id}`}
                  className="text-foreground/85 hover:text-foreground transition-colors"
                >
                  {entry.label}
                </a>
                <span className="flex-1" />
                {entry.count !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {entry.count}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Section>
        </>
        )}

        {/* TAGLINES */}
        {includeOverview && overview && overview.taglines.length > 0 && !skip.has("taglines") && (
          <Section id="taglines" label="Taglines">
            <ul className="space-y-2">
              {overview.taglines.map((t, i) => (
                <li
                  key={`${i}-${t}`}
                  className="text-[16px] leading-[1.5] text-foreground/85 italic"
                >
                  “{t.replace(/^["“]|["”]$/g, "")}”
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* SYNOPSIS */}
        {includeOverview && overview?.synopsis && (
          <Section id="synopsis" label="Synopsis">
            <p className="text-[14px] leading-[1.75] text-foreground/80 whitespace-pre-line">
              {overview.synopsis}
            </p>
          </Section>
        )}

        {/* FILM IDENTITY */}
        {includeOverview && overview && overview.identity.length > 0 && !skip.has("film-identity") && (
          <Section id="film-identity" label="Film Identity">
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
              {overview.identity.map((item) => (
                <div key={item.label} className="space-y-0.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-[13px] text-foreground/85">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {/* THEMES */}
        {includeOverview && overview && overview.themes.length > 0 && (
          <Section id="themes" label="Themes">
            <div className="space-y-5">
              {overview.themes.map((t) => (
                <div key={t.title} className="break-inside-avoid">
                  <h3 className="text-[13px] font-semibold text-foreground mb-1.5">
                    {t.title}
                  </h3>
                  <p className="text-[13px] leading-[1.7] text-foreground/70">{t.body}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* SCOPE */}
        {includeOverview && overview && (overview.stats.length > 0 || overview.complexity) && (
          <Section id="scope" label="Scope at a Glance">
            {overview.stats.length > 0 && (() => {
              // Mirror the in-app viewer: numeric stats show only the leading
              // number in the compact grid (so a value like "45–60 days (long
              // reasoning…)" renders as "45", not a 200-char card); text stats
              // become chips or a short paragraph.
              const numericStats = overview.stats.filter((s) => getLeadingNumber(s.value));
              const textStats = overview.stats.filter((s) => !getLeadingNumber(s.value));
              return (
                <>
                  {numericStats.length > 0 && (
                    // One equal-width row so the counters never leave an orphan
                    // card on a second line.
                    <div
                      className="grid gap-2 mb-3"
                      style={{
                        gridTemplateColumns: "repeat(auto-fit, minmax(min(112px, 100%), 1fr))",
                      }}
                    >
                      {numericStats.map((s) => (
                        <div
                          key={s.label}
                          className="rounded-lg border border-border/60 bg-card/30 px-3 py-3"
                        >
                          <div className="text-2xl font-semibold text-foreground tabular-nums leading-none">
                            {getLeadingNumber(s.value)}
                          </div>
                          <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mt-1.5 leading-snug">
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {textStats.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-3 mb-5">
                      {textStats.map((s) => {
                        const items = splitCommaList(s.value);
                        // Only render as chips when every piece reads like a
                        // tag, not a sentence. Prose with commas (e.g. "needs
                        // schedule pass — roughly 45-60 days…, creature, and
                        // battle work") was breaking into stray gray pills.
                        const looksLikeTags =
                          items.length > 1 &&
                          items.length <= 8 &&
                          items.every((item) => item.length <= 24 && !/[—.:;]/.test(item));
                        return (
                          <div
                            key={s.label}
                            className="rounded-xl border border-border/60 bg-card/30 p-4 break-inside-avoid"
                          >
                            <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                              {s.label}
                            </div>
                            {looksLikeTags ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {items.map((item) => (
                                  <span
                                    key={item}
                                    className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-foreground/70"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[13px] leading-[1.6] text-foreground/75">
                                {s.value}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
            {overview.complexity && (
              <div className="rounded-xl border border-border/60 bg-card/20 p-5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Complexity Read
                </div>
                <p className="text-[13px] leading-[1.7] text-foreground/80">
                  {overview.complexity}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* ATMOSPHERE */}
        {includeMood && mood?.atmosphere && (
          <Section id="atmosphere" label="Atmosphere">
            <p className="text-[14px] leading-[1.75] text-foreground/85 whitespace-pre-line">
              {mood.atmosphere}
            </p>
          </Section>
        )}

        {/* TONAL DESCRIPTORS */}
        {includeMood && mood && mood.descriptors.length > 0 && (
          <Section id="tonal-descriptors" label="Tonal Descriptors">
            {/* Highlighter keyword stamps — like tone words marked up on a
                script. Numbered so the cluster reads as a deliberate index. */}
            <div className="flex flex-wrap gap-x-2.5 gap-y-2.5">
              {mood.descriptors.map((d, i) => (
                <span
                  key={`${i}-${d}`}
                  className="group inline-flex items-stretch border border-foreground bg-background"
                >
                  <span className="flex items-center bg-foreground px-1.5 font-mono text-[9px] tabular-nums text-background">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="bg-[var(--paper-highlight)] px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.08em] text-foreground">
                    {d}
                  </span>
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* REFERENCE POINTS */}
        {includeMood && mood && mood.references.length > 0 && (
          <Section id="reference-points" label="Reference Points">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mood.references.map((r) => (
                <div
                  key={r.title}
                  className="rounded-lg border border-border/60 bg-card/40 p-4 break-inside-avoid"
                >
                  <div className="text-[12px] font-semibold text-foreground leading-snug">
                    {r.title}
                  </div>
                  <p className="text-[11px] text-foreground/65 leading-[1.6] mt-1.5 first-letter:uppercase">
                    {r.description}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* MUSIC & SOUND + SOUNDTRACK REFERENCES */}
        {includeMood && mood && (mood.musicProse || mood.soundtracks.length > 0) && (
          <Section id="music-sound" label="Music & Sound">
            {mood.musicProse && (
              <p className="text-[14px] leading-[1.75] text-foreground/85 whitespace-pre-line mb-6">
                {mood.musicProse}
              </p>
            )}
            {mood.soundtracks.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Soundtrack References
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mood.soundtracks.map((t) => (
                    <PosterCard
                      key={`sound-${t.title}`}
                      posterUrl={tmdbResolved[t.title]?.poster_url || null}
                      title={t.title}
                      year={t.year}
                      subtitle={t.composer}
                      description={t.description}
                    />
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* COLOR PALETTE */}
        {(includeMood || includeIdentity) && mood && mood.palette.length > 0 && (
          <Section id="color-palette" label="Color Palette">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mood.palette.map((c) => (
                <div
                  key={c.hex}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/30 px-3 py-2.5 break-inside-avoid"
                >
                  <div
                    className="w-10 h-10 rounded-md border border-border/60 shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-foreground leading-tight">
                        {c.name}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">
                        {c.hex}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/65 leading-[1.55] mt-0.5">
                      {c.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* SIMILAR MOODS */}
        {includeMood && mood && mood.similarMoods.length > 0 && (
          <Section id="similar-moods" label="Similar Moods">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mood.similarMoods.slice(0, 4).map((f) => (
                <PosterCard
                  key={`mood-${f.title}`}
                  posterUrl={tmdbResolved[f.title]?.poster_url || null}
                  title={f.title}
                  year={f.year}
                  description={f.description}
                />
              ))}
            </div>
          </Section>
        )}

        {/* POSTER CONCEPTS — poster leads at full card width, text files below */}
        {includePosters && posterConcepts && posterConcepts.concepts.length > 0 && (
          <Section id="poster-concepts" label="Poster Concepts">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posterConcepts.concepts.map((concept) => {
                const img = posterImages[concept.number];
                const posterLightboxId = makeImageId(
                  "poster-concept",
                  String(concept.number),
                );
                return (
                  <div
                    key={concept.number}
                    className="rounded-xl border bg-card/40 p-4 break-inside-avoid"
                  >
                    <div
                      className="rounded-lg overflow-hidden border bg-muted/30"
                      style={{ aspectRatio: "5/7" }}
                    >
                      {img?.url && (
                        <ImageOpenButton
                          label={`Open poster concept ${concept.number}: ${concept.name}`}
                          onClick={() => openLightbox(posterLightboxId)}
                          className="h-full w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={`Poster — ${concept.name}`}
                            className="w-full h-full object-cover"
                          />
                        </ImageOpenButton>
                      )}
                    </div>
                    {concept.colors.length > 0 && (
                      <div className="flex rounded overflow-hidden h-2 mt-3">
                        {concept.colors.map((c, i) => (
                          <div
                            key={i}
                            className="flex-1"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        {concept.category}
                      </div>
                      <h3 className="text-[14px] font-semibold text-foreground leading-tight">
                        {concept.name}
                      </h3>
                      {concept.tagline && (
                        <p className="text-[12px] italic text-foreground/80 mt-1.5">
                          “{concept.tagline}”
                        </p>
                      )}
                      {concept.composition && (
                        <p className="text-[11px] text-foreground/55 leading-[1.5] mt-2 first-letter:uppercase">
                          {concept.composition}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* CAST */}
        {includeCast && characters.length > 0 && (
          <Section id="cast" label="Cast">
            <div className="space-y-3">
              {characters.map((char, i) => {
                const portrait = portraits[char.name];
                const portraitLightboxId = makeImageId("portrait", char.name);
                return (
                  <div
                    key={`${char.name}-${i}`}
                    className="rounded-xl border bg-card/40 p-4 flex flex-col gap-4 break-inside-avoid sm:flex-row sm:gap-5 sm:p-5"
                  >
                    <div className="w-24 h-24 rounded-lg shrink-0 bg-muted/40 border border-border/60 overflow-hidden sm:h-32 sm:w-32">
                      {portrait?.url && (
                        <ImageOpenButton
                          label={`Open ${char.name} cast portrait`}
                          onClick={() => openLightbox(portraitLightboxId)}
                          className="h-full w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={portrait.url}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        </ImageOpenButton>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                        {char.name}
                      </h3>
                      {char.description && (
                        <p className="text-[12px] text-foreground/70 mt-1 leading-relaxed">
                          {char.description}
                        </p>
                      )}
                      {char.arc_summary && (
                        <p className="text-[12px] text-muted-foreground/90 italic mt-2 leading-relaxed">
                          {char.arc_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
                        <span>{char.scenes_present?.length || 0} scenes</span>
                        {char.wardrobe_changes !== undefined &&
                          char.wardrobe_changes > 0 && (
                            <>
                              <span>·</span>
                              <span>{char.wardrobe_changes} wardrobe changes</span>
                            </>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* LOCATIONS (expanded) */}
        {includeLocations && locations.length > 0 && (
          <Section id="locations" label="Locations">
            <div className="space-y-4">
              {locations.map((loc, i) => {
                const sceneCount = loc.scenes?.length || 0;
                const locScenes = scenes.filter((sc) =>
                  loc.scenes?.includes(sc.scene_number),
                );
                const locationImage = locationImages[loc.name];
                const locationLightboxId = makeImageId("location", loc.name);
                return (
                  <div
                    key={`${loc.name}-${i}`}
                    className="rounded-xl border bg-card/40 p-4 break-inside-avoid sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {locationImage?.url && (
                        <div className="w-full shrink-0 overflow-hidden rounded-lg border bg-muted/40 sm:w-44">
                          <div className="aspect-video">
                            <ImageOpenButton
                              label={`Open ${loc.name} location reference`}
                              onClick={() => openLightbox(locationLightboxId)}
                              className="h-full w-full"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={locationImage.url}
                                alt={`${loc.name} location reference`}
                                className="h-full w-full object-cover"
                              />
                            </ImageOpenButton>
                          </div>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div>
                            <h3 className="text-base font-semibold capitalize text-foreground">
                              {loc.name}
                            </h3>
                            <p className="text-[13px] leading-[1.6] text-foreground/70 mt-1">
                              {loc.description}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:flex-col sm:items-end sm:gap-1">
                            {loc.int_ext && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {loc.int_ext}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {sceneCount} {sceneCount === 1 ? "scene" : "scenes"}
                            </span>
                          </div>
                        </div>
                        {loc.time_variations && loc.time_variations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {loc.time_variations.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {loc.set_requirements && loc.set_requirements.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/60">
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                              Set Requirements
                            </h4>
                            <ul className="text-[12px] space-y-1 text-foreground/70">
                              {loc.set_requirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-muted-foreground mt-0.5">•</span>
                                  <span>{req}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {locScenes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/60">
                            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                              Key Visual Moments
                            </h4>
                            <ul className="text-[12px] space-y-1.5 text-foreground/70">
                              {locScenes.map((sc) => (
                                <li
                                  key={sc.scene_number}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-muted-foreground font-mono shrink-0">
                                    S{sc.scene_number}
                                  </span>
                                  <span className="leading-relaxed">{sc.key_visual_moment}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* PRODUCTION DESIGN — PROPS */}
        {includeProduction && propsMaster.length > 0 && (
          <Section id="props" label="Production Design · Props">
            <div className="space-y-3">
              {propsMaster.map((p, i) => {
                const img = propImages[p.item];
                const propLightboxId = makeImageId("prop", p.item);
                return (
                  <div
                    key={`${p.item}-${i}`}
                    className="rounded-xl border bg-card/40 p-4 flex flex-col gap-4 break-inside-avoid sm:flex-row sm:gap-5 sm:p-5"
                  >
                    <div className="w-24 h-24 rounded-lg shrink-0 bg-muted/40 border border-border/60 overflow-hidden sm:h-32 sm:w-32">
                      {img?.url && (
                        <ImageOpenButton
                          label={`Open ${p.item} prop reference`}
                          onClick={() => openLightbox(propLightboxId)}
                          className="h-full w-full"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={p.item}
                            className="w-full h-full object-cover"
                          />
                        </ImageOpenButton>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 mb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold capitalize text-foreground">
                            {p.item}
                          </h3>
                          {p.hero_prop && (
                            <span className="inline-flex items-center gap-1 border border-foreground bg-[var(--paper-highlight)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
                              <Star size={10} className="fill-current" />
                              Hero
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {p.scenes.length}{" "}
                          {p.scenes.length === 1 ? "scene" : "scenes"}
                        </span>
                      </div>
                      {p.notes && (
                        <p className="text-[13px] leading-[1.6] text-foreground/70 mt-1">
                          {p.notes}
                        </p>
                      )}
                      {p.scenes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {p.scenes.map((sn) => (
                            <span
                              key={sn}
                              className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                            >
                              S{sn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* SCENES (every scene, expanded, with storyboard) */}
        {includeScenes && sceneBreakdown && sceneBreakdown.scenes.length > 0 && (
          <Section id="scenes" label="Scenes">
            <div className="space-y-2">
              {sceneBreakdown.scenes.map((s) => (
                <SceneFull
                  key={s.number}
                  scene={s}
                  storyboard={storyboardByScene[s.number]}
                  image={storyboardImages[s.number]}
                  storyboardLightboxId={makeImageId("storyboard", String(s.number))}
                  onOpenImage={openLightbox}
                />
              ))}
            </div>
          </Section>
        )}

        {/* FOOTER */}
        <footer className="pt-10 mt-10 border-t border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <div>
              Generated by <span className="text-foreground/70 font-medium">Scriptlook</span>
              {" — a tool by "}
              <a
                href="https://santiagoalonso.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/70 underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Santiago Alonso
              </a>
            </div>
            <button
              type="button"
              onClick={handleScrollToTop}
              data-ui-audio="select"
              className="no-print inline-flex min-h-10 items-center justify-center border border-foreground px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-[var(--paper-highlight)]"
            >
              Back to top
            </button>
          </div>
        </footer>
      </div>
      <ImageLightbox
        images={lightboxImages}
        activeId={activeLightboxId}
        onActiveIdChange={setActiveLightboxId}
      />
    </>
  );
}

function Section({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  // Paper-form section head: stamped Oswald label over a solid ink rule.
  return (
    <section id={id} className="break-before-auto scroll-mt-16">
      <div className="mb-6 flex items-baseline gap-3 border-b border-foreground pb-2.5">
        <h2 className="form-sec-head text-[20px] text-foreground">{label}</h2>
        <div className="flex-1" />
      </div>
      {children}
    </section>
  );
}

type PosterConceptLightboxData = ReturnType<typeof parsePosterConcepts>["concepts"][number];

type LightboxBuildArgs = {
  sceneBreakdownScenes: ParsedScene[];
  storyboardByScene: Record<number, StoryboardScene>;
  storyboardImages: Record<number, SavedImage>;
  locations: NonNullable<ScreenplayData["locations"]>;
  locationImages: Record<string, SavedImage>;
  characters: NonNullable<ScreenplayData["characters"]>;
  portraits: Record<string, SavedImage>;
  propsMaster: NonNullable<ScreenplayData["props_master"]>;
  propImages: Record<string, SavedImage>;
  posterConcepts: PosterConceptLightboxData[];
  posterImages: Record<number, SavedImage>;
};

function buildLightboxImages({
  sceneBreakdownScenes,
  storyboardByScene,
  storyboardImages,
  locations,
  locationImages,
  characters,
  portraits,
  propsMaster,
  propImages,
  posterConcepts,
  posterImages,
}: LightboxBuildArgs): LightboxImage[] {
  const storyboardLightboxImages = sceneBreakdownScenes
    .map((scene): LightboxImage | null => {
      const image = storyboardImages[scene.number];
      if (!image?.url) return null;

      const storyboard = storyboardByScene[scene.number];
      const keyVisual =
        scene.fields.find((field) => field.label === "Key Visual Moment")?.value ||
        storyboard?.prompt;

      return {
        id: makeImageId("storyboard", String(scene.number)),
        src: image.url,
        alt: `Storyboard frame for scene ${scene.number}`,
        title: `Scene ${String(scene.number).padStart(3, "0")} - ${cleanSceneSlug(scene.slugLine)}`,
        description: keyVisual,
        meta: compactLabel("Storyboard frame", scene.intExt, scene.timeOfDay),
      };
    })
    .filter(isLightboxImage);

  const locationLightboxImages = locations
    .map((location): LightboxImage | null => {
      const image = locationImages[location.name];
      if (!image?.url) return null;

      const sceneCount = location.scenes?.length ?? 0;
      return {
        id: makeImageId("location", location.name),
        src: image.url,
        alt: `${location.name} location reference`,
        title: toDisplayTitle(location.name),
        description: location.description,
        meta: compactLabel(
          "Location reference",
          location.int_ext,
          sceneCount ? `${sceneCount} ${sceneCount === 1 ? "scene" : "scenes"}` : undefined,
        ),
      };
    })
    .filter(isLightboxImage);

  const portraitLightboxImages = characters
    .map((character): LightboxImage | null => {
      const image = portraits[character.name];
      if (!image?.url) return null;

      return {
        id: makeImageId("portrait", character.name),
        src: image.url,
        alt: `${character.name} cast portrait`,
        title: character.name,
        description: compactDescription(character.description, character.arc_summary),
        meta: compactLabel(
          "Cast reference",
          character.scenes_present?.length
            ? `${character.scenes_present.length} scenes`
            : undefined,
        ),
      };
    })
    .filter(isLightboxImage);

  const propLightboxImages = propsMaster
    .map((prop): LightboxImage | null => {
      const image = propImages[prop.item];
      if (!image?.url) return null;

      return {
        id: makeImageId("prop", prop.item),
        src: image.url,
        alt: `${prop.item} prop reference`,
        title: toDisplayTitle(prop.item),
        description: prop.notes,
        meta: compactLabel(
          prop.hero_prop ? "Hero prop" : "Prop reference",
          `${prop.scenes.length} ${prop.scenes.length === 1 ? "scene" : "scenes"}`,
        ),
      };
    })
    .filter(isLightboxImage);

  const posterLightboxImages = posterConcepts
    .map((concept): LightboxImage | null => {
      const image = posterImages[concept.number];
      if (!image?.url) return null;

      return {
        id: makeImageId("poster-concept", String(concept.number)),
        src: image.url,
        alt: `Poster concept ${concept.number}: ${concept.name}`,
        title: concept.name,
        description: compactDescription(concept.composition, concept.tagline),
        meta: compactLabel("Poster concept", concept.category),
      };
    })
    .filter(isLightboxImage);

  return [
    ...storyboardLightboxImages,
    ...locationLightboxImages,
    ...portraitLightboxImages,
    ...propLightboxImages,
    ...posterLightboxImages,
  ];
}

function ImageOpenButton({
  label,
  children,
  className,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-ui-audio="open"
      className={cn(
        "group relative block overflow-hidden bg-transparent text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background print:pointer-events-none",
        className,
      )}
    >
      {children}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full border-t border-foreground bg-[var(--paper-highlight)] px-2 py-1 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-foreground transition-transform duration-150 group-hover:translate-y-0 group-focus-visible:translate-y-0 print:hidden">
        Inspect image
      </span>
    </button>
  );
}

function makeImageId(kind: string, key: string) {
  const normalizedKey = key
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${kind}-${normalizedKey || "untitled"}`;
}

function cleanSceneSlug(slugLine: string) {
  return slugLine
    .replace(/^(INT|EXT)\.\s*/, "")
    .replace(/\s*-\s*(NIGHT|DAY|MORNING|AFTERNOON|EVENING|DAWN|DUSK|CONTINUOUS)\s*$/i, "")
    .trim();
}

function compactDescription(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}

function compactLabel(...values: Array<number | string | undefined>) {
  return values
    .filter((value) => value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value))
    .join(" · ");
}

function toDisplayTitle(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function isLightboxImage(image: LightboxImage | null): image is LightboxImage {
  return Boolean(image);
}

function PosterCard({
  posterUrl,
  title,
  year,
  subtitle,
  description,
}: {
  posterUrl: string | null;
  title: string;
  year?: number;
  subtitle?: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-card/30 p-3 break-inside-avoid">
      <div className="w-20 aspect-[2/3] rounded-md overflow-hidden bg-muted/40 border border-border/60 shrink-0">
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-foreground leading-snug">
          {title}
          {year && (
            <span className="text-muted-foreground font-normal"> · {year}</span>
          )}
        </div>
        {subtitle && (
          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {subtitle}
          </div>
        )}
        <p className="text-[11px] text-foreground/65 leading-[1.55] mt-1.5 first-letter:uppercase">
          {description}
        </p>
      </div>
    </div>
  );
}

type ParsedScene = {
  number: number;
  slugLine: string;
  intExt: "INT" | "EXT" | "";
  timeOfDay: string;
  fields: { label: string; value: string }[];
};

// One shared label/value row so every detail line in a scene card — content
// fields and storyboard cues alike — uses the exact same label treatment.
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-3">
      <dt className="pt-px text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </dt>
      <dd className="flex-1 text-[12px] leading-[1.5] text-foreground/75">{children}</dd>
    </div>
  );
}

function SceneFull({
  scene,
  storyboard,
  image,
  storyboardLightboxId,
  onOpenImage,
}: {
  scene: ParsedScene;
  storyboard?: StoryboardScene;
  image?: SavedImage;
  storyboardLightboxId?: string;
  onOpenImage?: (imageId: string) => void;
}) {
  const characters = scene.fields.find((f) => f.label === "Characters")?.value || "";
  const pages = scene.fields.find((f) => f.label === "Pages")?.value || "";
  const keyVisual = scene.fields.find((f) => f.label === "Key Visual Moment")?.value || "";
  const beat = scene.fields.find((f) => f.label === "Emotional Beat")?.value || "";
  const notes = scene.fields.find((f) => f.label === "Notes")?.value || "";

  // Everything the dossier-summary versions dropped stays here — Props,
  // Wardrobe, VFX/Stunts, etc. — packed into a tight definition grid instead
  // of spacious stacked blocks. Nothing is hidden or truncated, so the card
  // still prints complete.
  const HANDLED = new Set([
    "Location",
    "Time",
    "Pages",
    "Characters",
    "Key Visual Moment",
    "Emotional Beat",
    "Notes",
  ]);
  const detailRows = [
    ...(characters ? [{ label: "Characters", value: characters }] : []),
    ...scene.fields.filter(
      (f) => !HANDLED.has(f.label) && f.value && f.value !== "None",
    ),
    ...(notes ? [{ label: "Notes", value: notes }] : []),
  ];

  const slug = scene.slugLine
    .replace(/^(INT|EXT)\.\s*/, "")
    .replace(/\s*-\s*(NIGHT|DAY|MORNING|AFTERNOON|EVENING|DAWN|DUSK|CONTINUOUS)\s*$/i, "");

  const storyboardImageUrl = image?.url;
  const hasStoryboardImage = Boolean(storyboardImageUrl);
  const versionedStoryboardImageUrl = storyboardImageUrl
    ? storyboardImageUrl
    : "";
  const hasStoryboardDetails = Boolean(
    storyboard?.camera || storyboard?.lighting || storyboard?.mood,
  );

  return (
    <div className="flex border bg-card/40 break-inside-avoid">
      {/* Meta rail */}
      <div className="flex w-[74px] shrink-0 flex-col items-start gap-2 border-r border-border/60 px-3 py-3.5">
        <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-foreground">
          {scene.number}
        </span>
        {scene.intExt && (
          <span className="border border-foreground px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
            {scene.intExt}
          </span>
        )}
        <div className="text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
          {scene.timeOfDay && <div>{scene.timeOfDay}</div>}
          {pages && <div className="tabular-nums">pp. {pages}</div>}
        </div>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 px-4 py-3.5">
        {/* Slug + beat */}
        <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <h3 className="text-[14px] font-bold leading-snug text-foreground">{slug}</h3>
          {beat && (
            <span className="max-w-full bg-[#ffe34d26] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-foreground">
              {beat}
            </span>
          )}
        </div>

        {/* Key visual moment — the lead */}
        {keyVisual && (
          <p className="text-[14px] leading-[1.65] text-foreground/85">{keyVisual}</p>
        )}

        {/* Every remaining field as one consistent stacked label/value list —
            Characters, Props, Wardrobe, VFX/Stunts, Notes, then the
            storyboard's Camera/Lighting/Mood share the exact same row style.
            A hairline rule sets the metadata list off from the description. */}
        {(detailRows.length > 0 || storyboard) && (
          <dl className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
            {detailRows.map((field) => (
              <FieldRow key={`${scene.number}-${field.label}`} label={field.label}>
                {field.value}
              </FieldRow>
            ))}

            {storyboard && (hasStoryboardImage || hasStoryboardDetails) && (
              <div className="mt-3 flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row">
                {hasStoryboardImage && (
                  <div className="w-full shrink-0 sm:w-[200px]">
                    <div className="aspect-video overflow-hidden border border-border/60 bg-muted/30">
                      <ImageOpenButton
                        label={`Open storyboard for scene ${scene.number}`}
                        onClick={() => {
                          if (storyboardLightboxId) onOpenImage?.(storyboardLightboxId);
                        }}
                        className="h-full w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={versionedStoryboardImageUrl}
                          alt={`Storyboard — Scene ${scene.number}`}
                          className="h-full w-full object-cover"
                        />
                      </ImageOpenButton>
                    </div>
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {storyboard.camera && <FieldRow label="Camera">{storyboard.camera}</FieldRow>}
                  {storyboard.lighting && (
                    <FieldRow label="Lighting">{storyboard.lighting}</FieldRow>
                  )}
                  {storyboard.mood && <FieldRow label="Mood">{storyboard.mood}</FieldRow>}
                </div>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

function PrintStyles() {
  // Screen-side light theming now lives in the shared `.paper` scope in
  // globals.css (the old `.share-light` token block graduated there). Only the
  // print reset stays here.
  return (
    <style jsx global>{`
      @media print {
        .paper {
          --background: #ffffff;
          --foreground: #111111;
          --card: #ffffff;
          --muted: rgba(17, 17, 17, 0.06);
          --muted-foreground: rgba(17, 17, 17, 0.55);
          --border: rgba(17, 17, 17, 0.14);
          background: white !important;
          color: #111111 !important;
        }
        .no-print {
          display: none !important;
        }
        .shareable-page {
          padding: 0.5in !important;
          max-width: none !important;
        }
        body {
          background: white !important;
        }
        .break-inside-avoid {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @page {
          margin: 0.4in;
          size: letter;
        }
      }
    `}</style>
  );
}
