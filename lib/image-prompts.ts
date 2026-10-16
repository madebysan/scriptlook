import { migrateLegacyStorageKeys } from "@/lib/storage-migration";

// Customizable image-generation style prompts.
//
// These are the user-facing style prompts shown in Settings. Provider-specific
// trigger words stay out of the editor and are added by the matching route.
//
// Storage: a single localStorage key holds a partial map. Missing keys fall
// back to the default. This keeps the Settings dialog simple and lets users
// override just one kind of image if they want.

export type ImagePromptKind = "storyboard" | "portrait" | "prop" | "location" | "poster";

export const DEFAULT_IMAGE_PROMPTS: Record<ImagePromptKind, string> = {
  storyboard:
    "black-and-white arthouse storyboard frame, hand-drawn poster-style ink illustration, bold graphic silhouettes, loose ink linework with visible pencil under-sketch, scratchy crosshatching for shadows, uneven hand-inked contours, screen-printed black and grey values on white paper, paper grain texture, cinematic shot composition, clear blocking, readable environment, practical production storyboard clarity, strictly monochrome, no color, no tint, no tone",

  portrait:
    "bold black ink casting reference portrait, unified black-and-white character reference series, same storyboard artist hand, head-and-shoulders bust only, face and shoulders large in frame, subject fills most of the square frame, readable eyes and expression, clear costume neckline and shoulder silhouette, medium-thick black marker contour lines, consistent stroke weight, restrained grey hatching for shadows, clean white background, no full-body pose, no faint pencil, no color",

  prop:
    "bold black ink production prop reference, one object only, artifact close-up, object fills seventy to eighty percent of the square frame, full silhouette visible, centered three-quarter view, medium-thick black ink contour lines, consistent stroke weight, readable material texture and key details, controlled grey wash shadows, plain white background, no tiny object, no excessive margin, no hands, no people, no color",

  location:
    "black-and-white cinematic location scout plate, wide environment reference frame, no people, no characters, no vehicles unless essential to the setting, clear architecture and geography, readable entrances and exits, production-design texture, strong foreground-middle-background depth, loose ink linework with visible pencil under-sketch, restrained grey wash shadows, practical scouting clarity, clean white paper, strictly monochrome, no color",

  poster:
    "vertical textless arthouse key illustration, not a commercial movie poster layout, no title area, no footer caption band, one restrained symbolic scene, simple readable silhouette, strong but not empty negative space, subject small-to-medium in the lower half, limited muted palette of two or three flat colors, flat screen-printed color fields, hand-drawn ink linework with visible pencil under-sketch, subtle crosshatching, risograph paper grain, quiet cinematic mood, no title text, no credits, no typography, no letters, no words, no logo, no watermark, no signature, no initials, no marks that look like writing, no scribbles, no glyphs, must pass OCR as blank",
};

export const IMAGE_NEGATIVE_PROMPTS: Record<ImagePromptKind, string> = {
  storyboard:
    "color, colorful, photorealistic, 3d render, polished finished art, sepia, yellow, warm tint, aged paper, brown, amber, toned paper, typography, text, watermark, logo",
  portrait:
    "color, colorful, photorealistic, 3d render, faint pencil, pale low-contrast drawing, washed out, full body, tiny subject, small subject, excessive empty margin, dramatic crop, cluttered background, text, labels, watermark, logo, sepia, yellow, aged paper",
  prop:
    "color, colorful, photorealistic, 3d render, faint pencil, pale low-contrast drawing, washed out, blank page, tiny subject, small subject, excessive empty margin, dramatic crop, cluttered background, hands, people, text, labels, watermark, logo, sepia, yellow, aged paper",
  location:
    "color, colorful, photorealistic, 3d render, glossy architectural visualization, real estate photo, people, characters, crowds, faces, hands, text, labels, signs, readable signage, watermark, logo, sepia, yellow, aged paper, tiny environment, excessive empty margin",
  poster:
    "fake title text, fake credits, typography, letters, words, labels, inscriptions, signatures, artist signature, micro-credits, bottom credits line, pseudo text, OCR text, handwriting, cursive, newspaper, document, page, book cover, map labels, sign, billboard, street sign, interface text, computer screen text, price tag, tag, ticket, card, paper scrap with marks, numbers, numerals, macro close-up, oversized object study, logo, watermark, malformed letters, title area, footer caption band, commercial movie poster layout, glossy 3d render, photorealistic stock photo, busy collage, low-resolution",
};

export const GESTURE_DRAW_LORA_URL =
  "https://huggingface.co/glif/Gesture-Draw/resolve/main/Gesture_Draw_v1.safetensors";

export const GESTURE_DRAW_LORA_SCALES: Record<ImagePromptKind, number> = {
  storyboard: 0.7,
  portrait: 0.9,
  prop: 0.9,
  location: 0.7,
  poster: 0.55,
};

export const GESTURE_DRAW_TRIGGER = "gstdrw style";

export const IMAGE_PROMPT_STORAGE = "scriptlook-image-prompts";

type StoredPrompts = Partial<Record<ImagePromptKind, string>>;

export function sanitizeEditableImagePrompt(prompt: string): string {
  return prompt
    .replace(/^gstdrw\s+style,?\s*/i, "")
    .replace(/^gesture\s+draw\s+lora,?\s*/i, "")
    .replace(/\bflux(?:\.1)?(?:-|\s)?dev\b/gi, "")
    .replace(/\bflux\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function resolveImageStylePrompt(
  kind: ImagePromptKind,
  stylePrefix: unknown,
): string {
  if (typeof stylePrefix !== "string") return DEFAULT_IMAGE_PROMPTS[kind];
  const cleaned = sanitizeEditableImagePrompt(stylePrefix);
  return cleaned || DEFAULT_IMAGE_PROMPTS[kind];
}

export function buildFalGesturePrompt(
  kind: ImagePromptKind,
  stylePrefix: unknown,
  subjectPrompt: string,
): string {
  const style = resolveImageStylePrompt(kind, stylePrefix);
  return [GESTURE_DRAW_TRIGGER, style, subjectPrompt.trim()]
    .filter(Boolean)
    .join(". ");
}

export function loadImagePrompts(): StoredPrompts {
  if (typeof window === "undefined") return {};
  try {
    migrateLegacyStorageKeys();
    const raw = localStorage.getItem(IMAGE_PROMPT_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPrompts;
    const clean: StoredPrompts = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "string") continue;
      const kind = k as ImagePromptKind;
      const cleaned = sanitizeEditableImagePrompt(v);
      if (cleaned) clean[kind] = cleaned;
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveImagePrompts(prompts: StoredPrompts): void {
  if (typeof window === "undefined") return;
  // Drop empty strings so a blank field falls back to the default next time.
  const clean: StoredPrompts = {};
  for (const [k, v] of Object.entries(prompts)) {
    const cleaned = typeof v === "string" ? sanitizeEditableImagePrompt(v) : "";
    if (cleaned) clean[k as ImagePromptKind] = cleaned;
  }
  if (Object.keys(clean).length === 0) {
    localStorage.removeItem(IMAGE_PROMPT_STORAGE);
    return;
  }
  localStorage.setItem(IMAGE_PROMPT_STORAGE, JSON.stringify(clean));
}

/**
 * Read the current style prefix for a given image kind. Browser-only —
 * returns undefined on the server so API routes can fall back to their own
 * defaults. Viewers call this right before a fetch to pass the user's custom
 * prompt (if any) in the request body.
 */
export function getStylePrefix(kind: ImagePromptKind): string | undefined {
  if (typeof window === "undefined") return undefined;
  const stored = loadImagePrompts();
  return stored[kind];
}
