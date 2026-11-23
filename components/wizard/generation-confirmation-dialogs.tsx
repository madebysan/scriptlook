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
  TEXT_PROVIDERS,
  getTextModelLabel,
  getTextProviderOption,
  isPlausibleModelId,
  type TextProvider,
} from "@/lib/ai-providers";
import {
  IMAGE_MODEL_OPTIONS,
  formatImageCostEstimate,
  type ImageModel,
} from "@/lib/image-models";
import { useApiKeys } from "@/lib/api-keys-context";
import { hasTextKey, providersWithKeys } from "@/lib/settings-storage";
import {
  FormRow,
  HINT_CLASS,
  KeyField,
  PRIMARY_BUTTON_CLASS,
  ProviderCells,
  QUIET_BUTTON_CLASS,
  SELECT_CLASS,
  SHEET_CLASS,
} from "@/components/wizard/form-parts";

const CUSTOM_MODEL_VALUE = "custom";

type TextConfirmationDialogProps = {
  open: boolean;
  onCancel: () => void;
  // Called with the key the run will use.
  onConfirm: (apiKey: string) => void;
};

// "Write the deck?": one ruled row naming the model, which is also where it
// can be changed. It offers the models of the writing provider and of every
// provider with a saved key, so switching provider is one pick and never a
// re-paste.
export function TextConfirmationDialog({ open, onCancel, onConfirm }: TextConfirmationDialogProps) {
  const { settings, apiProvider, apiKey, textModel, setApiProvider, setTextKey, setModelChoice } =
    useApiKeys();

  const savedProviders = providersWithKeys(settings);
  const offeredProviders = TEXT_PROVIDERS.filter(
    (provider) => provider === apiProvider || savedProviders.includes(provider),
  );
  // The writing provider's key is asked for in place while it is missing. What
  // is typed stays here until the run is confirmed, so Cancel saves nothing.
  // (The dialog is mounted only while it is open.)
  const needsKey = !hasTextKey(settings, apiProvider);
  const [typedKey, setTypedKey] = useState("");
  const canConfirm = !needsKey || typedKey.trim().length > 0;
  const activeChoice = settings.modelChoices[apiProvider];
  const selectedValue = `${apiProvider}::${
    activeChoice.useCustom && isPlausibleModelId(activeChoice.customModel)
      ? CUSTOM_MODEL_VALUE
      : textModel
  }`;
  const modelLabel = getTextModelLabel(apiProvider, textModel);
  const providerOption = getTextProviderOption(apiProvider);

  const handleModelChange = (value: string) => {
    const separator = value.indexOf("::");
    const provider = value.slice(0, separator) as TextProvider;
    const model = value.slice(separator + 2);
    if (!TEXT_PROVIDERS.includes(provider)) return;
    if (model === CUSTOM_MODEL_VALUE) setModelChoice(provider, { useCustom: true });
    else setModelChoice(provider, { model, useCustom: false });
    if (provider !== apiProvider) setApiProvider(provider);
  };

  const confirm = () => {
    if (!canConfirm) return;
    if (!needsKey) {
      onConfirm(apiKey.trim());
      return;
    }
    const key = typedKey.trim();
    setTextKey(apiProvider, key);
    onConfirm(key);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className={`${SHEET_CLASS} max-h-[88vh] overflow-y-auto sm:max-w-lg`}>
        <DialogHeader>
          <DialogTitle className="form-sec-head text-[20px]">Write the deck?</DialogTitle>
          <DialogDescription className="sr-only">
            Confirm the model that will write the deck. Images are not started by this step.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <div className="border-t border-foreground">
            <FormRow label="Model" htmlFor="write-model">
              <select
                id="write-model"
                value={selectedValue}
                onChange={(event) => handleModelChange(event.target.value)}
                className={SELECT_CLASS}
              >
                {offeredProviders.map((provider) => {
                  const option = getTextProviderOption(provider);
                  const choice = settings.modelChoices[provider];
                  const hasCustom = isPlausibleModelId(choice.customModel);
                  return (
                    <optgroup key={provider} label={option.label}>
                      {option.models.map((model) => (
                        <option key={model.id} value={`${provider}::${model.id}`}>
                          {model.label} · {model.tier}
                        </option>
                      ))}
                      {hasCustom && (
                        <option value={`${provider}::${CUSTOM_MODEL_VALUE}`}>
                          {choice.customModel.trim()} · typed in
                        </option>
                      )}
                    </optgroup>
                  );
                })}
              </select>
            </FormRow>
            <p className={`${HINT_CLASS} pt-2.5`}>Images are not started by this step.</p>
          </div>

          {needsKey && (
            <>
              {savedProviders.length === 0 && (
                <ProviderCells
                  label="Text provider"
                  providers={TEXT_PROVIDERS}
                  value={apiProvider}
                  onChange={setApiProvider}
                />
              )}
              <KeyField
                id="write-text-key"
                label={providerOption.keyLabel}
                keyUrl={providerOption.keyUrl}
                placeholder={providerOption.placeholder}
                value={typedKey}
                onChange={setTypedKey}
                autoFocus
              />
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={QUIET_BUTTON_CLASS}>
              Cancel
            </button>
            <button type="submit" disabled={!canConfirm} className={PRIMARY_BUTTON_CLASS}>
              Write with {modelLabel}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ImageConfirmationDialogProps = {
  open: boolean;
  deckCount: number;
  posterCount: number;
  onCancel: () => void;
  // Called with the fal.ai key the batch will use.
  onConfirm: (falKey: string) => void;
};

// "Generate N images?": one ruled row per kind of image, each with its model.
export function ImageConfirmationDialog({
  open,
  deckCount,
  posterCount,
  onCancel,
  onConfirm,
}: ImageConfirmationDialogProps) {
  const { settings, falKey, setFalKey, setDeckImageModel, setPosterImageModel } = useApiKeys();
  // The fal.ai key is asked for in place while it is missing. What is typed
  // stays here until the batch is confirmed, so Cancel saves nothing.
  // (The dialog is mounted only while it is open.)
  const needsKey = falKey.trim().length === 0;
  const [typedKey, setTypedKey] = useState("");

  const total = deckCount + posterCount;
  const canRun = total > 0 && (!needsKey || typedKey.trim().length > 0);
  const confirm = () => {
    if (!canRun) return;
    if (!needsKey) {
      onConfirm(falKey.trim());
      return;
    }
    const key = typedKey.trim();
    setFalKey(key);
    onConfirm(key);
  };
  const estimate = formatImageCostEstimate([
    { model: settings.deckImageModel, count: deckCount },
    { model: settings.posterImageModel, count: posterCount },
  ]);

  if (total === 0) {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
        <DialogContent className={`${SHEET_CLASS} sm:max-w-md`}>
          <DialogHeader>
            <DialogTitle className="form-sec-head text-[20px]">Nothing to generate</DialogTitle>
            <DialogDescription className={HINT_CLASS}>
              No images are waiting. A section that has not been written yet gets its images
              after it is written.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <button type="button" onClick={onCancel} className={PRIMARY_BUTTON_CLASS}>
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className={`${SHEET_CLASS} max-h-[90vh] overflow-y-auto sm:max-w-lg`}>
        <DialogHeader>
          <DialogTitle className="form-sec-head text-[20px]">
            Generate {total} {total === 1 ? "image" : "images"}?
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm the image models. Nothing runs until you confirm.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <div className="border-t border-foreground">
            {deckCount > 0 && (
              <FormRow label={`Deck images · ${deckCount}`} htmlFor="deck-image-model">
                <ImageModelSelect
                  id="deck-image-model"
                  value={settings.deckImageModel}
                  onChange={setDeckImageModel}
                />
              </FormRow>
            )}
            {posterCount > 0 && (
              <FormRow label={`Posters · ${posterCount}`} htmlFor="poster-image-model">
                <ImageModelSelect
                  id="poster-image-model"
                  value={settings.posterImageModel}
                  onChange={setPosterImageModel}
                />
              </FormRow>
            )}
          </div>

          {needsKey && (
            <KeyField
              id="image-fal-key"
              label="fal.ai API key"
              keyUrl="https://fal.ai/dashboard/keys"
              placeholder="fal-..."
              value={typedKey}
              onChange={setTypedKey}
              autoFocus
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={QUIET_BUTTON_CLASS}>
              Cancel
            </button>
            <button type="submit" disabled={!canRun} className={PRIMARY_BUTTON_CLASS}>
              <span>
                Generate {total} {total === 1 ? "image" : "images"}
                {estimate && <span className="font-normal"> · {estimate}</span>}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImageModelSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ImageModel;
  onChange: (model: ImageModel) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as ImageModel)}
      className={SELECT_CLASS}
    >
      {IMAGE_MODEL_OPTIONS.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
