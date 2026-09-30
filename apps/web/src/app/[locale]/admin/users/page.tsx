'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Search, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { GET_USERS } from '@/lib/graphql/queries';
import { SET_USER_ACTIVE, REMOVE_USER } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { formatDate } from '@/lib/utils/format';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

export default function AdminUsersPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, loading, refetch } = useQuery(GET_USERS, {
    variables: { filter: { page: 1, limit: 200, search: search || undefined, role: roleFilter || undefined } },
    // Keeps the "online now" figure on the dashboard and this list from
    // silently drifting apart while an admin leaves this tab open.
    pollInterval: 15000,
  });
  const [setUserActive] = useMutation(SET_USER_ACTIVE);
  const [removeUser] = useMutation(REMOVE_USER);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const users = data?.users?.list ?? [];
  const total = data?.users?.total ?? 0;

  async function handleToggleActive(id: string, currentlyActive: boolean) {
    const confirmMsg = currentlyActive ? dict.admin.confirmBlock : dict.admin.confirmUnblock;
    // eslint-disable-next-line no-alert
    if (!confirm(confirmMsg)) return;
    setUpdatingId(id);
    try {
      await setUserActive({ variables: { id, isActive: !currentlyActive } });
      await refetch();
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(getFriendlyErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  }

  // Blokdan farqli — foydalanuvchini bazadan butunlay o'chiradi, shuning
  // uchun uning telefon raqami darhol bo'shab, o'sha raqam bilan qaytadan
  // ro'yxatdan o'tish mumkin bo'ladi. Buyurtma tarixi bor foydalanuvchini
  // backend rad etadi (getFriendlyErrorMessage o'sha xabarni ko'rsatadi).
  async function handleDelete(id: string) {
    // eslint-disable-next-line no-alert
    if (!confirm(dict.admin.confirmDeleteUser)) return;
    setDeletingId(id);
    try {
      await removeUser({ variables: { id } });
      await refetch();
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(getFriendlyErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">
          {dict.admin.users} <span className="text-base font-normal text-ink-900/40">({total})</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={dict.product.searchPlaceholder}
              className="rounded-full border border-ink-900/15 bg-white py-2 pl-8 pr-4 text-xs text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-xs font-semibold text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream"
          >
            <option value="">{dict.admin.allStatuses}</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">{dict.admin.customer}</option>
          </select>
        </div>
      </div>

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[1260px] text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-left text-xs uppercase tracking-wider text-ink-900/40">
              <th className="px-5 py-4">{dict.admin.userName}</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">{dict.admin.phone}</th>
              <th className="px-5 py-4">{dict.admin.address}</th>
              <th className="px-5 py-4">{dict.admin.role}</th>
              <th className="px-5 py-4">{dict.admin.ordersCount}</th>
              <th className="px-5 py-4">{dict.orders.date}</th>
              <th className="px-5 py-4">{dict.admin.onlineUsers}</th>
              <th className="px-5 py-4">{dict.admin.accountStatus}</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {/* No `!loading` guard here on purpose: a search keystroke or the
                15s poll flips `loading` back to true, and gating the rows on
                it made the whole table blank out for a moment on every
                refresh — same bug as the admin dashboard. Keep rendering the
                last-known `users` list while a refetch is in flight. */}
            {users.map((u: any) => {
              const online = u.lastSeenAt && Date.now() - new Date(u.lastSeenAt).getTime() < 5 * 60 * 1000;
              return (
                <tr key={u.id} className="border-b border-ink-900/5 last:border-0">
                  <td className="px-5 py-4 font-semibold">
                    {u.firstName} {u.lastName ?? ''}
                  </td>
                  <td className="px-5 py-4 text-ink-900/60">{u.email}</td>
                  <td className="px-5 py-4 text-ink-900/60">{u.phone ?? '—'}</td>
                  <td className="px-5 py-4 text-ink-900/60">{u.address ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        u.role === 'ADMIN'
                          ? 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-300'
                          : 'bg-ink-900/5 text-ink-900/60 dark:bg-cream/10 dark:text-cream/60'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-900/60">{u.ordersCount ?? 0}</td>
                  <td className="px-5 py-4 text-ink-900/60">{formatDate(u.createdAt, locale)}</td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${online ? 'text-emerald-600' : 'text-ink-900/30'}`}>
                      <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-ink-900/20'}`} />
                      {online ? dict.admin.onlineUsers : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        u.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {u.isActive ? dict.admin.active : dict.admin.blocked}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {currentUser?.id !== u.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
                          disabled={updatingId === u.id || deletingId === u.id}
                          title={u.isActive ? dict.admin.block : dict.admin.unblock}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-50 ${
                            u.isActive
                              ? 'border-ink-900/10 text-red-500 hover:border-red-500'
                              : 'border-ink-900/10 text-emerald-600 hover:border-emerald-500'
                          }`}
                        >
                          {u.isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={updatingId === u.id || deletingId === u.id}
                          title={dict.admin.deleteUser}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-900/10 text-ink-900/40 hover:border-red-500 hover:text-red-500 disabled:opacity-50 dark:text-cream/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && users.length === 0 && <p className="p-8 text-center text-sm text-ink-900/40">{dict.orders.empty}</p>}
      </div>
    </div>
  );
}
