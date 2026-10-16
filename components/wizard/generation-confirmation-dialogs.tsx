"use client";

import { ExternalLink, Images, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextProviderFields } from "./text-provider-fields";
import { getTextProviderOption, type TextProvider } from "@/lib/ai-providers";
import {
  IMAGE_MODEL_OPTIONS,
  type ImageModel,
} from "@/lib/image-models";
import { cn } from "@/lib/utils";

type TextConfirmationDialogProps = {
  open: boolean;
  provider: TextProvider;
  apiKey: string;
  model: string;
  onProviderChange: (provider: TextProvider) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (model: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TextConfirmationDialog({
  open,
  provider,
  apiKey,
  model,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
  onCancel,
  onConfirm,
}: TextConfirmationDialogProps) {
  const providerOption = getTextProviderOption(provider);
  const canRun = apiKey.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="paper max-h-[88vh] overflow-y-auto border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="form-sec-head flex items-center gap-2 text-[22px]">
            <Sparkles size={17} /> Confirm text generation
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-foreground/65">
            Review the provider and exact model. Images will not start when this run begins.
          </DialogDescription>
        </DialogHeader>

        <TextProviderFields
          provider={provider}
          apiKey={apiKey}
          model={model}
          onProviderChange={onProviderChange}
          onApiKeyChange={onApiKeyChange}
          onModelChange={onModelChange}
          surface="paper"
        />

        <div className="flex justify-end gap-2 border-t border-foreground pt-4">
          <button type="button" onClick={onCancel} className="min-h-10 border border-transparent px-4 text-[13px] hover:border-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canRun}
            className="min-h-10 border-2 border-foreground bg-foreground px-5 text-[13px] font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate text with {providerOption.models.find((option) => option.id === model)?.label}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ImageConfirmationDialogProps = {
  open: boolean;
  falKey: string;
  deckModel: ImageModel;
  posterModel: ImageModel;
  deckCount: number;
  posterCount: number;
  onFalKeyChange: (apiKey: string) => void;
  onDeckModelChange: (model: ImageModel) => void;
  onPosterModelChange: (model: ImageModel) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ImageConfirmationDialog({
  open,
  falKey,
  deckModel,
  posterModel,
  deckCount,
  posterCount,
  onFalKeyChange,
  onDeckModelChange,
  onPosterModelChange,
  onCancel,
  onConfirm,
}: ImageConfirmationDialogProps) {
  const canRun = falKey.trim().length > 0;
  const total = deckCount + posterCount;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="paper max-h-[90vh] overflow-y-auto border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="form-sec-head flex items-center gap-2 text-[22px]">
            <Images size={17} /> Confirm image generation
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-foreground/65">
            Choose one model for supporting deck images and another for posters. Nothing runs until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 border border-foreground p-4">
          <label htmlFor="image-fal-key" className="text-[13px] font-medium">fal.ai API key</label>
          <input
            id="image-fal-key"
            type="password"
            value={falKey}
            onChange={(event) => onFalKeyChange(event.target.value)}
            placeholder="fal-..."
            className="w-full border border-foreground bg-background/60 px-3 py-2.5 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <ModelChoice
          title={`Supporting deck images · ${deckCount}`}
          description="Storyboards, portraits, props, and priority locations."
          value={deckModel}
          onChange={onDeckModelChange}
        />
        <ModelChoice
          title={`Poster images · ${posterCount}`}
          description="A separate quality choice for key art and campaign concepts."
          value={posterModel}
          onChange={onPosterModelChange}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground pt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em]">
            {total === 0 ? "No missing images" : `${total} images will be generated`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="min-h-10 border border-transparent px-4 text-[13px] hover:border-foreground">
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canRun || total === 0}
              className="min-h-10 border-2 border-foreground bg-foreground px-5 text-[13px] font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate {total} images
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModelChoice({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: ImageModel;
  onChange: (model: ImageModel) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="form-sec-head text-[17px]">{title}</h3>
        <p className="mt-1 text-[12px] text-foreground/60">{description}</p>
      </div>
      <div role="radiogroup" aria-label={title} className="grid gap-3 sm:grid-cols-2">
        {IMAGE_MODEL_OPTIONS.map((option) => {
          const selected = option.id === value;
          return (
            <div
              key={option.id}
              role="radio"
              tabIndex={0}
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(option.id);
                }
              }}
              className={cn(
                "border-2 p-4 text-left transition-colors",
                selected ? "border-foreground bg-[var(--paper-highlight)]" : "border-[var(--paper-rule-soft)] hover:border-foreground",
              )}
            >
              <span className="block text-[14px] font-bold">{option.label}</span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/55">{option.provider}</span>
              <span className="mt-3 block text-[12px] leading-relaxed">{option.description}</span>
              <span className="mt-2 block text-[11px] text-foreground/60">Best for: {option.bestFor}</span>
              <a
                href={option.exampleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-3 inline-flex items-center gap-1 text-[11px] underline underline-offset-2"
              >
                View model examples <ExternalLink size={10} />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
