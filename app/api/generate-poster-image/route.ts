import { NextRequest, NextResponse } from "next/server";
import {
  IMAGE_NEGATIVE_PROMPTS,
} from "@/lib/image-prompts";
import { createFalClientWithCredentials } from "@/lib/fal-client";
import { generateFalImage } from "@/lib/fal-image-generation";
import { getGenerationAccessErrorStatus, resolveImageGenerationAccess } from "@/lib/generation-access";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, stylePrefix } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const access = await resolveImageGenerationAccess(body);
    const falClient = createFalClientWithCredentials(access.apiKey);
    if (!falClient) {
      return NextResponse.json({ error: "Missing fal.ai API key" }, { status: 400 });
    }

    const imageUrl = await generateFalImage({
      client: falClient, model: body.imageModel, kind: "poster", prompt,
      stylePrefix, negativePrompt: IMAGE_NEGATIVE_PROMPTS.poster,
      width: 720, height: 1008, aspectRatio: "2:3",
    });

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Poster image generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image generation failed" },
      { status: getGenerationAccessErrorStatus(error) }
    );
  }
}
