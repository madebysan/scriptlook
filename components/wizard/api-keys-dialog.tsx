"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EXTRACTION_MODELS,
  TEXT_PROVIDERS,
  getTextProviderOption,
  isExtractionProvider,
  type ExtractionProvider,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  hasTextKey,
  providersWithKeys,
  resolveReadingProvider,
  type Settings,
} from "@/lib/settings-storage";
import {
  FormRow,
  HINT_CLASS,
  KeyField,
  PRIMARY_BUTTON_CLASS,
  ProviderCells,
  QUIET_BUTTON_CLASS,
  SHEET_CLASS,
} from "@/components/wizard/form-parts";

// What the slip is asking for:
//   "read"  confirm reading a screenplay (shown on every file drop)
//   "text"  an action needs a text key and none is saved for the provider
//   "fal"   an image action needs the fal.ai key
export type KeySlipMode = "read" | "text" | "fal";

export type KeySlipResult = {
  provider: TextProvider;
  // Set only when a key was typed here.
  textKey?: string;
  falKey?: string;
};

type KeySlipProps = {
  mode: KeySlipMode;
  settings: Settings;
  onSubmit: (result: KeySlipResult) => void;
  onCancel: () => void;
};

const EXTRACTION_PROVIDERS: readonly ExtractionProvider[] = ["anthropic", "openai"];

// A small confirmation that asks for a key only when the key it needs is
// missing, and only for that one key. Mount it fresh for each request (give it
// a `key`), so its fields start from the saved settings every time.
export function KeySlip({ mode, settings, onSubmit, onCancel }: KeySlipProps) {
  const readingProvider = resolveReadingProvider(settings);
  const [provider, setProvider] = useState<TextProvider>(() => {
    if (mode !== "read") return settings.apiProvider;
    if (readingProvider) return readingProvider;
    return isExtractionProvider(settings.apiProvider) ? settings.apiProvider : "anthropic";
  });
  const [textKey, setTextKey] = useState("");
  const [falKey, setFalKey] = useState("");

  const providerOption = getTextProviderOption(provider);
  // A text action asks for a key only while the picked provider has none, so
  // picking a provider whose key is saved is enough to continue.
  const needsTextKey =
    mode === "text" ? !hasTextKey(settings, provider) : mode === "read" && !readingProvider;
  const canSubmit =
    mode === "fal" ? falKey.trim().length > 0 : !needsTextKey || textKey.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      provider,
      textKey: needsTextKey ? textKey.trim() : undefined,
      falKey: mode === "fal" ? falKey.trim() : undefined,
    });
  };

  const title =
    mode === "read" ? "Read this screenplay?" : mode === "fal" ? "Add a fal.ai key" : "Add a key";
  const submitLabel =
    mode === "read"
      ? "Read screenplay"
      : mode === "text" && !needsTextKey
        ? "Continue"
        : "Save and continue";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className={`${SHEET_CLASS} max-h-[85vh] overflow-y-auto sm:max-w-md`}>
        <DialogHeader>
          <DialogTitle className="form-sec-head text-[20px] text-foreground">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === "read"
              ? "Confirm the model that will read the screenplay."
              : "Add the key this action needs."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {mode === "read" && (
            <div className="border-t border-foreground">
              <FormRow label="Model">
                {EXTRACTION_MODELS[isExtractionProvider(provider) ? provider : "anthropic"].label}
              </FormRow>
              <p className={`${HINT_CLASS} pt-2.5`}>About 2 to 4 minutes for a feature script.</p>
            </div>
          )}

          {mode === "read" && needsTextKey && (
            <>
              <p className={HINT_CLASS}>Reading a screenplay needs a Claude or OpenAI key.</p>
              <ProviderCells
                label="Provider that reads the screenplay"
                providers={EXTRACTION_PROVIDERS}
                value={provider}
                onChange={setProvider}
              />
            </>
          )}

          {mode === "text" && (
            <ProviderCells
              label="Text provider"
              providers={TEXT_PROVIDERS}
              value={provider}
              savedProviders={providersWithKeys(settings)}
              onChange={setProvider}
            />
          )}

          {needsTextKey && (
            <KeyField
              id="slip-text-key"
              label={providerOption.keyLabel}
              keyUrl={providerOption.keyUrl}
              placeholder={providerOption.placeholder}
              value={textKey}
              onChange={setTextKey}
              autoFocus
            />
          )}

          {mode === "fal" && (
            <>
              <p className={HINT_CLASS}>Needed to generate images.</p>
              <KeyField
                id="slip-fal-key"
                label="fal.ai API key"
                keyUrl="https://fal.ai/dashboard/keys"
                placeholder="fal-..."
                value={falKey}
                onChange={setFalKey}
                autoFocus
              />
            </>
          )}

          {(needsTextKey || mode === "fal") && (
            <p className={HINT_CLASS}>Saved in this browser. Edit keys anytime in Settings.</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={QUIET_BUTTON_CLASS}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit} className={PRIMARY_BUTTON_CLASS}>
              {submitLabel}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
