'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'apps', 'server');
const DEFAULT_PORT = 15411;
const FIXTURES = Object.freeze({
  password: 'LocalFixtureOnly!123',
  owner: { id: '10000000-0000-4000-8000-000000000001', email: 'owner@wardrobe.invalid', phone: '+998900000001' },
  other: { id: '10000000-0000-4000-8000-000000000002', email: 'other@wardrobe.invalid', phone: '+998900000002' },
  admin: { id: '10000000-0000-4000-8000-000000000003', email: 'admin@wardrobe.invalid', phone: '+998900000003' },
  registrationPhone: '+998900000004',
  categoryId: '30000000-0000-4000-8000-000000000001',
  productId: '20000000-0000-4000-8000-000000000001',
  variantId: '40000000-0000-4000-8000-000000000001',
  price: 275000,
  quantity: 2,
  stock: 10,
});

function insideRoot(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error('Local path is outside Wardrobe');
  let current = ROOT;
  for (const segment of path.relative(ROOT, resolved).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Local path contains a symlink or junction');
  }
  return resolved;
}

function preflight(port = DEFAULT_PORT) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose an unprivileged local port');
  for (const directory of [ROOT, SERVER, path.join(SERVER, 'prisma')]) {
    for (const name of fs.readdirSync(directory)) {
      if (name === '.env' || (name.startsWith('.env.') && !name.endsWith('.example'))) {
        throw new Error('Refusing local execution: a real environment file exists at ' + path.join(directory, name));
      }
    }
  }
  const required = [
    path.join(SERVER, 'dist', 'src', 'app.module.js'),
    path.join(SERVER, 'dist', 'src', 'main.js'),
    path.join(SERVER, 'node_modules', 'prisma', 'build', 'index.js'),
    path.join(SERVER, 'prisma', 'schema.prisma'),
  ];
  for (const filename of required) if (!fs.existsSync(filename)) throw new Error('Build/dependency prerequisite missing: ' + filename);
  const schema = fs.readFileSync(required[3], 'utf8');
  if (!/provider\s*=\s*"sqlite"/.test(schema)) throw new Error('This disposable runner supports the existing SQLite schema only');
  const serverRequire = createRequire(path.join(SERVER, 'package.json'));
  const prismaRequire = createRequire(serverRequire.resolve('prisma/package.json'));
  const engineRoot = path.dirname(prismaRequire.resolve('@prisma/engines/package.json'));
  const nativeSchemaEngine = fs.readdirSync(engineRoot).find(name => name.startsWith('schema-engine-') && !name.endsWith('.gz'));
  if (!nativeSchemaEngine) throw new Error('Installed Prisma schema engine is missing; this runner never downloads engines');
  return { port, schema: required[3], prismaCli: required[2], schemaEngine: path.join(engineRoot, nativeSchemaEngine), serverRequire };
}

function plan(port = DEFAULT_PORT) {
  preflight(port);
  return {
    mode: 'dry-run',
    endpoint: 'http://127.0.0.1:' + port + '/graphql',
    database: '.local/dev/<unique-session>/local.db',
    schemaPreparation: 'prisma db push --skip-generate against a brand-new file only',
    migrations: 'none',
    inheritedIntegrationEnvironment: 'discarded',
    externalProviders: 'disabled',
    paymentCallbacks: 'blocked',
    fixtures: 'three fake users and one fake product/variant; no production data',
    secrets: 'random process-local JWT secrets; never logged or written',
  };
}

function cleanEnvironment(runDir, databaseUrl, port, schemaEngine) {
  const clean = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) {
    if (process.env[name]) clean[name] = process.env[name];
  }
  Object.assign(clean, {
    TEMP: path.join(runDir, 'tmp'), TMP: path.join(runDir, 'tmp'),
    NODE_ENV: 'development', DATABASE_URL: databaseUrl, PORT: String(port),
    CORS_ORIGIN: 'http://127.0.0.1:3000,http://localhost:3000',
    JWT_ACCESS_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_ACCESS_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '1h',
    CLICK_TEST_MODE: 'false', PAYME_TEST_MODE: 'false',
    CLICK_SERVICE_ID: '', CLICK_MERCHANT_ID: '', CLICK_SECRET_KEY: '',
    PAYME_MERCHANT_ID: '', PAYME_SECRET_KEY: '',
    TELEGRAM_BOT_TOKEN: '', TELEGRAM_STOCK_BOT_TOKEN: '', TELEGRAM_SUPPORT_BOT_TOKEN: '', TELEGRAM_ERROR_BOT_TOKEN: '',
    TELEGRAM_ADMIN_CHAT_ID: '', TELEGRAM_ERROR_CHAT_ID: '', TELEGRAM_BOT_USERNAME: '',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', MAIL_FROM: '',
    DEVSMS_API_TOKEN: '', SMS_GATEWAY_BASE_URL: '', SMS_GATEWAY_USERNAME: '', SMS_GATEWAY_PASSWORD: '',
    ESKIZ_EMAIL: '', ESKIZ_PASSWORD: '', TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: '', TWILIO_FROM: '',
    PRISMA_SCHEMA_ENGINE_BINARY: schemaEngine,
    PRISMA_ENGINES_MIRROR: 'http://127.0.0.1:9',
    PRISMA_GENERATE_SKIP_AUTOINSTALL: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1',
    npm_config_cache: path.join(runDir, 'npm-cache'),
    DOTENV_CONFIG_PATH: path.join(runDir, '.env-does-not-exist'),
  });
  return clean;
}

function lockOutboundNetwork(runDir) {
  const originalConnect = net.Socket.prototype.connect;
  const originalFetch = globalThis.fetch;
  let blocked = 0;
  const allowed = host => ['127.0.0.1', '::1', 'localhost'].includes(String(host).replace(/^\[|\]$/g, '').toLowerCase());
  net.Socket.prototype.connect = function (...args) {
    // Node can pass a normalized [options, callback] array internally.
    const connectionArgs = Array.isArray(args[0]) ? args[0] : args;
    const first = connectionArgs[0];
    const options = typeof first === 'object' && first !== null ? first : { host: typeof connectionArgs[1] === 'string' ? connectionArgs[1] : 'localhost' };
    if (options.path) {
      if (!path.resolve(options.path).startsWith(runDir + path.sep)) { blocked++; throw new Error('Non-local pipe connection blocked'); }
    } else if (!allowed(options.host || options.hostname || 'localhost')) {
      blocked++; throw new Error('External network connection blocked by disposable runner');
    }
    return originalConnect.apply(this, args);
  };
  globalThis.fetch = function (input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    if (!allowed(url.hostname)) { blocked++; return Promise.reject(new Error('External fetch blocked by disposable runner')); }
    return originalFetch(input, init);
  };
  return { count: () => blocked, restore() { net.Socket.prototype.connect = originalConnect; globalThis.fetch = originalFetch; } };
}

async function seedFixtures(PrismaClient, databaseUrl, serverRequire) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
  const bcrypt = serverRequire('bcryptjs');
  try {
    if (await prisma.user.count() || await prisma.product.count()) throw new Error('Disposable database is not empty');
    const passwordHash = await bcrypt.hash(FIXTURES.password, 10);
    for (const key of ['owner', 'other', 'admin']) {
      const value = FIXTURES[key];
      await prisma.user.create({ data: { ...value, passwordHash, firstName: 'Local ' + key, lastName: 'Fixture', role: key === 'admin' ? 'ADMIN' : 'USER', phoneVerified: true, emailVerified: false, isActive: true } });
    }
    await prisma.category.create({ data: { id: FIXTURES.categoryId, name: 'Local fixtures', nameRu: 'Локальные тесты', slug: 'local-fixtures' } });
    await prisma.product.create({ data: { id: FIXTURES.productId, title: 'Local test perfume', titleRu: 'Локальный тестовый парфюм', slug: 'local-test-perfume', sku: 'LOCAL-FIXTURE-001', price: FIXTURES.price, stock: FIXTURES.stock, categoryId: FIXTURES.categoryId, sizes: JSON.stringify(['10ml']), colors: JSON.stringify(['clear']), images: '[]', colorImages: '[]', isActive: true, isFeatured: true } });
    await prisma.productVariant.create({ data: { id: FIXTURES.variantId, productId: FIXTURES.productId, size: '10ml', color: 'clear', stock: FIXTURES.stock, price: null } });
  } finally { await prisma.$disconnect(); }
}

async function startLocal(port = DEFAULT_PORT) {
  const ready = preflight(port);
  const runDir = insideRoot(path.join(ROOT, '.local', 'dev', crypto.randomUUID()));
  const databasePath = insideRoot(path.join(runDir, 'local.db'));
  const databaseUrl = 'file:' + databasePath.replaceAll('\\', '/');
  fs.mkdirSync(path.dirname(runDir), { recursive: true });
  fs.mkdirSync(runDir);
  for (const name of ['tmp', 'src', 'uploads/products', 'uploads/reviews']) fs.mkdirSync(path.join(runDir, name), { recursive: true });
  if (fs.existsSync(databasePath)) throw new Error('Refusing to touch an existing database');
  const clean = cleanEnvironment(runDir, databaseUrl, port, ready.schemaEngine);
  for (const name of Object.keys(process.env)) delete process.env[name];
  Object.assign(process.env, clean);
  process.chdir(runDir);
  const preparation = spawnSync(process.execPath, [ready.prismaCli, 'db', 'push', '--schema', ready.schema, '--skip-generate'], { cwd: runDir, env: clean, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (preparation.error || preparation.status !== 0) throw new Error('Fresh local schema preparation failed; no reset or data-loss override was used');
  if (!fs.existsSync(databasePath)) throw new Error('Prisma did not create the expected disposable database');
  const network = lockOutboundNetwork(runDir);
  let app;
  try {
    const { PrismaClient } = ready.serverRequire('@prisma/client');
    await seedFixtures(PrismaClient, databaseUrl, ready.serverRequire);
    ready.serverRequire('reflect-metadata');
    const { NestFactory } = ready.serverRequire('@nestjs/core');
    const { ValidationPipe } = ready.serverRequire('@nestjs/common');
    const { WsAdapter } = ready.serverRequire('@nestjs/platform-ws');
    const { AppModule } = require(path.join(SERVER, 'dist', 'src', 'app.module.js'));
    app = await NestFactory.create(AppModule, { logger: false });
    app.set('trust proxy', false);
    app.use((req, res, next) => req.path.startsWith('/payments') ? res.status(403).json({ message: 'Payment callbacks are disabled in disposable local mode' }) : next());
    app.useStaticAssets(path.join(runDir, 'uploads'), { prefix: '/uploads' });
    app.useWebSocketAdapter(new WsAdapter(app));
    app.enableCors({ origin: ['http://127.0.0.1:3000', 'http://localhost:3000'], credentials: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
    await app.listen(port, '127.0.0.1');
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
    let stopped = false;
    return { app, prisma, runDir, databasePath, databaseUrl, fixtures: FIXTURES, endpoint: 'http://127.0.0.1:' + port + '/graphql', blockedOutboundRequests: network.count, async stop() { if (stopped) return; stopped = true; await app.close(); await prisma.$disconnect(); network.restore(); delete process.env.JWT_ACCESS_SECRET; delete process.env.JWT_REFRESH_SECRET; } };
  } catch (error) { if (app) await app.close().catch(() => {}); network.restore(); delete process.env.JWT_ACCESS_SECRET; delete process.env.JWT_REFRESH_SECRET; throw error; }
}

module.exports = { ROOT, SERVER, DEFAULT_PORT, FIXTURES, preflight, plan, startLocal };
if (require.main === module) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = portIndex === -1 ? DEFAULT_PORT : Number(args[portIndex + 1]);
  if (!args.includes('--run')) console.log(JSON.stringify(plan(port), null, 2));
  else startLocal(port).then(runtime => {
    console.log('Disposable API ready: ' + runtime.endpoint);
    console.log('Disposable files: ' + path.relative(ROOT, runtime.runDir));
    console.log('Fake fixture account: owner@wardrobe.invalid; password is documented for local fixtures only.');
    const shutdown = () => runtime.stop().then(() => process.exit(0)).catch(() => process.exit(1));
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  }).catch(() => { console.error('Disposable API preparation/start failed. Existing databases were not selected or reset.'); process.exitCode = 1; });
}