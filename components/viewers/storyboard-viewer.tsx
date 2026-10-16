"use client";

export type StoryboardScene = {
  number: number;
  slugLine: string;
  prompt: string;
  camera: string;
  lighting: string;
  mood: string;
};

type Act = {
  label: string;
  scenes: StoryboardScene[];
};

export function parseStoryboardPrompts(md: string): { title: string; intro: string; acts: Act[] } {
  const lines = md.split("\n");
  let title = "";
  const allScenes: StoryboardScene[] = [];
  const actLabels: { label: string; startIndex: number }[] = [];
  let current: StoryboardScene | null = null;
  let collectingPrompt = false;
  let promptBuffer = "";
  let introBuffer = "";
  let pastIntro = false;

  for (const line of lines) {
    if (/^# /.test(line) && !title) {
      title = line.replace(/^# (Storyboard Prompts:\s*)?/, "").trim();
      continue;
    }

    // Act heading: ## Act 1: Setup, ## First Act, etc.
    const actMatch = line.match(/^## (.+)/);
    if (actMatch) {
      if (!pastIntro) {
        // Could be intro section heading — skip but capture act label if it looks like one
        const actText = actMatch[1].trim();
        if (/act/i.test(actText)) {
          actLabels.push({ label: actText, startIndex: allScenes.length });
        }
        continue;
      }
      // Act heading after scenes have started — only if it looks like an act label
      const actText = actMatch[1].trim();
      if (/act/i.test(actText)) {
        actLabels.push({ label: actText, startIndex: allScenes.length });
      }
      continue;
    }

    // Scene heading: ### Scene N: SLUG_LINE
    const sceneMatch = line.match(/^### Scene (\d+):\s*(.+)/);
    if (sceneMatch) {
      pastIntro = true;
      if (current) {
        if (collectingPrompt) current.prompt = promptBuffer.trim();
        allScenes.push(current);
      }
      current = {
        number: parseInt(sceneMatch[1]),
        slugLine: sceneMatch[2].trim(),
        prompt: "",
        camera: "",
        lighting: "",
        mood: "",
      };
      collectingPrompt = false;
      promptBuffer = "";
      continue;
    }

    if (!pastIntro && !current && line.trim() && !line.startsWith("---")) {
      introBuffer += line + " ";
      continue;
    }

    if (!current) continue;

    // Metadata fields
    const cameraMatch = line.match(/\*\*Camera:\*\*\s*(.+)/);
    const lightingMatch = line.match(/\*\*Lighting:\*\*\s*(.+)/);
    const moodMatch = line.match(/\*\*Mood:\*\*\s*(.+)/);

    if (cameraMatch) {
      if (collectingPrompt) { current.prompt = promptBuffer.trim(); collectingPrompt = false; promptBuffer = ""; }
      let camText = cameraMatch[1];
      const inlineLight = camText.match(/\*\*Lighting:\*\*\s*(.+)/);
      if (inlineLight) {
        camText = camText.replace(/\*\*Lighting:\*\*.*/, "").trim();
        let lightText = inlineLight[1];
        const inlineMood = lightText.match(/\*\*Mood:\*\*\s*(.+)/);
        if (inlineMood) {
          lightText = lightText.replace(/\*\*Mood:\*\*.*/, "").trim();
          current.mood = inlineMood[1].trim();
        }
        current.lighting = lightText.trim();
      }
      current.camera = camText.trim();
      continue;
    }
    if (lightingMatch) {
      if (collectingPrompt) { current.prompt = promptBuffer.trim(); collectingPrompt = false; promptBuffer = ""; }
      let lightText = lightingMatch[1];
      const inlineMood = lightText.match(/\*\*Mood:\*\*\s*(.+)/);
      if (inlineMood) {
        lightText = lightText.replace(/\*\*Mood:\*\*.*/, "").trim();
        current.mood = inlineMood[1].trim();
      }
      current.lighting = lightText.trim();
      continue;
    }
    if (moodMatch) {
      if (collectingPrompt) { current.prompt = promptBuffer.trim(); collectingPrompt = false; promptBuffer = ""; }
      current.mood = moodMatch[1].trim();
      continue;
    }

    // Prompt field
    const promptStart = line.match(/\*\*Prompt:\*\*\s*(.*)/);
    if (promptStart) {
      collectingPrompt = true;
      promptBuffer = promptStart[1] + " ";
      continue;
    }

    if (collectingPrompt && line.trim() && !line.startsWith("---")) {
      promptBuffer += line.trim() + " ";
    }
  }

  if (current) {
    if (collectingPrompt) current.prompt = promptBuffer.trim();
    allScenes.push(current);
  }

  // Group scenes into acts
  let acts: Act[];
  if (actLabels.length > 0) {
    // Use parsed act labels with array indices
    acts = actLabels.map((act, i) => {
      const nextStart = actLabels[i + 1]?.startIndex ?? allScenes.length;
      return {
        label: act.label,
        scenes: allScenes.slice(act.startIndex, nextStart),
      };
    });
    // Catch any scenes before the first act label
    const firstStart = actLabels[0].startIndex;
    if (firstStart > 0) {
      acts.unshift({ label: "Prologue", scenes: allScenes.slice(0, firstStart) });
    }
  } else if (allScenes.length > 0) {
    // Fall back to 3-act structure based on scene count
    const total = allScenes.length;
    const act1End = Math.ceil(total * 0.25);
    const act2End = Math.ceil(total * 0.75);
    acts = [
      { label: "First Act: Setup", scenes: allScenes.slice(0, act1End) },
      { label: "Second Act: Confrontation", scenes: allScenes.slice(act1End, act2End) },
      { label: "Third Act: Resolution", scenes: allScenes.slice(act2End) },
    ];
  } else {
    acts = [];
  }

  return { title, intro: introBuffer.trim(), acts };
}
