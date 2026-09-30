const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiClientError } = require('@wardrobe/api-client');
const source = fs.readFileSync(path.resolve(__dirname, '../../../services/secure-session.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS,
} }).outputText;
const first = { accessToken: 'fake-first-access', refreshToken: 'fake-first-refresh' };
const second = { accessToken: 'fake-second-access', refreshToken: 'fake-second-refresh' };
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return {promise,resolve}; }
function fixture(sharedMap = new Map()) {
  let setGate;
  let getGate;
  let failSet = false;
  let failGet = false;
  const writes = [];
  const mock = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    async getItemAsync(key) {
      if (failGet) throw new Error('fake-native-sensitive-detail');
      const value = sharedMap.get(key) ?? null;
      if (getGate) { const gate = getGate; getGate = null; gate.started.resolve(); await gate.release.promise; }
      return value;
    },
    async setItemAsync(key, value, options) {
      if (failSet) throw new Error('fake-native-sensitive-detail');
      if (setGate) { const gate = setGate; setGate = null; gate.started.resolve(); await gate.release.promise; }
      writes.push({key,value,options});
      sharedMap.set(key,value);
    },
    async deleteItemAsync(key) { sharedMap.delete(key); },
  };
  const module = {exports:{}};
  vm.runInNewContext(compiled, {
    exports: module.exports, module,
    require(name) {
      if (name === 'expo-secure-store') return mock;
      if (name === '@wardrobe/api-client') return {ApiClientError};
      throw new Error('Unexpected test module');
    },
    Date, Promise, Set, JSON, Error,
  }, {filename:'mocked-secure-session.js'});
  return {
    api: module.exports, map: sharedMap, writes,
    blockSet() { setGate = {started:deferred(),release:deferred()}; return setGate; },
    blockGet() { getGate = {started:deferred(),release:deferred()}; return getGate; },
    failSet(value) {failSet=value;}, failGet(value) {failGet=value;},
  };
}
const key = 'wardrobe.secure-session.v1';
const plain = (value) => JSON.parse(JSON.stringify(value));

test('tokens share one atomic SecureStore record and refresh preserves session generation', async () => {
  const local = fixture();
  await local.api.replaceSession(first);
  const originalKey = await local.api.tokenStorage.getSessionKey();
  const restored = fixture(local.map);
  assert.deepEqual(plain(await restored.api.tokenStorage.getTokens()), first);
  assert.equal(await restored.api.tokenStorage.getSessionKey(), originalKey);
  await local.api.tokenStorage.setTokens(second, originalKey);
  assert.equal(await local.api.tokenStorage.getSessionKey(), originalKey);
  assert.equal(local.map.size,1);
  assert.deepEqual(JSON.parse(local.map.get(key)), {...second,sessionKey:originalKey});
  assert.equal(local.writes.every((write) => write.key === key && write.options.keychainAccessible === 6),true);
});

test('a new session is hidden until the secure write commits', async () => {
  const local = fixture();
  const events = [];
  local.api.subscribeSessionChanges((event) => events.push(event));
  const gate = local.blockSet();
  const pending = local.api.replaceSession(first);
  await gate.started.promise;
  assert.equal(await local.api.tokenStorage.getTokens(),null);
  assert.equal(events[0].hasSession,false);
  gate.release.resolve();
  await pending;
  assert.deepEqual(plain(await local.api.tokenStorage.getTokens()),first);
  assert.equal(events.at(-1).hasSession,true);
});

test('logout during a pending refresh write cannot resurrect tokens', async () => {
  const local = fixture();
  await local.api.replaceSession(first);
  const originalKey = await local.api.tokenStorage.getSessionKey();
  const gate = local.blockSet();
  const refreshing = local.api.tokenStorage.setTokens(second,originalKey);
  const checked = assert.rejects(refreshing, (error) => error.code === 'SESSION_CHANGED');
  await gate.started.promise;
  const clearing = local.api.tokenStorage.clearTokens();
  assert.equal(await local.api.tokenStorage.getTokens(),null);
  gate.release.resolve();
  await Promise.all([checked,clearing]);
  assert.equal(local.map.has(key),false);
  assert.equal(await local.api.tokenStorage.getTokens(),null);
});

test('stale refresh writes cannot overwrite a new login', async () => {
  const local = fixture();
  await local.api.replaceSession(first);
  const originalKey = await local.api.tokenStorage.getSessionKey();
  await local.api.replaceSession(second);
  const currentKey = await local.api.tokenStorage.getSessionKey();
  assert.notEqual(currentKey,originalKey);
  await assert.rejects(local.api.tokenStorage.setTokens(first,originalKey),
    (error) => error.code === 'SESSION_CHANGED');
  assert.deepEqual(plain(await local.api.tokenStorage.getTokens()),second);
});

test('invalid old refresh cannot clear a new login', async () => {
  const local = fixture();
  await local.api.replaceSession(first);
  const originalKey = await local.api.tokenStorage.getSessionKey();
  await local.api.replaceSession(second);
  await assert.rejects(local.api.tokenStorage.clearTokens(originalKey),
    (error) => error.code === 'SESSION_CHANGED');
  assert.deepEqual(plain(await local.api.tokenStorage.getTokens()),second);
  assert.equal(local.map.has(key),true);
});

test('logout while hydration is reading old storage cannot restore old tokens', async () => {
  const existing = new Map([[key,JSON.stringify({...first,sessionKey:'session-100-2'})]]);
  const local = fixture(existing);
  const gate = local.blockGet();
  const loading = local.api.tokenStorage.getTokens();
  await gate.started.promise;
  const clearing = local.api.tokenStorage.clearTokens();
  gate.release.resolve();
  assert.equal(await loading,null);
  await clearing;
  assert.equal(existing.has(key),false);
});

test('malformed secure record is treated as no usable session', async () => {
  for (const value of ['not-json',JSON.stringify({accessToken:123,refreshToken:'fake'}),
    JSON.stringify({accessToken:'fake-only'})]) {
    const local=fixture(new Map([[key,value]]));
    assert.equal(await local.api.tokenStorage.getTokens(),null);
  }
});

test('native storage failure is redacted and a failed login is not visible', async () => {
  const local=fixture();
  local.failSet(true);
  await assert.rejects(local.api.replaceSession(first), (error) => {
    assert.equal(error.code,'STORAGE');
    assert.equal(error.message.includes('sensitive'),false);
    assert.equal(error.cause,undefined);
    return true;
  });
  assert.equal(await local.api.tokenStorage.getTokens(),null);
  const reader=fixture();
  reader.failGet(true);
  await assert.rejects(reader.api.tokenStorage.getTokens(), (error) => error.code === 'STORAGE');
});

test('stale successful login cannot replace a newer account', async () => {
  const local = fixture();
  const guestKey = await local.api.tokenStorage.getSessionKey();
  const committed = await local.api.replaceSession(second, guestKey);
  assert.equal(committed, await local.api.tokenStorage.getSessionKey());
  await assert.rejects(local.api.replaceSession(first, guestKey),
    (error) => error.code === 'SESSION_CHANGED');
  assert.deepEqual(plain(await local.api.tokenStorage.getTokens()), second);
});

test('logout during an explicit login commit cannot restore that account', async () => {
  const local = fixture();
  const gate = local.blockSet();
  const signingIn = local.api.replaceSession(first);
  const checked = assert.rejects(signingIn, (error) => error.code === 'SESSION_CHANGED');
  await gate.started.promise;
  const clearing = local.api.tokenStorage.clearTokens();
  gate.release.resolve();
  await Promise.all([checked, clearing]);
  assert.equal(await local.api.tokenStorage.getTokens(), null);
  assert.equal(local.map.has(key), false);
});
function authFixture(me) {
  const local = fixture();
  const cache = { cancellations: 0, clears: 0 };
  const storeSource = fs.readFileSync(path.resolve(__dirname, '../../../store/auth.ts'), 'utf8');
  const storeCompiled = ts.transpileModule(storeSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  const module = { exports: {} };
  function create(initializer) {
    let state;
    const set = (partial) => { state = {...state,...partial}; };
    const get = () => state;
    const store = (selector) => selector(state);
    store.getState = get;
    store.setState = set;
    state = initializer(set,get);
    return store;
  }
  vm.runInNewContext(storeCompiled, {
    exports: module.exports, module,
    require(name) {
      if (name === 'zustand') return {create};
      if (name === '@wardrobe/api-client') return {ApiClientError};
      if (name === '../services/secure-session') return local.api;
      if (name === '../services/api') return {mobileApi:{me}};
      if (name === '../services/query-client') return {queryClient:{
        async cancelQueries() {cache.cancellations += 1;},
        clear() {cache.clears += 1;},
      }};
      throw new Error('Unexpected auth store test module');
    }, Date, Promise, Error,
  }, {filename:'mocked-auth-store.js'});
  return {...local,store:module.exports.useAuth,cache};
}
const profile = {id:'fake-user',email:'fake@phone.local',phone:'+998000000000',firstName:'Fake',role:'USER'};

test('hydration opens offline and preserves stored tokens after a network failure', async () => {
  const local = authFixture(async () => {throw new ApiClientError('NETWORK');});
  await local.api.replaceSession(first);
  local.store.setState({hydrated:false});
  await local.store.getState().hydrate();
  assert.equal(local.store.getState().hydrated,true);
  assert.equal(local.store.getState().hasSession,true);
  assert.equal(local.store.getState().issue,'NETWORK');
  assert.deepEqual(plain(await local.api.tokenStorage.getTokens()),first);
});

test('repeated hydration never starts duplicate profile requests', async () => {
  const gate = deferred();
  let calls = 0;
  const local = authFixture(async () => {calls += 1;await gate.promise;return profile;});
  await local.api.replaceSession(first);
  local.store.setState({hydrated:false});
  const firstHydrate = local.store.getState().hydrate();
  const secondHydrate = local.store.getState().hydrate();
  await new Promise((done) => setImmediate(done));
  assert.equal(calls,1);
  assert.equal(local.store.getState().hydrated,true);
  gate.resolve();
  await Promise.all([firstHydrate,secondHydrate]);
  assert.equal(local.store.getState().user.id,profile.id);
});

test('late profile hydration cannot repopulate a logged-out account or its cache', async () => {
  const gate = deferred();
  const started = deferred();
  const local = authFixture(async () => {started.resolve();await gate.promise;return profile;});
  await local.api.replaceSession(first);
  local.store.setState({hydrated:false});
  const hydrating = local.store.getState().hydrate();
  await started.promise;
  await local.store.getState().logout();
  gate.resolve();
  await hydrating;
  assert.equal(local.store.getState().user,null);
  assert.equal(local.store.getState().hasSession,false);
  assert.equal(local.store.getState().hydrated,true);
  assert.equal(local.cache.clears > 0,true);
  assert.equal(local.cache.cancellations > 0,true);
});

test('logout during auth store session commit cannot apply the returned profile', async () => {
  const local = authFixture(async () => profile);
  await local.api.tokenStorage.getTokens();
  const guestKey = local.store.getState().sessionKey;
  const gate = local.blockSet();
  const signingIn = local.store.getState().setSession({...first,user:profile},guestKey);
  const checked = assert.rejects(signingIn,(error) => error.code === 'SESSION_CHANGED');
  await gate.started.promise;
  const signingOut = local.store.getState().logout();
  gate.release.resolve();
  await Promise.all([checked,signingOut]);
  assert.equal(local.store.getState().user,null);
  assert.equal(local.store.getState().hasSession,false);
  assert.equal(await local.api.tokenStorage.getTokens(),null);
});