import { NextRequest, NextResponse } from "next/server";
import {
  IMAGE_NEGATIVE_PROMPTS,
} from "@/lib/image-prompts";
import { createFalClientWithCredentials } from "@/lib/fal-client";
import { generateFalImage } from "@/lib/fal-image-generation";
import { getImageGenerationErrorStatus, resolveImageGenerationAccess } from "@/lib/generation-access";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, name, stylePrefix } = body;

    if (!description && !name) {
      return NextResponse.json(
        { error: "Missing character name or description" },
        { status: 400 }
      );
    }

    const access = await resolveImageGenerationAccess(body);
    const falClient = createFalClientWithCredentials(access.apiKey);
    if (!falClient) {
      return NextResponse.json({ error: "Missing fal.ai API key" }, { status: 400 });
    }

    const prompt = description
      ? `Character: ${name || "Unknown"}. ${description}`
      : `Character: ${name}.`;

    const imageUrl = await generateFalImage({
      client: falClient, model: body.imageModel, kind: "portrait", prompt,
      stylePrefix, negativePrompt: IMAGE_NEGATIVE_PROMPTS.portrait,
      width: 720, height: 720, aspectRatio: "1:1",
    });

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Portrait generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Portrait generation failed" },
      { status: getImageGenerationErrorStatus(error) }
    );
  }
}
