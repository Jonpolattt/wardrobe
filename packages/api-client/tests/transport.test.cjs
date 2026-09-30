const test = require('node:test');
const assert = require('node:assert/strict');
const { createGraphQLClient, ApiClientError } = require('../dist/index.js');

const endpoint = 'https://local-validation.invalid/graphql';
const oldTokens = { accessToken: 'old-access', refreshToken: 'old-refresh' };
const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'Content-Type': 'application/json' },
});
const unauthenticated = () => response({
  data: null, errors: [{ message: 'sensitive diagnostic omitted', extensions: { code: 'UNAUTHENTICATED' } }],
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function memoryStorage(initial = oldTokens) {
  let tokens = initial ? { ...initial } : null;
  let writes = 0;
  let clears = 0;
  return {
    async getTokens() { return tokens ? { ...tokens } : null; },
    async setTokens(value) { writes++; tokens = { ...value }; },
    async clearTokens() { clears++; tokens = null; },
    snapshot() { return { tokens, writes, clears }; },
  };
}
function body(init) { return JSON.parse(init.body); }
function code(expected) {
  return (error) => error instanceof ApiClientError && error.code === expected;
}

test('an account replacement cancels a rejected mutation instead of replaying it under a new account', async () => {
  let epoch = 'account-one';
  const store = memoryStorage();
  store.getSessionKey = async () => epoch;
  let calls = 0;
  const client = createGraphQLClient({ endpoint, storage: store, fetch: async () => {
    calls++;
    epoch = 'account-two';
    await store.setTokens(newTokens);
    return unauthenticated();
  } });
  await assert.rejects(client.request('mutation CreateOrder { createOrder { id } }', {}, { retryOnUnauthenticated: true }), code('SESSION_CHANGED'));
  assert.equal(calls, 1);
  assert.deepEqual(store.snapshot().tokens, newTokens);
});

test('public request does not read tokens or send Authorization/cookies', async () => {
  let reads = 0;
  const client = createGraphQLClient({
    endpoint,
    storage: { async getTokens() { reads++; throw new Error('secret'); },
      async setTokens() {}, async clearTokens() {} },
    fetch: async (url, init) => {
      assert.equal(url, endpoint);
      assert.equal(init.credentials, 'omit');
      assert.equal(init.headers.Authorization, undefined);
      assert.deepEqual(body(init), { query: 'query Products { products { total } }',
        variables: { filter: { page: 1 } }, operationName: 'Products' });
      return response({ data: { products: { total: 3 } } });
    },
  });
  const data = await client.request('query Products { products { total } }',
    { filter: { page: 1 } }, { auth: false, operationName: 'Products' });
  assert.equal(data.products.total, 3);
  assert.equal(reads, 0);
});

test('concurrent rejected queries share one refresh and retry with updated access token', async () => {
  const storage = memoryStorage();
  const started = deferred();
  const release = deferred();
  let refreshes = 0;
  let queries = 0;
  const client = createGraphQLClient({
    endpoint, storage,
    fetch: async (_url, init) => {
      const payload = body(init);
      if (payload.query.includes('WardrobeRefresh')) {
        refreshes++;
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(payload.variables.refreshToken, oldTokens.refreshToken);
        started.resolve();
        await release.promise;
        return response({ data: { refreshToken: newTokens } });
      }
      queries++;
      if (init.headers.Authorization === 'Bearer old-access') return unauthenticated();
      assert.equal(init.headers.Authorization, 'Bearer new-access');
      return response({ data: { me: { id: 'customer' } } });
    },
  });
  const first = client.request('query Me { me { id } }');
  const second = client.request('query Me { me { id } }');
  await started.promise;
  release.resolve();
  assert.deepEqual(await Promise.all([first, second]),
    [{ me: { id: 'customer' } }, { me: { id: 'customer' } }]);
  assert.equal(refreshes, 1);
  assert.equal(queries, 4);
  assert.equal(storage.snapshot().writes, 1);
});

test('an explicitly opted-in guard-rejected mutation retries exactly once', async () => {
  const storage = memoryStorage();
  let mutations = 0;
  let refreshes = 0;
  const client = createGraphQLClient({
    endpoint, storage,
    fetch: async (_url, init) => {
      if (body(init).query.includes('WardrobeRefresh')) {
        refreshes++;
        return response({ data: { refreshToken: newTokens } });
      }
      mutations++;
      return mutations === 1 ? unauthenticated() : response({ data: { clearCart: true } });
    },
  });
  assert.deepEqual(await client.request('mutation ClearCart { clearCart }', undefined,
    { retryOnUnauthenticated: true }), { clearCart: true });
  assert.equal(mutations, 2);
  assert.equal(refreshes, 1);
});

test('default mutations never refresh or retry even for UNAUTHENTICATED', async () => {
  let calls = 0;
  const storage = memoryStorage();
  const client = createGraphQLClient({ endpoint, storage, fetch: async () => {
    calls++; return unauthenticated();
  } });
  await assert.rejects(client.request('mutation Place { createOrder(input: {}) { id } }'), code('GRAPHQL'));
  assert.equal(calls, 1);
  assert.equal(storage.snapshot().clears, 0);
});

test('auth false invalid login never refreshes or clears an existing user', async () => {
  let calls = 0;
  const storage = memoryStorage();
  const client = createGraphQLClient({ endpoint, storage, fetch: async () => {
    calls++; return unauthenticated();
  } });
  await assert.rejects(client.request('mutation Login { login(input: {}) { accessToken } }',
    undefined, { auth: false, retryOnUnauthenticated: true }), code('GRAPHQL'));
  assert.equal(calls, 1);
  assert.deepEqual(storage.snapshot().tokens, oldTokens);
});

test('partial data or mixed errors never retry, including opted-in mutations', async () => {
  for (const payload of [
    { data: { sideEffect: true }, errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] },
    { data: null, errors: [{ extensions: { code: 'UNAUTHENTICATED' } },
      { extensions: { code: 'BAD_USER_INPUT' } }] },
  ]) {
    let calls = 0;
    const client = createGraphQLClient({ endpoint, storage: memoryStorage(),
      fetch: async () => { calls++; return response(payload); } });
    await assert.rejects(client.request('mutation Change { change }', undefined,
      { retryOnUnauthenticated: true }), code('GRAPHQL'));
    assert.equal(calls, 1);
  }
});

test('skipRefresh rejects without altering tokens', async () => {
  let calls = 0;
  const storage = memoryStorage();
  const client = createGraphQLClient({ endpoint, storage,
    fetch: async () => { calls++; return unauthenticated(); } });
  await assert.rejects(client.request('query Me { me { id } }', undefined,
    { skipRefresh: true }), code('GRAPHQL'));
  assert.equal(calls, 1);
  assert.deepEqual(storage.snapshot().tokens, oldTokens);
});

test('second authentication rejection terminates without a refresh loop', async () => {
  let calls = 0;
  let refreshes = 0;
  const client = createGraphQLClient({ endpoint, storage: memoryStorage(),
    fetch: async (_url, init) => {
      calls++;
      if (body(init).query.includes('WardrobeRefresh')) {
        refreshes++; return response({ data: { refreshToken: newTokens } });
      }
      return unauthenticated();
    } });
  await assert.rejects(client.request('query Me { me { id } }'), code('GRAPHQL'));
  assert.equal(calls, 3);
  assert.equal(refreshes, 1);
});

test('rejected refresh clears only its original session', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const client = createGraphQLClient({ endpoint, storage,
    fetch: async () => { calls++; return unauthenticated(); } });
  await assert.rejects(client.request('query Me { me { id } }'), code('GRAPHQL'));
  assert.equal(calls, 2);
  assert.equal(storage.snapshot().clears, 1);
  assert.equal(storage.snapshot().tokens, null);
});

test('a transient refresh network failure preserves session and is not retried', async () => {
  const storage = memoryStorage();
  let calls = 0;
  const client = createGraphQLClient({ endpoint, storage,
    fetch: async (_url, init) => {
      calls++;
      if (body(init).query.includes('WardrobeRefresh')) throw new Error('secret-provider-error');
      return unauthenticated();
    } });
  await assert.rejects(client.request('query Me { me { id } }'), (error) => {
    assert.equal(error.code, 'NETWORK');
    assert.equal(error.message.includes('secret'), false);
    return true;
  });
  assert.equal(calls, 2);
  assert.deepEqual(storage.snapshot().tokens, oldTokens);
  assert.equal(storage.snapshot().clears, 0);
});

test('logout while refresh is awaiting response does not resurrect the session', async () => {
  const storage = memoryStorage();
  const started = deferred();
  const release = deferred();
  const client = createGraphQLClient({ endpoint, storage,
    fetch: async (_url, init) => {
      if (body(init).query.includes('WardrobeRefresh')) {
        started.resolve(); await release.promise;
        return response({ data: { refreshToken: newTokens } });
      }
      return unauthenticated();
    } });
  const pending = client.request('query Me { me { id } }');
  const checked = assert.rejects(pending, code('SESSION_CHANGED'));
  await started.promise;
  await storage.clearTokens();
  release.resolve();
  await checked;
  assert.equal(storage.snapshot().tokens, null);
  assert.equal(storage.snapshot().writes, 0);
});

test('new login while refresh is pending is preserved and used for the retry', async () => {
  const storage = memoryStorage();
  const loginTokens = { accessToken: 'other-login-access', refreshToken: 'other-login-refresh' };
  const started = deferred();
  const release = deferred();
  const client = createGraphQLClient({ endpoint, storage,
    fetch: async (_url, init) => {
      if (body(init).query.includes('WardrobeRefresh')) {
        started.resolve(); await release.promise;
        return response({ data: { refreshToken: newTokens } });
      }
      if (init.headers.Authorization === 'Bearer old-access') return unauthenticated();
      assert.equal(init.headers.Authorization, 'Bearer other-login-access');
      return response({ data: { me: { id: 'other-customer' } } });
    } });
  const pending = client.request('query Me { me { id } }');
  await started.promise;
  await storage.setTokens(loginTokens);
  release.resolve();
  assert.deepEqual(await pending, { me: { id: 'other-customer' } });
  assert.deepEqual(storage.snapshot().tokens, loginTokens);
  assert.equal(storage.snapshot().writes, 1);
});

test('network and HTTP mutation failures are typed and never retried', async () => {
  for (const kind of ['NETWORK', 'HTTP']) {
    let calls = 0;
    const client = createGraphQLClient({ endpoint, storage: memoryStorage(),
      fetch: async () => {
        calls++;
        if (kind === 'NETWORK') throw new Error('password=not-for-errors');
        return response({ sensitive: 'private body' }, 503);
      } });
    await assert.rejects(client.request('mutation Create { createOrder(input: {}) { id } }',
      undefined, { retryOnUnauthenticated: true }), (error) => {
      assert.equal(error.code, kind);
      assert.equal(JSON.stringify(error).includes('private'), false);
      assert.equal(error.message.includes('password'), false);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('timeout aborts a pending fetch and never retries', async () => {
  let calls = 0;
  let signal;
  const client = createGraphQLClient({ endpoint, timeoutMs: 15, fetch: async (_url, init) => {
    calls++; signal = init.signal; return new Promise(() => {});
  } });
  await assert.rejects(client.request('mutation Create { createOrder(input: {}) { id } }'),
    code('TIMEOUT'));
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test('caller cancellation is typed and releases a pending operation', async () => {
  const controller = new AbortController();
  const started = deferred();
  const client = createGraphQLClient({ endpoint, fetch: async () => {
    started.resolve(); return new Promise(() => {});
  } });
  const pending = client.request('query Products { products { total } }', undefined,
    { signal: controller.signal });
  const checked = assert.rejects(pending, code('ABORTED'));
  await started.promise;
  controller.abort();
  await checked;
});

test('GraphQL diagnostics cannot leak server messages or untrusted error codes', async () => {
  const client = createGraphQLClient({ endpoint, fetch: async () => response({
    data: null, errors: [{ message: 'merchant-secret=do-not-expose',
      extensions: { code: 'secret-token-with-dashes' }, stack: 'private-stack' }],
  }) });
  await assert.rejects(client.request('query Example { example }'), (error) => {
    assert.equal(error.code, 'GRAPHQL');
    assert.deepEqual(error.graphqlCodes, ['UNKNOWN']);
    assert.equal(JSON.stringify(error).includes('secret'), false);
    assert.equal(error.message.includes('merchant'), false);
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('invalid JSON/envelopes and token storage failures are typed', async () => {
  for (const payload of [null, [], {}, { errors: 'invalid' }]) {
    const client = createGraphQLClient({ endpoint, fetch: async () => response(payload) });
    await assert.rejects(client.request('query Example { example }'), code('INVALID_RESPONSE'));
  }
  const client = createGraphQLClient({ endpoint, storage: {
    async getTokens() { throw new Error('sensitive native failure'); },
    async setTokens() {}, async clearTokens() {},
  }, fetch: async () => { throw new Error('must not be reached'); } });
  await assert.rejects(client.request('query Me { me { id } }'), code('STORAGE'));
});

test('endpoint credentials and non-HTTP schemes are rejected without exposure', () => {
  for (const address of ['https://name:private@local-validation.invalid/graphql',
    'javascript:alert(1)', 'https://local-validation.invalid/graphql?token=private']) {
    assert.throws(() => createGraphQLClient({ endpoint: address }), (error) => {
      assert.equal(error.code, 'INVALID_ENDPOINT');
      assert.equal(error.message.includes('private'), false);
      return true;
    });
  }
});

test('a mixed query/mutation document never auto-retries the selected mutation', async () => {
  let calls = 0;
  const client = createGraphQLClient({ endpoint, storage: memoryStorage(),
    fetch: async () => { calls++; return unauthenticated(); } });
  await assert.rejects(client.request(
    'query Read { me { id } } mutation Write { clearCart }',
    undefined, { operationName: 'Write' }), code('GRAPHQL'));
  assert.equal(calls, 1);
});
