import type { createFalClientWithCredentials } from "@/lib/fal-client";
import {
  buildFalGesturePrompt,
  GESTURE_DRAW_LORA_SCALES,
  GESTURE_DRAW_LORA_URL,
  type ImagePromptKind,
} from "@/lib/image-prompts";
import { normalizeImageModel, type ImageModel } from "@/lib/image-models";

type FalClient = NonNullable<ReturnType<typeof createFalClientWithCredentials>>;

type GenerateFalImageInput = {
  client: FalClient;
  model: unknown;
  kind: ImagePromptKind;
  prompt: string;
  stylePrefix?: string;
  negativePrompt: string;
  width: number;
  height: number;
  aspectRatio: "16:9" | "1:1" | "2:3";
};

export async function generateFalImage({
  client,
  model,
  kind,
  prompt,
  stylePrefix,
  negativePrompt,
  width,
  height,
  aspectRatio,
}: GenerateFalImageInput): Promise<string> {
  const selectedModel = normalizeImageModel(model);
  const result = selectedModel === "nano-banana-2"
    ? await client.subscribe("fal-ai/nano-banana-2", {
        input: {
          prompt: buildNeutralPrompt(stylePrefix, prompt),
          num_images: 1,
          aspect_ratio: aspectRatio,
          resolution: "1K",
          output_format: "webp",
          limit_generations: true,
          enable_web_search: false,
        } as never,
      })
    : await client.subscribe("fal-ai/flux-lora", {
        input: {
          prompt: buildFalGesturePrompt(kind, stylePrefix, prompt),
          negative_prompt: negativePrompt,
          loras: [{ path: GESTURE_DRAW_LORA_URL, scale: GESTURE_DRAW_LORA_SCALES[kind] }],
          image_size: { width, height },
          num_images: 1,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          acceleration: "regular",
        } as never,
      });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error(`No image returned from ${labelForModel(selectedModel)}`);
  return imageUrl;
}

function buildNeutralPrompt(stylePrefix: string | undefined, prompt: string): string {
  return [stylePrefix?.trim(), prompt.trim(), "No readable text, credits, labels, logos, signatures, or watermarks."]
    .filter(Boolean)
    .join(" ");
}

function labelForModel(model: ImageModel): string {
  return model === "nano-banana-2" ? "Nano Banana 2" : "FLUX";
}
