import { NextRequest, NextResponse } from "next/server";
import { generateDocument } from "@/lib/claude";
import { resolveTextGenerationConfig } from "@/lib/text-generation";
import { mapTextProviderError } from "@/lib/text-provider-errors";
import { getGenerationAccessErrorStatus } from "@/lib/generation-access";

// Focused prompts for regenerating individual sections within a document.
// Each returns JUST the section markdown (including the ## heading) so callers
// can splice it back into the full document.

const SECTION_PROMPTS: Record<string, string> = {
  "overview/taglines": `Write 3 new taglines for this film. Taglines are what goes on the poster — short, atmospheric, built for a one-sheet. Each should take a different angle: one visceral, one thematic, one enigmatic. No more than 10 words each. Avoid cliches and avoid repeating anything a previous generation might have written.

Output ONLY the taglines in this exact markdown format:

## Taglines
- Tagline one
- Tagline two
- Tagline three

No commentary, no extra text.`,

  "mood-and-tone/color-palette": `Propose 5 NEW colors that define this film's visual identity. Ground each choice in the screenplay — what scene, what character, what emotional beat does this color belong to? Pick colors that are DIFFERENT from an obvious first pass — reach for the second or third choice a designer would make. No obvious blacks/whites/reds unless there's a specific scene-grounded reason. Mix hue, saturation, and temperature intentionally.

Output ONLY the palette in this exact markdown format:

## Color Palette
- **[Color Name]** \`#[hex]\` — [one sentence tying this color to a specific scene or emotional register from the script]
- **[Color Name]** \`#[hex]\` — [description]
- **[Color Name]** \`#[hex]\` — [description]
- **[Color Name]** \`#[hex]\` — [description]
- **[Color Name]** \`#[hex]\` — [description]

No commentary, no extra text.`,

  "mood-and-tone/music": `Rewrite the Music & Sound Direction for this film. Write 2-3 paragraphs on the sonic texture — the musical identity (acoustic or electronic, sparse or dense, scored or found), and specific screenplay moments where music/sound should do heavy lifting. Reference scene numbers where relevant.

Then list 4 SOUNDTRACK REFERENCES — actual film scores. Use a DIFFERENT set of films from any obvious first pass. Mix canonical with recent, and include at least one slightly unexpected pick. Use exact common film titles so they can be looked up.

Output ONLY the section in this exact markdown format:

## Music & Sound Direction
[paragraph 1]

[paragraph 2]

[paragraph 3, optional]

### Soundtrack References
- **[Film Title] ([Year])** — [Composer] — [one sentence on what specifically to steal]
- **[Film Title] ([Year])** — [Composer] — [one sentence]
- **[Film Title] ([Year])** — [Composer] — [one sentence]
- **[Film Title] ([Year])** — [Composer] — [one sentence]

No commentary, no extra text.`,

  "mood-and-tone/similar-moods": `Pick 4 NEW films whose MOOD this script most resembles — not plot, not genre, but emotional and atmospheric register. Reach past the obvious. Mix art-house with mainstream, mix decades, include at least one that would surprise a film-literate reader. Use exact common film titles so they can be looked up.

For each, write one sentence on the SHARED EMOTIONAL TEXTURE — what specifically these two films feel like in the same way. Don't just say "tense" or "atmospheric" — name the specific feeling.

Output ONLY the section in this exact markdown format:

## Similar Moods
- **[Film Title] ([Year])** — [one sentence on the shared emotional texture]
- **[Film Title] ([Year])** — [one sentence]
- **[Film Title] ([Year])** — [one sentence]
- **[Film Title] ([Year])** — [one sentence]

No commentary, no extra text.`,

  "mood-and-tone/reference-points": `Generate 5-6 NEW Reference Points for this film's visual and emotional language. Reference points are NOT films — they should be: photographers, painters, architectural movements, books, music genres, specific historical moments, art movements, or specific artists. Reach past the obvious. Each reference should illuminate something specific the script is doing.

For each, write one sentence on what to STEAL from this reference — what visual or emotional technique the film should borrow.

Output ONLY the section in this exact markdown format:

## Reference Points
- **[Reference name]** — [one sentence on what specifically to steal or learn]
- **[Reference name]** — [one sentence]
- **[Reference name]** — [one sentence]
- **[Reference name]** — [one sentence]
- **[Reference name]** — [one sentence]
- **[Reference name]** — [one sentence, optional 6th]

No commentary, no extra text.`,

  "mood-and-tone/atmosphere": `Rewrite the Atmosphere section for this film. Write 2-3 paragraphs (not bullet points) of cinephile-grade prose describing the film's atmospheric DNA — what it feels like to inhabit this story scene by scene. Ground claims in specific screenplay moments (reference scene numbers where it sharpens the point). Avoid generic adjectives like "tense" or "moody"; reach for specific, sensory language.

Then list 8-10 TONAL DESCRIPTORS — short, evocative, sometimes-paradoxical phrases (like "exhausted wonder" or "baroque fatigue") separated by middle dots.

Output ONLY the section in this exact markdown format:

## Atmosphere

[paragraph 1]

[paragraph 2]

[paragraph 3, optional]

## Tonal Descriptors

[Descriptor 1] · [Descriptor 2] · [Descriptor 3] · [Descriptor 4] · [Descriptor 5] · [Descriptor 6] · [Descriptor 7] · [Descriptor 8] · [Descriptor 9] · [Descriptor 10]

No commentary, no extra text.`,

  "overview/synopsis": `Rewrite the Synopsis for this film. 2-3 paragraphs. Write it like the back of a Criterion DVD — atmospheric, specific, lingers on emotional truth rather than plot mechanics. Reach past obvious "and then" plot recap. Should make a reader want to watch the film. Around 150-220 words total.

Output ONLY the section in this exact markdown format:

## Synopsis

[paragraph 1]

[paragraph 2]

[paragraph 3, optional]

No commentary, no extra text.`,

  "overview/themes": `Rewrite the Themes section for this film. Identify 4-5 DIFFERENT thematic threads from any obvious first pass. Reach for the second or third theme a thoughtful reader would notice — not the surface "good vs evil" but something specific to THIS script. Each theme gets a 2-3 sentence paragraph explaining how the screenplay surfaces it (reference characters or scene numbers).

Output ONLY the section in this exact markdown format:

## Themes

**[Theme name]**

[paragraph]

**[Theme name]**

[paragraph]

**[Theme name]**

[paragraph]

**[Theme name]**

[paragraph]

**[Theme name, optional 5th]**

[paragraph]

No commentary, no extra text.`,
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sectionKey?: unknown;
      jsonData?: unknown;
      apiKey?: unknown;
      apiProvider?: unknown;
    };
    const sectionKey = typeof body.sectionKey === "string" ? body.sectionKey : "";
    const jsonData = typeof body.jsonData === "string" ? body.jsonData : "";
    const generationAccess = await resolveTextGenerationConfig(body);
    const { apiKey, provider } = generationAccess;

    if (!sectionKey || !jsonData || !apiKey) {
      return NextResponse.json(
        { error: "Missing sectionKey, jsonData, or selected provider API key" },
        { status: 400 },
      );
    }

    const prompt = SECTION_PROMPTS[sectionKey];
    if (!prompt) {
      return NextResponse.json(
        { error: `Unknown section key: ${sectionKey}` },
        { status: 400 },
      );
    }

    const content = await generateDocument(prompt, jsonData, { apiKey, provider });
    return NextResponse.json({ content: content.trim() });
  } catch (error) {
    console.error("Section regeneration error:", error);
    const accessStatus = getGenerationAccessErrorStatus(error);
    if (accessStatus !== 500) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Regeneration is unavailable" },
        { status: accessStatus },
      );
    }
    const providerError = mapTextProviderError(error, "anthropic", "regeneration");
    return NextResponse.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  }
}
