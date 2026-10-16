"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Check } from "lucide-react";

// Inline-editable text. Hover reveals a pencil; click enters edit mode.
//   - Enter saves (single-line mode)
//   - Shift+Enter inserts newline (multiline)
//   - Escape cancels
//   - Blur saves
//
// The parent decides the display markup (renderDisplay) — this component only
// owns the edit affordance + input/textarea swap.

type EditableTextProps = {
  value: string;
  onSave: (next: string) => void;
  editable?: boolean;
  multiline?: boolean;
  multilineSize?: "compact" | "medium" | "long";
  placeholder?: string;
  title?: string;
  renderDisplay: (value: string) => React.ReactNode;
  inputClassName?: string;
  containerClassName?: string;
  pencilSize?: number;
  // Reveal pencil always vs. on container hover. "always" is useful for dense
  // inline fields where hover discovery is unreliable.
  pencilVisibility?: "always" | "hover";
};

export function EditableText({
  value,
  onSave,
  editable = true,
  multiline = false,
  multilineSize = "medium",
  placeholder,
  title,
  renderDisplay,
  inputClassName = "",
  containerClassName = "",
  pencilSize = 11,
  pencilVisibility = "hover",
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const multilineClassName = {
    compact: "min-h-[4.5rem]",
    medium: "min-h-[7rem]",
    long: "min-h-[10rem]",
  }[multilineSize];
  const multilineRows = { compact: 2, medium: 4, long: 6 }[multilineSize];

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      } else {
        inputRef.current.setSelectionRange(0, inputRef.current.value.length);
      }
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
      return;
    }
    if (multiline && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  if (editing) {
    return (
      <div className={`flex items-start gap-2 ${containerClassName}`}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            placeholder={placeholder}
            rows={multilineRows}
            className={`flex-1 max-h-[28rem] ${multilineClassName} [field-sizing:content] resize-y overflow-y-auto rounded-[6px] border border-border bg-background/60 px-3 py-2 text-inherit tracking-normal focus:border-foreground/40 focus:outline-none ${inputClassName}`}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
            placeholder={placeholder}
            className={`flex-1 rounded-[6px] bg-background/60 border border-border px-2 py-0.5 text-inherit tracking-normal focus:outline-none focus:border-foreground/40 ${inputClassName}`}
          />
        )}
        <button
          onMouseDown={(e) => {
            // Prevent the textarea's onBlur from firing before commit runs.
            e.preventDefault();
            commit();
          }}
          className="shrink-0 text-muted-foreground hover:text-foreground mt-1"
          title={multiline ? "Save (⌘+Enter)" : "Save (Enter)"}
        >
          <Check size={pencilSize} />
        </button>
      </div>
    );
  }

  if (!editable) {
    return <>{renderDisplay(value)}</>;
  }

  return (
    <div className={`group relative ${containerClassName}`}>
      <button
        onClick={() => setEditing(true)}
        title={title || "Click to edit"}
        className="block w-full text-left cursor-text"
      >
        {renderDisplay(value)}
      </button>
      <button
        onClick={() => setEditing(true)}
        title={title || "Edit"}
        className={`absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-opacity ${
          pencilVisibility === "always" ? "opacity-60" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <Pencil size={pencilSize} />
      </button>
    </div>
  );
}
