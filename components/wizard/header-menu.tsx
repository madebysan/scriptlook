"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export function HeaderButton({
  icon,
  label,
  onClick,
  audioCue = "soft",
  title,
}: {
  icon: ReactNode;
  label?: string;
  onClick: () => void;
  audioCue?: "soft" | "open" | "select" | "toggle" | "success" | "confirm" | "cancel";
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label ?? title ?? "Header action"}
      data-ui-audio={audioCue}
      className="paper-motion-button inline-flex min-h-9 items-center justify-center gap-1.5 border border-foreground bg-[var(--paper-sheet)] px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-[var(--paper-highlight)] sm:px-3"
    >
      {icon}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

export type MenuItem =
  | { icon: ReactNode; label: string; onClick: () => void }
  | "divider"
  | null
  | false;

export function MoreMenu({
  items,
}: {
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Collapse consecutive dividers and drop trailing/leading ones so the menu
  // never renders an orphaned separator when conditional items are hidden.
  const cleaned: ({ icon: ReactNode; label: string; onClick: () => void } | "divider")[] = [];
  for (const it of items) {
    if (!it) continue;
    if (it === "divider") {
      if (cleaned.length === 0) continue;
      if (cleaned[cleaned.length - 1] === "divider") continue;
      cleaned.push("divider");
    } else {
      cleaned.push(it);
    }
  }
  while (cleaned.length && cleaned[cleaned.length - 1] === "divider") cleaned.pop();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="More options"
        aria-label="More options"
        aria-expanded={open}
        data-ui-audio="toggle"
        className="paper-motion-button inline-flex h-9 w-9 items-center justify-center border border-foreground bg-[var(--paper-sheet)] text-foreground transition-colors hover:bg-[var(--paper-highlight)]"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 min-w-[240px] border-2 border-foreground bg-[var(--paper-sheet)] py-1 shadow-[5px_5px_0_rgba(17,17,17,0.18)]">
          {cleaned.map((item, i) => {
            if (item === "divider") {
              return <div key={`d-${i}`} className="my-1 h-px bg-foreground/35" />;
            }
            return (
              <button
                type="button"
                key={`${i}-${item.label}`}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                data-ui-audio="select"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.05em] text-foreground/80 transition-colors hover:bg-[var(--paper-highlight)] hover:text-foreground"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
