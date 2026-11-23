import { describe, expect, it } from "vitest";
import {
  isPlausibleModelId,
  resolveRequestedTextModel,
  resolveTextModelChoice,
} from "@/lib/ai-providers";
import { formatImageCostEstimate } from "@/lib/image-models";
import {
  activeTextModel,
  defaultSettings,
  loadSettings,
  providersWithKeys,
  resolveReadingProvider,
  saveSettings,
} from "@/lib/settings-storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("settings storage", () => {
  it("starts with no keys and the default models", () => {
    const settings = loadSettings(memoryStorage());
    expect(settings).toEqual(defaultSettings());
    expect(providersWithKeys(settings)).toEqual([]);
    expect(activeTextModel(settings)).toBe("claude-sonnet-5-5");
  });

  it("files the old single key under the provider it belonged to, once", () => {
    const storage = memoryStorage({ "stp-api-key": "old-openai-key", "stp-api-provider": "openai" });
    const settings = loadSettings(storage);

    expect(settings.apiProvider).toBe("openai");
    expect(settings.textKeys.openai).toBe("old-openai-key");
    expect(settings.textKeys.anthropic).toBe("");
    expect(storage.getItem("stp-api-key")).toBeNull();
    expect(loadSettings(storage).textKeys.openai).toBe("old-openai-key");
  });

  it("does not let an old key overwrite one already saved for that provider", () => {
    const storage = memoryStorage({
      "stp-api-key": "stale",
      "stp-api-provider": "anthropic",
      "scriptlook-text-keys": JSON.stringify({ anthropic: "current" }),
    });
    expect(loadSettings(storage).textKeys.anthropic).toBe("current");
  });

  it("keeps one key per provider through a save and load", () => {
    const storage = memoryStorage();
    const settings = defaultSettings();
    settings.apiProvider = "gemini";
    settings.textKeys.anthropic = "claude-key";
    settings.textKeys.gemini = "gemini-key";
    settings.falKey = "fal-key";
    settings.deckImageModel = "nano-banana-2";
    settings.modelChoices.gemini = { model: "gemini-3.5-flash-lite", customModel: "", useCustom: false };
    saveSettings(storage, settings);

    expect(loadSettings(storage)).toEqual(settings);
    expect(providersWithKeys(loadSettings(storage))).toEqual(["anthropic", "gemini"]);
  });

  it("ignores unreadable or unknown stored values", () => {
    const settings = loadSettings(
      memoryStorage({
        "stp-api-provider": "not-a-provider",
        "scriptlook-text-keys": "{broken",
        "scriptlook-image-models": JSON.stringify({ deck: "made-up", poster: 7 }),
        "scriptlook-model-choices": JSON.stringify({ openai: "nope", anthropic: { model: 3 } }),
      }),
    );
    expect(settings).toEqual(defaultSettings());
  });
});

describe("which provider reads a screenplay", () => {
  it("follows the writing provider when it can read and has a key", () => {
    const settings = defaultSettings();
    settings.apiProvider = "openai";
    settings.textKeys.openai = "k";
    settings.textKeys.anthropic = "k";
    expect(resolveReadingProvider(settings)).toBe("openai");
  });

  it("falls back to Claude, then OpenAI, when the writing provider cannot read", () => {
    const settings = defaultSettings();
    settings.apiProvider = "deepseek";
    settings.textKeys.deepseek = "k";
    expect(resolveReadingProvider(settings)).toBeNull();

    settings.textKeys.openai = "k";
    expect(resolveReadingProvider(settings)).toBe("openai");

    settings.textKeys.anthropic = "k";
    expect(resolveReadingProvider(settings)).toBe("anthropic");
  });

  it("uses the other reader when the writing provider has no key", () => {
    const settings = defaultSettings();
    settings.apiProvider = "anthropic";
    settings.textKeys.openai = "k";
    expect(resolveReadingProvider(settings)).toBe("openai");
  });
});

describe("typed model IDs", () => {
  it("accepts ID-shaped text and rejects anything else", () => {
    expect(isPlausibleModelId("claude-opus-5-5")).toBe(true);
    expect(isPlausibleModelId("  gpt-6.2-astra ")).toBe(true);
    expect(isPlausibleModelId("")).toBe(false);
    expect(isPlausibleModelId("two words")).toBe(false);
    expect(isPlausibleModelId('x"}; drop')).toBe(false);
    expect(isPlausibleModelId(42)).toBe(false);
  });

  it("uses the typed ID only while that option is on and the ID is usable", () => {
    const base = { model: "claude-haiku-5-5", customModel: "claude-opus-5-5", useCustom: true };
    expect(resolveTextModelChoice("anthropic", base)).toBe("claude-opus-5-5");
    expect(resolveTextModelChoice("anthropic", { ...base, useCustom: false })).toBe("claude-haiku-5-5");
    expect(resolveTextModelChoice("anthropic", { ...base, customModel: "" })).toBe("claude-haiku-5-5");
  });

  it("falls back to the default when a listed choice has left the list", () => {
    expect(
      resolveTextModelChoice("openai", { model: "gpt-5.6-terra", customModel: "", useCustom: false }),
    ).toBe("gpt-6.1-terra");
  });

  it("lets the server pass a typed ID through but not junk", () => {
    expect(resolveRequestedTextModel("anthropic", "claude-opus-5-5")).toBe("claude-opus-5-5");
    expect(resolveRequestedTextModel("anthropic", "claude-haiku-5-5")).toBe("claude-haiku-5-5");
    expect(resolveRequestedTextModel("anthropic", "not a model")).toBe("claude-sonnet-5-5");
    expect(resolveRequestedTextModel("anthropic", undefined)).toBe("claude-sonnet-5-5");
  });
});

describe("image cost estimate", () => {
  it("adds up the batch at each model's price", () => {
    expect(
      formatImageCostEstimate([
        { model: "flux-gesture", count: 219 },
        { model: "nano-banana-2", count: 15 },
      ]),
    ).toBe("about $9");
  });

  it("stays vague for small batches and says nothing for none", () => {
    expect(formatImageCostEstimate([{ model: "flux-gesture", count: 3 }])).toBe("under $1");
    expect(formatImageCostEstimate([{ model: "flux-gesture", count: 0 }])).toBe("");
  });
});
