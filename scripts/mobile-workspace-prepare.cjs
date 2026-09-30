// EAS standard install hook builds shared artifacts before native prebuild.
// Ordinary local installs do not run additional builds or services.
if (process.env.EAS_BUILD !== 'true') process.exit(0);
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const result = spawnSync(process.execPath, [path.join(root, 'scripts/pnpm.cjs'), '--filter', './packages/**', 'build'], {
  cwd: root, env: process.env, stdio: 'inherit',
});
process.exit(result.status ?? 1);
