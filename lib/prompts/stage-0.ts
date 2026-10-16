// Stage 0 extraction prompt — run manually in Claude.ai or ChatGPT
// with your screenplay PDF attached. Copy the JSON output into the app.

export const STAGE_0_PROMPT = `You are a professional script supervisor and pre-production analyst. Analyze the attached screenplay and extract a comprehensive structured JSON document.

Read the entire screenplay carefully. Extract every scene, character, location, and prop. Be thorough — missing data means missing production planning.

Output ONLY valid JSON matching this exact schema (no markdown, no commentary, no code fences):

{
  "title": "The movie title",
  "writer": "Screenwriter name(s) as credited on the title page (e.g., 'Charlie Kaufman' or 'Joel Coen & Ethan Coen')",
  "based_on": "Source material if adapted (e.g., 'Based on the novel by Stephen King'), otherwise empty string",
  "genre": ["Primary genre", "Secondary genre"],
  "setting_period": "Time period (e.g., 'Contemporary', '1960s', 'Near future')",
  "total_pages": 120,
  "scenes": [
    {
      "scene_number": 1,
      "slug_line": "INT. LOCATION - TIME OF DAY",
      "location": "the PARENT physical location, lowercase — the place a crew travels to, not the room (e.g. 'harry's house' even when this scene plays in its kitchen). Must match a locations[] entry.",
      "int_ext": "INT" or "EXT" or "INT/EXT",
      "time_of_day": "DAY" or "NIGHT" or "DAWN" or "DUSK" or "CONTINUOUS",
      "page_start": 1,
      "page_end": 3,
      "length_eighths": 16,
      "characters_present": ["CHARACTER NAME", "CHARACTER NAME"],
      "key_visual_moment": "The single most visually striking or emotionally important moment in the scene — describe it cinematically in one sentence",
      "emotional_beat": "The core emotional shift or tension (e.g., 'confrontation', 'revelation', 'tenderness', 'dread')",
      "props": ["prop1", "prop2"],
      "wardrobe_notes": ["Character in specific outfit description"],
      "vfx_stunts": ["Any VFX, stunts, or special requirements"],
      "music_cue": "Any music direction mentioned or implied",
      "notes": "Any continuity notes, callbacks, or production-relevant details"
    }
  ],
  "characters": [
    {
      "name": "CHARACTER NAME (as written in the script, ALL CAPS)",
      "description": "Physical description, age, key traits as written in the script",
      "arc_summary": "One sentence describing their character arc across the screenplay",
      "scenes_present": [1, 3, 5, 7],
      "special_requirements": ["Any special skills, prosthetics, stunts, etc."],
      "wardrobe_changes": 4
    }
  ],
  "locations": [
    {
      "name": "location name (lowercase, matching scene references)",
      "description": "Physical description of the location as written in the script",
      "scenes": [1, 5, 12],
      "int_ext": "INT" or "EXT" or "BOTH",
      "time_variations": ["NIGHT", "MORNING"],
      "set_requirements": ["Key set dressing, practical effects, or build requirements"]
    }
  ],
  "props_master": [
    {
      "item": "prop name",
      "scenes": [1, 7, 15],
      "hero_prop": true,
      "notes": "Any special requirements (close-up, breakaway, multiples needed, etc.)"
    }
  ],
  "themes": ["Major thematic element 1", "Major thematic element 2"],
  "tone": "Overall tone description in 2-3 words (e.g., 'dark comedic thriller', 'tender coming-of-age')"
}

Rules:
- Segment by slug line: start a NEW scene object at every INT./EXT. heading. Never merge multiple slug lines into one scene, and never split one slug line into multiple scenes. A feature screenplay normally yields 40-150 scenes — if you have far fewer, you are lumping sequences together; re-segment scene by scene.
- scene_number MUST be a sequential integer (1, 2, 3 ... N) as a JSON number, never a string. When the source uses lettered scenes (17A, 33C) or its numbering skips values, renumber sequentially and record the original in notes as "Source slug numbered 17A." — downstream parsers and image keys require unique integers.
- Include EVERY scene in order, even brief transitional or one-line scenes.
- page_start and page_end are your best estimate of the pages the scene spans. Ranges must run in order and stay contiguous (each scene's page_start is greater than or equal to the previous scene's). A single scene rarely exceeds 3 pages.
- length_eighths is the scene's length in eighths of a page (8 = one full page): a half-page scene is 4, a two-page scene is 16. Use a whole number, minimum 1. Most scenes fall between 1 and 24. This drives scheduling, so estimate it carefully per scene.
- time_of_day must match each scene's slug line accurately (DAY, NIGHT, DAWN, DUSK, or CONTINUOUS). Do not default scenes to NIGHT.
- Character names must be consistent (use the ALL CAPS version from the script)
- Location names must be consistent across scenes (use lowercase).
- GROUP locations by physical place, not by slug heading. One building or place a crew travels to is ONE location, even when scenes play in different rooms or areas of it. "INT. BARN HOUSE - DOWNSTAIRS", "INT. BARN HOUSE - UPSTAIRS", and "INT. BARN HOUSE - NORA'S ROOM" are all the SAME location ("barn house"), not three. The room/area lives in the scene's slug_line; note distinct areas in the location's set_requirements. Count locations the way a line producer would: the number of distinct places you'd physically travel to, typically 10-40 for a feature, not the number of unique slug headings.
- Each location appears EXACTLY ONCE in the locations array. Never output two entries with the same name — merge them and combine their scene lists.
- The same uniqueness rule applies to characters and props_master: each character name appears once in characters, and each item appears once in props_master. Never output two entries with the same name/item — merge duplicates and combine their scene lists.
- Mark a prop as hero_prop: true if it has narrative significance (appears in multiple scenes, is a plot device, or gets a close-up)
- For wardrobe_notes, only include when the script specifically describes what a character is wearing
- For vfx_stunts, include any visual effects, practical effects, stunts, car chases, explosions, etc.
- In notes, prefer descriptive cross-references ("recalled in the climactic flashback") over numeric scene citations. If you do cite a scene number, the referenced scene's content must actually match what you attribute to it — verify before writing.
- Include named animals that recur on screen (a family dog, a horse the hero rides) as character entries — they carry real scheduling and handling weight.
- Before output, reconcile both directions of the character-scene mapping: each character's scenes_present must equal exactly the set of scenes whose characters_present includes that character. Fix any mismatch.
- If a field has no data for a scene, use an empty array [] or empty string ""
- Output ONLY the JSON object. No other text.`;