// Read-only checks: print file/line metadata, never matched credential values.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const listing = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
if (listing.status !== 0) throw new Error('Git inventory failed');
const files = [...new Set(listing.stdout.split('\0').filter(Boolean))];
const findings = [];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b\d{7,14}:[A-Za-z0-9_-]{30,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/,
];
for (const relative of files) {
  if (!/\.(?:ts|tsx|js|jsx|cjs|mjs|json|ya?ml|md|example)$/.test(relative)) continue;
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (secretPatterns.some(pattern => pattern.test(line))) findings.push({ file: relative, line: index + 1, kind: 'credential-pattern-review' });
    if (relative.startsWith('apps/mobile/') && /\.(?:ts|tsx)$/.test(relative) && relative !== 'apps/mobile/app.config.ts') {
      if (/(?:from\s*|import\s*\(|require\s*\()\s*['"](?:next(?:\/|['"])|@nestjs\/|@prisma\/|telegraf['"]|nodemailer['"]|node:|fs['"]|path['"])/.test(line)) {
        findings.push({ file: relative, line: index + 1, kind: 'server-browser-import-in-mobile' });
      }
      if (/process\.env\.(?:DATABASE_URL|JWT_\w+|\w+_SECRET(?:_KEY)?|TELEGRAM_\w*TOKEN)/.test(line)) {
        findings.push({ file: relative, line: index + 1, kind: 'secret-env-in-mobile' });
      }
    }
  });
}
for (const relative of files.filter(file => file.startsWith('packages/') && file.endsWith('/package.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  if (manifest.private !== true) findings.push({ file: relative, kind: 'shared-package-not-private' });
}
console.log(JSON.stringify({ sourceFilesChecked: files.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
