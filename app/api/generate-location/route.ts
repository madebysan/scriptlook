import { NextRequest, NextResponse } from "next/server";
import {
  IMAGE_NEGATIVE_PROMPTS,
  NO_TEXT_INSTRUCTION,
} from "@/lib/image-prompts";
import { createFalClientWithCredentials } from "@/lib/fal-client";
import { generateFalImage } from "@/lib/fal-image-generation";
import { getImageGenerationErrorStatus, resolveImageGenerationAccess } from "@/lib/generation-access";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, prompt, stylePrefix } = body;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Missing location prompt" }, { status: 400 });
    }

    const access = await resolveImageGenerationAccess(body);
    const falClient = createFalClientWithCredentials(access.apiKey);
    if (!falClient) {
      return NextResponse.json({ error: "Missing fal.ai API key" }, { status: 400 });
    }

    const locationName = typeof name === "string" && name.trim() ? name.trim() : "Unknown location";
    const locationPrompt = `Prompt context location name: ${locationName}. ${prompt.trim()}. ${NO_TEXT_INSTRUCTION}`;

    const imageUrl = await generateFalImage({
      client: falClient, model: body.imageModel, kind: "location", prompt: locationPrompt,
      stylePrefix, negativePrompt: IMAGE_NEGATIVE_PROMPTS.location,
      width: 1280, height: 720, aspectRatio: "16:9",
    });

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Location generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Location generation failed" },
      { status: getImageGenerationErrorStatus(error) },
    );
  }
}
