export const OVERVIEW_PROMPT = `Generate an Overview document from this screenplay data. This is the first thing a collaborator opens — it should read like the opening page of a tasteful film craft dossier. Treat it as a pitch artifact, not a spreadsheet.

Before writing, silently classify the film's creative lane from the JSON. Use that lane to control vocabulary and emphasis:
- intimate drama / romance: time, distance, language, restraint, ordinary rooms, memory, chosen lives
- horror / thriller: dread, control, threat, revelation, spatial rules, safety turning unstable
- historical / court / satire: status, ritual, costume, appetite, hierarchy, private leverage
- sci-fi / action / epic: scale, systems, vehicles, combat, worldbuilding, inherited power
- family / fable / magical realism: wonder, object behavior, innocence, public rules, simple visual metaphor

Do not force every film into the same production language. Avoid stock phrases like "power changes the room", "hero object", "main proving ground", "survival is a design language", "the world decides", or "every location has a political cost" unless the JSON genuinely supports that exact idea.

Format your output as clean markdown:

# [Title]

## Logline
Write a single compelling sentence that captures the protagonist, central tension, obstacle, and emotional or production stakes. Let the film's lane decide whether the sentence is about spectacle, intimacy, dread, ritual, or wonder. Lead with the film's most specific concrete image or object, not a generic time-passage or destiny frame. HARD LIMIT: 30 words. Count the words before emitting; if over 30, cut a subordinate clause and recount.

## Taglines
Write 3 taglines for the film. Taglines are what goes on the poster — short, atmospheric, built for a one-sheet. Each should take a different angle: one visceral, one thematic, one enigmatic. No more than 10 words each. No cliches, no generic destiny/power language. Prefer wit and a specific image over safe literalism — a tagline that could sit on any film in this genre fails. Format as a plain list:

- Tagline one
- Tagline two
- Tagline three

## Synopsis
Write a 150-200 word spoiler-free synopsis. Establish the world, the characters, and the conflict — tease the turn without revealing the ending. Suitable for sharing with a potential DP, production designer, or investor who hasn't read the script. Ground the synopsis in the film's specific emotional grammar: silence for quiet dramas, space for thrillers, ritual/status for court pieces, scale/systems for epics, object behavior for fables. Use named characters and specific scene texture from the JSON — a synopsis compressed into dense generic summary fails; concrete beats beat coverage.

## Film Identity
Always render in this exact order. Include **Written by** whenever the \`writer\` field in the JSON is a non-empty string. Only include **Based on** when the \`based_on\` field is a non-empty string.
- **Written by:** [writer field, verbatim]
- **Based on:** [based_on field, verbatim — omit this bullet entirely if the JSON has no based_on or it's empty]
- **Genre:** [primary + secondary]
- **Format:** [feature, short, series, commercial — infer from total_pages]
- **Setting:** [setting_period]
- **Tone:** [tone from the JSON]
- **Runtime estimate:** [rough estimate from page count at 1 page/minute]

## Themes
Render each theme from the JSON as a concise heading + 1-2 sentence explanation of how it threads through the story. Be specific — reference actual scenes or character arcs where helpful. If you cite a scene number, re-check that scene's key_visual_moment first: the cited scene must literally contain the action you attribute to it. When unsure, describe the moment without a number.

## Scope at a Glance
A quick read on the size of the project. Use concrete numbers pulled from the JSON. Keep estimates conservative and label them as estimates when the JSON does not make an exact answer possible:
- **Total scenes:** [count]
- **Unique locations:** [count]
- **Principal cast:** [count of characters appearing in 3+ scenes, formatted like "8 principals (plus 12 smaller roles)" when the JSON includes one-scene parts]
- **Exterior scenes:** [count where int_ext is EXT or INT/EXT — mixed scenes still need exterior work]
- **Night shoots:** [count with time_of_day = NIGHT]
- **VFX/FX scenes:** [count of scenes with non-empty vfx_stunts]
- **Company moves:** [estimated range of meaningful location moves implied by the scene order and unique locations; format like "approx. 18-24" — never a single confident number]
- **Estimated shoot days:** [rough range based only on page count, scene count, repeated locations, night shoots, exterior work, and VFX/stunts; format like "8-11 days" or "needs schedule pass"]
- **Complexity read:** [one concrete sentence naming the real pressure points — for example night exteriors, child performers, practical effects, crowds, vehicles, animals, water, company moves, or contained single-location efficiency. Do not mention budget, unions, permits, or external production assumptions unless the JSON explicitly supports them.]

Numbers discipline: every "N" or "N of total" figure in this document must be an exact count from the JSON arrays. If you cannot count it exactly, use a labeled range or a phrase like "most scenes" — never a confident-looking single number you didn't compute.

Quotation discipline: never wrap text in quotation marks unless that exact string appears in the supplied JSON. You may remember real lines from films you recognize — those are NOT in your source and must be paraphrased, not quoted.

Output ONLY the markdown document. No commentary outside the document. Do not include any introductory text before the # heading.`;
