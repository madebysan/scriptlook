export const SCENE_BREAKDOWN_PROMPT = `Generate a comprehensive Scene Breakdown document from this screenplay data.

Format your output as clean markdown with the following structure:

# Scene Breakdown: [Title]

## Overview
- Total scenes: [count]
- Total pages: [number]
- Locations: [count unique locations]

## Scene-by-Scene Breakdown

For EVERY scene, create a section:

### Scene [number]: [SLUG LINE]
- **Pages:** [start]-[end]
- **Location:** [location name]
- **Time:** [time of day]
- **Characters:** [comma-separated list]
- **Key Visual Moment:** [the key visual moment]
- **Emotional Beat:** [emotional beat]
- **Props:** [comma-separated list or "None"]
- **Wardrobe:** [notes or "Standard"]
- **VFX/Stunts:** [notes or "None"]
- **Notes:** [any notes or continuity details]

---

After all scenes, add:

## Summary Statistics
- Total scenes: [count]
- INT scenes: [count where int_ext is exactly "INT"]
- EXT scenes: [count where int_ext is exactly "EXT"]
- INT/EXT scenes: [count of mixed scenes — omit this line only if there are none]
- DAY scenes: [count]
- NIGHT scenes: [count]
- Scenes with VFX/Stunts: [count]

Arithmetic invariant: INT + EXT + INT/EXT must equal Total scenes. Never fold a mixed scene into both the INT and EXT counts.

Output ONLY the markdown document. No commentary or explanations outside the document.`;
