const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../model.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS,
} }).outputText;
const moduleFixture = { exports: {} };
vm.runInNewContext(compiled, { module: moduleFixture, exports: moduleFixture.exports });
const { selectedStock } = moduleFixture.exports;

test('unavailable variant never inherits another variant aggregate stock', () => {
  const product = { stock: 40, variants: [
    { size: 'M', color: 'black', stock: 0 },
    { size: 'L', color: 'white', stock: 40 },
  ] };
  assert.equal(selectedStock(product, 'M', 'black'), 0);
  assert.equal(selectedStock(product, 'M', 'white'), 0);
  assert.equal(selectedStock(product, undefined, undefined), 0);
  assert.equal(selectedStock(product, 'L', 'white'), 40);
});

test('simple products and empty optional variant dimensions remain supported', () => {
  assert.equal(selectedStock({ stock: 3, variants: [] }), 3);
  assert.equal(selectedStock({ stock: 12, variants: [{ size: '', color: '', stock: 2 }] }), 2);
});
