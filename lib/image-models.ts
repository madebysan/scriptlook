export const IMAGE_MODELS = ["flux-gesture", "nano-banana-2"] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export type ImageModelOption = {
  id: ImageModel;
  label: string;
  provider: string;
  description: string;
  bestFor: string;
  exampleUrl: string;
  // US dollars per image at the sizes this app requests, from fal.ai's model
  // pages on 2026-11-22. A guide for the estimate, not a quote.
  approxPricePerImage: number;
};

export const IMAGE_MODEL_OPTIONS: readonly ImageModelOption[] = [
  {
    id: "flux-gesture",
    label: "FLUX + Gesture Draw",
    provider: "fal.ai",
    description: "The existing illustrated Scriptlook look with strong style control.",
    bestFor: "Storyboards, portraits, props, and locations",
    exampleUrl: "https://fal.ai/models/fal-ai/flux-lora",
    approxPricePerImage: 0.035,
  },
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal.ai · Google",
    description: "Higher semantic and compositional understanding with consistent characters.",
    bestFor: "Premium posters and complex compositions",
    exampleUrl: "https://fal.ai/nano-banana-2",
    approxPricePerImage: 0.08,
  },
];

export const DEFAULT_DECK_IMAGE_MODEL: ImageModel = "flux-gesture";
export const DEFAULT_POSTER_IMAGE_MODEL: ImageModel = "nano-banana-2";

export function normalizeImageModel(value: unknown): ImageModel {
  return typeof value === "string" && (IMAGE_MODELS as readonly string[]).includes(value)
    ? (value as ImageModel)
    : DEFAULT_DECK_IMAGE_MODEL;
}

export function getImageModelOption(model: ImageModel): ImageModelOption {
  return IMAGE_MODEL_OPTIONS.find((option) => option.id === model) || IMAGE_MODEL_OPTIONS[0];
}

// "about $9" for a batch. Prices drift, so the wording stays approximate.
export function formatImageCostEstimate(
  batches: readonly { model: ImageModel; count: number }[],
): string {
  const total = batches.reduce(
    (sum, batch) => sum + batch.count * getImageModelOption(batch.model).approxPricePerImage,
    0,
  );
  if (total <= 0) return "";
  if (total < 1) return "under $1";
  return "about $" + Math.round(total);
}
