import { describe, expect, it } from "vitest";

import { parseMoodAndTone } from "@/components/viewers/mood-and-tone-viewer";

// Self-contained Mood & Tone fixture (no demo dependency). Deliberately uses
// the hyphen separator form ( - ) the parser must accept alongside em-dashes.
const MOOD_AND_TONE_FIXTURE = `## Atmosphere

Dread that hides in plain daylight.

## Tonal Descriptors

Unsettling · Controlled · Paranoid

## Color Palette

- **Bone White** \`#f4f1ea\` - sterile suburban calm
- **Blood Red** \`#7a1c1c\` - sudden, intimate violence

## Music & Sound

Low strings and long silences carry the unease.

### Soundtrack References

- **Sicario (2015)** - Jóhann Jóhannsson - Low-frequency dread that never resolves
- **Get Out (2017)** - Michael Abels - Swahili warnings buried under the strings

## Similar Moods

- **Rosemary's Baby (1968)** - polite menace closing in on the everyday
- **The Stepford Wives (1975)** - suburban conformity as slow horror

## References

- **Rosemary's Baby** - paranoia inside a friendly building
- **Funny Games** - violence framed by impeccable manners
`;

describe("parseMoodAndTone", () => {
  it("parses fixture rows that use hyphen separators", () => {
    const parsed = parseMoodAndTone(MOOD_AND_TONE_FIXTURE);

    expect(parsed.references.length).toBeGreaterThan(0);
    expect(parsed.similarMoods.length).toBeGreaterThan(0);
    expect(parsed.soundtracks.length).toBeGreaterThan(0);
    expect(parsed.palette.length).toBeGreaterThan(0);
    expect(parsed.references.map((item) => item.title)).toContain("Rosemary's Baby");
    expect(parsed.similarMoods.map((item) => item.title)).toContain("Rosemary's Baby");
    expect(parsed.soundtracks.map((item) => item.title)).toContain("Sicario");
    expect(parsed.soundtracks.find((item) => item.title === "Sicario")?.description).toContain("Low-frequency dread");
  });
});
