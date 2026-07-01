import { CountUp } from "@/components/CountUp";

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-start justify-between gap-3 px-6 py-5 glass-base">
      <div>
        <h1 className="hh-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 hh-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  const tones = {
    default: "text-ink",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
  };
  
  return (
    <div className="hh-panel">
      <div className="hh-label">{label}</div>
      <div className={`hh-display mt-1 text-3xl font-semibold tracking-tight tabular-nums ${tones[tone]}`}>
        <CountUp value={value} />
      </div>
      {hint && <div className="mt-1 hh-caption">{hint}</div>}
    </div>
  );
}
