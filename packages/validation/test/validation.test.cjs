const { test } = require('node:test');
const assert = require('node:assert/strict');
const v = require('../dist');
test('Uzbek phone input normalizes formatting but rejects wrong countries and length', () => {
  assert.equal(v.normalizeUzPhone('90 123 45 67'), '+998901234567');
  assert.equal(v.isUzPhone('+998 (90) 123-45-67'), true);
  assert.equal(v.isUzPhone('+74951234567'), false);
  assert.equal(v.isUzPhone('90123'), false);
});
test('registration mirrors required name/password/Gmail and five-digit OTP shapes', () => {
  assert.equal(v.isName('Алишер'), true); assert.equal(v.isName('Ali1'), false);
  assert.equal(v.isPassword('12345'), false); assert.equal(v.isPassword('123456'), true);
  assert.equal(v.isRegistrationEmail(''), true); assert.equal(v.isRegistrationEmail('a@example.com'), false);
  assert.equal(v.OTP_REGEX.test('12345'), true); assert.equal(v.OTP_REGEX.test('123456'), false);
});
test('checkout rejects missing address and fractional/nonpositive quantities', () => {
  assert.equal(v.isAddress('abc'), false); assert.equal(v.isAddress('Toshkent, 12'), true);
  for (const x of [0, -1, 1.5, NaN]) assert.equal(v.isQuantity(x), false);
  assert.equal(v.isQuantity(1), true);
});
