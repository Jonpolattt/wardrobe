const { test } = require('node:test'); const assert = require('node:assert/strict');
const { formatPrice, formatDate } = require('../dist');
test('price formatting preserves web rounding/grouping and handles malformed API display data', () => {
  assert.equal(formatPrice('125000.6'), "125 001 so'm");
  assert.equal(formatPrice(-125000), "-125 000 so'm");
  assert.equal(formatPrice('bad'), "0 so'm");
  assert.equal(formatPrice(125000,'ru'), "125 000 so'm");
});
test('date formatting tolerates invalid values and uses the existing Uzbek/Russian month vocabulary', () => {
  assert.equal(formatDate('not-a-date'), '');
  assert.equal(formatDate(new Date(2026,8,30),'uz'), '30 sen 2026');
  assert.equal(formatDate(new Date(2026,8,30),'ru'), '30 сен 2026');
});
