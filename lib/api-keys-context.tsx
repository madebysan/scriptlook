"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiKeysDialog } from "@/components/wizard/api-keys-dialog";
import {
  DEFAULT_TEXT_PROVIDER,
  normalizeTextProvider,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  API_KEY_STORAGE,
  API_PROVIDER_STORAGE,
  FAL_KEY_STORAGE,
  TMDB_KEY_STORAGE,
} from "@/lib/reports";

export type EnsureKeysOptions = {
  // When true, the fal.ai key is also required (image-only actions).
  // When false (default), only the selected text provider key is required and fal is optional.
  requireFal?: boolean;
  // Opens the review dialog even when stored credentials already satisfy the request.
  alwaysConfirm?: boolean;
};

export type EnsuredKeys = {
  apiProvider: TextProvider;
  apiKey: string;
  falKey: string;
};

type PendingRequest = {
  opts: EnsureKeysOptions;
  resolve: (keys: EnsuredKeys | null) => void;
};

type ApiKeysContextValue = {
  apiProvider: TextProvider;
  apiKey: string;
  falKey: string;
  tmdbKey: string;
  setApiProvider: (provider: TextProvider) => void;
  setApiKey: (k: string) => void;
  setFalKey: (k: string) => void;
  setTmdbKey: (k: string) => void;
  // Returns satisfied keys, or null if the user cancelled.
  ensureKeys: (opts?: EnsureKeysOptions) => Promise<EnsuredKeys | null>;
};

const ApiKeysContext = createContext<ApiKeysContextValue | null>(null);

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [apiProvider, setApiProviderState] =
    useState<TextProvider>(DEFAULT_TEXT_PROVIDER);
  const [apiKey, setApiKeyState] = useState<string>("");
  const [falKey, setFalKeyState] = useState<string>("");
  const [tmdbKey, setTmdbKeyState] = useState<string>("");
  const [pending, setPending] = useState<PendingRequest | null>(null);

  // Track latest values without forcing ensureKeys to re-create its closure.
  const apiProviderRef = useRef<TextProvider>(DEFAULT_TEXT_PROVIDER);
  const apiKeyRef = useRef("");
  const falKeyRef = useRef("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const storedProvider = normalizeTextProvider(localStorage.getItem(API_PROVIDER_STORAGE));
    const storedApi = localStorage.getItem(API_KEY_STORAGE) || "";
    const storedFal = localStorage.getItem(FAL_KEY_STORAGE) || "";
    const storedTmdb = localStorage.getItem(TMDB_KEY_STORAGE) || "";
    apiProviderRef.current = storedProvider;
    apiKeyRef.current = storedApi;
    falKeyRef.current = storedFal;
    setApiProviderState(storedProvider);
    setApiKeyState(storedApi);
    setFalKeyState(storedFal);
    setTmdbKeyState(storedTmdb);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setApiProvider = useCallback((provider: TextProvider) => {
    apiProviderRef.current = provider;
    setApiProviderState(provider);
    if (typeof window !== "undefined") localStorage.setItem(API_PROVIDER_STORAGE, provider);
  }, []);

  const setApiKey = useCallback((k: string) => {
    apiKeyRef.current = k;
    setApiKeyState(k);
    if (typeof window !== "undefined") localStorage.setItem(API_KEY_STORAGE, k);
  }, []);

  const setFalKey = useCallback((k: string) => {
    falKeyRef.current = k;
    setFalKeyState(k);
    if (typeof window !== "undefined") localStorage.setItem(FAL_KEY_STORAGE, k);
  }, []);

  const setTmdbKey = useCallback((k: string) => {
    setTmdbKeyState(k);
    if (typeof window !== "undefined") localStorage.setItem(TMDB_KEY_STORAGE, k);
  }, []);

  const ensureKeys = useCallback(
    (opts: EnsureKeysOptions = {}): Promise<EnsuredKeys | null> => {
      const haveApi = apiKeyRef.current.trim().length > 0;
      const haveFal = falKeyRef.current.trim().length > 0;
      const satisfied = haveApi && (!opts.requireFal || haveFal);
      if (satisfied && !opts.alwaysConfirm) {
        return Promise.resolve({
          apiKey: apiKeyRef.current,
          apiProvider: apiProviderRef.current,
          falKey: falKeyRef.current,
        });
      }
      return new Promise((resolve) => {
        setPending({ opts, resolve });
      });
    },
    [],
  );

  const handleConfirm = (
    nextProvider: TextProvider,
    nextApi: string,
    nextFal: string,
    nextTmdb: string,
  ) => {
    setApiProvider(nextProvider);
    setApiKey(nextApi);
    setFalKey(nextFal);
    setTmdbKey(nextTmdb);
    const req = pending;
    setPending(null);
    req?.resolve({ apiProvider: nextProvider, apiKey: nextApi, falKey: nextFal });
  };

  const handleCancel = () => {
    const req = pending;
    setPending(null);
    req?.resolve(null);
  };

  return (
    <ApiKeysContext.Provider
      value={{
        apiProvider,
        apiKey,
        falKey,
        tmdbKey,
        setApiProvider,
        setApiKey,
        setFalKey,
        setTmdbKey,
        ensureKeys,
      }}
    >
      {children}
      <ApiKeysDialog
        open={pending !== null}
        requireFal={pending?.opts.requireFal ?? false}
        confirmationMode={pending?.opts.alwaysConfirm ?? false}
        initialApiProvider={apiProvider}
        initialApiKey={apiKey}
        initialFalKey={falKey}
        initialTmdbKey={tmdbKey}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
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
