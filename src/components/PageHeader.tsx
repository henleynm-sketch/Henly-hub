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
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
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
    warn: "text-amber-600 dark:text-amber-450",
  };
  
  return (
    <div className="p-5 glass-card">
      <div className="label text-ink-soft">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tones[tone]}`}>
        <CountUp value={value} />
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
