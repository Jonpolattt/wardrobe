/** Public brand configuration only. No environment reads and no server credentials. */
export const SITE_NAME = 'Wardrobe Store';
export const SITE_ORIGIN = 'https://wardrobestore.uz';
export const SUPPORTED_LOCALES = ['uz', 'ru'] as const;
export const DEFAULT_LOCALE = 'uz' as const;
export const MOBILE_SCHEME = 'wardrobe';

export function apiEndpoint(value: string | undefined, release = false): string {
  if (!value?.trim()) throw new Error('API_NOT_CONFIGURED');
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_API_URL');
  if (release && url.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
  return url.toString().replace(/\/$/, '');
}

/** Resolve backend upload paths without depending on Next.js rewrites. */
export function assetUrl(value: string | null | undefined, endpoint: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, endpoint ? new URL(endpoint).origin : undefined);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined;
  } catch { return undefined; }
}
