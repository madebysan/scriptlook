import { NextRequest, NextResponse } from "next/server";
import { generateDocument } from "@/lib/claude";
import { resolveTextGenerationConfig } from "@/lib/text-generation";
import { SCENE_BREAKDOWN_PROMPT } from "@/lib/prompts/scene-breakdown";
import { trimForSceneBreakdown } from "@/lib/json-trimmer";
import { getCached, setCache } from "@/lib/response-cache";
import { mapTextProviderError } from "@/lib/text-provider-errors";

const SLUG = "scene-breakdown";

// Per-scene content scales with scene count; allow up to 5 minutes so a
// feature-length breakdown (up to 32k output tokens) finishes without truncation.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      jsonData?: unknown;
      apiKey?: unknown;
      apiProvider?: unknown;
    };
    const jsonData = typeof body.jsonData === "string" ? body.jsonData : "";
    const generationAccess = await resolveTextGenerationConfig(body);
    const { apiKey, provider, model } = generationAccess;

    if (!jsonData || !apiKey) {
      return NextResponse.json(
        { error: "Missing jsonData or selected provider API key" },
        { status: 400 }
      );
    }

    const cached = getCached(SLUG, jsonData, `${provider}:${model}`);
    if (cached) return NextResponse.json({ content: cached });
    const trimmed = trimForSceneBreakdown(jsonData);
    const markdown = await generateDocument(SCENE_BREAKDOWN_PROMPT, trimmed, {
      apiKey,
      provider,
      model,
      maxTokens: 32000,
    });
    setCache(SLUG, jsonData, markdown, `${provider}:${model}`);

    return NextResponse.json({ content: markdown });
  } catch (error) {
    console.error("Scene breakdown generation error:", error);
    const providerError = mapTextProviderError(error, "anthropic", "text generation");
    return NextResponse.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  }
}
