/** Public format checks only; verification, authorization and pricing remain server-owned. */
export const UZ_PHONE_REGEX = /^\+998\d{9}$/;
export const OTP_REGEX = /^\d{5}$/;
export function normalizeUzPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 9 ? `+998${digits}` : `+${digits}`;
}
export function isUzPhone(value: string): boolean { return UZ_PHONE_REGEX.test(normalizeUzPhone(value)); }
export function isIdentifier(value: string): boolean { return isUzPhone(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function isPassword(value: string): boolean { return value.length >= 6; }
export function isName(value: string): boolean { return value.trim().length >= 2 && /^[^0-9]+$/.test(value.trim()); }
export function isRegistrationEmail(value: string): boolean { return value.trim() === '' || /^[^\s@]+@gmail\.com$/.test(value.trim().toLowerCase()); }
export function isAddress(value: string): boolean { return value.trim().length >= 5; }
export function isQuantity(value: number): boolean { return Number.isInteger(value) && value >= 1; }
