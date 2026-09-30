const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const transport = require('@wardrobe/api-client');

// In-memory API responses only. Tests never contact a server or persist cart data.
function fixture() {
  const calls = [];
  const product = { id: 'product-id', price: 100, variants: [
    { id: 'variant-small', size: '10ml', color: '', price: null, stock: 5 },
    { id: 'variant-large', size: '30ml', color: '', price: 250, stock: 3 },
  ] };
  const row = { id: 'cart-id', productId: product.id, size: '30ml', color: '', quantity: 2, product };
  const responses = {
    MobileWishlist: { myWishlist: [{ id: 'favorite-id', productId: product.id, product }] },
    MobileToggleWishlist: { toggleWishlist: { added: true } },
    MobileRemoveWishlist: { removeWishlistItem: true },
    MobileCart: { myCart: [row, { id: 'missing-id', productId: 'missing-product', quantity: 1, product: null }] },
    MobileAddCart: { addToCart: { id: row.id, productId: row.productId, size: row.size, color: row.color, quantity: row.quantity } },
    MobileUpdateCart: { updateCartItem: { id: row.id, quantity: 1 } },
    MobileRemoveCart: { removeCartItem: true },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const instance = { exports: {} };
    cache.set(filename, instance.exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const resolve = (name) => {
      if (name === './secure-session') return { tokenStorage: {
        getTokens: async () => ({ accessToken: 'test-access', refreshToken: 'test-refresh' }),
        getSessionKey: async () => 'test-session',
      } };
      if (name === '@wardrobe/api-client') return {
        ...transport,
        createGraphQLClient: options => transport.createGraphQLClient({ ...options, fetch: async (_url, init) => {
          const body = JSON.parse(init.body);
          const operation = /\b(?:query|mutation)\s+(\w+)/.exec(body.query)[1];
          calls.push({ ...body, operation, authorization: new Headers(init.headers).get('Authorization') });
          assert.ok(responses[operation], `Unexpected network operation: ${operation}`);
          return new Response(JSON.stringify({ data: responses[operation] }), { status: 200 });
        } }),
      };
      return name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name);
    };
    vm.runInNewContext(source, {
      module: instance, exports: instance.exports, require: resolve, __DEV__: false,
      process: { env: { EXPO_PUBLIC_GRAPHQL_URL: 'https://local-validation.invalid/graphql' } },
      URL, Headers, console,
    });
    return instance.exports;
  }
  return { ...load(path.resolve(__dirname, '../../../services/api.ts')), calls, row };
}

test('favorites operations retain bearer authentication and product/item ID contracts', async () => {
  const { mobileApi, calls } = fixture();
  assert.equal((await mobileApi.toggleWishlist('product-id')).added, true);
  const wishlist = await mobileApi.wishlist();
  assert.equal(wishlist[0].productId, 'product-id');
  assert.equal(await mobileApi.removeWishlist('favorite-id'), true);
  assert.deepEqual(calls.map(call => call.operation), ['MobileToggleWishlist', 'MobileWishlist', 'MobileRemoveWishlist']);
  assert.deepEqual(calls[0].variables, { productId: 'product-id' });
  assert.deepEqual(calls[2].variables, { id: 'favorite-id' });
  for (const call of calls) {
    assert.equal(call.authorization, 'Bearer test-access');
    assert.ok(!/\bunitPrice\b/.test(call.query));
  }
});

test('cart mutations preserve size/color/quantity inputs and accept the deployed response shape', async () => {
  const { mobileApi, calls } = fixture();
  const input = { productId: 'product-id', size: '30ml', color: '', quantity: 2 };
  assert.equal((await mobileApi.addCart(input)).quantity, 2);
  assert.equal((await mobileApi.updateCart({ id: 'cart-id', quantity: 1 })).quantity, 1);
  assert.equal(await mobileApi.removeCart('cart-id'), true);
  assert.deepEqual(calls[0].variables, { input });
  assert.deepEqual(calls[1].variables, { input: { id: 'cart-id', quantity: 1 } });
  assert.deepEqual(calls[2].variables, { id: 'cart-id' });
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.authorization, 'Bearer test-access');
    assert.ok(!/\bunitPrice\b/.test(call.query));
  }
});

test('cart adapter displays existing variant prices without submitting client prices', async () => {
  const { mobileApi, calls, row } = fixture();
  const items = await mobileApi.cart();
  assert.equal(items[0].unitPrice, 250);
  assert.equal(items[0].unitPrice * items[0].quantity, 500);
  assert.equal(items[0].size, row.size);
  assert.equal(items[1].product, null);
  assert.equal(items[1].unitPrice, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'MobileCart');
  assert.equal(calls[0].variables, undefined);
  assert.ok(!/\bunitPrice\b/.test(calls[0].query));
});
