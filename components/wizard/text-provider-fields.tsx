"use client";

import { Check } from "lucide-react";
import {
  TEXT_PROVIDER_OPTIONS,
  getTextProviderOption,
  type TextProvider,
} from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

type TextProviderFieldsProps = {
  provider: TextProvider;
  apiKey: string;
  onProviderChange: (provider: TextProvider) => void;
  onApiKeyChange: (apiKey: string) => void;
  model?: string;
  onModelChange?: (model: string) => void;
  autoFocus?: boolean;
  surface?: "default" | "paper";
  showProviderModel?: boolean;
  allowedProviders?: readonly TextProvider[];
};

export function TextProviderFields({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  model,
  onModelChange,
  autoFocus = false,
  surface = "default",
  showProviderModel = true,
  allowedProviders,
}: TextProviderFieldsProps) {
  const activeOption = getTextProviderOption(provider);
  const isPaper = surface === "paper";
  const visibleOptions = TEXT_PROVIDER_OPTIONS.filter(
    (option) => !allowedProviders || allowedProviders.includes(option.id),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium tracking-normal">Text provider</div>
          <p className="mt-0.5 text-[11.5px] leading-[1.5] tracking-normal text-foreground/55">
            One active provider at a time.
          </p>
        </div>
        <a
          href={activeOption.keyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Get a key ↗
        </a>
      </div>

      <div
        role="radiogroup"
        aria-label="Text provider"
        className="grid gap-2 sm:grid-cols-2"
      >
        {visibleOptions.map((option) => {
          const selected = option.id === provider;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onProviderChange(option.id)}
              className={cn(
                "border p-3 text-left transition-colors",
                isPaper
                  ? "bg-[var(--paper-sheet)] [border-radius:0!important] hover:bg-[rgba(255,227,77,0.14)]"
                  : "rounded-[10px]",
                selected
                  ? isPaper
                    ? "border-foreground bg-[var(--paper-highlight)] text-foreground"
                    : "border-foreground/22 bg-white/[0.06] text-foreground"
                  : isPaper
                    ? "border-[var(--paper-rule-soft)] text-muted-foreground hover:border-foreground hover:text-foreground"
                    : "border-border/70 bg-card/40 text-muted-foreground hover:border-foreground/16 hover:bg-white/[0.035] hover:text-foreground",
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[13px] font-medium tracking-normal">
                    {option.label}
                  </span>
                  {showProviderModel && (
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] opacity-60">
                      {option.model}
                    </span>
                  )}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-transparent"
                  }`}
                >
                  {selected && <Check size={11} />}
                </span>
              </span>
              <span className="mt-2 block text-[11.5px] leading-[1.45] tracking-normal opacity-70">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {model && onModelChange && (
        <div className="space-y-2">
          <label htmlFor="text-model" className="text-[13px] font-medium tracking-normal">
            Text model <span className="font-normal text-muted-foreground">· confirm before running</span>
          </label>
          <select
            id="text-model"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            className={cn(
              "w-full px-3 py-2.5 font-mono text-[12px] focus:outline-none",
              isPaper
                ? "border border-border bg-background/60 text-foreground [border-radius:0!important] focus:border-foreground focus:ring-2 focus:ring-foreground/20"
                : "rounded-[8px] bg-card/60 shadow-pill focus:shadow-paper-hover",
            )}
          >
            {activeOption.models.map((modelOption) => (
              <option key={modelOption.id} value={modelOption.id}>
                {modelOption.label} · {modelOption.tier}
              </option>
            ))}
          </select>
          <p className="text-[11.5px] leading-[1.5] text-foreground/60">
            {activeOption.models.find((option) => option.id === model)?.description}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[13px] font-medium tracking-normal">
          {activeOption.keyLabel}{" "}
          <span className="font-normal text-muted-foreground">· required</span>
        </label>
        <input
          type="password"
          placeholder={activeOption.placeholder}
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          autoFocus={autoFocus}
          className={cn(
            "w-full px-3 py-2.5 font-mono text-[13px] placeholder:text-muted-foreground/50 focus:outline-none",
            isPaper
              ? "border border-border bg-background/60 text-foreground [border-radius:0!important] focus:border-foreground focus:ring-2 focus:ring-foreground/20"
              : "rounded-[8px] bg-card/60 shadow-pill focus:shadow-paper-hover",
          )}
        />
      </div>
    </div>
  );
}
