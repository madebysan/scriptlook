import { NextRequest, NextResponse } from "next/server";
import { generateDocument } from "@/lib/claude";
import { resolveTextGenerationConfig } from "@/lib/text-generation";
import { OVERVIEW_PROMPT } from "@/lib/prompts/overview";
import { trimForOverview } from "@/lib/json-trimmer";
import { getCached, setCache } from "@/lib/response-cache";
import { mapTextProviderError } from "@/lib/text-provider-errors";

const SLUG = "overview";

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
    const trimmed = trimForOverview(jsonData);
    const markdown = await generateDocument(OVERVIEW_PROMPT, trimmed, {
      apiKey,
      provider,
      model,
    });
    setCache(SLUG, jsonData, markdown, `${provider}:${model}`);

    return NextResponse.json({ content: markdown });
  } catch (error) {
    console.error("Overview generation error:", error);
    const providerError = mapTextProviderError(error, "anthropic", "text generation");
    return NextResponse.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  }
}
