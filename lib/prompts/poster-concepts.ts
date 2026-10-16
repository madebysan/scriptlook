export const POSTER_CONCEPTS_PROMPT = `Generate a Poster Concepts document from this screenplay data. This is a creative exploration document — generate MANY diverse ideas for movie poster designs. Quantity and variety matter more than perfection. The user will iterate on favorites.

Before writing, silently classify the film's creative lane from the JSON and choose poster language that belongs to that lane:
- intimate drama / romance: negative space, distance, city texture, rooms, thresholds, screens, hands, reflected lives
- horror / thriller: ordinary space turning unsafe, one clue, controlled gaze, social surface, ritual, threat
- historical / court / satire: status tableau, costume, rank, appetite, animals/props, ceremonial rooms, private leverage
- sci-fi / action / epic: scale, systems, vehicles, combat, ritual, environmental pressure, worldbuilding
- family / fable / magical realism: central object behavior, child-eye view, public rules, simple wonder, sky/street geometry

Do not reuse one generic concept set for every film. Avoid stock concepts like "The Power Structure", "The Hero Object", "The Main Location as Pressure", or taglines like "Power changes hands" unless the JSON specifically supports that wording. Make the concept names feel born from this screenplay.

Format your output as clean markdown:

# Poster Concepts: [Title]

## About This Document
These are concept directions for movie poster design. Each concept describes a visual approach, composition, and mood. Use these as briefs for a designer, or as prompts for AI image generation. Mix and match elements across concepts.

---

Generate 12-15 distinct poster concepts across these style categories. The per-category ranges below can sum past 15 — the TOTAL cap of 15 wins. Before finishing, count your concepts; if over 15, cut the weakest until you are within range:

### Category: Character-Driven (2-3 concepts)
Posters that center on a character's face, silhouette, or figure.

**Concept [N]: [Concept Name]**
- **Style:** [e.g., Close-up portrait, Full silhouette, Split face]
- **Composition:** [Detailed description of what the viewer sees — layout, focal point, negative space, background]
- **Color Palette:** [3-4 colors with hex codes and mood reasoning]
- **Typography:** [Where the title goes, what style, size relationship to image]
- **Tagline:** [Suggested tagline for this specific concept — original ad copy you invent, never a quoted line of script dialogue, even one that sounds right for the film. Do not wrap any text in quotation marks unless that exact string appears in the supplied JSON.]
- **Mood:** [2-3 words]
- **Campaign Read:** [Who this poster speaks to most, phrased as a design rationale rather than marketing demographics]
- **AI Prompt:** [A ready-to-use image generation prompt for this poster concept]

### Category: Symbolic/Metaphorical (2-3 concepts)
Posters built around a central symbol, object, or metaphor from the story.

### Category: Scene-Based (2-3 concepts)
Posters that depict a specific key moment or location from the film.

### Category: Minimalist/Typographic (2-3 concepts)
Posters that rely on typography, negative space, and minimal imagery.

### Category: Mood/Atmospheric (2-3 concepts)
Posters that capture the film's tone through color, texture, and abstract visuals.

### Category: Collage/Ensemble (1-2 concepts)
Posters that combine multiple elements, characters, or scenes into a unified composition.

---

## Poster Series Ideas
Suggest 2-3 ways these concepts could work as a series (e.g., character-specific variants, teaser + theatrical + home release, international variants).

## Campaign Notes
Briefly name which concepts work best as teaser, primary one-sheet, and alternate/arthouse key art. Keep it to 3-5 bullets. Do not include generic poster dimension advice, social media checklists, or production boilerplate unless the JSON itself makes that relevant.

Output ONLY the markdown document. No commentary outside the document.`;
