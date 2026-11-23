import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_MODELS,
  getTextProviderOption,
  isExtractionProvider,
  type TextProvider,
} from "@/lib/ai-providers";
import { STAGE_0_PROMPT } from "@/lib/prompts/stage-0";
import { mapTextProviderError, TextProviderRequestError } from "@/lib/text-provider-errors";
import { resolveTextGenerationAccess } from "@/lib/generation-access";
import {
  isClaudeReplyCutOff,
  postToProvider,
  readChatCompletionText,
  readClaudeText,
} from "@/lib/text-generation";

// Allow the serverless function to run for up to 5 minutes — extraction of a
// feature-length script can legitimately take several minutes. Default Vercel
// timeout would kill it mid-response.
export const maxDuration = 300;

// Stage 0 is a mechanical extraction pass, not creative deck writing. OpenAI
// and Claude are both supported through the provider selected in the local
// app; the model for each lives in EXTRACTION_MODELS.
//
// The ceiling is the most either model can write in one reply. The breakdown
// of a feature script runs to tens of thousands of tokens, and the model's own
// thinking is counted against the same ceiling, so there is no reason to ask
// for less.
const EXTRACTION_MAX_TOKENS = 128_000;

type ExtractionUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

type OpenAIExtractionResponse = {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null; refusal?: string | null };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
};

export async function POST(request: NextRequest) {
  let extractionProvider: TextProvider = "anthropic";
  try {
    const body = (await request.json()) as {
      text?: unknown;
      apiKey?: unknown;
      apiProvider?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const access = await resolveTextGenerationAccess(body);
    extractionProvider = access.provider;
    const extractionApiKey = access.apiKey;

    if (!text) {
      return NextResponse.json(
        { error: "No screenplay text provided" },
        { status: 400 },
      );
    }

    if (!extractionApiKey) {
      return NextResponse.json(
        { error: "An API key is required for screenplay extraction" },
        { status: 400 },
      );
    }

    if (!isExtractionProvider(extractionProvider)) {
      return NextResponse.json(
        { error: "Reading a screenplay needs a Claude or OpenAI key. Select one of those providers and try again." },
        { status: 400 },
      );
    }

    const client =
      extractionProvider === "anthropic"
        ? new Anthropic({ apiKey: extractionApiKey })
        : null;

    let extractionUsage: ExtractionUsage | undefined;
    let stopReason: string | null = null;
    let output: string;
    if (extractionProvider === "openai") {
      const result = await callOpenAIExtraction({
        apiKey: extractionApiKey,
        text,
      });
      extractionUsage = result.usage;
      stopReason = result.stopReason;
      if (result.stopReason === "length") {
        throw new Error("screenplay_too_long");
      }
      const validJson = extractJson(result.output);
      if (!validJson) {
        console.error("[extract-screenplay] could not extract OpenAI JSON", {
          stopReason,
          outputLength: result.output.length,
          head: result.output.slice(0, 200),
          tail: result.output.slice(-200),
          inputTokens: extractionUsage?.input_tokens,
          outputTokens: extractionUsage?.output_tokens,
        });
        throw new Error("invalid_extraction_json");
      }
      output = validJson;
    } else {
      if (!client) throw new Error("Anthropic extraction client is unavailable");
      // No `thinking` or effort setting: the default is the one configuration
      // every current Claude model accepts, and it keeps the cached prompt
      // prefix stable from one upload to the next.
      const stream = client.messages.stream({
        model: EXTRACTION_MODELS.anthropic.id,
        max_tokens: EXTRACTION_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: STAGE_0_PROMPT,
                cache_control: { type: "ephemeral" },
              },
              {
                type: "text",
                text: `--- SCREENPLAY ---\n\n${text}`,
              },
            ],
          },
        ],
      });
      const message = await stream.finalMessage();
      extractionUsage = message.usage;
      stopReason = message.stop_reason;
      if (isClaudeReplyCutOff(message)) {
        throw new Error("screenplay_too_long");
      }
      const rawOutput = readClaudeText(message);
      const validJson = extractJson(rawOutput);
      if (!validJson) {
        console.error("[extract-screenplay] could not extract JSON", {
          stopReason,
          outputLength: rawOutput.length,
          head: rawOutput.slice(0, 200),
          tail: rawOutput.slice(-200),
          inputTokens: extractionUsage?.input_tokens,
          outputTokens: extractionUsage?.output_tokens,
        });
        throw new Error("invalid_extraction_json");
      }
      output = validJson;
    }

    return NextResponse.json({
      json: output,
      tokens: {
        input: extractionUsage?.input_tokens,
        output: extractionUsage?.output_tokens,
        cacheRead: extractionUsage?.cache_read_input_tokens,
        cacheWrite: extractionUsage?.cache_creation_input_tokens,
      },
    });
  } catch (error) {
    console.error("Extraction error:", error);
    if (error instanceof Error && error.message === "screenplay_too_long") {
      return NextResponse.json(
        {
          error:
            "Your screenplay was too long for one pass. Try a shorter script or split it into parts.",
        },
        { status: 413 },
      );
    }
    if (error instanceof Error && error.message === "invalid_extraction_json") {
      return NextResponse.json(
        { error: "The screenplay breakdown came back unreadable. Try again, or switch between Claude and OpenAI." },
        { status: 422 },
      );
    }
    // A reply the provider withheld (422) or never finished (504). Extraction
    // always runs on one fixed model per provider, so the way round either is
    // the other provider, not another model.
    if (
      error instanceof TextProviderRequestError &&
      (error.status === 422 || error.status === 504) &&
      isExtractionProvider(extractionProvider)
    ) {
      const label = getTextProviderOption(extractionProvider).label;
      const otherLabel = getTextProviderOption(
        extractionProvider === "anthropic" ? "openai" : "anthropic",
      ).label;
      const message =
        error.status === 504
          ? `${label} took too long to read this screenplay. Try again, or switch the provider to ${otherLabel}.`
          : `${label} declined to read this screenplay. Its safety filter sometimes stops on screenplay material. Switch the provider to ${otherLabel} and try again.`;
      return NextResponse.json({ error: message }, { status: error.status });
    }
    const providerError = mapTextProviderError(error, extractionProvider, "screenplay extraction");
    return NextResponse.json(
      { error: providerError.message },
      { status: providerError.status },
    );
  }
}

async function callOpenAIExtraction({
  apiKey,
  text,
}: {
  apiKey: string;
  text: string;
}): Promise<{
  output: string;
  stopReason: string | null;
  usage: ExtractionUsage | undefined;
}> {
  const response = await postToProvider(
    "openai",
    "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${apiKey}` },
    {
      model: EXTRACTION_MODELS.openai.id,
      reasoning_effort: "low",
      max_completion_tokens: EXTRACTION_MAX_TOKENS,
      response_format: { type: "json_object" },
      // GPT-6 takes instructions in a "developer" message. JSON mode needs the
      // word JSON in the conversation, so the user message says it as well.
      messages: [
        { role: "developer", content: STAGE_0_PROMPT },
        {
          role: "user",
          content: `Return the JSON breakdown for this screenplay.\n\n--- SCREENPLAY ---\n\n${text}`,
        },
      ],
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI API ${response.status}: ${details.slice(0, 500)}`);
  }

  const data = (await response.json()) as OpenAIExtractionResponse;
  const stopReason = data.choices?.[0]?.finish_reason || null;
  // A reply cut off at the ceiling is reported by the caller as "too long".
  // Any other reply has to carry an answer: this throws on a withheld or
  // empty one.
  const output = stopReason === "length" ? "" : readChatCompletionText(data, "openai");

  return {
    output,
    stopReason,
    usage: data.usage
      ? {
          input_tokens: data.usage.prompt_tokens || 0,
          output_tokens: data.usage.completion_tokens || 0,
          cache_read_input_tokens:
            data.usage.prompt_tokens_details?.cached_tokens || 0,
        }
      : undefined,
  };
}

// Forgiving JSON extraction. Returns the parsed-clean JSON string, or null if
// nothing parses. Tries three strategies in order:
//   1. Raw parse — happy path, model followed instructions.
//   2. First ```json ... ``` fenced block — model wrapped the JSON in a fence.
//   3. First balanced-brace span — model added preamble/trailing prose. Scans
//      from the first `{`, tracking brace depth (and respecting strings so
//      braces inside string values don't throw off the count) until the
//      matching close brace.
function extractJson(raw: string): string | null {
  const tryParse = (s: string): string | null => {
    try {
      JSON.parse(s);
      return s;
    } catch {
      return null;
    }
  };

  const rawTrimmed = raw.trim();
  const direct = tryParse(rawTrimmed);
  if (direct) return direct;

  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const fenced = tryParse(fenceMatch[1].trim());
    if (fenced) return fenced;
  }

  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = raw.slice(start, i + 1);
        return tryParse(candidate);
      }
    }
  }
  return null;
}
