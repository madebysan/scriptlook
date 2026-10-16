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
  tier: "economy" | "recommended" | "premium";
  description: string;
};

export const DEFAULT_TEXT_PROVIDER: TextProvider = "anthropic";

export const TEXT_PROVIDER_OPTIONS: readonly TextProviderOption[] = [
  {
    id: "anthropic",
    label: "Claude",
    company: "Anthropic",
    model: "claude-haiku-4-5-20251001",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "economy", description: "Fastest, lowest-cost deck pass." },
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", tier: "recommended", description: "Stronger writing and creative judgment." },
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
    model: "gpt-5.6-terra",
    models: [
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", tier: "economy", description: "Efficient for high-volume report generation." },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", tier: "recommended", description: "Best balance of quality and cost." },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", tier: "premium", description: "Highest-quality OpenAI deck pass." },
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
    model: "deepseek-v4-flash",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", tier: "economy", description: "Low-cost, fast report generation." },
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
    model: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", tier: "economy", description: "Lowest-cost Google text pass." },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", tier: "recommended", description: "Stronger long-context deck generation." },
    ],
    description: "Long-context Google model.",
    keyLabel: "Gemini API key",
    keyUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
];

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
