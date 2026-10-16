"use client";

import { Check, Layers3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DELIVERABLE_OPTIONS,
  DELIVERABLE_PRESETS,
  getGeneratedDocuments,
  resolveDeliverableDependencies,
  type DeliverableId,
} from "@/lib/deliverables";
import { cn } from "@/lib/utils";

type DeliverablesDialogProps = {
  open: boolean;
  selection: readonly DeliverableId[];
  onSelectionChange: (selection: DeliverableId[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeliverablesDialog({
  open,
  selection,
  onSelectionChange,
  onCancel,
  onConfirm,
}: DeliverablesDialogProps) {
  const selected = new Set(selection);
  const textRequestCount = getGeneratedDocuments(selection).length;
  const derivedCount = selection.filter((id) =>
    DELIVERABLE_OPTIONS.find((option) => option.id === id)?.source === "extraction",
  ).length;

  const toggleDeliverable = (id: DeliverableId) => {
    const next = new Set(selection);
    if (next.has(id)) {
      next.delete(id);
      if (id === "scenes") next.delete("storyboards");
    } else {
      next.add(id);
    }
    onSelectionChange(resolveDeliverableDependencies([...next]));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="paper max-h-[92vh] overflow-y-auto border-2 border-foreground bg-[var(--paper-sheet)] text-foreground shadow-[8px_8px_0_rgba(17,17,17,0.18)] [border-radius:0!important] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="form-sec-head flex items-center gap-2 text-[22px]">
            <Layers3 size={18} /> Choose your deliverables
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-foreground/65">
            Build only the parts you need. You can start with a preset and customize it below.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Deck presets">
          {DELIVERABLE_PRESETS.map((preset) => {
            const active = sameSelection(selection, preset.deliverables);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectionChange([...preset.deliverables])}
                className={cn(
                  "border-2 p-3 text-left transition-colors",
                  active
                    ? "border-foreground bg-[var(--paper-highlight)]"
                    : "border-[var(--paper-rule-soft)] hover:border-foreground",
                )}
              >
                <span className="block text-[13px] font-bold">{preset.label}</span>
                <span className="mt-1.5 block text-[11px] leading-relaxed text-foreground/65">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-foreground pb-2">
            <div>
              <h3 className="form-sec-head text-[17px]">Custom sections</h3>
              <p className="mt-1 text-[11px] text-foreground/60">Storyboard briefs automatically include the Scenes section.</p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/60">
              {selection.length} selected
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {DELIVERABLE_OPTIONS.map((option) => {
              const checked = selected.has(option.id);
              const isStoryboard = option.id === "storyboards";
              return (
                <label
                  key={option.id}
                  className={cn(
                    "relative flex cursor-pointer gap-3 border p-3 transition-colors",
                    checked
                      ? "border-foreground bg-[rgba(255,227,77,0.2)]"
                      : "border-[var(--paper-rule-soft)] hover:border-foreground",
                    isStoryboard && "sm:col-span-2 lg:col-span-3",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDeliverable(option.id)}
                    className="sr-only"
                  />
                  <span className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border",
                    checked ? "border-foreground bg-foreground text-background" : "border-foreground/45",
                  )}>
                    {checked && <Check size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[13px] font-bold">{option.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground/50">
                        {option.source}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-foreground/65">
                      {option.description}
                    </span>
                    {isStoryboard && checked && (
                      <span className="mt-2 block border-l-2 border-foreground pl-2 text-[11px] font-bold">
                        Largest potential image batch. Image generation remains off until separately confirmed.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/65">
            {textRequestCount} creative text {textRequestCount === 1 ? "section" : "sections"} · {derivedCount} extraction-based
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="min-h-10 border border-transparent px-4 text-[13px] hover:border-foreground">
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={selection.length === 0}
              className="min-h-10 border-2 border-foreground bg-foreground px-5 text-[13px] font-bold text-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue with {selection.length} selected
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function sameSelection(left: readonly DeliverableId[], right: readonly DeliverableId[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}
