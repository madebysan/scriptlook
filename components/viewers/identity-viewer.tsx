"use client";

import { useMemo } from "react";
import { Palette, Type } from "lucide-react";
import { TitleTreatment } from "@/components/viewers/title-treatment";
import { SectionHead } from "@/components/ui/section-head";
import { SectionLabelPill } from "@/components/ui/inline-chip";
import { ShuffleButton, useShuffleState } from "@/components/ui/shuffle-button";
import { EditableText } from "@/components/ui/editable-text";
import { replaceMarkdownSection } from "@/lib/markdown-utils";
import { useApiKeys } from "@/lib/api-keys-context";

type ColorEntry = { name: string; hex: string; description: string };

type IdentityViewerProps = {
  jsonData: string;
  moodContent: string | null;
  onMoodContentUpdate?: (newContent: string) => void;
};

function parsePalette(md: string | null): ColorEntry[] {
  if (!md) return [];
  const sections = md.split(/^## /m).slice(1);
  for (const section of sections) {
    const [heading, ...bodyLines] = section.split("\n");
    if (!heading.toLowerCase().includes("color palette")) continue;
    const body = bodyLines.join("\n");
    const lines = body.split("\n").filter((l) => l.trim().startsWith("-"));
    const out: ColorEntry[] = [];
    for (const line of lines) {
      const match = line.match(/-\s*\*\*([^*]+)\*\*\s*`(#[0-9a-fA-F]{3,8})`\s*—\s*(.+)/);
      if (match) {
        out.push({
          name: match[1].trim(),
          hex: match[2].trim(),
          description: match[3].trim(),
        });
      }
    }
    return out;
  }
  return [];
}

function parseTitleFromJson(jsonData: string): string {
  try {
    const parsed = JSON.parse(jsonData);
    return parsed.title || "Untitled";
  } catch {
    return "Untitled";
  }
}

export function IdentityViewer({
  jsonData,
  moodContent,
  onMoodContentUpdate,
}: IdentityViewerProps) {
  const paletteShuffle = useShuffleState();
  const { ensureKeys } = useApiKeys();

  const palette = useMemo(() => parsePalette(moodContent), [moodContent]);
  const title = useMemo(() => parseTitleFromJson(jsonData), [jsonData]);

  const handleReshufflePalette = async () => {
    if (!moodContent || !onMoodContentUpdate) return;
    const keys = await ensureKeys();
    if (!keys) return;
    await paletteShuffle.run(async () => {
      const res = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionKey: "mood-and-tone/color-palette",
          jsonData,
          apiProvider: keys.apiProvider,
          apiKey: keys.apiKey,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { content: newSection } = await res.json();
      const updated = replaceMarkdownSection(moodContent, "Color Palette", newSection);
      onMoodContentUpdate(updated);
    });
  };

  function handleColorEdit(hex: string, field: "name" | "description", newValue: string) {
    if (!moodContent || !onMoodContentUpdate) return;
    const updatedPalette = palette.map((c) =>
      c.hex === hex ? { ...c, [field]: newValue } : c,
    );
    const newSectionMd = [
      "## Color Palette",
      ...updatedPalette.map(
        (c) => `- **${c.name}** \`${c.hex}\` — ${c.description}`,
      ),
    ].join("\n");
    const updated = replaceMarkdownSection(moodContent, "Color Palette", newSectionMd);
    onMoodContentUpdate(updated);
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <SectionLabelPill icon={<Palette size={10} />} className="mb-3">
          Visual Identity
        </SectionLabelPill>
        <h1 className="mb-3 font-display text-[38px] font-normal leading-[1.05] tracking-normal text-foreground md:text-[46px]">
          Identity
        </h1>
        <p className="max-w-[62ch] text-[16px] leading-[1.65] text-foreground/62">
          Color and type for the first visual pass.
        </p>
      </div>

      <div className="space-y-14">
        <section>
          <SectionHead
            index={1}
            label="Palette"
            labelIcon={<Palette size={10} />}
            meta={
              onMoodContentUpdate ? (
                <ShuffleButton
                  onClick={handleReshufflePalette}
                  state={paletteShuffle.state}
                  title="Reshuffle color palette"
                />
              ) : null
            }
          >
            Color Palette
          </SectionHead>

          {palette.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 tracking-normal">
              No palette yet. Check Mood & Tone.
            </p>
          ) : (
            <div
              className={`grid grid-cols-1 gap-3 transition-opacity duration-200 ${
                paletteShuffle.state === "loading" ? "opacity-40" : "opacity-100"
              }`}
            >
              {palette.map((c) => (
                <div
                  key={c.hex}
                  className="flex min-h-[82px] items-center gap-4 rounded-[12px] border border-border bg-card/35 px-3 py-3 transition-all hover:border-foreground/18 hover:bg-card/45"
                >
                  <div
                    className="h-11 w-11 shrink-0 rounded-[6px] border border-white/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <div className="min-w-0 flex-1 pr-5 relative">
                        <EditableText
                          value={c.name}
                          onSave={(next) => handleColorEdit(c.hex, "name", next)}
                          editable={Boolean(onMoodContentUpdate)}
                          title="Edit color name"
                          pencilSize={10}
                          renderDisplay={(v) => (
                            <span className="text-[13px] font-medium text-foreground leading-tight tracking-normal">
                              {v}
                            </span>
                          )}
                          inputClassName="text-[13px] font-medium"
                        />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                        {c.hex}
                      </span>
                    </div>
                    <div className="mt-1 pr-5 relative">
                      <EditableText
                        value={c.description}
                        onSave={(next) => handleColorEdit(c.hex, "description", next)}
                        editable={Boolean(onMoodContentUpdate)}
                        multiline
                        multilineSize="compact"
                        title="Edit color description"
                        pencilSize={10}
                        renderDisplay={(v) => (
                          <p className="text-[12px] text-foreground/70 leading-[1.55] tracking-normal">
                            {v}
                          </p>
                        )}
                        inputClassName="text-[12px] leading-[1.55]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHead index={2} label="Treatment" labelIcon={<Type size={10} />}>
            Title Treatment
          </SectionHead>
          <TitleTreatment title={title} />
        </section>
      </div>
    </div>
  );
}
