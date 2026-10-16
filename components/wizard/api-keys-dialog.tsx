"use client";

import { useEffect, useState } from "react";
import { Clock, DollarSign, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTextProviderOption, type TextProvider } from "@/lib/ai-providers";
import { TextProviderFields } from "@/components/wizard/text-provider-fields";
import { cn } from "@/lib/utils";

type ApiKeysDialogProps = {
  open: boolean;
  requireFal: boolean;
  confirmationMode?: boolean;
  initialApiProvider: TextProvider;
  initialApiKey: string;
  initialFalKey: string;
  initialTmdbKey: string;
  onConfirm: (
    apiProvider: TextProvider,
    apiKey: string,
    falKey: string,
    tmdbKey: string,
  ) => void;
  onCancel: () => void;
};

export function ApiKeysDialog({
  open,
  requireFal,
  confirmationMode = false,
  initialApiProvider,
  initialApiKey,
  initialFalKey,
  initialTmdbKey,
  onConfirm,
  onCancel,
}: ApiKeysDialogProps) {
  const [apiProvider, setApiProvider] = useState<TextProvider>(initialApiProvider);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [falKey, setFalKey] = useState(initialFalKey);
  const [tmdbKey, setTmdbKey] = useState(initialTmdbKey);
  const [surface, setSurface] = useState<"default" | "paper">("default");

  // When the dialog (re)opens, sync from the provider's latest values.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      const supportedInitialProvider = confirmationMode &&
        !(["anthropic", "openai"] as TextProvider[]).includes(initialApiProvider)
        ? "openai"
        : initialApiProvider;
      setSurface(document.querySelector(".paper") ? "paper" : "default");
      setApiProvider(supportedInitialProvider);
      setApiKey(supportedInitialProvider === initialApiProvider ? initialApiKey : "");
      setFalKey(initialFalKey);
      setTmdbKey(initialTmdbKey);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, confirmationMode, initialApiProvider, initialApiKey, initialFalKey, initialTmdbKey]);

  const providerOption = getTextProviderOption(apiProvider);
  const isPaper = surface === "paper";
  const textProviderOk = apiKey.trim().length > 0;
  const falOk = falKey.trim().length > 0;
  const canSubmit = textProviderOk && (!requireFal || falOk);

  const estCost = falOk ? "Text + images" : "Text only";
  const estTime = falOk ? "~3–5 minutes" : "~2–4 minutes";

  const handleProviderChange = (nextProvider: TextProvider) => {
    if (nextProvider === apiProvider) return;
    setApiProvider(nextProvider);
    setApiKey("");
  };

  const inputClass = cn(
    "w-full px-3 py-2.5 font-mono text-[13px] placeholder:text-muted-foreground/50 focus:outline-none",
    isPaper
      ? "border border-border bg-background/60 text-foreground [border-radius:0!important] focus:border-foreground focus:ring-2 focus:ring-foreground/20"
      : "rounded-[8px] bg-card/60 shadow-pill focus:shadow-paper-hover",
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto sm:max-w-lg",
          isPaper &&
            "paper border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important]",
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn(
              "flex items-center gap-2 tracking-normal",
              isPaper && "form-sec-head text-[20px] text-foreground",
            )}
          >
            <Key size={16} className="text-muted-foreground" />
            {requireFal
              ? "fal.ai key required"
              : confirmationMode
                ? "Confirm screenplay extraction"
                : "Add API keys"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose one text provider and add the keys needed for this request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {!requireFal && (
            <div
              className={cn(
                "space-y-2 px-4 py-3.5",
                isPaper
                  ? "border border-[var(--paper-rule-soft)] bg-[var(--paper-sheet)] [border-radius:0!important]"
                  : "rounded-[10px] bg-muted/40",
              )}
            >
              <p className="text-[12px] text-foreground/70 leading-[1.55] tracking-normal">
                {confirmationMode
                  ? "This first text request extracts the screenplay into structured production data. Review the provider before it starts."
                  : "Your keys are saved in this browser. Scriptlook sends them only for the request you run and does not store them on its server."}
              </p>
              <div className="flex items-center gap-4 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/70">
                  <Clock size={11} /> {estTime}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/70">
                  <DollarSign size={11} /> {providerOption.label} · {estCost}
                </span>
              </div>
            </div>
          )}

          <TextProviderFields
            provider={apiProvider}
            apiKey={apiKey}
            onProviderChange={handleProviderChange}
            onApiKeyChange={setApiKey}
            autoFocus={!apiKey}
            surface={surface}
            showProviderModel={!confirmationMode}
            allowedProviders={confirmationMode ? ["anthropic", "openai"] : undefined}
          />

          {confirmationMode && (
            <div className="border border-foreground px-3 py-2.5 text-[12px]">
              Extraction model: {apiProvider === "openai"
                ? "GPT-5.4 Nano"
                : "Claude Haiku 4.5"}
            </div>
          )}

          {/* fal.ai */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-[13px] font-medium tracking-normal">
                fal.ai API key{" "}
                <span className="text-muted-foreground font-normal">
                  · {requireFal ? "required for images" : "optional"}
                </span>
              </label>
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Get a key ↗
              </a>
            </div>
            <p className="text-[11.5px] text-foreground/60 tracking-normal leading-[1.5]">
              {requireFal
                ? "Needed for this image only."
                : confirmationMode
                  ? "Makes image models available later. No images run during extraction."
                  : "Makes image generation available. Images still require a separate confirmation."}
            </p>
            <input
              type="password"
              placeholder="fal-..."
              value={falKey}
              onChange={(e) => setFalKey(e.target.value)}
              autoFocus={!!apiKey && requireFal && !falKey}
              className={inputClass}
            />
          </div>

          {/* TMDB — only shown on the general onboarding modal, not when a
              specific action is asking for fal credentials. */}
          {!requireFal && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <label className="text-[13px] font-medium tracking-normal">
                  TMDB API key{" "}
                  <span className="text-muted-foreground font-normal">· optional</span>
                </label>
                <a
                  href="https://www.themoviedb.org/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Get a key ↗
                </a>
              </div>
              <p className="text-[11.5px] text-foreground/60 tracking-normal leading-[1.5]">
                Adds poster thumbnails. Optional.
              </p>
              <input
                type="password"
                placeholder="TMDB API key (v3 auth)"
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <p className="text-[11px] text-foreground/45 tracking-normal leading-[1.5]">
            Edit keys anytime from Settings. They stay in this browser.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onCancel}
              className={cn(
                "inline-flex items-center justify-center px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                isPaper
                  ? "border border-transparent [border-radius:0!important] hover:border-foreground hover:bg-[var(--paper-highlight)]"
                  : "rounded-lg",
              )}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                canSubmit &&
                onConfirm(apiProvider, apiKey.trim(), falKey.trim(), tmdbKey.trim())
              }
              disabled={!canSubmit}
              className={cn(
                "inline-flex items-center justify-center bg-foreground px-5 py-2 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40",
                isPaper ? "[border-radius:0!important]" : "rounded-lg",
              )}
            >
              {requireFal && (!textProviderOk || !falOk)
                ? "Add required keys"
                : confirmationMode
                  ? "Extract screenplay"
                  : "Save and continue"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
