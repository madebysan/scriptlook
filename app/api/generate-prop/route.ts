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
    const { name, notes, stylePrefix } = body;

    if (!name) {
      return NextResponse.json({ error: "Missing prop name" }, { status: 400 });
    }

    const access = await resolveImageGenerationAccess(body);
    const falClient = createFalClientWithCredentials(access.apiKey);
    if (!falClient) {
      return NextResponse.json({ error: "Missing fal.ai API key" }, { status: 400 });
    }

    const description = notes ? `${name}. ${notes}` : name;
    const prompt = `Subject: ${description}`;

    const imageUrl = await generateFalImage({
      client: falClient, model: body.imageModel, kind: "prop", prompt,
      stylePrefix, negativePrompt: IMAGE_NEGATIVE_PROMPTS.prop,
      width: 720, height: 720, aspectRatio: "1:1",
    });

    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("Prop generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prop generation failed" },
      { status: getGenerationAccessErrorStatus(error) },
    );
  }
}
