"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { FileText, Sparkles, BarChart3, Compass, ImageIcon, Pencil, Check } from "lucide-react";
import { replaceMarkdownSection } from "@/lib/markdown-utils";
import { SectionHead } from "@/components/ui/section-head";
import { SectionLabelPill } from "@/components/ui/inline-chip";
import { ShuffleButton, useShuffleState } from "@/components/ui/shuffle-button";
import { EditableText } from "@/components/ui/editable-text";
import { PosterCarousel } from "./poster-carousel";
import type { SavedImage } from "@/lib/reports";
import { useApiKeys } from "@/lib/api-keys-context";

type IdentityEntry = { label: string; value: string };
type ThemeEntry = { title: string; body: string };
type StatEntry = { label: string; value: string };

type ParsedOverview = {
  title: string;
  logline: string;
  taglines: string[];
  synopsis: string;
  identity: IdentityEntry[];
  themes: ThemeEntry[];
  stats: StatEntry[];
  complexity: string;
};

export function parseOverview(md: string): ParsedOverview {
  const result: ParsedOverview = {
    title: "",
    logline: "",
    taglines: [],
    synopsis: "",
    identity: [],
    themes: [],
    stats: [],
    complexity: "",
  };

  const titleMatch = md.match(/^#\s+(.+)$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  const sections = md.split(/^## /m).slice(1);

  for (const section of sections) {
    const [heading, ...bodyLines] = section.split("\n");
    const body = bodyLines.join("\n").trim();
    const h = heading.toLowerCase().trim();

    if (h === "logline") {
      result.logline = body.trim();
    } else if (h === "taglines" || h.includes("tagline")) {
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      result.taglines = lines.map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
    } else if (h === "synopsis") {
      result.synopsis = body.trim();
    } else if (h.includes("film identity")) {
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(/-\s*\*\*([^:]+):\*\*\s*(.+)/);
        if (match) {
          result.identity.push({ label: match[1].trim(), value: match[2].trim() });
        }
      }
    } else if (h === "themes") {
      const blocks = body.split(/\n\n+/).filter(Boolean);
      for (const block of blocks) {
        const match = block.match(/^\*\*([^*]+)\*\*\s*\n?([\s\S]*)/);
        if (match) {
          result.themes.push({
            title: match[1].trim(),
            body: match[2].trim(),
          });
        }
      }
    } else if (h.includes("scope")) {
      const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const match = line.match(/-\s*\*\*([^:]+):\*\*\s*(.+)/);
        if (match) {
          const label = match[1].trim();
          const value = match[2].trim();
          if (label.toLowerCase().includes("complexity")) {
            result.complexity = value;
          } else {
            result.stats.push({ label, value });
          }
        }
      }
    }
  }

  return result;
}

type OverviewViewerProps = {
  content: string;
  jsonData?: string;
  onContentUpdate?: (newContent: string) => void;
  posterContent?: string | null;
  posterImages?: Record<number, SavedImage>;
  onNavigateToPosters?: () => void;
};

export function getLeadingNumber(value: string): string | null {
  return value.match(/^(\d[\d.,]*)/)?.[1] ?? null;
}

export function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function OverviewViewer({
  content,
  jsonData,
  onContentUpdate,
  posterContent,
  posterImages,
  onNavigateToPosters,
}: OverviewViewerProps) {
  const parsed = useMemo(() => parseOverview(content), [content]);
  const taglinesShuffle = useShuffleState();
  const synopsisShuffle = useShuffleState();
  const themesShuffle = useShuffleState();
  const { ensureKeys } = useApiKeys();
  const numericStats = parsed.stats.filter((stat) => getLeadingNumber(stat.value));
  const textStats = parsed.stats.filter((stat) => !getLeadingNumber(stat.value));

  // Each shuffle uses its own state so they can run independently.
  async function shuffleSection(
    state: ReturnType<typeof useShuffleState>,
    sectionKey: string,
    sectionHeading: string,
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
      const updated = replaceMarkdownSection(content, sectionHeading, newSection);
      onContentUpdate(updated);
    });
  }

  function handleIdentityEdit(label: string, newValue: string) {
    if (!onContentUpdate) return;
    const updatedIdentity = parsed.identity.map((item) =>
      item.label === label ? { ...item, value: newValue } : item,
    );
    const newSectionMd = [
      "## Film Identity",
      ...updatedIdentity.map((item) => `- **${item.label}:** ${item.value}`),
    ].join("\n");
    const updated = replaceMarkdownSection(content, "Film Identity", newSectionMd);
    onContentUpdate(updated);
  }

  function handleLoglineEdit(newValue: string) {
    if (!onContentUpdate) return;
    const newSectionMd = `## Logline\n${newValue}`;
    const updated = replaceMarkdownSection(content, "Logline", newSectionMd);
    onContentUpdate(updated);
  }

  const hasCarousel = !!posterContent && !!posterImages && Object.keys(posterImages).length > 0;

  return (
    <div className="max-w-5xl space-y-16">
      <header className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-10 items-start">
        <div>
          <SectionLabelPill icon={<Compass size={11} />} className="mb-4">
            Overview
          </SectionLabelPill>
          {parsed.title && (
            <h1 className="font-display text-[40px] font-normal leading-[1.04] tracking-normal text-foreground md:text-[48px]">
              {parsed.title}
            </h1>
          )}
          {parsed.logline && (
            <div className="max-w-[58ch] pr-6">
              <EditableText
                value={parsed.logline}
                onSave={handleLoglineEdit}
                editable={Boolean(onContentUpdate)}
                multiline
                multilineSize="long"
                title="Edit the logline"
                renderDisplay={(v) => (
                  <p className="mt-4 text-[17px] leading-[1.6] text-foreground/68">
                    {v}
                  </p>
                )}
                inputClassName="text-[16px] leading-[1.6] text-foreground/85"
              />
            </div>
          )}

          {parsed.taglines.length > 0 && (
            <div className="mt-8 max-w-[60ch] border-t border-border/80 pt-6">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Taglines
                </h3>
                <div className="h-px flex-1 bg-border/80" />
                {onContentUpdate && jsonData && (
                  <ShuffleButton
                    onClick={() => shuffleSection(taglinesShuffle, "overview/taglines", "Taglines")}
                    state={taglinesShuffle.state}
                    title="Generate new taglines"
                  />
                )}
              </div>
              <ul
                className={`space-y-2 transition-opacity duration-200 ${
                  taglinesShuffle.state === "loading" ? "opacity-40" : "opacity-100"
                }`}
              >
                {parsed.taglines.map((t, i) => (
                  <li
                    key={`${i}-${t}`}
                    className="text-[15px] leading-[1.55] text-foreground/76 italic"
                  >
                    “{t.replace(/^["“]|["”]$/g, "")}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.identity.length > 0 && (
            <div className="mt-8 max-w-[60ch] border-t border-border/80 pt-8">
              <h3 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Film Identity
              </h3>
              <dl className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-border">
                {parsed.identity.map((item) => (
                  <IdentityField
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    editable={Boolean(onContentUpdate)}
                    onSave={(next) => handleIdentityEdit(item.label, next)}
                  />
                ))}
              </dl>
            </div>
          )}
        </div>

        {hasCarousel ? (
          <PosterCarousel posterContent={posterContent} posterImages={posterImages!} />
        ) : (
          <button
            onClick={onNavigateToPosters}
            className="hidden md:flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-border/60 hover:border-foreground/30 aspect-[5/7] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ImageIcon size={20} className="mb-1.5" />
            <span className="text-[10px] font-medium">Generate sketch</span>
          </button>
        )}
      </header>

      {parsed.synopsis && (
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <div className="flex-1">
              <SectionHead index={1} label="Synopsis" labelIcon={<FileText size={10} />}>
                Story in brief
              </SectionHead>
            </div>
            {onContentUpdate && jsonData && (
              <ShuffleButton
                onClick={() => shuffleSection(synopsisShuffle, "overview/synopsis", "Synopsis")}
                state={synopsisShuffle.state}
                title="Rewrite the synopsis"
              />
            )}
          </div>
          <p
            className={`max-w-[68ch] whitespace-pre-line text-[16px] leading-[1.75] text-foreground/76 transition-opacity duration-200 ${
              synopsisShuffle.state === "loading" ? "opacity-40" : "opacity-100"
            }`}
          >
            {parsed.synopsis}
          </p>
        </section>
      )}

      {parsed.themes.length > 0 && (
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <div className="flex-1">
              <SectionHead index={2} label="Themes" labelIcon={<Sparkles size={10} />}>
                Core Themes
              </SectionHead>
            </div>
            {onContentUpdate && jsonData && (
              <ShuffleButton
                onClick={() => shuffleSection(themesShuffle, "overview/themes", "Themes")}
                state={themesShuffle.state}
                title="Rewrite the themes"
              />
            )}
          </div>
          <div
            className={`max-w-[68ch] space-y-6 transition-opacity duration-200 ${
              themesShuffle.state === "loading" ? "opacity-40" : "opacity-100"
            }`}
          >
            {parsed.themes.map((t) => (
              <div key={t.title}>
                <h3 className="mb-2 text-[15px] font-semibold text-foreground">
                  {t.title}
                </h3>
                <p className="text-[14px] leading-[1.7] text-foreground/68">
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(parsed.stats.length > 0 || parsed.complexity) && (
        <section>
          <SectionHead index={3} label="Scope" labelIcon={<BarChart3 size={10} />}>
            Production footprint
          </SectionHead>
          {numericStats.length > 0 && (
            <div className="mb-6 grid max-w-[760px] grid-cols-2 overflow-hidden rounded-[12px] border border-border md:grid-cols-3 xl:grid-cols-6">
              {numericStats.map((s) => {
                const shortValue = getLeadingNumber(s.value);
                return (
                  <div
                    key={s.label}
                    className="min-w-0 border-b border-r border-border bg-card/35 px-4 py-5 last:border-r-0"
                  >
                    <div className="text-[28px] font-semibold leading-none text-foreground tabular-nums">
                      {shortValue}
                    </div>
                    <div className="mt-2 min-h-[1.8em] font-mono text-[10px] font-semibold uppercase leading-[1.35] tracking-[0.1em] text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {textStats.length > 0 && (
            <div className="mb-6 grid max-w-[760px] gap-3 md:grid-cols-2">
              {textStats.map((s) => {
                const items = splitCommaList(s.value);
                const showAsList = items.length > 1 && items.length <= 8;
                return (
                  <div
                    key={s.label}
                    className="rounded-[12px] border border-border bg-card/35 p-4"
                  >
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {s.label}
                    </div>
                    {showAsList ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {items.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-border bg-white/[0.03] px-2.5 py-1 text-[12px] leading-none text-foreground/72"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[14px] leading-[1.65] text-foreground/72">
                        {s.value}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {parsed.complexity && (
            <div className="max-w-[68ch] rounded-[12px] border border-border bg-card/35 p-6">
              <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Complexity Read
              </div>
              <p className="text-[16px] leading-[1.75] text-foreground/76">
                {parsed.complexity}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Inline-editable Film Identity field. Hover reveals an edit affordance; click
// flips to a small text input. Save commits via `onSave`. Esc cancels.
function IdentityField({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="group min-w-0 border-b border-r border-border p-4">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
        {editable && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            title={`Edit ${label}`}
          >
            <Pencil size={9} />
          </button>
        )}
      </dt>
      <dd className="mt-2 truncate text-[14px] text-foreground/82">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              className="w-full rounded-[6px] bg-background/60 border border-border px-2 py-0.5 text-[13px] tracking-normal focus:outline-none focus:border-foreground/40"
            />
            <button
              onClick={commit}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Save"
            >
              <Check size={11} />
            </button>
          </div>
        ) : editable ? (
          <button
            onClick={() => setEditing(true)}
            className="text-left hover:text-foreground transition-colors w-full truncate"
            title="Click to edit"
          >
            {value}
          </button>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
