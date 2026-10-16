export const IMAGE_MODELS = ["flux-gesture", "nano-banana-2"] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export type ImageModelOption = {
  id: ImageModel;
  label: string;
  provider: string;
  description: string;
  bestFor: string;
  exampleUrl: string;
};

export const IMAGE_MODEL_OPTIONS: readonly ImageModelOption[] = [
  {
    id: "flux-gesture",
    label: "FLUX + Gesture Draw",
    provider: "fal.ai",
    description: "The existing illustrated Scriptlook look with strong style control.",
    bestFor: "Storyboards, portraits, props, and locations",
    exampleUrl: "https://fal.ai/models/fal-ai/flux-lora",
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal.ai · Google",
    description: "Higher semantic and compositional understanding with consistent characters.",
    bestFor: "Premium posters and complex compositions",
    exampleUrl: "https://fal.ai/nano-banana-2",
  },
];

export const DEFAULT_DECK_IMAGE_MODEL: ImageModel = "flux-gesture";
export const DEFAULT_POSTER_IMAGE_MODEL: ImageModel = "nano-banana-2";

export function normalizeImageModel(value: unknown): ImageModel {
  return typeof value === "string" && (IMAGE_MODELS as readonly string[]).includes(value)
    ? (value as ImageModel)
    : DEFAULT_DECK_IMAGE_MODEL;
}
