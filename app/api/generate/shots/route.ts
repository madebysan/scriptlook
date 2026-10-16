import { NextRequest, NextResponse } from "next/server";
import { generateDocument } from "@/lib/claude";
import { resolveTextGenerationConfig } from "@/lib/text-generation";
import { SHOT_LIST_SYSTEM_PROMPT, parseAiShots } from "@/lib/shot-list";
import { mapTextProviderError } from "@/lib/text-provider-errors";

// Per-scene shot list generation. On-demand (not part of the parallel doc batch)
// so users only pay for scenes they choose to upgrade from the heuristic baseline.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      scene?: unknown;
      film?: unknown;
      apiKey?: unknown;
      apiProvider?: unknown;
    };

    const { apiKey, provider, model } = await resolveTextGenerationConfig(body);
    const scene = body.scene;

    if (!scene || typeof scene !== "object") {
      return NextResponse.json({ error: "Missing scene data" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing selected provider API key" },
        { status: 400 },
      );
    }

    const sceneObj = scene as Record<string, unknown>;
    const sceneNumber =
      typeof sceneObj.scene_number === "number" ? sceneObj.scene_number : 0;

    const input = JSON.stringify({ film: body.film ?? {}, scene }, null, 2);
    const raw = await generateDocument(SHOT_LIST_SYSTEM_PROMPT, input, {
      apiKey,
      provider,
      model,
      maxTokens: 1500,
    });

    const shots = parseAiShots(raw, sceneNumber);
    if (shots.length === 0) {
      return NextResponse.json(
        { error: "Could not parse a shot list from the model response" },
        { status: 502 },
      );
    }

    return NextResponse.json({ shots });
  } catch (error) {
    console.error("Shot list generation error:", error);
    const providerError = mapTextProviderError(error, "anthropic", "text generation");
    return NextResponse.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  }
}
