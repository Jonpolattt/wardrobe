'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const mobileRoot = path.resolve(__dirname, '..', '..', '..');
const ts = createRequire(path.join(mobileRoot, 'package.json'))('typescript');
const source = path.join(__dirname, '..', 'deep-links.ts');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, URLSearchParams, decodeURIComponent, encodeURIComponent }, { filename: source });
const { safeOrderId, safeProductSlug, paymentOrderId, paymentReturnPath, safeSignedInDestination, safeContinuationPath } = loaded.exports;
const clean = value => typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
const ID = '20000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';
const FALLBACK = '/(tabs)/profile';

test('payment identifiers reject malformed, repeated, and conflicting parameters', () => {
  assert.equal(paymentOrderId({ orderId: ID }), ID);
  assert.equal(paymentOrderId({ id: ID }), ID);
  assert.equal(paymentOrderId({ orderId: ID, id: ID }), ID);
  assert.equal(paymentOrderId({ orderId: ID, id: OTHER }), undefined);
  assert.equal(paymentOrderId({ orderId: [ID, ID] }), undefined);
  assert.equal(paymentOrderId({ orderId: 'invalid', id: ID }), undefined);
  assert.equal(paymentOrderId({}), undefined);
  for (const input of ['../orders', 'https://evil.invalid', ID + '\n', '', ID + '?paid=true']) assert.equal(safeOrderId(input), undefined);
});

test('payment login continuation preserves only its validated order identifier', () => {
  assert.equal(paymentReturnPath({ orderId: ID }), '/payment-return?orderId=' + ID);
  assert.deepEqual(clean(safeSignedInDestination('/payment-return?orderId=' + ID + '&paid=true&status=PAID&token=ignored')), { pathname: '/payment-return', params: { orderId: ID } });
  assert.equal(safeContinuationPath('/payment-return?orderId=' + ID + '&paid=true'), '/payment-return?orderId=' + ID);
  assert.equal(safeSignedInDestination('/payment-return?orderId=' + ID + '&orderId=' + ID), FALLBACK);
  assert.equal(safeSignedInDestination('/payment-return?orderId=' + ID + '&id=' + OTHER), FALLBACK);
});

test('known private routes and order links produce literal internal destinations', () => {
  assert.equal(safeSignedInDestination('/cart'), '/(tabs)/cart');
  assert.equal(safeSignedInDestination('/(tabs)/favorites'), '/(tabs)/favorites');
  assert.equal(safeSignedInDestination('/orders'), '/orders');
  assert.equal(safeSignedInDestination('/profile/edit'), '/profile/edit');
  assert.deepEqual(clean(safeSignedInDestination('/orders/' + ID)), { pathname: '/orders/[id]', params: { id: ID } });
  assert.equal(safeContinuationPath('/orders/' + ID), '/orders/' + ID);
});

test('product continuation decodes exactly one safe bounded slug segment', () => {
  assert.deepEqual(clean(safeSignedInDestination('/product/test-perfume_10ml')), { pathname: '/product/[slug]', params: { slug: 'test-perfume_10ml' } });
  assert.deepEqual(clean(safeSignedInDestination('/product/parf%C3%BCm')), { pathname: '/product/[slug]', params: { slug: 'parfüm' } });
  assert.equal(safeSignedInDestination('/product/a%2Fcheckout'), FALLBACK);
  assert.equal(safeSignedInDestination('/product/a%5Ccheckout'), FALLBACK);
  assert.equal(safeSignedInDestination('/product/%252Fcheckout'), FALLBACK);
  assert.equal(safeProductSlug('a'.repeat(201)), undefined);
  assert.equal(safeProductSlug(['first', 'second']), undefined);
});

test('checkout continuation keeps only bounded UUID item selections', () => {
  assert.deepEqual(clean(safeSignedInDestination('/checkout?items=' + ID + ',' + OTHER + '&total=1')), { pathname: '/checkout', params: { items: ID + ',' + OTHER } });
  assert.deepEqual(clean(safeSignedInDestination('/checkout?items=' + ID + ',' + ID)), { pathname: '/checkout', params: { items: ID } });
  assert.equal(safeSignedInDestination('/checkout?items='), FALLBACK);
  assert.equal(safeSignedInDestination('/checkout?items=not-a-uuid'), FALLBACK);
  assert.equal(safeSignedInDestination('/checkout?items=' + ID + '&items=' + OTHER), FALLBACK);
  assert.equal(safeSignedInDestination('/checkout?items=' + Array(101).fill(ID).join(',')), FALLBACK);
});

test('untrusted redirects, traversal, secret routes, and oversized inputs fall back', () => {
  for (const value of [
    'https://evil.invalid/orders/' + ID, '//evil.invalid', 'javascript:alert(1)',
    '/orders/../profile', '/orders/%2e%2e/profile', '/product/%2e%2e', '/cart\\evil',
    '/auth/reset-password?token=opaque-secret', '/admin/orders', '/unknown',
    '/orders/' + ID + '#fragment', '/cart\n', ' /cart', '/cart' + 'x'.repeat(4096),
    ['/cart', '/orders'],
  ]) assert.equal(safeSignedInDestination(value), FALLBACK);
});