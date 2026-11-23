"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  KeySlip,
  type KeySlipMode,
  type KeySlipResult,
} from "@/components/wizard/api-keys-dialog";
import {
  resolveTextModelChoice,
  type TextModelChoice,
  type TextProvider,
} from "@/lib/ai-providers";
import type { ImageModel } from "@/lib/image-models";
import {
  activeTextModel,
  defaultSettings,
  hasTextKey,
  loadSettings,
  resolveReadingProvider,
  saveSettings,
  type Settings,
} from "@/lib/settings-storage";

export type EnsureKeysOptions = {
  // An image action: only the fal.ai key is needed.
  requireFal?: boolean;
  // Reading a screenplay: always ask for a yes first, even when a key is saved.
  alwaysConfirm?: boolean;
};

export type EnsuredKeys = {
  apiProvider: TextProvider;
  apiKey: string;
  falKey: string;
  // The model the provider will write with.
  textModel: string;
};

type PendingRequest = {
  id: number;
  mode: KeySlipMode;
  resolve: (keys: EnsuredKeys | null) => void;
};

type ApiKeysContextValue = {
  settings: Settings;
  // Shortcuts for the active provider.
  apiProvider: TextProvider;
  apiKey: string;
  textModel: string;
  falKey: string;
  tmdbKey: string;
  setApiProvider: (provider: TextProvider) => void;
  setTextKey: (provider: TextProvider, key: string) => void;
  setFalKey: (key: string) => void;
  setTmdbKey: (key: string) => void;
  setModelChoice: (provider: TextProvider, patch: Partial<TextModelChoice>) => void;
  setDeckImageModel: (model: ImageModel) => void;
  setPosterImageModel: (model: ImageModel) => void;
  // Returns what the action needs, or null if the user cancelled.
  ensureKeys: (opts?: EnsureKeysOptions) => Promise<EnsuredKeys | null>;
};

const ApiKeysContext = createContext<ApiKeysContextValue | null>(null);

function toEnsuredKeys(settings: Settings, provider = settings.apiProvider): EnsuredKeys {
  return {
    apiProvider: provider,
    apiKey: settings.textKeys[provider].trim(),
    falKey: settings.falKey.trim(),
    textModel: resolveTextModelChoice(provider, settings.modelChoices[provider]),
  };
}

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pending, setPending] = useState<PendingRequest | null>(null);

  // The latest settings, readable from callbacks without re-creating them.
  // Written only by `update`, never during render.
  const settingsRef = useRef<Settings>(settings);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Read localStorage after hydration so the server and first client render
    // agree. One state update for the whole settings object.
    const stored = loadSettings(localStorage);
    settingsRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(stored);
  }, []);

  // Keep up with keys and choices saved in another tab of this browser.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      const stored = loadSettings(localStorage);
      settingsRef.current = stored;
      setSettings(stored);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Every change starts from what is stored, not from this tab's copy, so a tab
  // that has been open a while cannot write its old keys over newer ones.
  const update = useCallback((change: (current: Settings) => Settings) => {
    const next = change(loadSettings(localStorage));
    settingsRef.current = next;
    setSettings(next);
    saveSettings(localStorage, next);
  }, []);

  const setApiProvider = useCallback(
    (provider: TextProvider) => update((current) => ({ ...current, apiProvider: provider })),
    [update],
  );
  const setTextKey = useCallback(
    (provider: TextProvider, key: string) =>
      update((current) => ({ ...current, textKeys: { ...current.textKeys, [provider]: key } })),
    [update],
  );
  const setFalKey = useCallback(
    (key: string) => update((current) => ({ ...current, falKey: key })),
    [update],
  );
  const setTmdbKey = useCallback(
    (key: string) => update((current) => ({ ...current, tmdbKey: key })),
    [update],
  );
  const setModelChoice = useCallback(
    (provider: TextProvider, patch: Partial<TextModelChoice>) =>
      update((current) => ({
        ...current,
        modelChoices: {
          ...current.modelChoices,
          [provider]: { ...current.modelChoices[provider], ...patch },
        },
      })),
    [update],
  );
  const setDeckImageModel = useCallback(
    (model: ImageModel) => update((current) => ({ ...current, deckImageModel: model })),
    [update],
  );
  const setPosterImageModel = useCallback(
    (model: ImageModel) => update((current) => ({ ...current, posterImageModel: model })),
    [update],
  );

  const ensureKeys = useCallback((opts: EnsureKeysOptions = {}): Promise<EnsuredKeys | null> => {
    const current = settingsRef.current;

    let mode: KeySlipMode | null = null;
    if (opts.alwaysConfirm) mode = "read";
    else if (opts.requireFal) mode = current.falKey.trim() ? null : "fal";
    else mode = hasTextKey(current, current.apiProvider) ? null : "text";

    if (!mode) return Promise.resolve(toEnsuredKeys(current));

    const slipMode = mode;
    return new Promise((resolve) => {
      requestIdRef.current += 1;
      setPending({ id: requestIdRef.current, mode: slipMode, resolve });
    });
  }, []);

  const handleSubmit = (result: KeySlipResult) => {
    const request = pending;
    if (!request) return;
    setPending(null);

    if (request.mode === "fal") {
      if (result.falKey) setFalKey(result.falKey);
      request.resolve(toEnsuredKeys(settingsRef.current));
      return;
    }

    if (result.textKey) setTextKey(result.provider, result.textKey);

    if (request.mode === "text") {
      setApiProvider(result.provider);
      request.resolve(toEnsuredKeys(settingsRef.current, result.provider));
      return;
    }

    // Reading a screenplay. A key typed here also becomes the writing key when
    // the writing provider has none, so the next step does not ask again.
    const afterKey = settingsRef.current;
    if (result.textKey && !hasTextKey(afterKey, afterKey.apiProvider)) {
      setApiProvider(result.provider);
    }
    const reader = resolveReadingProvider(settingsRef.current) ?? result.provider;
    request.resolve(toEnsuredKeys(settingsRef.current, reader));
  };

  const handleCancel = () => {
    const request = pending;
    setPending(null);
    request?.resolve(null);
  };

  return (
    <ApiKeysContext.Provider
      value={{
        settings,
        apiProvider: settings.apiProvider,
        apiKey: settings.textKeys[settings.apiProvider],
        textModel: activeTextModel(settings),
        falKey: settings.falKey,
        tmdbKey: settings.tmdbKey,
        setApiProvider,
        setTextKey,
        setFalKey,
        setTmdbKey,
        setModelChoice,
        setDeckImageModel,
        setPosterImageModel,
        ensureKeys,
      }}
    >
      {children}
      {pending && (
        <KeySlip
          key={pending.id}
          mode={pending.mode}
          settings={settings}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys(): ApiKeysContextValue {
  const ctx = useContext(ApiKeysContext);
  if (!ctx) {
    throw new Error("useApiKeys must be used within ApiKeysProvider");
  }
  return ctx;
}
