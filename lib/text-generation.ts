import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_TEXT_PROVIDER,
  getTextProviderOption,
  normalizeTextModel,
  type TextProvider,
} from "@/lib/ai-providers";
import { mapTextProviderError } from "@/lib/text-provider-errors";
import { resolveTextGenerationAccess } from "@/lib/generation-access";

const MAX_RETRIES = 3;

type GenerateDocumentConfig = {
  apiKey: string;
  provider?: TextProvider;
  maxTokens?: number;
  model?: string;
};

type ResolvedTextGenerationConfig = {
  apiKey: string;
  provider: TextProvider;
  model: string;
};

type OpenAICompatibleResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  promptFeedback?: {
    blockReason?: string;
  };
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUserPrompt(systemPrompt: string, input: string): string {
  return `Here is the screenplay extraction data:\n\n${input}\n\n${systemPrompt}`;
}

function getDefaultMaxTokens(provider: TextProvider): number {
  switch (provider) {
    case "anthropic":
      return 16384;
    case "deepseek":
      return 8192;
    case "gemini":
    case "openai":
    default:
      return 12000;
  }
}

// Hard output ceiling per provider. Routes that produce per-scene content
// (scene-breakdown, storyboards) request more than the default so they don't
// truncate mid-script on a feature; this clamps the request to each model's
// real cap. The anthropic cap stays at 32k to keep generation under the 300s
// serverless limit (Haiku supports 64k, but a 64k doc can run ~5 min).
function getProviderMaxTokens(provider: TextProvider): number {
  switch (provider) {
    case "anthropic":
      return 32000;
    case "gemini":
      return 32000;
    case "openai":
      return 16384;
    case "deepseek":
      return 8192;
    default:
      return 16384;
  }
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function resolveTextGenerationConfig(body: {
  apiKey?: unknown;
  apiProvider?: unknown;
  textModel?: unknown;
}): Promise<ResolvedTextGenerationConfig> {
  const access = resolveTextGenerationAccess(body);
  return {
    apiKey: access.apiKey,
    provider: access.provider,
    model: normalizeTextModel(access.provider, body.textModel),
  };
}

export async function generateDocument(
  systemPrompt: string,
  input: string,
  config: string | GenerateDocumentConfig,
): Promise<string> {
  const resolvedConfig =
    typeof config === "string"
      ? { apiKey: config, provider: DEFAULT_TEXT_PROVIDER }
      : { ...config, provider: config.provider || DEFAULT_TEXT_PROVIDER };

  const prompt = buildUserPrompt(systemPrompt, input);
  const provider = resolvedConfig.provider;
  const model = resolvedConfig.model || getTextProviderOption(provider).model;
  const requestedMaxTokens = resolvedConfig.maxTokens || getDefaultMaxTokens(provider);
  const maxTokens = Math.min(requestedMaxTokens, getProviderMaxTokens(provider));

  try {
    switch (provider) {
      case "openai":
        return callOpenAICompatible({
          provider,
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
      case "deepseek":
        return callOpenAICompatible({
          provider,
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
      case "gemini":
        return callGemini({
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
      case "anthropic":
      default:
        return callAnthropic({
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
    }
  } catch (error: unknown) {
    throw mapTextProviderError(error, provider, "text generation");
  }
}

async function callAnthropic({
  apiKey,
  model,
  maxTokens,
  prompt,
}: {
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
}): Promise<string> {
  const client = new Anthropic({ apiKey });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      // Stream and assemble: doc routes can request up to 32k output tokens,
      // and non-streaming requests risk the SDK's HTTP timeout above ~16k.
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const message = await stream.finalMessage();

      const textBlock = message.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from Claude");
      }

      return textBlock.text.trim();
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Anthropic.RateLimitError ||
        (error instanceof Anthropic.APIError && error.status === 429);

      if (isRateLimit && attempt < MAX_RETRIES) {
        await sleep(15000 * 2 ** attempt);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Claude retry limit exceeded");
}

async function callOpenAICompatible({
  provider,
  apiKey,
  model,
  maxTokens,
  prompt,
}: {
  provider: "openai" | "deepseek";
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
}): Promise<string> {
  const providerOption = getTextProviderOption(provider);
  const baseUrl =
    provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        ...(provider === "openai"
          ? { max_completion_tokens: maxTokens }
          : { max_tokens: maxTokens }),
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (shouldRetry(response.status) && attempt < MAX_RETRIES) {
      await sleep(5000 * 2 ** attempt);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const isInvalidKey =
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 && /api key/i.test(errorText));
      if (isInvalidKey) {
        throw new Error(`Invalid ${providerOption.label} API key. Check the selected provider and key.`);
      }
      throw new Error(`${providerOption.label} API ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`${providerOption.label} returned no text content`);
    }

    return text.trim();
  }

  throw new Error(`${providerOption.label} retry limit exceeded`);
}

async function callGemini({
  apiKey,
  model,
  maxTokens,
  prompt,
}: {
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
}): Promise<string> {
  const providerOption = getTextProviderOption("gemini");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (shouldRetry(response.status) && attempt < MAX_RETRIES) {
      await sleep(5000 * 2 ** attempt);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      const isInvalidKey =
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 && /api key/i.test(errorText));
      if (isInvalidKey) {
        throw new Error(`Invalid ${providerOption.label} API key. Check the selected provider and key.`);
      }
      throw new Error(`${providerOption.label} API ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      const blockReason = data.promptFeedback?.blockReason;
      throw new Error(
        blockReason
          ? `${providerOption.label} blocked the request: ${blockReason}`
          : `${providerOption.label} returned no text content`,
      );
    }

    return text;
  }

  throw new Error(`${providerOption.label} retry limit exceeded`);
}
