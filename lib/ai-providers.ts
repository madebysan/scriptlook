export const TEXT_PROVIDERS = ["anthropic", "openai", "deepseek", "gemini"] as const;

export type TextProvider = (typeof TEXT_PROVIDERS)[number];

export type TextProviderOption = {
  id: TextProvider;
  label: string;
  company: string;
  model: string;
  models: readonly TextModelOption[];
  description: string;
  keyLabel: string;
  keyUrl: string;
  placeholder: string;
};

export type TextModelOption = {
  id: string;
  label: string;
  tier: "economy" | "recommended";
  description: string;
};

export const DEFAULT_TEXT_PROVIDER: TextProvider = "anthropic";

export const TEXT_PROVIDER_OPTIONS: readonly TextProviderOption[] = [
  {
    id: "anthropic",
    label: "Claude",
    company: "Anthropic",
    model: "claude-sonnet-5-5",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", tier: "economy", description: "Fastest, lowest-cost deck pass." },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", tier: "recommended", description: "Stronger writing and creative judgment." },
    ],
    description: "Strong default for report writing.",
    keyLabel: "Claude API key",
    keyUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-api03-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    company: "OpenAI",
    model: "gpt-6.1-terra",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", tier: "economy", description: "Efficient for high-volume report generation." },
      { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", tier: "recommended", description: "Best balance of quality and cost." },
    ],
    description: "Fast general-purpose report pass.",
    keyLabel: "OpenAI API key",
    keyUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    company: "DeepSeek",
    model: "deepseek-flash",
    models: [
      { id: "deepseek-flash", label: "DeepSeek Flash", tier: "economy", description: "Low-cost, fast report generation." },
    ],
    description: "Low-cost OpenAI-compatible option.",
    keyLabel: "DeepSeek API key",
    keyUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
  },
  {
    id: "gemini",
    label: "Gemini",
    company: "Google",
    model: "gemini-4-hydrogen",
    models: [
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", tier: "economy", description: "Lowest-cost Google text pass." },
      { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen", tier: "recommended", description: "Stronger long-context deck generation." },
    ],
    description: "Long-context Google model.",
    keyLabel: "Gemini API key",
    keyUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
];

// Screenplay extraction is a mechanical pass, so it always runs on the
// provider's low-cost model, whatever model is picked for writing the deck.
export type ExtractionProvider = "anthropic" | "openai";

export const EXTRACTION_MODELS: Record<ExtractionProvider, { id: string; label: string }> = {
  anthropic: { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  openai: { id: "gpt-6-luna", label: "GPT-6 Luna" },
};

export function isExtractionProvider(value: unknown): value is ExtractionProvider {
  return value === "anthropic" || value === "openai";
}

// Model for a call that must return bare JSON as its text (the shot list).
// Google documents that Gemini 4 can answer a plain-text request for raw JSON
// with a malformed tool call instead of an answer, so on Gemini these calls run
// on Flash-Lite, which that warning does not cover. Other providers keep the
// model that was picked.
export function getJsonReplyModel(provider: TextProvider, model: string): string {
  return provider === "gemini" ? "gemini-3.5-flash-lite" : model;
}

export function isTextProvider(value: unknown): value is TextProvider {
  return typeof value === "string" && (TEXT_PROVIDERS as readonly string[]).includes(value);
}

export function normalizeTextProvider(value: unknown): TextProvider {
  return isTextProvider(value) ? value : DEFAULT_TEXT_PROVIDER;
}

export function getTextProviderOption(provider: TextProvider): TextProviderOption {
  return TEXT_PROVIDER_OPTIONS.find((option) => option.id === provider) || TEXT_PROVIDER_OPTIONS[0];
}

export function normalizeTextModel(provider: TextProvider, value: unknown): string {
  const option = getTextProviderOption(provider);
  if (typeof value !== "string") return option.model;
  return option.models.some((model) => model.id === value) ? value : option.model;
}

// A model ID someone typed in because it is newer than this list. Only its
// shape is checked: the provider decides whether it exists.
const MODEL_ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,99}$/;

export function isPlausibleModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_SHAPE.test(value.trim());
}

// What a person picked for one provider: a listed model, or a typed ID that
// takes over while `useCustom` is on.
export type TextModelChoice = {
  model: string;
  customModel: string;
  useCustom: boolean;
};

export function defaultTextModelChoice(provider: TextProvider): TextModelChoice {
  return { model: getTextProviderOption(provider).model, customModel: "", useCustom: false };
}

// The model ID to send for a provider, given what was picked. A listed model
// that has since left the list falls back to the provider default.
export function resolveTextModelChoice(provider: TextProvider, choice: TextModelChoice): string {
  if (choice.useCustom && isPlausibleModelId(choice.customModel)) {
    return choice.customModel.trim();
  }
  return normalizeTextModel(provider, choice.model);
}

// Server side: accept a listed model or a plausible typed ID from the request.
export function resolveRequestedTextModel(provider: TextProvider, value: unknown): string {
  const option = getTextProviderOption(provider);
  if (typeof value !== "string") return option.model;
  if (option.models.some((model) => model.id === value)) return value;
  return isPlausibleModelId(value) ? value.trim() : option.model;
}

export function getTextModelLabel(provider: TextProvider, modelId: string): string {
  const listed = getTextProviderOption(provider).models.find((model) => model.id === modelId);
  return listed ? listed.label : modelId;
}
