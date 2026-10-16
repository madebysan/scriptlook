export const STORYBOARD_PROMPTS_PROMPT = `Generate Storyboard Prompts from this screenplay data. Each prompt is designed to be used with an image generator to create storyboard frames.

Before writing, silently classify the film's creative lane from the JSON and adapt the frame language to that lane. A quiet romance should privilege distance, posture, silence, city texture, and thresholds. A horror film should privilege spatial threat and object clues. A period satire should privilege rank, costume, ceremony, and body language. An epic should privilege scale and systems. A fable should privilege object behavior and childlike geography.

Format your output as clean markdown:

# Storyboard Prompts: [Title]

Each prompt below should be a production-use image brief grounded in the supplied JSON. Do not add a usage guide, prompt modifiers, or meta-instructions for the user.

---

For EVERY scene that has a key_visual_moment, generate a prompt block:

### Scene [number]: [slug line]

**Prompt:**
[Write a detailed image generation prompt that describes:
- The physical setting and environment
- Characters present and their positions/actions
- Camera angle (wide shot, close-up, over-the-shoulder, bird's eye, etc.)
- Lighting (natural, harsh, soft, neon, candlelit, etc.)
- Mood and atmosphere
- Color palette for this specific moment
- Any important props or wardrobe details visible

Write it as a single flowing paragraph optimized for image generation. Be specific about composition. Each prompt is standalone — the generator has no memory of prior frames, so restate every character's identity AND their relationship to others in frame ("his mother", "her teenage son"), never relying on context from earlier scenes. When a visual format recurs across many scenes (home video footage, security cameras, a recurring location), vary its texture description scene to scene so frames track the emotional shift instead of repeating one boilerplate. Do NOT restate the camera angle, lighting setup, or mood inside the paragraph — those live ONLY in the Camera/Lighting/Mood fields below; the paragraph carries setting, figures, action, composition, and palette.]

**Camera:** [suggested camera angle/movement]
**Lighting:** [key lighting description]
**Mood:** [1-3 words]

---

Output ONLY the markdown document. No commentary outside the document.`;
