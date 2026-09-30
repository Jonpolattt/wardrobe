/** Parse an existing positive whole-number ml label without platform APIs. */
export function parseMl(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = /^(\d+)\s*ml$/i.exec(String(size).trim());
  if (!match) return null;
  const ml = Number(match[1]);
  return Number.isFinite(ml) && ml > 0 ? ml : null;
}
export { formatPrice, formatDate } from './format';
