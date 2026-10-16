export const MOOD_AND_TONE_PROMPT = `Generate a Mood & Tone document from this screenplay data. This is the most important document in the bible for a director, cinematographer, production designer, or composer — it's the film's atmospheric identity, put into words.

Write like a thoughtful cinephile, not a marketer. Avoid generic adjectives ("gritty", "cinematic", "haunting") — go specific. Reference concrete moments from the scenes. Trust the reader's taste.

Before writing, silently create a one-paragraph creative brief for yourself from the JSON:
- What kind of film is this?
- What should the deck sound like?
- What should it avoid sounding like?
- Which 3-5 images, locations, props, or relationships define the film?

Apply that brief to every section, but do not output it. The document must adapt to the film. An intimate romance should not sound like a military epic. A fable should not sound like a thriller. A court satire should not sound like a superhero campaign. Avoid reusable phrases from prior demos — and avoid reusable structural sentences too ("the surface cracks", "earns its feeling", "gains a pulse", "lets real feeling break through"): every transition must name a concrete on-screen detail instead.

Quotation discipline: never wrap text in quotation marks unless that exact string appears in the supplied JSON. Lines you remember from films you recognize are NOT in your source — paraphrase the beat instead. The reverse also holds: when the JSON itself carries a load-bearing line of dialogue or a vivid phrase, USE it — quoting the source's strongest material is the point of the document, and timidity here flattens the deck.

Format your output as clean markdown:

# Mood & Tone

## Atmosphere
Write a 3-4 paragraph prose narrative of the film's overall atmosphere. Describe the air, the light, the textures, the pace. What does it feel like to watch this film? What would a viewer remember a week later? Reference specific scenes and emotional beats where helpful, but keep the prose flowing — not bulleted. This is the heart of the document. Match the film's scale: quiet films need quiet sentences, spectacle films can carry scale, horror needs pressure, fables need simplicity. Close the section on a concrete image cluster pulled from the JSON's scenes — specific objects, specific light — never on a tidy abstract summary.

## Tonal Descriptors
Give 8-12 single-word or short-phrase descriptors that together triangulate the film's tone. Mix registers — some should be concrete (textural, visual), some emotional, some pacing-related. Format as a simple inline list separated by middots:

\`descriptor one · descriptor two · descriptor three · ...\`

## Color Palette
Propose 5 colors that define the film's visual identity. Ground each choice in the screenplay — what scene, what character, what emotional beat does this color belong to? Format as:

- **[Color Name]** \`#[hex]\` — [one sentence tying this color to a specific scene or emotional register from the script]

## Music & Sound Direction
Write 2-3 paragraphs on the sonic texture of the film. Address:
- The overall musical identity — acoustic or electronic, sparse or dense, diegetic or scored, referential or original
- Specific moments from the screenplay where music or sound should do heavy lifting (cite the scene)
- What silence, room tone, city noise, object sounds, language, or physical action should carry when music stays out

Then, under the same section heading, list 4 SOUNDTRACK REFERENCES — actual film scores whose sensibility matches this film. Use this exact format:

### Soundtrack References
- **[Film Title] ([Year])** — [Composer Name] — [one sentence on what specifically to steal: the texture, the restraint, the rhythmic idea, the instrumentation]
- **[Film Title] ([Year])** — [Composer Name] — [one sentence]
- **[Film Title] ([Year])** — [Composer Name] — [one sentence]
- **[Film Title] ([Year])** — [Composer Name] — [one sentence]

Use the exact common film title so it can be looked up in a film database. Mix a canonical touchstone, a recent reference, and something slightly unexpected. No title may appear in both Soundtrack References and Similar Moods — if a film fits both, use it once and find a distinct title for the other list.

## Reference Points
Give 4-6 visual/tonal references — can be directors, paintings, photographers, records, music videos, specific scenes from other films. Not comparable films in the marketing sense — actual aesthetic touchstones a DP or production designer would study. Each with one sentence on what specifically to steal.

- **[Reference]** — [what to take from it]

## Similar Moods
Name exactly 4 films that share this film's mood — not its plot, not its genre, its FEEL. The air in the room. What a viewer would remember a week later. Mix a canonical touchstone, a recent reference, and something slightly unexpected. Use the exact film title as commonly known (so it can be looked up in a film database), with the year in parentheses.

- **[Film Title] ([Year])** — [one short sentence on what mood, atmosphere, or tonal quality specifically aligns: the dread, the stillness, the moral weight, the palette, the texture of silence, etc.]

Output ONLY the markdown document. No commentary outside the document. Do not include any introductory text before the # heading.`;
