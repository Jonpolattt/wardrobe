import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@wardrobe/config';
export const locales = SUPPORTED_LOCALES;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = DEFAULT_LOCALE;

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
};
