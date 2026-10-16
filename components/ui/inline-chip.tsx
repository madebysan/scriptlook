/**
 * Small uppercase production-form coordinate label.
 */
export function SectionLabelPill({
  icon,
  children,
  className = "",
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${className}`}
    >
      {icon}
      {children}
    </div>
  );
}
