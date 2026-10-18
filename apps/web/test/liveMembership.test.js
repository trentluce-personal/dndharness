import test from 'node:test';
import assert from 'node:assert/strict';
import { createMembershipDiscovery, createMembershipHeartbeat } from '../src/liveMembership.js';

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const detail = (id, revision = 1) => ({ id, revision, self: { joined: true, isHost: id === 'host' } });

function fixture(t, read) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  let epoch = 0, details = {}, error = '', sessions = [];
  const beats = [];
  const shared = {
    read, getEpoch: () => epoch, getDetails: () => details,
    install: (next) => { if (!details[next.id] || next.revision >= details[next.id].revision) details = { ...details, [next.id]: next }; },
  };
  const remove = (id) => { delete details[id]; };
  const discovery = createMembershipDiscovery({ ...shared, onDirectory: (next) => { sessions = next; }, remove, onError: (next) => { error = next; } });
  const heartbeat = createMembershipHeartbeat({ ...shared, install: (next) => { shared.install(next); beats.push({ id: next.id, time: Date.now() }); }, onMissing: remove, onError: () => {} });
  t.after(() => { discovery.dispose(); heartbeat.dispose(); });
  return { discovery, heartbeat, get details() { return details; }, get sessions() { return sessions; }, get error() { return error; }, beats, leave(id) { epoch++; remove(id); }, accept: shared.install };
}

test('fresh workspace reload at Dice discovers host despite another failed detail and renews before five minutes without SSE', async (t) => {
  let failed = true, reads = 0;
  const state = fixture(t, async (path) => {
    if (path === '/live-sessions') { reads++; return [{ id: 'peer' }, { id: 'host' }]; }
    if (path === '/live-sessions/peer' && failed) throw new Error('Temporary peer failure');
    return detail(path.split('/')[2]);
  });
  t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host.self.isHost, true);
  assert.match(state.error, /Temporary peer failure/);
  assert.equal(state.sessions.length, 2);
  t.mock.timers.tick(29940); await flush();
  assert.ok(state.beats.some(({ id, time }) => id === 'host' && time < 300000));
  failed = false;
  t.mock.timers.tick(60); await flush();
  assert.equal(state.details.peer.self.joined, true);
  assert.equal(state.error, '');
  assert.equal(reads, 2, 'fixed recurring retry, no SSE or peer invalidation');
});

test('failed host detail on reload recovers membership on recurring retry and then heartbeats', async (t) => {
  let failed = true;
  const state = fixture(t, async (path) => {
    if (path === '/live-sessions') return [{ id: 'host' }];
    if (failed) throw new Error('Unavailable');
    return detail('host');
  });
  t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host, undefined);
  failed = false;
  t.mock.timers.tick(30000); await flush();
  t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host.self.joined, true);
  t.mock.timers.tick(30000); await flush();
  assert.ok(state.beats.some(({ id, time }) => id === 'host' && time < 300000));
});

test('transient failures retain known memberships; only authoritative absence or 404 removes them', async (t) => {
  let mode = 'healthy';
  const state = fixture(t, async (path) => {
    if (path === '/live-sessions') {
      if (mode === 'directory-fail') throw new Error('Directory offline');
      return mode === 'absent' ? [] : [{ id: 'host' }];
    }
    if (mode === '404') throw Object.assign(new Error('Gone'), { status: 404 });
    if (mode === 'detail-fail') throw new Error('Detail offline');
    return detail('host');
  });
  t.mock.timers.tick(60); await flush();
  for (mode of ['directory-fail', 'detail-fail']) {
    state.discovery.request(); t.mock.timers.tick(60); await flush();
    assert.equal(state.details.host.self.joined, true);
  }
  mode = '404'; state.discovery.request(); t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host, undefined);
  state.accept(detail('host')); mode = 'absent';
  state.discovery.request(); t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host, undefined);
});

test('late directory, detail and heartbeat responses cannot resurrect same-browser leave', async (t) => {
  let releaseDetail, releaseHeartbeat;
  const state = fixture(t, (path) => {
    if (path === '/live-sessions') return Promise.resolve([{ id: 'host' }]);
    return new Promise((resolve) => { if (path.endsWith('/heartbeat')) releaseHeartbeat = resolve; else releaseDetail = resolve; });
  });
  state.accept(detail('host'));
  t.mock.timers.tick(60); await flush();
  state.heartbeat.request(); await flush();
  state.leave('host');
  releaseDetail(detail('host', 2)); releaseHeartbeat(detail('host', 3)); await flush();
  assert.equal(state.details.host, undefined);
  assert.equal(state.beats.length, 0);
});

test('directory absence captured before a local join cannot erase the newly joined session', async (t) => {
  let release;
  const state = fixture(t, () => new Promise((resolve) => { release = resolve; }));
  t.mock.timers.tick(60); await flush();
  state.leave('host'); // Membership epoch also changes on join.
  state.accept(detail('host'));
  release([]); await flush();
  assert.equal(state.details.host.self.joined, true);
});

test('a stalled peer neither blocks successful discovery nor causes an unbounded retry storm', async (t) => {
  let reads = 0;
  const state = fixture(t, async (path) => {
    if (path === '/live-sessions') { reads++; return [{ id: 'peer' }, { id: 'host' }]; }
    if (path === '/live-sessions/peer') return new Promise(() => {});
    return detail('host');
  });
  t.mock.timers.tick(60); await flush();
  assert.equal(state.details.host.self.joined, true);
  t.mock.timers.tick(15000); await flush();
  assert.match(state.error, /timed out/);
  assert.equal(reads, 1);
  t.mock.timers.tick(15000); await flush();
  t.mock.timers.tick(60); await flush();
  assert.equal(reads, 2);
  assert.ok(state.beats.some(({ id }) => id === 'host'));
});
