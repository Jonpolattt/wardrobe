const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(dev, payload) {
  const logs = [];
  const instance = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../../services/api-diagnostics.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    module: instance, exports: instance.exports, __DEV__: dev, URL, Headers,
    console: { info: (...args) => logs.push(args.join(' ')) },
    fetch: async () => new Response(JSON.stringify(payload), { status: 200 }),
  });
  return { ...instance.exports, logs };
}

test('development tracing redacts auth input, response values and error bodies without consuming the response', async () => {
  const payload = { data: { login: { accessToken: 'private-access-marker', refreshToken: 'private-refresh-marker', user: { phone: 'private-phone-marker' } } },
    errors: [{ message: 'private-error-marker', extensions: { code: 'BAD_USER_INPUT', stacktrace: ['private-stack-marker'] } }] };
  const trace = fixture(true, payload);
  trace.recordApiTrace({ operation: 'MobileLogin', variables: trace.publicVariables('MobileLogin', { input: { password: 'private-password-marker', code: 'private-otp-marker' } }) });
  const response = await trace.tracedFetch('https://example.com/graphql', { headers: { Authorization: 'Bearer private-header-marker' }, body: JSON.stringify({ query: 'mutation MobileLogin { login }', variables: { input: { password: 'private-password-marker' } } }) });
  assert.deepEqual(await response.json(), payload);
  const logs = trace.logs.join('\n');
  for (const marker of ['access', 'refresh', 'phone', 'error', 'stack', 'password', 'otp', 'header']) assert.ok(!logs.includes(`private-${marker}-marker`));
  assert.ok(logs.includes('"authorizationPresent":true'));
  assert.ok(logs.includes('BAD_USER_INPUT'));
  assert.ok(logs.includes('"httpStatus":200'));
  assert.equal(trace.publicEndpoint('https://username:password@example.com/graphql?secret=value'), 'https://example.com/graphql');
});

test('release mode records no diagnostics', () => {
  const trace = fixture(false, {});
  trace.recordApiTrace({ stage: 'requested' });
  assert.equal(trace.logs.length, 0);
  assert.equal(trace.readApiTrace().length, 0);
});
