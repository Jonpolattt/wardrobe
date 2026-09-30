// TEMPORARY UI/UX-testing helper — while the backend wasn't running/
// connected, every GraphQL auth call failed outright (network error / non-
// 2xx response) before it could reach real validation, which blocked
// clicking through the register/login/forgot-password/reset-password
// screens at all. While MOCK_AUTH_FALLBACK was true, each auth page caught
// that failure and fabricated a successful response instead.
//
// Turned OFF now that real testing against the real backend has started —
// this was exactly what made a real login failure (e.g. a genuine wrong
// password, or a backend error like the Prisma Client needing
// `npx prisma generate`) look like a successful login as a fake "Test
// Foydalanuvchi" account instead of showing the real error. Real real
// admin/user accounts and their data were never touched by this flag —
// it only ever affected what the *frontend* displayed after a failed call.
//
// Flip back to `true` only for genuine offline UI/UX click-through testing
// with no backend running at all — never while a real backend is up,
// since a real failure would then silently look like success again.
export const MOCK_AUTH_FALLBACK = false;

let mockUserCounter = 0;

export function mockAuthPayload(overrides: { email?: string; firstName?: string; lastName?: string } = {}) {
  mockUserCounter += 1;
  return {
    accessToken: `mock-access-token-${mockUserCounter}`,
    refreshToken: `mock-refresh-token-${mockUserCounter}`,
    user: {
      id: `mock-user-${mockUserCounter}`,
      email: overrides.email ?? 'test@example.com',
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Foydalanuvchi',
      role: 'USER' as const,
    },
  };
}

// Mirrors AuthService.detectIdentifierType on the backend closely enough
// for mock purposes: anything with an '@' is treated as an email, anything
// else as a phone number.
export function mockDetectIdentifierType(identifier: string): 'PHONE' | 'EMAIL' {
  return identifier.includes('@') ? 'EMAIL' : 'PHONE';
}
