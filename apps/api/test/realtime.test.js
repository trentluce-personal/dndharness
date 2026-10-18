import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import { createEvents } from '../src/events.js';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a dedicated _test database.');
const { app } = await import('../src/app.js');
const { events } = await import('../src/events.js');
const { liveSessions, closeRealtime } = await import('../src/live-routes.js');
const { pool, migrate } = await import('../src/db.js');

test('SSE backpressure closes slow clients and heartbeat/shutdown clean up', async () => {
  const hub = createEvents({ heartbeatMs: 5, maxStreams: 1 });
  function response(block = false) {
    const res = new EventEmitter();
    res.messages = [];
    res.status = () => res;
    res.set = () => res;
    res.flushHeaders = () => {};
    res.write = (value) => { res.messages.push(value); return !block; };
    res.destroy = () => { res.destroyed = true; res.emit('close'); };
    res.end = () => { res.writableEnded = true; res.emit('close'); };
    return res;
  }
  const slow = response(true);
  hub.connect({}, slow);
  assert.equal(slow.destroyed, true);
  assert.equal(hub.streamCount, 0);
  const active = response();
  hub.connect({}, active);
  const refused = { status(code) { assert.equal(code, 503); return this; }, json() {} };
  hub.connect({}, refused);
  await delay(20);
  assert.ok(active.messages.includes(': heartbeat\n\n'));
  hub.close();
  assert.equal(active.writableEnded, true);
  assert.equal(hub.streamCount, 0);
  const count = active.messages.length;
  await delay(15);
  assert.equal(active.messages.length, count);
});

test('accountless lifecycle, committed invalidations, rollback silence and stream cleanup', async (t) => {
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const controllers = [];
  const origin = 'http://127.0.0.1:5173';
  function browser() {
    let cookie;
    return async (path, method = 'GET', body, expected = 200, headers = {}) => {
      if (!cookie && method === 'POST' && (path === '/live-sessions' || path.endsWith('/join'))) {
        const bootstrap = await fetch(base + '/live-browser', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}' });
        assert.equal(bootstrap.status, 200);
        cookie = bootstrap.headers.get('set-cookie')?.split(';')[0];
        assert.deepEqual(await bootstrap.json(), { ready: true });
      }
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const nextCookie = response.headers.get('set-cookie');
      if (nextCookie) cookie = nextCookie.split(';')[0];
      const data = await response.json();
      if (Array.isArray(expected)) assert.ok(expected.includes(response.status), JSON.stringify(data));
      else assert.equal(response.status, expected, JSON.stringify(data));
      return { data, status: response.status, cookie: nextCookie };
    };
  }
  const host = browser(); const player = browser(); const outsider = browser();
  async function stream(headers = {}) {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(base + '/events', { headers, signal: controller.signal });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const records = [];
    const reader = response.body.getReader();
    let buffer = '';
    const reading = (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          buffer += new TextDecoder().decode(value);
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (!block.startsWith('event: ')) continue;
            const lines = block.split('\n');
            records.push({ event: lines[0].slice(7), data: JSON.parse(lines[1].slice(6)) });
          }
        }
      } catch (error) { if (!controller.signal.aborted) throw error; }
    })();
    return { records, controller, reading };
  }
  async function until(predicate) {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(10); }
    assert.fail('Timed out waiting for realtime condition.');
  }
  let active;
  try {
    active = await stream(); // Native EventSource may omit Origin.
    await until(() => active.records.length === 1);
    assert.deepEqual(active.records, [{ event: 'sync-required', data: {} }]);
    const campaign = (await host('/campaigns', 'POST', { title: 'Realtime fixture', editionId: 'dnd-5e-2024' }, 201)).data;
    await until(() => active.records.some((r) => r.event === 'campaign-changed' && r.data.campaignId === campaign.id));
    assert.deepEqual(active.records.at(-1), { event: 'campaign-changed', data: { campaignId: campaign.id, revision: 1 } });
    const historyBefore = (await host(`/campaigns/${campaign.id}/history`)).data;
    const payload = { campaignId: campaign.id, expectedRevision: campaign.revision, displayName: 'Session DM' };
    let session;
    await t.test('global Origin checks, explicit live Origin and JSON protections', async () => {
      const call = (body, headers = {}) => fetch(base + '/live-browser', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      const probe = await call({ probe: true });
      assert.deepEqual(await probe.json(), { ready: false });
      assert.equal(probe.headers.get('set-cookie'), null);
      const bootstrapped = await call({});
      assert.deepEqual(await bootstrapped.json(), { ready: true });
      const cookie = bootstrapped.headers.get('set-cookie').split(';')[0];
      const reused = await call({}, { Cookie: cookie });
      assert.deepEqual(await reused.json(), { ready: true });
      assert.equal(reused.headers.get('set-cookie'), null);
      const confirmed = await call({ probe: true }, { Cookie: cookie });
      assert.deepEqual(await confirmed.json(), { ready: true });
      assert.equal(confirmed.headers.get('set-cookie'), null);
      const denied = await call({}, { Origin: 'https://hostile.example' });
      assert.equal(denied.status, 403);
      await denied.json();
      const native = await fetch(base + '/live-browser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(native.status, 403);
      await native.json();
      for (const path of ['/live-sessions', '/live-sessions/missing/join']) {
        const uninitialized = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        assert.equal(uninitialized.status, 428);
        assert.equal(uninitialized.headers.get('set-cookie'), null);
        await uninitialized.json();
      }
      for (const path of ['/events', '/campaigns', '/live-sessions', '/hosting', '/health']) {
        const response = await fetch(base + path, { headers: { Origin: 'https://hostile.example' } });
        assert.equal(response.status, 403);
      }
      const noOrigin = await fetch(base + '/live-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(noOrigin.status, 403);
      await noOrigin.json();
      const mixedCase = await fetch(base.replace('/api', '/API') + '/LIVE-SESSIONS', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(mixedCase.status, 403);
      await mixedCase.json();
      await host('/live-sessions', 'POST', payload, 403, { Origin: 'null' });
      await host('/live-sessions', 'POST', payload, 415, { 'Content-Type': 'text/plain' });
      await host('/live-sessions', 'POST', [], 400);
      await host('/live-sessions', 'POST', { ...payload, expectedRevision: undefined }, 400);
      await host('/live-sessions', 'POST', { ...payload, expectedRevision: 2 }, 409);
      await host('/live-sessions', 'POST', { ...payload, displayName: '' }, 400);
      const hosting = (await host('/hosting', 'GET', undefined, 200, { Host: 'attacker.example', 'X-Forwarded-Host': 'attacker.example' })).data;
      assert.ok(Array.isArray(hosting.joinUrls));
      assert.ok(!JSON.stringify(hosting).includes('attacker'));
    });
    await t.test('concurrent host attempts permit exactly one session and no history changes', async () => {
      const attempts = await Promise.all([host('/live-sessions', 'POST', payload, [201, 409]), outsider('/live-sessions', 'POST', payload, [201, 409])]);
      assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409]);
      // Use the winner's browser as the authenticated host below.
      if (attempts[0].status !== 201) {
        await outsider(`/live-sessions/${attempts[1].data.id}/end`, 'POST', {});
        session = (await host('/live-sessions', 'POST', payload, 201)).data;
      } else session = attempts[0].data;
      assert.deepEqual(Object.keys(session).sort(), ['id', 'campaignId', 'title', 'editionId', 'hostName', 'startedAt', 'participantCount', 'revision', 'participants', 'self'].sort());
      assert.deepEqual(Object.keys(session.participants[0]).sort(), ['displayName', 'id', 'isHost']);
      assert.deepEqual(session.self, { participantId: session.participants[0].id, isHost: true, joined: true });
      assert.deepEqual((await host(`/campaigns/${campaign.id}/history`)).data, historyBefore);
      assert.deepEqual((await host(`/campaigns/${campaign.id}`)).data, campaign);
      assert.equal((await host('/live-sessions')).data.filter((s) => s.campaignId === campaign.id).length, 1);
      await outsider('/live-sessions', 'POST', payload, 409);
    });
    await t.test('standalone validation never treats an invalid supplied campaign ID as absent', async () => {
      const standalone = { title: 'Standalone', displayName: 'Host' };
      const before = (await host('/live-sessions')).data;
      for (const value of [undefined, null, '', '   ', 42, {}, [], 'x'.repeat(151)]) {
        await host('/live-sessions', 'POST', { ...standalone, title: value }, 400);
      }
      for (const value of [undefined, null, '', '   ', 42, {}, [], 'x'.repeat(101)]) {
        await host('/live-sessions', 'POST', { ...standalone, displayName: value }, 400);
      }
      for (const campaignId of [null, '', '   ', false, 42, {}, [], 'not-a-uuid']) {
        await host('/live-sessions', 'POST', { ...standalone, campaignId, expectedRevision: 1 }, 400);
      }
      await host('/live-sessions', 'POST', { ...standalone, campaignId: '00000000-0000-0000-0000-000000000000', expectedRevision: 1 }, 404);
      await host('/live-sessions', 'POST', { ...standalone, campaignId: campaign.id }, 400);
      await host('/live-sessions', 'POST', { ...standalone, campaignId: campaign.id, expectedRevision: 2 }, 409);
      for (const headers of [{ Origin: origin }, {}, { Origin: 'https://hostile.example' }]) {
        const response = await fetch(base + '/live-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(standalone) });
        assert.equal(response.status, headers.Origin === origin ? 428 : 403);
        assert.equal(response.headers.get('set-cookie'), null);
        await response.json();
      }
      assert.deepEqual((await host('/live-sessions')).data, before);
      for (const length of [1, 150]) {
        const created = (await host('/live-sessions', 'POST', { title: ` ${'x'.repeat(length)} `, displayName: ` ${'h'.repeat(length === 1 ? 1 : 100)} ` }, 201)).data;
        assert.equal(created.title.length, length);
        assert.equal(created.hostName.length, length === 1 ? 1 : 100);
        await host(`/live-sessions/${created.id}/end`, 'POST', {});
      }
    });
    await t.test('standalone host and two peers join/leave/end without any PostgreSQL access or content/history changes', async (st) => {
      async function storedContent() {
        const snapshot = {};
        for (const table of ['editions', 'campaigns', 'campaign_adventures', 'campaign_characters', 'campaign_saves', 'campaign_history']) {
          snapshot[table] = (await pool.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
        }
        return snapshot;
      }
      const before = await storedContent();
      const linkedBefore = (await host(`/live-sessions/${session.id}`)).data;
      // Fail on any database access, including read-only transactions. Restore
      // before comparing stored content and continuing the linked workflows.
      const connect = st.mock.method(pool, 'connect', () => { throw new Error('Standalone lifecycle must not access PostgreSQL'); });
      let standalone;
      try {
        standalone = (await host('/live-sessions', 'POST', { title: ' Standalone table ', displayName: ' Standalone host ', editionId: 'ignored', expectedRevision: -1 }, 201)).data;
        assert.deepEqual(Object.keys(standalone).sort(), Object.keys(session).sort());
        assert.equal(standalone.campaignId, null);
        assert.equal(standalone.editionId, null);
        assert.equal(standalone.title, 'Standalone table');
        assert.equal(standalone.hostName, 'Standalone host');
        assert.equal(standalone.revision, 1);
        assert.equal(standalone.participantCount, 1);
        assert.deepEqual(standalone.self, { participantId: standalone.participants[0].id, isHost: true, joined: true });
        const root = `/live-sessions/${standalone.id}`;
        assert.deepEqual((await player(root)).data.self, { participantId: null, isHost: false, joined: false });
        await player(root + '/heartbeat', 'POST', {}, 403);
        const first = (await player(root + '/join', 'POST', { displayName: 'Peer one' })).data;
        const second = (await outsider(root + '/join', 'POST', { displayName: 'Peer two' })).data;
        assert.equal(first.participantCount, 2);
        assert.equal(second.participantCount, 3);
        assert.notEqual(first.self.participantId, second.self.participantId);
        for (const participant of second.participants) assert.deepEqual(Object.keys(participant).sort(), ['displayName', 'id', 'isHost']);
        assert.equal((await player(root + '/join', 'POST', { displayName: 'Rename' })).data.self.participantId, first.self.participantId);
        for (const peer of [player, outsider]) {
          await peer(root + '/end', 'POST', {}, 403);
          await peer(root + '/heartbeat', 'POST', {});
          await peer(root + '/leave', 'POST', {});
          assert.equal((await peer(root)).data.self.joined, false);
        }
        await host(root + '/leave', 'POST', {}, 409);
        await host(root + '/heartbeat', 'POST', {});
        const summary = (await host('/live-sessions')).data.find((s) => s.id === standalone.id);
        assert.equal(summary.campaignId, null);
        assert.equal(summary.editionId, null);
        assert.equal(summary.participantCount, 1);
        assert.ok(!JSON.stringify(second).includes(campaign.id));
        assert.ok(!JSON.stringify(second).includes('dndharness_live'));
        await host(root + '/end', 'POST', {});
        await host(root + '/end', 'POST', {});
        await player(root, 'GET', undefined, 404);
        await player(root + '/join', 'POST', { displayName: 'Late' }, 404);
        assert.deepEqual((await host(`/live-sessions/${session.id}`)).data, linkedBefore);
        assert.equal(connect.mock.callCount(), 0);
      } finally { connect.mock.restore(); }
      assert.deepEqual(await storedContent(), before);
      await until(() => active.records.some((r) => r.event === 'live-session-changed' && r.data.sessionId === standalone.id && r.data.revision === 6));
      const lifecycle = active.records.filter((r) => r.event === 'live-session-changed' && r.data.sessionId === standalone.id);
      assert.deepEqual(lifecycle.map((r) => r.data), [1, 2, 3, 4, 5, 6].map((revision) => ({ sessionId: standalone.id, revision })));
    });
    await t.test('concurrent same-title standalone sessions coexist with a linked table and end independently', async () => {
      const owners = [host, player, outsider, browser()];
      const created = await Promise.all(owners.map((owner) => owner('/live-sessions', 'POST', { title: session.title, displayName: 'Same name' }, 201)));
      assert.equal(new Set(created.map((r) => r.data.id)).size, 4);
      assert.equal((await host('/live-sessions')).data.length, 5);
      for (let i = 0; i < created.length; i++) {
        assert.equal(created[i].data.campaignId, null);
        assert.equal(created[i].data.editionId, null);
        await owners[i](`/live-sessions/${created[i].data.id}/end`, 'POST', {});
        for (let j = i + 1; j < created.length; j++) assert.deepEqual((await owners[j](`/live-sessions/${created[j].data.id}`)).data, created[j].data);
        await host('/live-sessions', 'POST', payload, 409);
      }
      assert.deepEqual((await host(`/live-sessions/${session.id}`)).data, session);
    });
    await t.test('independent identities enforce lifecycle and same-browser join is idempotent', async () => {
      const root = `/live-sessions/${session.id}`;
      const unknown = (await outsider(root)).data;
      assert.deepEqual(unknown.self, { participantId: null, isHost: false, joined: false });
      await outsider(root + '/end', 'POST', {}, 403);
      await outsider(root + '/heartbeat', 'POST', {}, 403);
      await host(root + '/leave', 'POST', {}, 409);
      let joined = (await player(root + '/join', 'POST', { displayName: 'Player' })).data;
      const id = joined.self.participantId;
      assert.equal(joined.participantCount, 2);
      const again = (await player(root + '/join', 'POST', { displayName: 'Different' })).data;
      assert.deepEqual(again, joined);
      const hostAgain = (await host(root + '/join', 'POST', { displayName: 'Impostor name' })).data;
      assert.equal(hostAgain.hostName, 'Session DM');
      assert.equal(hostAgain.self.participantId, session.self.participantId);
      await until(() => active.records.some((r) => r.event === 'live-session-changed' && r.data.sessionId === session.id && r.data.revision === joined.revision));
      const count = active.records.length;
      await host(root + '/heartbeat', 'POST', {});
      await player(root + '/heartbeat', 'POST', {});
      await delay(25);
      assert.equal(active.records.length, count);
      await player(root + '/leave', 'POST', {});
      assert.equal((await player(root)).data.self.joined, false);
      joined = (await player(root + '/join', 'POST', { displayName: 'Returned' })).data;
      assert.notEqual(joined.self.participantId, id);
      assert.equal((await host('/live-sessions')).data.find((s) => s.id === session.id).participantCount, 2);
      assert.ok(!JSON.stringify(joined).includes('dndharness_live'));
    });
    await t.test('current campaign updates/archive/revert keep active table and multiple tables coexist', async () => {
      const standalone = (await host('/live-sessions', 'POST', { title: 'Independent table', displayName: 'Host' }, 201)).data;
      const source = (await host(`/campaigns/${campaign.id}/adventure`)).data;
      const changed = (await host(`/campaigns/${campaign.id}/adventure`, 'PUT', { ...source, expectedRevision: 1, title: 'New live title' })).data;
      assert.equal((await host(`/live-sessions/${session.id}`)).data.title, 'New live title');
      const archived = (await outsider(`/campaigns/${campaign.id}`, 'PATCH', { expectedRevision: changed.campaignRevision, status: 'archived' })).data;
      assert.equal((await host(`/live-sessions/${session.id}`)).data.id, session.id);
      await outsider('/live-sessions', 'POST', { ...payload, expectedRevision: archived.revision }, 400);
      const archivedHistory = (await host(`/campaigns/${campaign.id}/history`)).data;
      await outsider('/live-sessions', 'POST', payload, 409);
      assert.deepEqual((await host(`/campaigns/${campaign.id}/history`)).data, archivedHistory);
      await outsider(`/campaigns/${campaign.id}/history/${historyBefore[0].id}/restore`, 'POST', { expectedRevision: archived.revision });
      assert.equal((await host(`/live-sessions/${session.id}`)).data.title, campaign.title);
      assert.deepEqual((await host(`/live-sessions/${standalone.id}`)).data, standalone);
      await host(`/live-sessions/${standalone.id}/end`, 'POST', {});
      const other = (await outsider('/campaigns', 'POST', { title: 'Second live campaign', editionId: 'dnd-5e-2014' }, 201)).data;
      const otherSession = (await host('/live-sessions', 'POST', { campaignId: other.id, expectedRevision: other.revision, displayName: 'Same browser, second table' }, 201)).data;
      assert.equal((await host('/live-sessions')).data.length, 2);
      assert.equal((await host(`/live-sessions/${session.id}`)).data.self.isHost, true);
      assert.equal((await host(`/live-sessions/${otherSession.id}`)).data.self.isHost, true);
      await outsider(`/live-sessions/${otherSession.id}/end`, 'POST', {}, 403);
      await host(`/live-sessions/${otherSession.id}/end`, 'POST', {});
    });
    await t.test('failed commit emits nothing; all content mutation categories publish postcommit', async () => {
      const current = (await host(`/campaigns/${campaign.id}`)).data;
      // Drain prior invalidations before measuring a rollback.
      await until(() => active.records.some((r) => r.event === 'campaign-changed' && r.data.campaignId === campaign.id && r.data.revision === current.revision));
      await delay(25);
      const count = active.records.length;
      await pool.query(`CREATE FUNCTION realtime_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected history failure' USING ERRCODE='23505'; END; $$`);
      await pool.query('CREATE TRIGGER realtime_test_failure BEFORE INSERT ON campaign_history FOR EACH ROW EXECUTE FUNCTION realtime_test_reject()');
      try {
        await host(`/campaigns/${campaign.id}`, 'PATCH', { expectedRevision: current.revision, title: 'Rollback' }, 409);
        await host('/campaigns', 'POST', { title: 'Rollback create', editionId: campaign.editionId }, 409);
        await delay(25);
        assert.equal(active.records.length, count);
        assert.deepEqual((await host(`/campaigns/${campaign.id}`)).data, current);
      } finally {
        await pool.query('DROP TRIGGER realtime_test_failure ON campaign_history');
        await pool.query('DROP FUNCTION realtime_test_reject()');
      }
      let revision = current.revision;
      async function write(suffix, method, body, status = 200) {
        const result = (await host(`/campaigns/${campaign.id}${suffix}`, method, { ...body, expectedRevision: revision }, status)).data;
        revision++;
        await until(() => active.records.some((r) => r.event === 'campaign-changed' && r.data.campaignId === campaign.id && r.data.revision === revision));
        const canonical = (await host(`/campaigns/${campaign.id}`)).data;
        assert.equal(canonical.revision, revision);
        return result;
      }
      let updated = await write('/characters', 'POST', { name: 'Fixture sheet', sheet: {} }, 201);
      const characterId = updated.party[0].characterId;
      await write(`/characters/${characterId}`, 'PATCH', { name: 'Updated fixture' });
      const saved = await write('/saves', 'POST', { label: 'Realtime checkpoint' }, 201);
      await write(`/characters/${characterId}`, 'DELETE', {});
      await write(`/saves/${saved.id}/restore`, 'POST', {});
      await write(`/history/${historyBefore[0].id}/restore`, 'POST', {});
      await write('', 'PATCH', { title: 'Committed journal' });
      const revisions = active.records.filter((r) => r.event === 'campaign-changed' && r.data.campaignId === campaign.id).map((r) => r.data.revision);
      assert.deepEqual(revisions, Array.from({ length: revision }, (_, i) => i + 1));
    });
    await t.test('end is host-only idempotent, terminal GET is 404 and campaign remains intact', async () => {
      const before = (await host(`/campaigns/${campaign.id}`)).data;
      const beforeHistory = (await host(`/campaigns/${campaign.id}/history`)).data;
      await player(`/live-sessions/${session.id}/end`, 'POST', {}, 403);
      await host(`/live-sessions/${session.id}/end`, 'POST', {});
      await host(`/live-sessions/${session.id}/end`, 'POST', {});
      await player(`/live-sessions/${session.id}`, 'GET', undefined, 404);
      await player(`/live-sessions/${session.id}/join`, 'POST', { displayName: 'Late' }, 404);
      assert.deepEqual((await host('/live-sessions')).data, []);
      assert.deepEqual((await host(`/campaigns/${campaign.id}`)).data, before);
      assert.deepEqual((await host(`/campaigns/${campaign.id}/history`)).data, beforeHistory);
    });
    await t.test('reconnection requires fresh sync, disconnect and shutdown close streams', async () => {
      active.controller.abort();
      await active.reading;
      await until(() => events.streamCount === 0);
      active = await stream({ Origin: origin, 'Last-Event-ID': 'old-event' });
      await until(() => active.records.length === 1);
      assert.deepEqual(active.records, [{ event: 'sync-required', data: {} }]);
      closeRealtime();
      await active.reading;
      assert.equal(events.streamCount, 0);
      assert.deepEqual(liveSessions.list(), []);
    });
  } finally {
    for (const controller of controllers) controller.abort();
    closeRealtime();
    if (active) await active.reading;
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
