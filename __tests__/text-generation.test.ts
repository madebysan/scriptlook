import { describe, expect, it } from "vitest";
import {
  EXTRACTION_MODELS,
  TEXT_PROVIDER_OPTIONS,
  normalizeTextModel,
} from "@/lib/ai-providers";
import {
  buildChatCompletionBody,
  buildGeminiBody,
  getOutputTokenBudget,
  isClaudeReplyCutOff,
  readChatCompletionText,
  readClaudeText,
  readGeminiText,
} from "@/lib/text-generation";
import { TextProviderRequestError } from "@/lib/text-provider-errors";

describe("model catalogue", () => {
  it("defaults each provider to a model it actually offers", () => {
    for (const option of TEXT_PROVIDER_OPTIONS) {
      expect(option.models.map((model) => model.id)).toContain(option.model);
    }
  });

  it("falls back to the provider default for a model that is no longer offered", () => {
    expect(normalizeTextModel("anthropic", "claude-sonnet-4-5-20250929")).toBe("claude-haiku-5-5");
    expect(normalizeTextModel("openai", "gpt-5.6-terra")).toBe("gpt-6.1-terra");
    expect(normalizeTextModel("deepseek", "deepseek-v4-flash")).toBe("deepseek-flash");
    expect(normalizeTextModel("gemini", "gemini-3.5-flash")).toBe("gemini-4-hydrogen");
  });

  it("runs extraction on each provider's low-cost model", () => {
    expect(EXTRACTION_MODELS.anthropic.id).toBe("claude-haiku-5-5");
    expect(EXTRACTION_MODELS.openai.id).toBe("gpt-6-luna");
  });
});

describe("output budgets", () => {
  it("gives long documents more room than standard ones on every provider", () => {
    for (const { id } of TEXT_PROVIDER_OPTIONS) {
      expect(getOutputTokenBudget(id, "long")).toBeGreaterThan(getOutputTokenBudget(id, "standard"));
      expect(getOutputTokenBudget(id, "standard")).toBeGreaterThan(getOutputTokenBudget(id, "short"));
      expect(getOutputTokenBudget(id)).toBe(getOutputTokenBudget(id, "standard"));
    }
  });

  it("stays inside each provider's documented ceiling", () => {
    expect(getOutputTokenBudget("anthropic", "long")).toBeLessThanOrEqual(128000);
    expect(getOutputTokenBudget("openai", "long")).toBeLessThanOrEqual(128000);
    expect(getOutputTokenBudget("deepseek", "long")).toBeLessThanOrEqual(393216);
    expect(getOutputTokenBudget("gemini", "long")).toBeLessThanOrEqual(65536);
  });
});

describe("readClaudeText", () => {
  it("skips thinking blocks and joins every text block", () => {
    const text = readClaudeText({
      stop_reason: "end_turn",
      content: [
        { type: "thinking" },
        { type: "text", text: "# Overview\n" },
        { type: "text", text: "Logline." },
      ],
    });
    expect(text).toBe("# Overview\nLogline.");
  });

  it("reports a refusal instead of returning partial text", () => {
    expect(() =>
      readClaudeText({ stop_reason: "refusal", content: [{ type: "text", text: "I can't" }] }),
    ).toThrow(TextProviderRequestError);
  });

  it("reports a reply that is all thinking and no answer", () => {
    expect(() => readClaudeText({ stop_reason: "max_tokens", content: [{ type: "thinking" }] })).toThrow(
      /whole output allowance/,
    );
    expect(() => readClaudeText({ stop_reason: "end_turn", content: [] })).toThrow(/empty reply/);
  });

  it("recognises both ways a reply can be cut off", () => {
    expect(isClaudeReplyCutOff({ stop_reason: "max_tokens", content: [] })).toBe(true);
    expect(isClaudeReplyCutOff({ stop_reason: "model_context_window_exceeded", content: [] })).toBe(true);
    expect(isClaudeReplyCutOff({ stop_reason: "end_turn", content: [] })).toBe(false);
  });
});

describe("chat completion requests", () => {
  it("sends OpenAI an explicit reasoning effort and the completion-token field", () => {
    expect(buildChatCompletionBody({ provider: "openai", model: "gpt-6.2-sol", maxTokens: 33000, prompt: "p" })).toEqual({
      model: "gpt-6.2-sol",
      max_completion_tokens: 33000,
      reasoning_effort: "medium",
      messages: [{ role: "user", content: "p" }],
    });
  });

  it("switches DeepSeek thinking off and uses its own token field", () => {
    expect(buildChatCompletionBody({ provider: "deepseek", model: "deepseek-flash", maxTokens: 16384, prompt: "p" })).toEqual({
      model: "deepseek-flash",
      max_tokens: 16384,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: "p" }],
    });
  });

  it("returns the trimmed answer", () => {
    expect(
      readChatCompletionText({ choices: [{ finish_reason: "stop", message: { content: "  Deck.  " } }] }, "openai"),
    ).toBe("Deck.");
  });

  it("reports a withheld or refused reply", () => {
    expect(() =>
      readChatCompletionText({ choices: [{ finish_reason: "content_filter", message: { content: null } }] }, "deepseek"),
    ).toThrow(/DeepSeek withheld/);
    expect(() =>
      readChatCompletionText({ choices: [{ finish_reason: "stop", message: { content: null, refusal: "no" } }] }, "openai"),
    ).toThrow(/OpenAI withheld/);
  });

  it("reports an empty reply, including a body with no choices", () => {
    expect(() =>
      readChatCompletionText({ choices: [{ finish_reason: "length", message: { content: "" } }] }, "openai"),
    ).toThrow(/whole output allowance/);
    expect(() => readChatCompletionText({}, "deepseek")).toThrow(/empty reply/);
  });
});

describe("Gemini requests", () => {
  it("sets a low thinking level on Gemini 4 and none on Flash-Lite", () => {
    expect(buildGeminiBody({ model: "gemini-4-hydrogen", maxTokens: 32768, prompt: "p" })).toEqual({
      contents: [{ parts: [{ text: "p" }] }],
      generationConfig: { maxOutputTokens: 32768, thinkingConfig: { thinkingLevel: "low" } },
    });
    expect(buildGeminiBody({ model: "gemini-3.5-flash-lite", maxTokens: 32768, prompt: "p" })).toEqual({
      contents: [{ parts: [{ text: "p" }] }],
      generationConfig: { maxOutputTokens: 32768 },
    });
  });

  it("can drop the thinking level and never asks for more than the per-request limit", () => {
    expect(
      buildGeminiBody({ model: "gemini-4-hydrogen", maxTokens: 200000, prompt: "p", sendThinkingLevel: false }),
    ).toEqual({
      contents: [{ parts: [{ text: "p" }] }],
      generationConfig: { maxOutputTokens: 65536 },
    });
  });

  it("joins answer parts and leaves thought parts out", () => {
    const text = readGeminiText({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: "planning...", thought: true }, { text: "# Mood\n" }, { text: "Quiet." }] },
        },
      ],
    });
    expect(text).toBe("# Mood\nQuiet.");
  });

  it("reports a blocked prompt, an early stop and an empty reply", () => {
    expect(() => readGeminiText({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(/blocked the request: SAFETY/);
    expect(() =>
      readGeminiText({ candidates: [{ finishReason: "RECITATION", content: { parts: [{ text: "partial" }] } }] }),
    ).toThrow(/stopped before finishing \(RECITATION\)/);
    expect(() => readGeminiText({ candidates: [{ finishReason: "MAX_TOKENS" }] })).toThrow(/whole output allowance/);
    expect(() => readGeminiText({ candidates: [{}] })).toThrow(/empty reply/);
  });

  it("keeps the text of a reply that ran out of room after writing", () => {
    expect(
      readGeminiText({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "Scene 1" }] } }] }),
    ).toBe("Scene 1");
  });
});

describe("getJsonReplyModel", () => {
  it("moves Gemini to Flash-Lite and leaves other providers on the chosen model", async () => {
    const { getJsonReplyModel } = await import("@/lib/ai-providers");
    expect(getJsonReplyModel("gemini", "gemini-4-hydrogen")).toBe("gemini-3.5-flash-lite");
    expect(getJsonReplyModel("openai", "gpt-6.1-terra")).toBe("gpt-6.1-terra");
    expect(getJsonReplyModel("anthropic", "claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
  });
});
