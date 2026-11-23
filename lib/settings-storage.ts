// What Settings remembers, and how it is kept in this browser's localStorage.
// Pure functions over a Storage, so the migration can be tested.

import {
  DEFAULT_TEXT_PROVIDER,
  TEXT_PROVIDERS,
  defaultTextModelChoice,
  isExtractionProvider,
  normalizeTextProvider,
  resolveTextModelChoice,
  type ExtractionProvider,
  type TextModelChoice,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  DEFAULT_DECK_IMAGE_MODEL,
  DEFAULT_POSTER_IMAGE_MODEL,
  IMAGE_MODELS,
  type ImageModel,
} from "@/lib/image-models";
import {
  API_KEY_STORAGE,
  API_PROVIDER_STORAGE,
  FAL_KEY_STORAGE,
  IMAGE_MODELS_STORAGE,
  MODEL_CHOICES_STORAGE,
  TEXT_KEYS_STORAGE,
  TMDB_KEY_STORAGE,
} from "@/lib/reports";

export type TextKeys = Record<TextProvider, string>;
export type ModelChoices = Record<TextProvider, TextModelChoice>;

export type Settings = {
  // The provider that writes the deck.
  apiProvider: TextProvider;
  // One key per provider. Switching provider never clears another's key.
  textKeys: TextKeys;
  falKey: string;
  tmdbKey: string;
  modelChoices: ModelChoices;
  deckImageModel: ImageModel;
  posterImageModel: ImageModel;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function emptyTextKeys(): TextKeys {
  return { anthropic: "", openai: "", deepseek: "", gemini: "" };
}

function defaultModelChoices(): ModelChoices {
  return {
    anthropic: defaultTextModelChoice("anthropic"),
    openai: defaultTextModelChoice("openai"),
    deepseek: defaultTextModelChoice("deepseek"),
    gemini: defaultTextModelChoice("gemini"),
  };
}

export function defaultSettings(): Settings {
  return {
    apiProvider: DEFAULT_TEXT_PROVIDER,
    textKeys: emptyTextKeys(),
    falKey: "",
    tmdbKey: "",
    modelChoices: defaultModelChoices(),
    deckImageModel: DEFAULT_DECK_IMAGE_MODEL,
    posterImageModel: DEFAULT_POSTER_IMAGE_MODEL,
  };
}

function readJson(storage: StorageLike, key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asImageModel(value: unknown, fallback: ImageModel): ImageModel {
  return typeof value === "string" && (IMAGE_MODELS as readonly string[]).includes(value)
    ? (value as ImageModel)
    : fallback;
}

export function loadSettings(storage: StorageLike): Settings {
  const settings = defaultSettings();
  settings.apiProvider = normalizeTextProvider(storage.getItem(API_PROVIDER_STORAGE));
  settings.falKey = storage.getItem(FAL_KEY_STORAGE) || "";
  settings.tmdbKey = storage.getItem(TMDB_KEY_STORAGE) || "";

  const storedKeys = readJson(storage, TEXT_KEYS_STORAGE);
  for (const provider of TEXT_PROVIDERS) {
    const value = storedKeys[provider];
    if (typeof value === "string") settings.textKeys[provider] = value;
  }

  // Older versions kept a single text key that belonged to whichever provider
  // was selected. File it under that provider, once.
  const legacyKey = storage.getItem(API_KEY_STORAGE);
  if (legacyKey !== null) {
    if (legacyKey.trim() && !settings.textKeys[settings.apiProvider]) {
      settings.textKeys[settings.apiProvider] = legacyKey;
    }
    storage.setItem(TEXT_KEYS_STORAGE, JSON.stringify(settings.textKeys));
    storage.removeItem(API_KEY_STORAGE);
  }

  const storedChoices = readJson(storage, MODEL_CHOICES_STORAGE);
  for (const provider of TEXT_PROVIDERS) {
    const stored = storedChoices[provider];
    if (typeof stored !== "object" || stored === null) continue;
    const choice = stored as Partial<TextModelChoice>;
    const fallback = settings.modelChoices[provider];
    settings.modelChoices[provider] = {
      model: typeof choice.model === "string" ? choice.model : fallback.model,
      customModel: typeof choice.customModel === "string" ? choice.customModel : "",
      useCustom: choice.useCustom === true,
    };
  }

  const storedImageModels = readJson(storage, IMAGE_MODELS_STORAGE);
  settings.deckImageModel = asImageModel(storedImageModels.deck, DEFAULT_DECK_IMAGE_MODEL);
  settings.posterImageModel = asImageModel(storedImageModels.poster, DEFAULT_POSTER_IMAGE_MODEL);

  return settings;
}

export function saveSettings(storage: StorageLike, settings: Settings): void {
  storage.setItem(API_PROVIDER_STORAGE, settings.apiProvider);
  storage.setItem(FAL_KEY_STORAGE, settings.falKey);
  storage.setItem(TMDB_KEY_STORAGE, settings.tmdbKey);
  storage.setItem(TEXT_KEYS_STORAGE, JSON.stringify(settings.textKeys));
  storage.setItem(MODEL_CHOICES_STORAGE, JSON.stringify(settings.modelChoices));
  storage.setItem(
    IMAGE_MODELS_STORAGE,
    JSON.stringify({ deck: settings.deckImageModel, poster: settings.posterImageModel }),
  );
}

export function hasTextKey(settings: Settings, provider: TextProvider): boolean {
  return settings.textKeys[provider].trim().length > 0;
}

export function providersWithKeys(settings: Settings): TextProvider[] {
  return TEXT_PROVIDERS.filter((provider) => hasTextKey(settings, provider));
}

// The model ID the active provider will write with.
export function activeTextModel(settings: Settings): string {
  return resolveTextModelChoice(settings.apiProvider, settings.modelChoices[settings.apiProvider]);
}

// Which provider reads a screenplay. Only Claude and OpenAI can. It follows the
// writing provider when that is one of the two and has a key; otherwise it uses
// whichever of them has a key. Null means a key has to be asked for first.
export function resolveReadingProvider(settings: Settings): ExtractionProvider | null {
  if (isExtractionProvider(settings.apiProvider) && hasTextKey(settings, settings.apiProvider)) {
    return settings.apiProvider;
  }
  if (hasTextKey(settings, "anthropic")) return "anthropic";
  if (hasTextKey(settings, "openai")) return "openai";
  return null;
}
