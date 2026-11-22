import Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_TEXT_PROVIDER,
  getTextProviderOption,
  normalizeTextModel,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  mapTextProviderError,
  TextProviderRequestError,
} from "@/lib/text-provider-errors";
import { resolveTextGenerationAccess } from "@/lib/generation-access";
import { postJson, ReplyTimeoutError, type JsonPostResponse } from "@/lib/http-json";

const MAX_RETRIES = 3;

// How much a call is expected to write: "short" is a shot list, "standard" a
// 2k-8k token document, "long" a per-scene document that grows with the script.
export type OutputSize = "short" | "standard" | "long";

type GenerateDocumentConfig = {
  apiKey: string;
  provider?: TextProvider;
  outputSize?: OutputSize;
  model?: string;
};

type ResolvedTextGenerationConfig = {
  apiKey: string;
  provider: TextProvider;
  model: string;
};

type ChatCompletionResponse = {
  choices?: {
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }[];
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
        thought?: boolean;
      }[];
    };
    finishReason?: string;
    finishMessage?: string;
  }[];
  promptFeedback?: {
    blockReason?: string;
  };
};

type ClaudeMessage = {
  content: { type: string; text?: string }[];
  stop_reason: string | null;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUserPrompt(systemPrompt: string, input: string): string {
  return `Here is the screenplay extraction data:\n\n${input}\n\n${systemPrompt}`;
}

// Output budgets per provider. They sit well above the visible length we
// expect, because the budget is no longer only the answer: Claude and Gemini
// think before they write and OpenAI reasons at the effort we send, all billed
// and counted as output, and the Claude 5.5 models count about 30% more tokens
// for the same text. A budget sized to the answer alone can come back empty.
//
// The numbers differ because the providers do. Claude and DeepSeek charge
// nothing for an unused ceiling. OpenAI counts the requested ceiling against
// the per-minute token limit, so it stays close to what a call needs. Gemini
// stops every request at 65,536.
const OUTPUT_TOKEN_BUDGETS: Record<TextProvider, Record<OutputSize, number>> = {
  anthropic: { short: 16000, standard: 32000, long: 128000 },
  openai: { short: 16000, standard: 33000, long: 64000 },
  deepseek: { short: 4096, standard: 16384, long: 65536 },
  gemini: { short: 8192, standard: 32768, long: 65536 },
};

export function getOutputTokenBudget(
  provider: TextProvider,
  outputSize: OutputSize = "standard",
): number {
  return OUTPUT_TOKEN_BUDGETS[provider][outputSize];
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function providerError(provider: TextProvider, status: number, message: string) {
  return new TextProviderRequestError({ provider, status, message });
}

// Send a non-streamed request to a provider. Goes through `postJson` rather
// than `fetch`, which gives up after five minutes without response headers:
// these providers stay silent until the whole document is written.
export async function postToProvider(
  provider: TextProvider,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<JsonPostResponse> {
  try {
    return await postJson(url, headers, body);
  } catch (error: unknown) {
    if (error instanceof ReplyTimeoutError) {
      throw providerError(
        provider,
        504,
        `${getTextProviderOption(provider).label} took too long to reply and the request was dropped. Try again, or pick a faster model or another provider.`,
      );
    }
    throw error;
  }
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
  const resolvedConfig: GenerateDocumentConfig =
    typeof config === "string"
      ? { apiKey: config, provider: DEFAULT_TEXT_PROVIDER }
      : { ...config, provider: config.provider || DEFAULT_TEXT_PROVIDER };

  const prompt = buildUserPrompt(systemPrompt, input);
  const provider = resolvedConfig.provider || DEFAULT_TEXT_PROVIDER;
  const model = resolvedConfig.model || getTextProviderOption(provider).model;
  const maxTokens = getOutputTokenBudget(provider, resolvedConfig.outputSize);

  try {
    switch (provider) {
      case "openai":
      case "deepseek":
        return await callOpenAICompatible({
          provider,
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
      case "gemini":
        return await callGemini({
          apiKey: resolvedConfig.apiKey,
          model,
          maxTokens,
          prompt,
        });
      case "anthropic":
      default:
        return await callAnthropic({
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

// --- Claude -----------------------------------------------------------------

// Pull the answer out of a Claude reply. The Claude 5.5 models think by
// default, so the first content block can be a thinking block and the answer
// can be split across several text blocks: never read `content[0]`.
export function readClaudeText(message: ClaudeMessage): string {
  if (message.stop_reason === "refusal") {
    throw providerError(
      "anthropic",
      422,
      "Claude declined this request. Its safety filter sometimes stops on screenplay material. Try again with another Claude model or another provider.",
    );
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw providerError(
      "anthropic",
      502,
      message.stop_reason === "max_tokens"
        ? "Claude used its whole output allowance before writing an answer. Try again, or pick another model."
        : "Claude returned an empty reply. Try again.",
    );
  }

  return text;
}

// True when Claude stopped because it ran out of room, not because it finished.
export function isClaudeReplyCutOff(message: ClaudeMessage): boolean {
  return (
    message.stop_reason === "max_tokens" ||
    message.stop_reason === "model_context_window_exceeded"
  );
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
      // Stream and assemble: long documents can run to tens of thousands of
      // output tokens, and non-streaming requests risk the SDK's HTTP timeout.
      // No `thinking` or effort setting is sent: the default (adaptive
      // thinking) is the one configuration every current Claude model accepts.
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const message = await stream.finalMessage();

      return readClaudeText(message);
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

// --- OpenAI and DeepSeek (Chat Completions) ---------------------------------

export function buildChatCompletionBody({
  provider,
  model,
  maxTokens,
  prompt,
}: {
  provider: "openai" | "deepseek";
  model: string;
  maxTokens: number;
  prompt: string;
}): Record<string, unknown> {
  const messages = [{ role: "user", content: prompt }];

  if (provider === "deepseek") {
    // DeepSeek thinks by default and bills it as output. These are writing
    // calls, so switch it off and keep the whole budget for the answer.
    return { model, max_tokens: maxTokens, thinking: { type: "disabled" }, messages };
  }

  // GPT-6 models reason by default. Send the effort explicitly: "medium" is
  // accepted by every model offered here, while "none" is rejected by some.
  return { model, max_completion_tokens: maxTokens, reasoning_effort: "medium", messages };
}

export function readChatCompletionText(
  data: ChatCompletionResponse,
  provider: "openai" | "deepseek",
): string {
  const label = getTextProviderOption(provider).label;
  const choice = data.choices?.[0];

  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
    throw providerError(
      provider,
      422,
      `${label} withheld this reply. Its content filter sometimes stops on screenplay material. Try again with another model or another provider.`,
    );
  }

  const text = choice?.message?.content?.trim();
  if (!text) {
    throw providerError(
      provider,
      502,
      choice?.finish_reason === "length"
        ? `${label} used its whole output allowance before writing an answer. Try again, or pick another model.`
        : `${label} returned an empty reply. Try again.`,
    );
  }

  return text;
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
    const response = await postToProvider(
      provider,
      `${baseUrl}/chat/completions`,
      { authorization: `Bearer ${apiKey}` },
      buildChatCompletionBody({ provider, model, maxTokens, prompt }),
    );

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

    const data = (await response.json()) as ChatCompletionResponse;
    return readChatCompletionText(data, provider);
  }

  throw new Error(`${providerOption.label} retry limit exceeded`);
}

// --- Gemini -----------------------------------------------------------------

// Gemini stops every request at this many output tokens, thinking included.
const GEMINI_MAX_OUTPUT_TOKENS = 65536;

// Thinking level per model. Gemini 4 thinks at "high" unless told otherwise,
// which eats the output budget, and it rejects "minimal". Models missing from
// this table get no thinking setting: their default is already the lowest.
const GEMINI_THINKING_LEVELS: Record<string, string> = {
  "gemini-4-hydrogen": "low",
};

export function buildGeminiBody({
  model,
  maxTokens,
  prompt,
  sendThinkingLevel = true,
}: {
  model: string;
  maxTokens: number;
  prompt: string;
  sendThinkingLevel?: boolean;
}): Record<string, unknown> {
  const thinkingLevel = sendThinkingLevel ? GEMINI_THINKING_LEVELS[model] : undefined;
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, GEMINI_MAX_OUTPUT_TOKENS),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  };
}

export function readGeminiText(data: GeminiResponse): string {
  const label = getTextProviderOption("gemini").label;

  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    throw providerError("gemini", 422, `${label} blocked the request: ${blockReason}`);
  }

  const candidate = data.candidates?.[0];
  // Leave out thought parts: only the answer belongs in the document.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => typeof part.text === "string" && part.thought !== true)
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  const finishReason = candidate?.finishReason;
  const stoppedEarly =
    finishReason !== undefined && finishReason !== "STOP" && finishReason !== "MAX_TOKENS";
  if (stoppedEarly) {
    const detail = candidate?.finishMessage ? `: ${candidate.finishMessage}` : "";
    throw providerError(
      "gemini",
      422,
      `${label} stopped before finishing (${finishReason})${detail}. Try again with another model or another provider.`,
    );
  }

  if (!text) {
    throw providerError(
      "gemini",
      502,
      finishReason === "MAX_TOKENS"
        ? `${label} used its whole output allowance before writing an answer. Try again, or pick another model.`
        : `${label} returned an empty reply. Try again.`,
    );
  }

  return text;
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
  let sendThinkingLevel = model in GEMINI_THINKING_LEVELS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await postToProvider(
      "gemini",
      endpoint,
      { "x-goog-api-key": apiKey },
      buildGeminiBody({ model, maxTokens, prompt, sendThinkingLevel }),
    );

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
      // Google's REST examples and its schema disagree on how the thinking
      // level is spelled. If the setting itself is rejected, the request still
      // works without it (at the model's default level), so try that once.
      if (response.status === 400 && sendThinkingLevel && /thinking/i.test(errorText)) {
        sendThinkingLevel = false;
        attempt -= 1;
        continue;
      }
      throw new Error(`${providerOption.label} API ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const data = (await response.json()) as GeminiResponse;
    return readGeminiText(data);
  }

  throw new Error(`${providerOption.label} retry limit exceeded`);
}
