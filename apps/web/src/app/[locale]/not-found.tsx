import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-app flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-7xl font-semibold text-ink-950">404</p>
      <p className="mt-4 text-sm text-ink-900/50">Sahifa topilmadi / Страница не найдена</p>
      <Link href="/uz" className="btn-primary mt-8">
        Bosh sahifa
      </Link>
    </div>
  );
}
