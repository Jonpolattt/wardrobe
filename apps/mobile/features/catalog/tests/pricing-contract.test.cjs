const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadPureModule(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const instance = { exports: {} };
  vm.runInNewContext(compiled, { module: instance, exports: instance.exports, require });
  return instance.exports;
}

const { catalogDisplayPrice } = loadPureModule(path.resolve(__dirname, '../api-contract.ts'));
// Compare pure pricing functions only; importing Nest or starting a server is unnecessary.
const { resolveUnitPrice } = loadPureModule(path.resolve(
  __dirname, '../../../../../apps/server/src/common/utils/variant-price.util.ts',
));

test('catalog display pricing agrees with existing backend rules for selected variants', () => {
  const products = [
    { price: 100, variants: [] },
    { price: 100, variants: [
      { size: 'S', color: 'black', price: 125 },
      { size: 'L', color: 'white', price: null },
    ] },
    { price: 101, variants: [
      { size: '10ml', color: '', price: null },
      { size: '30ml', color: '', price: null },
      { size: '100ml', color: '', price: 800 },
    ] },
    { price: 0, variants: [{ size: '', color: '', price: null }] },
  ];
  const selections = [
    [], ['S', 'black'], ['L', 'white'], ['10ml'], ['30ml'], ['100ml'],
    ['20ml'], ['missing', 'black'], ['30ml', 'unavailable'], [undefined, 'black'],
  ];
  for (const product of products) {
    for (const [size, color] of selections) {
      assert.equal(catalogDisplayPrice(product, size, color), resolveUnitPrice(product, size, color));
    }
  }
});
