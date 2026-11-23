"use client";

// Small paper-form pieces shared by Settings and the run confirmations, so
// every key field, provider row and ruled row looks and behaves the same.

import { getTextProviderOption, type TextProvider } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

export const SHEET_CLASS =
  "paper border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important]";

export const FIELD_CLASS =
  "w-full border border-border bg-background/60 px-3 py-2.5 font-mono text-[13px] text-foreground placeholder:text-muted-foreground/50 [border-radius:0!important] focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

export const SELECT_CLASS =
  "w-full border border-border bg-background/60 px-3 py-2 font-mono text-[12px] font-normal text-foreground [border-radius:0!important] focus:border-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

export const LABEL_CLASS = "text-[13px] font-medium tracking-normal";

export const HINT_CLASS = "text-[11.5px] leading-[1.5] tracking-normal text-foreground/60";

export const LINK_CLASS =
  "shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center border-2 border-foreground bg-foreground px-5 text-[13px] font-bold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40";

export const QUIET_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center border border-transparent px-4 text-[13px] transition-colors hover:border-foreground";

// One row of provider names. The one in use is highlighted; a small ink square
// marks a provider whose key is already saved.
export function ProviderCells({
  providers,
  value,
  savedProviders = [],
  onChange,
  label,
}: {
  providers: readonly TextProvider[];
  value: TextProvider;
  savedProviders?: readonly TextProvider[];
  onChange: (provider: TextProvider) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid border-2 border-foreground"
      style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}
    >
      {providers.map((provider, index) => {
        const selected = provider === value;
        const saved = savedProviders.includes(provider);
        return (
          <button
            key={provider}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(provider)}
            className={cn(
              "form-sec-head flex min-h-10 items-center justify-center gap-2 px-2 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground",
              index > 0 && "border-l border-foreground",
              selected ? "bg-[var(--paper-highlight)]" : "hover:bg-[rgba(255,227,77,0.18)]",
            )}
          >
            {getTextProviderOption(provider).label}
            {saved && (
              <>
                <span aria-hidden className="inline-block size-[6px] bg-foreground" />
                <span className="sr-only">(key saved)</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

// A ruled label / value row, the way a form states a fact: MODEL | Claude ...
export function FormRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 border-b border-[var(--paper-rule-soft)] py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
      <label
        htmlFor={htmlFor}
        className="form-sec-head text-[11px] tracking-[0.14em] text-foreground/65"
      >
        {label}
      </label>
      <div className="min-w-0 text-[13px] font-bold">{children}</div>
    </div>
  );
}

// Label on the left, "Get a key" on the right, then the field.
export function KeyField({
  id,
  label,
  qualifier,
  keyUrl,
  placeholder,
  value,
  onChange,
  autoFocus = false,
}: {
  id: string;
  label: string;
  qualifier?: string;
  keyUrl: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
          {qualifier && <span className="font-normal text-muted-foreground"> · {qualifier}</span>}
        </label>
        <a href={keyUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Get a key ↗
        </a>
      </div>
      <input
        id={id}
        type="password"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        className={FIELD_CLASS}
      />
    </div>
  );
}
