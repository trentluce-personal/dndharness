import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSessions, browserPrincipal } from '../src/live-sessions.js';
import { parseOrigins, hostingInfo } from '../src/origins.js';

test('browser capability is random, cookie-only and stored as a hash', () => {
  const cookies = [];
  const res = { append: (name, value) => cookies.push(value) };
  assert.equal(browserPrincipal({ headers: {} }, res), null);
  const first = browserPrincipal({ headers: {} }, res, true);
  const second = browserPrincipal({ headers: {} }, res, true);
  assert.notEqual(first, second);
  assert.match(cookies[0], /^dndharness_live=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/api; Max-Age=604800/);
  const cookie = cookies[0].split(';')[0];
  assert.equal(browserPrincipal({ headers: { cookie } }, res), first);
  assert.notEqual(cookie.split('=')[1], first);
  const previous = process.env.COOKIE_SECURE;
  try {
    process.env.COOKIE_SECURE = 'true';
    browserPrincipal({ headers: { cookie: 'dndharness_live=forged' } }, res, true);
    assert.match(cookies.at(-1), /; Secure$/);
  } finally {
    if (previous === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = previous;
  }
});

test('configured origins normalize exactly and hosting never trusts request hosts', () => {
  assert.deepEqual(parseOrigins(' HTTP://LOCALHOST:80/,https://table.example:443,http://192.168.1.9:5173 '), ['http://localhost', 'https://table.example', 'http://192.168.1.9:5173']);
  assert.deepEqual(hostingInfo(parseOrigins('http://127.1.2.3,http://localhost,http://[::1],http://table.local:5173')), { lanConfigured: true, joinUrls: ['http://table.local:5173'] });
  assert.deepEqual(hostingInfo(parseOrigins()), { lanConfigured: false, joinUrls: [] });
  for (const origin of ['', '*', 'null', 'file:///tmp', 'https://*.test', 'http://x/path', 'http://x/.', 'http://x/?q=1', 'http://x/#a', 'http://user:secret@x', 'http://x,http://y/bad']) assert.throws(() => parseOrigins(origin), /APP_ORIGINS/);
});

test('leases, shared-tab idempotency, limits, expiration events and bounded end tombstones', () => {
  let time = 0;
  const emitted = [];
  const registry = createLiveSessions({ now: () => time, publish: (...event) => emitted.push(event), maxSessions: 2, maxParticipants: 2 });
  const campaign = { id: 'campaign', title: 'Journal title', adventure: { title: 'Adventure title' }, editionId: 'edition' };
  try {
    const hosted = registry.create(campaign, 'host-hash', 'Host');
    assert.equal(hosted.title, 'Adventure title');
    assert.equal(hosted.self.isHost, true);
    assert.equal(hosted.participantCount, 1);
    assert.equal(hosted.revision, 1);
    assert.equal(registry.detail(hosted.id, 'outsider').self.joined, false);
    assert.equal(registry.detail(hosted.id, 'outsider').self.participantId, null);
    assert.throws(() => registry.create(campaign, 'other-host', 'Other'), { status: 409 });
    registry.create({ ...campaign, id: 'second' }, 'second-host', 'Second');
    assert.throws(() => registry.create({ ...campaign, id: 'third' }, 'third-host', 'Third'), { status: 429 });
    let joined = registry.join(hosted.id, 'player-hash', 'Player');
    const participantId = joined.self.participantId;
    const eventCount = emitted.length;
    joined = registry.join(hosted.id, 'player-hash', 'Rename attempt');
    assert.equal(joined.self.participantId, participantId);
    assert.equal(joined.participants.find((p) => p.id === participantId).displayName, 'Player');
    registry.join(hosted.id, 'host-hash', 'Host rename attempt');
    assert.equal(registry.detail(hosted.id, 'host-hash').hostName, 'Host');
    assert.equal(emitted.length, eventCount);
    assert.throws(() => registry.join(hosted.id, 'third-hash', 'Third'), { status: 429 });
    assert.throws(() => registry.leave(hosted.id, 'host-hash'), { status: 409 });
    assert.throws(() => registry.end(hosted.id, 'player-hash'), { status: 403 });
    assert.throws(() => registry.heartbeat(hosted.id, 'outsider'), { status: 403 });
    time = 200000;
    registry.heartbeat(hosted.id, 'host-hash');
    assert.equal(emitted.length, eventCount);
    time = 300000;
    registry.sweep();
    assert.equal(registry.list().length, 1); // Other campaign's host expired.
    assert.equal(registry.detail(hosted.id, 'player-hash').self.joined, false);
    assert.equal(registry.detail(hosted.id, 'host-hash').participantCount, 1);
    assert.equal(registry.detail(hosted.id, 'host-hash').revision, 3);
    assert.deepEqual(emitted.at(-2), ['live-sessions-changed', {}]);
    assert.equal(emitted.at(-1)[0], 'live-session-changed');
    const rejoined = registry.join(hosted.id, 'player-hash', 'Back');
    assert.notEqual(rejoined.self.participantId, participantId);
    registry.leave(hosted.id, 'player-hash');
    const leftCount = emitted.length;
    registry.leave(hosted.id, 'player-hash');
    assert.equal(emitted.length, leftCount);
    registry.campaignChanged({ ...campaign, adventure: { title: 'Current source' } });
    assert.equal(registry.detail(hosted.id, 'host-hash').title, 'Current source');
    time = 500000;
    assert.throws(() => registry.detail(hosted.id, 'host-hash'), { status: 404 });
    registry.end(hosted.id, 'host-hash'); // Short host-only idempotency window.
    assert.throws(() => registry.end(hosted.id, 'player-hash'), { status: 404 });
    time += 300000;
    assert.throws(() => registry.end(hosted.id, 'host-hash'), { status: 404 });
    assert.deepEqual(registry.list(), []);
    assert.ok(!JSON.stringify(emitted).includes('hash'));
    assert.ok(!JSON.stringify(hosted).includes('hash'));
  } finally { registry.close(); }
});

test('any tab heartbeat extends a player lease, tombstones are bounded and shutdown rejects hosting', () => {
  let time = 0;
  const registry = createLiveSessions({ now: () => time });
  const campaign = { id: 'campaign', title: 'Table', editionId: 'edition' };
  try {
    const session = registry.create(campaign, 'host', 'Host');
    const player = registry.join(session.id, 'shared-browser', 'Player');
    time = 200000;
    registry.heartbeat(session.id, 'host');
    assert.equal(registry.heartbeat(session.id, 'shared-browser').self.participantId, player.self.participantId);
    time = 300001;
    assert.equal(registry.detail(session.id, 'shared-browser').self.joined, true);
    registry.end(session.id, 'host');
    for (let i = 0; i < 100; i++) {
      const next = registry.create(campaign, 'host', 'Host');
      registry.end(next.id, 'host');
    }
    assert.throws(() => registry.end(session.id, 'host'), { status: 404 });
    registry.close();
    assert.throws(() => registry.create(campaign, 'host', 'Host'), { status: 503 });
  } finally { registry.close(); }
});

test('standalone tables share the 100-session cap without title or null-key collisions', () => {
  const registry = createLiveSessions();
  const campaign = { id: 'linked', title: 'Same title', editionId: 'edition' };
  try {
    const linked = registry.create(campaign, 'linked-host', 'Host');
    const standalone = Array.from({ length: 99 }, () => registry.createStandalone(' Same title ', 'host', ' Host '));
    assert.equal(new Set(registry.list().map((s) => s.id)).size, 100);
    for (const session of standalone) {
      assert.equal(session.campaignId, null);
      assert.equal(session.editionId, null);
      assert.equal(session.title, 'Same title');
      assert.equal(session.hostName, 'Host');
    }
    assert.throws(() => registry.createStandalone('Another', 'host', 'Host'), { status: 429 });
    assert.throws(() => registry.create({ ...campaign, id: 'other' }, 'host', 'Host'), { status: 429 });
    registry.end(standalone[0].id, 'host');
    assert.throws(() => registry.create(campaign, 'host', 'Host'), { status: 409 });
    registry.campaignChanged({ ...campaign, title: 'Renamed linked table' });
    registry.campaignChanged({ id: null, title: 'Must not link', editionId: 'other' });
    assert.equal(registry.detail(linked.id, 'linked-host').title, 'Renamed linked table');
    assert.deepEqual(registry.detail(standalone[1].id, 'host'), standalone[1]);
    registry.end(linked.id, 'linked-host');
    const replacement = registry.create(campaign, 'linked-host', 'Host');
    registry.end(standalone[2].id, 'host');
    assert.equal(registry.detail(replacement.id, 'linked-host').campaignId, campaign.id);
    assert.throws(() => registry.create(campaign, 'host', 'Host'), { status: 409 });
  } finally { registry.close(); }
});

test('standalone leases, participant cap, host authority and shutdown use existing lifecycle', () => {
  let time = 0;
  const registry = createLiveSessions({ now: () => time, maxParticipants: 2 });
  try {
    const session = registry.createStandalone('Table', 'host', 'Host');
    const other = registry.createStandalone('Table', 'other-host', 'Host');
    registry.join(session.id, 'player', 'Player');
    assert.throws(() => registry.join(session.id, 'extra', 'Extra'), { status: 429 });
    assert.throws(() => registry.end(session.id, 'player'), { status: 403 });
    assert.throws(() => registry.leave(session.id, 'host'), { status: 409 });
    time = 200000;
    registry.heartbeat(session.id, 'host');
    time = 300000;
    registry.sweep();
    assert.equal(registry.detail(session.id, 'player').self.joined, false);
    assert.throws(() => registry.detail(other.id, 'other-host'), { status: 404 });
    time = 500000;
    assert.throws(() => registry.detail(session.id, 'host'), { status: 404 });
    registry.end(session.id, 'host');
    assert.deepEqual(registry.list(), []);
    registry.close();
    assert.throws(() => registry.createStandalone('Table', 'host', 'Host'), { status: 503 });
  } finally { registry.close(); }
});
