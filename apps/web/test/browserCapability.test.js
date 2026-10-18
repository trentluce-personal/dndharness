import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCapabilityCoordinator, createInitializationStore } from '../src/browserCapability.js';

function fixture() {
  let locked = false;
  let cookie = false;
  let issued = 0;
  const calls = [];
  const store = {
    async claim() { if (locked) return false; locked = true; return true; },
    async release() { locked = false; },
  };
  const fetch = async (path, options) => {
    calls.push({ path, options });
    assert.equal(path, '/api/live-browser');
    assert.equal(options.credentials, 'same-origin');
    const { probe } = JSON.parse(options.body);
    if (!probe) {
      issued++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      cookie = true;
    }
    return { ok: true, json: async () => ({ ready: cookie }) };
  };
  return { store, fetch, calls, get issued() { return issued; }, get locked() { return locked; }, set cookie(value) { cookie = value; } };
}

test('simultaneous independent tabs initialize exactly once; same-tab callers share setup', async () => {
  const state = fixture();
  const tabA = createBrowserCapabilityCoordinator({ ...state, pollMs: 1 });
  const tabB = createBrowserCapabilityCoordinator({ ...state, pollMs: 1 });
  await Promise.all([tabA(), tabA(), tabB()]);
  assert.equal(state.issued, 1);
  assert.equal(state.locked, false);
  assert.ok(!JSON.stringify(state.calls).includes('token'));
  await tabB();
  assert.equal(state.issued, 1);
  state.cookie = false;
  await tabA(); // No cached ready flag after cookies are cleared/expire.
  assert.equal(state.issued, 2);
});

test('uncertain late cookie response never permits replacement initializer; later probe recovers', async () => {
  const state = fixture();
  let finish;
  const fetch = async (path, options) => {
    if (!JSON.parse(options.body).probe) await new Promise((resolve) => { finish = resolve; });
    return state.fetch(path, options);
  };
  const tabA = createBrowserCapabilityCoordinator({ store: state.store, fetch, timeoutMs: 15, pollMs: 1 });
  await assert.rejects(tabA(), /close all tabs/);
  assert.equal(state.locked, true);
  const tabB = createBrowserCapabilityCoordinator({ store: state.store, fetch: state.fetch, timeoutMs: 15, pollMs: 1 });
  await assert.rejects(tabB(), /pending in another tab/);
  assert.equal(state.issued, 0);
  finish(); // Model a response arriving even though abort was requested.
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(state.issued, 1);
  assert.equal(state.locked, true);
  await tabB(); // Cookie is usable; sticky marker causes no replacement request.
  assert.equal(state.issued, 1);
});

test('crashed tab marker fails closed; missing storage or blocked cookies is actionable', async () => {
  const state = fixture();
  await state.store.claim();
  const crashed = createBrowserCapabilityCoordinator({ store: state.store, fetch: state.fetch, timeoutMs: 10, pollMs: 1 });
  await assert.rejects(crashed(), /clear this site’s data/);
  assert.equal(state.issued, 0);
  const unavailable = createBrowserCapabilityCoordinator({ store: createInitializationStore(undefined), fetch: state.fetch });
  await assert.rejects(unavailable(), /Enable site storage and cookies/);
  const blocked = fixture();
  const noCookies = createBrowserCapabilityCoordinator({ store: blocked.store, fetch: async () => ({ ok: true, json: async () => ({ ready: false }) }) });
  await assert.rejects(noCookies(), /clear this site’s data/);
  assert.equal(blocked.locked, true);
});

test('blocked storage transactions and failed requests have bounded caller lifetime', async () => {
  const blocked = createBrowserCapabilityCoordinator({ store: { claim: () => new Promise(() => {}) }, fetch: async () => ({ ok: true, json: async () => ({ ready: false }) }), timeoutMs: 10 });
  await assert.rejects(blocked(), /pending in another tab/);
  const state = fixture();
  const failed = createBrowserCapabilityCoordinator({ store: state.store, fetch: async (path, options) => {
    if (!JSON.parse(options.body).probe) throw new Error('Connection lost');
    return state.fetch(path, options);
  } });
  await assert.rejects(failed(), /close all tabs/);
  assert.equal(state.locked, true);
});

test('API helper probes capability before host/join, keeps ordinary writes open, and propagates setup errors', async () => {
  const previous = globalThis.fetch;
  const paths = [];
  let ready = true;
  globalThis.fetch = async (path, options) => {
    paths.push(path);
    if (path === '/api/live-browser') return { ok: ready, json: async () => ready ? { ready: true } : { error: 'Setup unavailable' } };
    assert.equal(options.credentials, 'same-origin');
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const { api } = await import('../src/api.js');
    await api('/live-sessions', 'POST', {});
    await api('/live-sessions/table/join', 'POST', {});
    await api('/campaigns', 'POST', {});
    await api('/live-sessions/table/heartbeat', 'POST', {});
    assert.deepEqual(paths, ['/api/live-browser', '/api/live-sessions', '/api/live-browser', '/api/live-sessions/table/join', '/api/campaigns', '/api/live-sessions/table/heartbeat']);
    ready = false;
    await assert.rejects(api('/live-sessions', 'POST', {}), /Setup unavailable/);
    assert.equal(paths.at(-1), '/api/live-browser');
  } finally { globalThis.fetch = previous; }
});
