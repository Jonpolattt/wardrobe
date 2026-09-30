import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminGuard } from '@/components/admin/AdminGuard';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const dict = await getDictionary(params.locale);

  return (
    <AdminGuard locale={params.locale}>
      <AdminShell locale={params.locale} dict={dict}>
        {children}
      </AdminShell>
    </AdminGuard>
  );
}
