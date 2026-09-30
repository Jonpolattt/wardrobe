import type { Locale } from './config';

const dictionaries = {
  uz: () => import('./dictionaries/uz.json').then((m) => m.default),
  ru: () => import('./dictionaries/ru.json').then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['uz']>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries.uz;
  return loader();
}
