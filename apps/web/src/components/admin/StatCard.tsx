import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  live,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  live?: boolean;
}) {
  return (
    <div className="card-surface flex items-center gap-4 p-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: accent ?? '#111114' }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-900/50">
          {label}
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
        </p>
        <p className="text-xl font-bold text-ink-950">{value}</p>
      </div>
    </div>
  );
}
