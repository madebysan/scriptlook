type SectionHeadProps = {
  children: React.ReactNode;
  index?: number;
  label?: string;
  labelIcon?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
};

export function SectionHead({
  children,
  index,
  label,
  labelIcon,
  meta,
  className = "",
}: SectionHeadProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {label && (
        <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {labelIcon}
          {label}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-3 border-b border-border/80 pb-3 sm:flex-nowrap">
        {typeof index === "number" && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {index.toString().padStart(2, "0")}
          </span>
        )}
        <h2 className="min-w-0 flex-1 text-[16px] font-semibold text-foreground">
          {children}
        </h2>
        {meta && (
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:shrink-0">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
