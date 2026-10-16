"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SectionLabelPill } from "@/components/ui/inline-chip";

export type DepartmentSignal = {
  label: string;
  value: string | number;
};

export type DepartmentLensProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  primaryRole: string;
  supportRole?: string;
  focus: string;
  signals?: DepartmentSignal[];
};

export function DepartmentLens({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  primaryRole,
  supportRole,
  focus,
  signals = [],
}: DepartmentLensProps) {
  return (
    <section className="mb-10 border-b-2 border-foreground pb-8">
      <div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
          <div className="max-w-[62ch]">
            <SectionLabelPill icon={<Icon size={11} />} className="mb-4">
              {eyebrow}
            </SectionLabelPill>
            <h1 className="form-sec-head text-[34px] leading-[1.02] text-foreground md:text-[44px]">
              {title}
            </h1>
            <p className="mt-4 text-[16px] leading-[1.65] text-foreground/62">
              {subtitle}
            </p>
          </div>

          <div className="w-full">
            <div className="border border-foreground bg-transparent">
              <div className="space-y-2">
                <RoleLine label="Lead" value={primaryRole} />
                {supportRole && <RoleLine label="Support" value={supportRole} />}
                <RoleLine label="Reads For" value={focus} />
              </div>
            </div>
          </div>
        </div>

        {signals.length > 0 && (
          <div className="mt-7 grid overflow-hidden border border-foreground md:grid-cols-3">
            {signals.map((signal) => (
              <div key={signal.label} className="border-b border-foreground bg-transparent px-4 py-3.5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {signal.label}
                </div>
                <div className="form-sec-head mt-1.5 text-[24px] leading-none text-foreground tabular-nums">
                  {signal.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RoleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_1fr] gap-3 border-b border-foreground/25 px-3 py-2 last:border-b-0">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[13px] leading-[1.45] text-foreground/75">
        {value}
      </span>
    </div>
  );
}

export function ReportPanel({
  eyebrow,
  title,
  children,
  meta,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-foreground bg-transparent p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h2 className="form-sec-head text-[17px] leading-tight text-foreground">
            {title}
          </h2>
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function EvidencePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-border bg-background/35 px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}
