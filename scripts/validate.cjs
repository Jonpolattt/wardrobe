// Build/type validation uses isolated non-routable API settings and no live credentials.
const { spawnSync } = require('node:child_process');
const { existsSync, readdirSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/TOKEN|SECRET|PASSWORD|DATABASE_URL|BOT_|MERCHANT|CLICK_|PAYME_|ESKIZ|TWILIO|DEVSMS|SMS_GATEWAY|SMTP_|MAIL_|GRAPHQL|NEXT_PUBLIC_|EXPO_PUBLIC_/i.test(key)) delete env[key];
}
Object.assign(env, {
  DATABASE_URL: 'file:./validation-never-opened.db',
  GRAPHQL_INTERNAL_URL: 'http://127.0.0.1:1/graphql',
  NEXT_PUBLIC_GRAPHQL_URL: 'http://127.0.0.1:1/graphql',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
  NEXT_TELEMETRY_DISABLED: '1', TURBO_TELEMETRY_DISABLED: '1',
  CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1', PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
});
// dotenv may override sanitized process configuration; fail closed if an app has real env files.
for (const app of ['web', 'server', 'mobile']) {
  for (const name of readdirSync(resolve(root, 'apps', app)).filter(name => (name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example'))) {
    if (existsSync(resolve(root, 'apps', app, name))) {
      console.error(`Validation refused: apps/${app}/${name} exists. Use a clean checkout or explicitly isolated validation environment.`);
      process.exit(1);
    }
  }
}
const targets = {
  shared: ['--filter', './packages/**', 'build'],
  webTypes: ['--filter', 'fashion-marketplace-frontend', 'exec', 'tsc', '--noEmit', '--incremental', 'false'],
  serverTypes: ['--filter', 'fashion-marketplace-backend', 'exec', 'tsc', '--noEmit', '--incremental', 'false', '-p', 'tsconfig.build.json'],
  prisma: ['--filter', 'fashion-marketplace-backend', 'exec', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  webBuild: ['--filter', 'fashion-marketplace-frontend', 'build'],
  serverBuild: ['--filter', 'fashion-marketplace-backend', 'build'],
  mobileTypes: ['--filter', '@wardrobe/mobile', 'typecheck'],
  mobileConfig: ['--filter', '@wardrobe/mobile', 'exec', 'expo', 'config', '--type', 'public'],
  mobileBuild: ['--filter', '@wardrobe/mobile', 'build'],
  mobileDependencies: ['--filter', '@wardrobe/mobile', 'check:expo'],
  tests: ['-r', '--if-present', 'test'],
  graph: ['exec', 'turbo', 'run', 'build', '--dry=json'],
};
const requested = process.argv.slice(2);
const selected = requested.length ? requested : ['shared', 'prisma', 'webTypes', 'serverTypes', 'mobileTypes', 'tests', 'webBuild', 'serverBuild', 'mobileConfig', 'mobileDependencies', 'mobileBuild', 'graph'];
mkdirSync(resolve(root, '.local', 'validation'), { recursive: true });
let failed = false;
for (const name of selected) {
  if (!targets[name]) throw new Error(`Unknown validation target: ${name}`);
  console.log(`Validating ${name}...`);
  const result = spawnSync(process.execPath, [resolve(__dirname, 'pnpm.cjs'), ...targets[name]], { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(resolve(root, '.local', 'validation', `${name}.log`), output);
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (log: .local/validation/${name}.log)`);
  if (result.status !== 0) { console.log(output.slice(-10000)); failed = true; }
}
process.exit(failed ? 1 : 0);
