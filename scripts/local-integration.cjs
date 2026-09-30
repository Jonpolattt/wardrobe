'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT, DEFAULT_PORT, plan, startLocal } = require('./local-server.cjs');

class LocalCheckError extends Error {
  constructor(code) { super(code); this.localCode = code; }
}
function expect(condition, code) { if (!condition) throw new LocalCheckError(code); }
const AUTH_FIELDS = 'accessToken refreshToken user { id phone role }';
const ORDER_FIELDS = 'id userId status paymentStatus paymentMethod totalAmount items { productId price quantity size color }';

async function run(port = DEFAULT_PORT) {
  const runtime = await startLocal(port);
  const results = [];
  const sessions = {};
  let cartItem;
  let order;
  const f = runtime.fixtures;

  async function gql(query, variables = {}, token) {
    const response = await fetch(runtime.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json();
    return { status: response.status, data: payload.data, errors: payload.errors || [] };
  }
  function successful(result) {
    expect(result.status === 200 && result.errors.length === 0 && result.data, 'GRAPHQL_OPERATION_FAILED');
    return result.data;
  }
  async function check(name, callback) {
    try { await callback(); results.push({ name, status: 'passed' }); console.log('PASS ' + name); }
    catch (error) { results.push({ name, status: 'failed', code: error.localCode || error.code || error.name || 'ERROR' }); console.log('FAIL ' + name + ' (details withheld to avoid logging credentials or OTPs)'); }
  }
  async function inventory(stock, sold) {
    const product = await runtime.prisma.product.findUnique({ where: { id: f.productId }, select: { stock: true, soldCount: true } });
    const variant = await runtime.prisma.productVariant.findUnique({ where: { id: f.variantId }, select: { stock: true } });
    expect(product?.stock === stock && product.soldCount === sold && variant?.stock === stock, 'INVENTORY_DELTA_MISMATCH');
  }
  async function payment(paid) {
    return successful(await gql('mutation($id:ID!,$paid:Boolean!){setOrderPaymentStatus(orderId:$id,paid:$paid){' + ORDER_FIELDS + '}}', { id: order.id, paid }, sessions.admin.accessToken)).setOrderPaymentStatus;
  }

  try {
    await check('local security configuration', async () => {
      expect(process.env.CLICK_TEST_MODE === 'false' && process.env.PAYME_TEST_MODE === 'false', 'PAYMENT_TEST_MODE_ENABLED');
      expect(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_SUPPORT_BOT_TOKEN', 'TELEGRAM_ERROR_BOT_TOKEN', 'TELEGRAM_STOCK_BOT_TOKEN', 'SMTP_HOST', 'DEVSMS_API_TOKEN', 'SMS_GATEWAY_BASE_URL', 'ESKIZ_EMAIL', 'TWILIO_ACCOUNT_SID', 'CLICK_SECRET_KEY', 'PAYME_SECRET_KEY'].every(key => !process.env[key]), 'INTEGRATION_CREDENTIAL_PRESENT');
      expect(path.resolve(runtime.databasePath).startsWith(path.join(ROOT, '.local', 'dev') + path.sep), 'DATABASE_OUTSIDE_LOCAL_DIRECTORY');
      const address = runtime.app.getHttpServer().address();
      expect(address && address.address === '127.0.0.1', 'SERVER_NOT_LOOPBACK_ONLY');
    });
    await check('mobile GraphQL documents match the isolated server schema', async () => {
      const { createRequire } = require('node:module');
      const serverRequire = createRequire(path.join(ROOT, 'apps/server/package.json'));
      const { buildSchema, parse, validate } = serverRequire('graphql');
      const { CUSTOMER_DOCUMENTS } = require(path.join(ROOT, 'packages/api-client/dist'));
      const schema = buildSchema(fs.readFileSync(path.join(runtime.runDir, 'src/schema.gql'), 'utf8'));
      for (const [name, document] of Object.entries(CUSTOMER_DOCUMENTS)) {
        const errors = validate(schema, parse(document));
        if (errors.length) throw new LocalCheckError('INVALID_MOBILE_DOCUMENT_' + name.toUpperCase());
      }
    });
    await check('fake account login and refresh', async () => {
      for (const key of ['owner', 'other', 'admin']) {
        const data = successful(await gql('mutation($input:LoginInput!){login(input:$input){' + AUTH_FIELDS + '}}', { input: { identifier: f[key].phone, password: f.password } }));
        expect(data.login.user.id === f[key].id && typeof data.login.accessToken === 'string' && typeof data.login.refreshToken === 'string', 'LOGIN_SESSION_MISMATCH');
        sessions[key] = data.login;
      }
      const refreshed = successful(await gql('mutation($refreshToken:String!){refreshToken(refreshToken:$refreshToken){' + AUTH_FIELDS + '}}', { refreshToken: sessions.owner.refreshToken })).refreshToken;
      expect(refreshed.user.id === f.owner.id, 'REFRESH_OWNER_MISMATCH');
      sessions.owner = refreshed;
      const me = successful(await gql('query{me{id phone}}', {}, sessions.owner.accessToken)).me;
      expect(me.id === f.owner.id, 'REFRESH_ACCESS_TOKEN_FAILED');
    });
    await check('cart uses the server computed unit price', async () => {
      expect(sessions.owner, 'LOGIN_PREREQUISITE_FAILED');
      cartItem = successful(await gql('mutation($input:AddToCartInput!){addToCart(input:$input){id productId quantity unitPrice size color}}', { input: { productId: f.productId, size: '10ml', color: 'clear', quantity: f.quantity } }, sessions.owner.accessToken)).addToCart;
      expect(cartItem.productId === f.productId && cartItem.quantity === f.quantity && cartItem.unitPrice === f.price, 'SERVER_CART_PRICE_MISMATCH');
    });
    await check('cart item ownership prevents another user changing it', async () => {
      expect(cartItem && sessions.other, 'CART_PREREQUISITE_FAILED');
      const denied = await gql('mutation($input:UpdateCartItemInput!){updateCartItem(input:$input){id quantity}}', { input: { id: cartItem.id, quantity: 1 } }, sessions.other.accessToken);
      expect(denied.errors.length > 0, 'CART_UPDATE_OWNERSHIP_NOT_ENFORCED');
      const removeDenied = await gql('mutation($id:ID!){removeCartItem(id:$id)}', { id: cartItem.id }, sessions.other.accessToken);
      expect(removeDenied.errors.length > 0, 'CART_REMOVE_OWNERSHIP_NOT_ENFORCED');
      const existing = await runtime.prisma.cartItem.findUnique({ where: { id: cartItem.id } });
      expect(existing?.userId === f.owner.id && existing.quantity === f.quantity, 'OTHER_USER_MUTATED_CART');
    });
    await check('checkout rejects client supplied totals', async () => {
      expect(cartItem, 'CART_PREREQUISITE_FAILED');
      const before = await runtime.prisma.order.count();
      const invalid = await gql('mutation($input:CreateOrderInput!){createOrder(input:$input){id}}', { input: { deliveryAddress: 'Local fixture address', phone: f.owner.phone, paymentMethod: 'CASH', itemIds: [cartItem.id], totalAmount: 1 } }, sessions.owner.accessToken);
      expect(invalid.errors.length > 0 && await runtime.prisma.order.count() === before, 'CLIENT_TOTAL_NOT_REJECTED');
    });
    await check('checkout records server total and retains stock until paid', async () => {
      expect(cartItem, 'CART_PREREQUISITE_FAILED');
      order = successful(await gql('mutation($input:CreateOrderInput!){createOrder(input:$input){' + ORDER_FIELDS + '}}', { input: { deliveryAddress: 'Local fixture address', deliveryCity: 'Local test city', phone: f.owner.phone, paymentMethod: 'CASH', itemIds: [cartItem.id] } }, sessions.owner.accessToken)).createOrder;
      expect(order.totalAmount === f.price * f.quantity && order.items.length === 1 && order.items[0].price === f.price && order.items[0].quantity === f.quantity && order.paymentStatus === 'PENDING', 'SERVER_ORDER_TOTAL_MISMATCH');
      expect(await runtime.prisma.cartItem.count({ where: { userId: f.owner.id } }) === 0, 'ORDERED_CART_NOT_CLEARED');
      await inventory(f.stock, 0);
    });
    await check('order visibility remains private to its owner', async () => {
      expect(order && sessions.other, 'ORDER_PREREQUISITE_FAILED');
      const denied = await gql('query($id:ID!){order(id:$id){id totalAmount}}', { id: order.id }, sessions.other.accessToken);
      expect(denied.errors.length > 0, 'ORDER_OWNERSHIP_NOT_ENFORCED');
      const own = successful(await gql('query($id:ID!){order(id:$id){id}}', { id: order.id }, sessions.owner.accessToken)).order;
      expect(own.id === order.id, 'OWNER_CANNOT_READ_ORDER');
      const otherOrders = successful(await gql('query{myOrders{id}}', {}, sessions.other.accessToken)).myOrders;
      expect(otherOrders.every(value => value.id !== order.id), 'ORDER_LEAKS_IN_OTHER_ACCOUNT');
    });
    await check('admin paid transition deducts stock once', async () => {
      expect(order && sessions.admin, 'ORDER_PREREQUISITE_FAILED');
      expect((await payment(true)).paymentStatus === 'PAID', 'PAYMENT_STATE_NOT_UPDATED');
      await inventory(f.stock - f.quantity, f.quantity);
      await payment(true);
      await inventory(f.stock - f.quantity, f.quantity);
    });
    await check('cancellation and unpaid toggle restock exactly once', async () => {
      expect(order && sessions.admin, 'ORDER_PREREQUISITE_FAILED');
      const cancelled = successful(await gql('mutation($input:UpdateOrderStatusInput!){updateOrderStatus(input:$input){id status paymentStatus}}', { input: { orderId: order.id, status: 'CANCELLED' } }, sessions.admin.accessToken)).updateOrderStatus;
      expect(cancelled.status === 'CANCELLED' && cancelled.paymentStatus === 'PENDING', 'CANCEL_STATE_MISMATCH');
      await inventory(f.stock, 0);
      await payment(false);
      await inventory(f.stock, 0);
    });
    await check('registration OTP is verified in the disposable database', async () => {
      successful(await gql('mutation($input:SendRegisterOtpInput!){sendRegisterOtp(input:$input)}', { input: { phone: f.registrationPhone } }));
      const otp = await runtime.prisma.phoneOtp.findUnique({ where: { phone: f.registrationPhone } });
      expect(otp && /^\d{5}$/.test(otp.code), 'LOCAL_OTP_NOT_CREATED');
      successful(await gql('mutation($input:VerifyRegisterOtpInput!){verifyRegisterOtp(input:$input)}', { input: { phone: f.registrationPhone, code: otp.code } }));
      const registration = successful(await gql('mutation($input:RegisterInput!){register(input:$input){' + AUTH_FIELDS + '}}', { input: { phone: f.registrationPhone, password: f.password, firstName: 'Local', lastName: 'Fixture' } })).register;
      const registeredUser = await runtime.prisma.user.findUnique({ where: { id: registration.user.id }, select: { phone: true, phoneVerified: true } });
      expect(registration.user.phone === f.registrationPhone && registeredUser?.phoneVerified === true, 'PHONE_REGISTRATION_FAILED');
      expect(await runtime.prisma.phoneOtp.count({ where: { phone: f.registrationPhone } }) === 0, 'REGISTRATION_OTP_NOT_CONSUMED');
    });
    await check('phone password reset consumes its local OTP', async () => {
      const requested = successful(await gql('mutation($input:RequestPasswordResetInput!){requestPasswordReset(input:$input){method}}', { input: { identifier: f.owner.phone } })).requestPasswordReset;
      expect(requested.method === 'PHONE', 'PHONE_RESET_METHOD_MISMATCH');
      const localUser = await runtime.prisma.user.findUnique({ where: { id: f.owner.id }, select: { resetCode: true } });
      expect(localUser?.resetCode && /^\d{5}$/.test(localUser.resetCode), 'LOCAL_RESET_OTP_NOT_CREATED');
      const newPassword = 'LocalFixtureChanged!456';
      const reset = successful(await gql('mutation($input:ResetPasswordInput!){resetPassword(input:$input){' + AUTH_FIELDS + '}}', { input: { identifier: f.owner.phone, code: localUser.resetCode, newPassword } })).resetPassword;
      expect(reset.user.id === f.owner.id, 'RESET_SESSION_MISMATCH');
      const cleared = await runtime.prisma.user.findUnique({ where: { id: f.owner.id }, select: { resetCode: true, resetCodeExpiresAt: true } });
      expect(cleared.resetCode === null && cleared.resetCodeExpiresAt === null, 'RESET_OTP_NOT_CONSUMED');
      const relogin = successful(await gql('mutation($input:LoginInput!){login(input:$input){user{id}}}', { input: { identifier: f.owner.phone, password: newPassword } })).login;
      expect(relogin.user.id === f.owner.id, 'CHANGED_PASSWORD_LOGIN_FAILED');
    });
    await check('no external network calls were attempted', async () => {
      expect(runtime.blockedOutboundRequests() === 0, 'EXTERNAL_NETWORK_ATTEMPT_BLOCKED');
    });
    const report = { runDirectory: path.relative(ROOT, runtime.runDir), database: path.relative(ROOT, runtime.databasePath), endpoint: runtime.endpoint, productionServicesUsed: false, secretsLogged: false, tests: results, passed: results.filter(value => value.status === 'passed').length, failed: results.filter(value => value.status === 'failed').length };
    fs.writeFileSync(path.join(runtime.runDir, 'integration-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log('Integration result: ' + report.passed + ' passed, ' + report.failed + ' failed.');
    console.log('Report: ' + path.join(report.runDirectory, 'integration-report.json'));
    return report;
  } finally {
    await runtime.stop();
    for (const key of Object.keys(sessions)) delete sessions[key];
  }
}

module.exports = { run };
if (require.main === module) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = portIndex === -1 ? DEFAULT_PORT : Number(args[portIndex + 1]);
  if (!args.includes('--run')) console.log(JSON.stringify({ ...plan(port), command: 'node scripts/local-integration.cjs --run', tests: ['login/refresh', 'cart price/ownership', 'checkout server total', 'order ownership', 'inventory transitions', 'local registration/password reset OTP'] }, null, 2));
  else run(port).then(report => { process.exitCode = report.failed ? 1 : 0; }).catch(() => { console.error('Disposable integration setup failed; details withheld to avoid logging secrets. No existing database was selected or reset.'); process.exitCode = 1; });
}
