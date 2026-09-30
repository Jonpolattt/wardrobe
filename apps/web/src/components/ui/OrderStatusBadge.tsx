import type { Dictionary } from '@/i18n/get-dictionary';

const STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const KEYS: Record<string, keyof Dictionary['orders']> = {
  PENDING: 'statusPending',
  PROCESSING: 'statusProcessing',
  SHIPPED: 'statusShipped',
  DELIVERED: 'statusDelivered',
  CANCELLED: 'statusCancelled',
};

// `compact` shrinks the padding/text size to match the smaller payment-
// status pill it sits next to on the profile page's order cards — every
// other usage (standalone /orders, admin orders table, admin dashboard)
// omits it and keeps the original size unchanged. The compact branch still
// grows back up at `lg:` — the profile order cards are only cramped on
// phones/tablets; on desktop there's plenty of room, so this badge (and
// the card around it) can go back to a comfortable size there.
export function OrderStatusBadge({ status, dict, compact = false }: { status: string; dict: Dictionary; compact?: boolean }) {
  return (
    <span
      className={`rounded-full font-bold ${compact ? 'px-2 py-0.5 text-[10px] lg:px-3 lg:py-1 lg:text-xs' : 'px-3 py-1 text-xs'} ${
        STYLES[status] ?? 'bg-ink-900/10 text-ink-900'
      }`}
    >
      {dict.orders[KEYS[status]] ?? status}
    </span>
  );
}
