// Use the pinned workspace package manager; never silently use a different pnpm.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve, dirname, delimiter } = require('node:path');
const root = resolve(__dirname, '..');
const expected = readFileSync(resolve(root, 'package.json'), 'utf8');
const version = JSON.parse(expected).packageManager.split('@').pop();
const explicit = process.env.WARDROBE_PNPM_CLI;
const program = explicit ? process.execPath : (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
const prefix = explicit ? [explicit] : [];
const check = spawnSync(program, [...prefix, '--version'], { encoding: 'utf8', shell: !explicit && process.platform === 'win32', cwd: root });
if (check.status !== 0 || check.stdout.trim() !== version) {
  console.error(`Wardrobe requires pnpm ${version}. Set WARDROBE_PNPM_CLI to the matching pnpm.cjs if your PATH uses another version.`);
  process.exit(1);
}
const env = { ...process.env };
if (explicit) env.PATH = `${dirname(explicit)}${delimiter}${process.env.PATH ?? ''}`;
const result = spawnSync(program, [...prefix, ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit', shell: !explicit && process.platform === 'win32' });
process.exit(result.status ?? 1);
