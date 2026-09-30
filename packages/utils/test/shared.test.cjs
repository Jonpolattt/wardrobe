const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const shared = require('../dist/index.js');
const types = require('../../types/dist/index.js');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/server/node_modules/typescript'));

function pricingModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } }).outputText;
  const output = { exports: {} };
  vm.runInNewContext(compiled, { module: output, exports: output.exports, require(name) {
    assert.equal(name, '@wardrobe/utils', 'pricing helpers must stay free of infrastructure imports');
    return shared;
  } }, { filename });
  return output.exports;
}
const web = pricingModule('apps/web/src/lib/utils/variantPrice.ts');
const server = pricingModule('apps/server/src/common/utils/variant-price.util.ts');

test('volume parsing keeps existing accepted labels and rejects non-volume/zero input', () => {
  for (const [label, volume] of [['50ml', 50], [' 20 mL ', 20], ['001ml', 1]]) assert.equal(shared.parseMl(label), volume);
  for (const label of [null, undefined, '', '0ml', '-10ml', '10.5ml', 'XL', '42', '10ml trailing']) assert.equal(shared.parseMl(label), null);
  assert.equal(web.parseMl, shared.parseMl);
  assert.equal(server.parseMl, shared.parseMl);
});

test('existing API enum names and values remain unchanged', () => {
  assert.deepEqual(Object.values(types.Role), ['ADMIN', 'USER']);
  assert.deepEqual(Object.values(types.OrderStatus), ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
  assert.deepEqual(Object.values(types.PaymentMethod), ['CLICK', 'PAYME', 'CASH']);
  assert.deepEqual(Object.values(types.PaymentStatus), ['PENDING', 'PAID', 'FAILED']);
});

test('explicit variant prices continue to override volume-derived prices', () => {
  const product = { price: 275000, sizes: ['10ml', '20ml'], variants: [{ size: '10ml', color: '', price: null }, { size: '20ml', color: '', price: 400000 }] };
  assert.equal(web.resolveUnitPrice(product, '20ml', ''), 400000);
  assert.equal(server.resolveUnitPrice(product, '20ml', ''), 400000);
});

test('volume fallback and ordinary clothing prices remain unchanged', () => {
  const perfume = { price: 275000, variants: [{ size: '10ml', color: '', price: null }] };
  assert.equal(web.resolveUnitPrice(perfume, '20ml', ''), 550000);
  assert.equal(server.resolveUnitPrice(perfume, '20ml', ''), 550000);
  const clothing = { price: 125000, variants: [{ size: 'XL', color: 'black', price: null }] };
  assert.equal(web.resolveUnitPrice(clothing, 'XL', 'black'), 125000);
  assert.equal(server.resolveUnitPrice(clothing, 'XL', 'black'), 125000);
});

test('existing web size-list versus backend variant-list distinction is preserved', () => {
  const product = { price: 275000, sizes: ['10ml', '20ml'], variants: [{ size: '20ml', color: '', price: null }] };
  assert.equal(web.baseVolumeMl(product), 10);
  assert.equal(server.baseVolumeMl(product), 20);
  assert.equal(web.resolveUnitPrice(product, '20ml', ''), 550000);
  assert.equal(server.resolveUnitPrice(product, '20ml', ''), 275000);
});

test('backend Decimal-like values and frontend missing-product behavior remain supported', () => {
  const product = { price: { toString: () => '275000' }, variants: [{ size: '10ml', color: '', price: null }] };
  assert.equal(server.resolveUnitPrice(product, '20ml', ''), 550000);
  assert.equal(web.resolveUnitPrice(null), 0);
});
