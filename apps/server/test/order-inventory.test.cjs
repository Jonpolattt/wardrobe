'use strict';

// Loads the compiled service with an in-memory Prisma substitute only.
// It never constructs PrismaClient or boots Nest/Telegram/payment providers.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { OrderService } = require(path.join(__dirname, '..', 'dist', 'src', 'modules', 'order', 'order.service.js'));

function fixture(options = {}) {
  const item = { productId: 'fixture-product', title: 'Fixture', size: '10ml', color: 'clear', quantity: 2 };
  let state = {
    order: { id: 'fixture-order', status: options.status || 'PENDING', paymentStatus: options.paymentStatus || 'PENDING', items: [item] },
    product: { id: item.productId, stock: options.stock ?? 10, soldCount: options.soldCount ?? 0 },
    variant: { id: 'fixture-variant', productId: item.productId, size: item.size, color: item.color, stock: options.variantStock ?? options.stock ?? 10 },
  };
  const clone = value => structuredClone(value);
  const tx = {
    order: {
      findUnique: async () => clone(state.order),
      update: async ({ data }) => { Object.assign(state.order, data); return clone(state.order); },
    },
    productVariant: {
      findFirst: async () => clone(state.variant),
      update: async ({ data }) => { state.variant.stock += data.stock.increment; return clone(state.variant); },
    },
    product: {
      findUnique: async () => clone(state.product),
      update: async ({ data }) => {
        state.product.stock += data.stock.increment;
        state.product.soldCount += data.soldCount.increment;
        return clone(state.product);
      },
    },
  };
  const prisma = { ...tx, async $transaction(callback) {
    const before = clone(state);
    try { return await callback(tx); }
    catch (error) { state = before; throw error; }
  } };
  return { service: new OrderService(prisma, {}), state: () => clone(state) };
}

function inventory(f, stock, soldCount) {
  const state = f.state();
  assert.equal(state.product.stock, stock);
  assert.equal(state.variant.stock, stock);
  assert.equal(state.product.soldCount, soldCount);
}

test('marking a pending order paid deducts aggregate and variant stock once', async () => {
  const f = fixture();
  await f.service.setPaymentStatus('fixture-order', true);
  inventory(f, 8, 2);
  await f.service.setPaymentStatus('fixture-order', true);
  inventory(f, 8, 2);
});

test('cancel then unpay restores inventory once and resets payment to pending', async () => {
  const f = fixture({ paymentStatus: 'PAID', stock: 8, soldCount: 2 });
  await f.service.updateStatus({ orderId: 'fixture-order', status: 'CANCELLED' });
  assert.equal(f.state().order.paymentStatus, 'PENDING');
  inventory(f, 10, 0);
  await f.service.setPaymentStatus('fixture-order', false);
  inventory(f, 10, 0);
});

test('unpay then cancel restores inventory once', async () => {
  const f = fixture({ paymentStatus: 'PAID', stock: 8, soldCount: 2 });
  await f.service.setPaymentStatus('fixture-order', false);
  await f.service.updateStatus({ orderId: 'fixture-order', status: 'CANCELLED' });
  inventory(f, 10, 0);
});

test('reactivating a paid cancelled order deducts inventory once', async () => {
  const f = fixture({ status: 'CANCELLED', paymentStatus: 'PAID' });
  await f.service.updateStatus({ orderId: 'fixture-order', status: 'PROCESSING' });
  inventory(f, 8, 2);
  await f.service.updateStatus({ orderId: 'fixture-order', status: 'PROCESSING' });
  inventory(f, 8, 2);
});

test('insufficient variant stock rejects payment without changing state', async () => {
  const f = fixture({ stock: 1 });
  await assert.rejects(() => f.service.setPaymentStatus('fixture-order', true));
  inventory(f, 1, 0);
  assert.equal(f.state().order.paymentStatus, 'PENDING');
});

test('aggregate shortage rolls back an earlier variant adjustment', async () => {
  const f = fixture({ stock: 1, variantStock: 5 });
  await assert.rejects(() => f.service.setPaymentStatus('fixture-order', true));
  const state = f.state();
  assert.equal(state.variant.stock, 5);
  assert.equal(state.product.stock, 1);
  assert.equal(state.product.soldCount, 0);
  assert.equal(state.order.paymentStatus, 'PENDING');
});