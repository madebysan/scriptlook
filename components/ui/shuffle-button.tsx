"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Check } from "lucide-react";

// Reusable Shuffle/Regenerate button with consistent feedback states:
//   idle      → RefreshCw icon, "Shuffle" label
//   loading   → spinner, dimmed label
//   succeeded → Check icon for ~1.5s, then back to idle
//
// Pair with `useShuffleState` for parent-side dimming of the regenerated content.

type ShuffleButtonProps = {
  onClick: () => void | Promise<void>;
  state: "idle" | "loading" | "succeeded";
  label?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
};

export function ShuffleButton({
  onClick,
  state,
  label = "Shuffle",
  title,
  className = "",
  disabled,
}: ShuffleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || state === "loading"}
      title={title}
      data-ui-audio="toggle"
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-out ${className}`}
      aria-busy={state === "loading"}
    >
      {state === "loading" ? (
        <Loader2 size={11} className="animate-spin motion-reduce:animate-none" />
      ) : state === "succeeded" ? (
        <Check size={11} className="report-motion-status text-foreground" />
      ) : (
        <RefreshCw size={11} />
      )}
      <span className="report-motion-status" key={state}>
        {state === "succeeded" ? "Updated" : label}
      </span>
    </button>
  );
}

// Hook that wraps a section regen call with idle → loading → succeeded state
// transitions and optimistic feedback. The success state auto-clears after
// a short delay so future shuffles start fresh.
export function useShuffleState() {
  const [state, setState] = useState<"idle" | "loading" | "succeeded">("idle");

  useEffect(() => {
    if (state !== "succeeded") return;
    const t = setTimeout(() => setState("idle"), 1500);
    return () => clearTimeout(t);
  }, [state]);

  async function run(action: () => Promise<void>) {
    setState("loading");
    try {
      await action();
      setState("succeeded");
    } catch (e) {
      console.error("Shuffle action failed", e);
      setState("idle");
    }
  }

  return { state, run };
}
