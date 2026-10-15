import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { adventure } from '../src/adventure.js';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a dedicated database whose name ends in _test.');
const { app } = await import('../src/app.js');
const { pool, migrate, transaction } = await import('../src/db.js');

test('campaign image migration, permissions, canonical edits, conflicts, privacy and legacy compatibility', async (t) => {
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  function client() {
    let cookie = '';
    return async (path, method = 'GET', body, expected = 200, headers = {}) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'http://127.0.0.1:5173', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const data = await response.json();
      if (Array.isArray(expected)) assert.ok(expected.includes(response.status), JSON.stringify(data));
      else assert.equal(response.status, expected, JSON.stringify(data));
      return data;
    };
  }
  const dm = client(); const member = client(); const outsider = client(); const anonymous = client();
  let campaign; let current; let character;
  const point = (overrides = {}) => ({ id: randomUUID(), title: 'Hidden ruin', kind: 'location', x: 0, y: 100, notes: 'SECRET POINT', location: 'SECRET LOCATION', characters: 'SECRET NPC', ...overrides });
  function safe(view) {
    assert.deepEqual(view.adventure, { title: current.title, synopsis: current.synopsis });
    for (const secret of ['SECRET STORY', 'SECRET GUIDANCE', 'SECRET POINT', 'SECRET LOCATION', 'SECRET NPC']) assert.ok(!JSON.stringify(view).includes(secret));
  }
  try {
    await t.test('forward backfill preserves journal and immutable snapshot meaning', async () => {
      // A transaction-local schema models pre-migration rows without altering real tables.
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('CREATE SCHEMA adventure_migration_fixture');
        await db.query('SET LOCAL search_path TO adventure_migration_fixture');
        await db.query('CREATE TABLE campaigns (id uuid PRIMARY KEY, title text, state jsonb)');
        await db.query('CREATE TABLE campaign_saves (snapshot jsonb)');
        const state = { summary: 'Shared original summary', notes: 'Shared original notes' };
        const snapshot = { version: 1, title: 'Original title', state };
        const id = randomUUID();
        await db.query('INSERT INTO campaigns VALUES ($1,$2,$3)', [id, 'Original title', state]);
        await db.query('INSERT INTO campaign_saves VALUES ($1)', [snapshot]);
        await db.query(await readFile(new URL('../../db/migrations/003_campaign_adventures.sql', import.meta.url), 'utf8'));
        assert.deepEqual((await db.query('SELECT * FROM campaign_adventures')).rows[0], { campaign_id: id, version: 1, revision: 0, title: 'Original title', synopsis: '', storyline: '', dm_guidance: '', canvas: null });
        assert.deepEqual((await db.query('SELECT state FROM campaigns')).rows[0].state, state);
        assert.deepEqual((await db.query('SELECT snapshot FROM campaign_saves')).rows[0].snapshot, snapshot);
        await assert.rejects(db.query('INSERT INTO campaign_adventures(campaign_id,title) VALUES ($1,$2)', [id, 'Duplicate']), /duplicate/);
      } finally { await db.query('ROLLBACK'); db.release(); }
    });
    await pool.query('TRUNCATE users,characters,campaigns,campaign_party,campaign_saves,sessions CASCADE');
    for (const [request, name] of [[dm, 'dm'], [member, 'member'], [outsider, 'outsider']]) {
      await request('/auth/register', 'POST', { email: `adventure-${name}@example.test`, password: 'Example-password-123', displayName: name }, 201);
    }
    await t.test('legacy creation starts with a blank board and empty overview text', async () => {
      campaign = await dm('/campaigns', 'POST', { title: 'Legacy title', editionId: 'dnd-5e-2024', state: { summary: 'Shared summary', notes: 'Shared notes' } }, 201);
      current = await dm(`/campaigns/${campaign.id}/adventure`);
      assert.deepEqual(current, { version: 1, revision: 0, title: 'Legacy title', synopsis: '', storyline: '', dmGuidance: '', canvas: null });
      safe(campaign);
      character = await member('/characters', 'POST', { editionId: campaign.editionId, name: 'Player', sheet: {} }, 201);
      safe(await member('/campaigns/join', 'POST', { inviteCode: campaign.inviteCode, characterId: character.id }));
    });
    const path = `/campaigns/${campaign.id}/adventure`;
    await t.test('anonymous, member and outsider permissions; origin and content restrictions', async () => {
      for (const method of ['GET', 'PUT']) {
        await anonymous(path, method, method === 'PUT' ? current : undefined, 401);
        await member(path, method, method === 'PUT' ? current : undefined, 403);
        await outsider(path, method, method === 'PUT' ? current : undefined, 404);
        await dm(`/campaigns/${randomUUID()}/adventure`, method, method === 'PUT' ? current : undefined, 404);
      }
      await dm(path, 'PUT', current, 403, { Origin: 'https://untrusted.test' });
      await dm(path, 'PUT', current, 415, { 'Content-Type': 'text/plain' });
      assert.deepEqual(await dm(path), current);
    });
    await t.test('allowlisted canonical full-object edits retain stable IDs and independent title', async () => {
      const p = point({ id: randomUUID().toUpperCase(), title: ' Hidden ruin ', ignored: 'STRIPPED POINT' });
      current = await dm(path, 'PUT', { ...current, title: ' Source title ', synopsis: ' Public synopsis ', storyline: 'SECRET STORY', dmGuidance: 'SECRET GUIDANCE', ignored: 'STRIPPED ROOT', canvas: { title: ' Blank board ', ignored: 'STRIPPED CANVAS', points: [p] } });
      assert.equal(current.revision, 1);
      assert.equal(current.title, 'Source title');
      assert.equal(current.synopsis, 'Public synopsis');
      assert.equal(current.canvas.title, 'Blank board');
      const { ignored, ...canonicalPoint } = p;
      assert.deepEqual(current.canvas.points[0], { ...canonicalPoint, id: p.id.toLowerCase(), title: 'Hidden ruin' });
      assert.equal(current.ignored, undefined);
      assert.equal(current.canvas.ignored, undefined);
      assert.deepEqual(await dm(path), current);
    });
    await t.test('shared list/detail/legacy mutation responses and saves do not leak preparation', async () => {
      for (const request of [dm, member]) {
        safe(await request(`/campaigns/${campaign.id}`));
        safe((await request('/campaigns')).find((row) => row.id === campaign.id));
      }
      const own = await dm('/characters', 'POST', { editionId: campaign.editionId, name: 'DM copy', sheet: {} }, 201);
      safe(await dm(`/campaigns/${campaign.id}/party`, 'POST', { characterId: own.id }));
      safe(await dm(`/campaigns/${campaign.id}/party/${own.id}`, 'PATCH', { name: 'Edited copy', sheet: {} }));
      const save = await dm(`/campaigns/${campaign.id}/saves`, 'POST', { label: 'Legacy checkpoint' }, 201);
      assert.deepEqual(Object.keys(save.snapshot).sort(), ['version', 'title', 'editionId', 'status', 'dm', 'party', 'state'].sort());
      assert.equal(save.snapshot.version, 1);
      assert.equal(save.snapshot.state.notes, 'Shared notes');
      assert.ok(!JSON.stringify(save).includes('SECRET'));
      safe(await dm(`/campaigns/${campaign.id}`, 'PATCH', { title: 'Changed journal title', status: 'archived', state: { summary: 'Changed shared summary' } }));
      current = await dm(path, 'PUT', { ...current, title: 'Edited archived source' });
      const beforeRestore = structuredClone(current);
      const restored = await dm(`/campaigns/${campaign.id}/saves/${save.id}/restore`, 'POST', {});
      safe(restored);
      assert.equal(restored.title, 'Legacy title');
      assert.equal(restored.status, 'active');
      assert.deepEqual(await dm(path), beforeRestore);
      assert.deepEqual((await member(`/campaigns/${campaign.id}/saves`))[0].snapshot, save.snapshot);
      await assert.rejects(pool.query('UPDATE campaign_saves SET label=$1 WHERE id=$2', ['Changed', save.id]), /immutable/);
    });
    await t.test('stale and simultaneous edits are rejected without replacing the winner', async () => {
      const old = structuredClone(current);
      // Both authenticated requests carry the same revision; arrival order is irrelevant.
      const edits = await Promise.all([dm(path, 'PUT', { ...old, synopsis: 'Winner A' }, [200, 409]), dm(path, 'PUT', { ...old, synopsis: 'Winner B' }, [200, 409])]);
      assert.equal(edits.filter((entry) => entry.revision === old.revision + 1).length, 1);
      assert.equal(edits.filter((entry) => entry.error === 'This campaign image changed elsewhere. Reload before saving.').length, 1);
      current = await dm(path);
      assert.equal(current.revision, old.revision + 1);
      const conflict = await dm(path, 'PUT', { ...old, title: 'Conflicting draft' }, 409);
      assert.equal(conflict.error, 'This campaign image changed elsewhere. Reload before saving.');
      assert.deepEqual(await dm(path), current);
    });
    await t.test('invalid versions, required shapes, text caps, point IDs/kinds and bounds', async () => {
      const bad = [
        { version: 2 }, { version: undefined }, { revision: -1 }, { revision: 0.5 }, { revision: '0' },
        { title: '' }, { title: 't'.repeat(151) }, { synopsis: 's'.repeat(2001) }, { storyline: 's'.repeat(20001) }, { dmGuidance: 'd'.repeat(20001) },
        { canvas: undefined }, { canvas: [] }, { canvas: { title: '', points: [] } }, { canvas: { title: 'c'.repeat(151), points: [] } },
        { canvas: { title: 'Board', points: Array.from({ length: 101 }, () => point()) } },
      ];
      for (const patch of bad) await dm(path, 'PUT', { ...current, ...patch }, 400);
      for (const patch of [{ id: 'bad' }, { title: '' }, { title: 'p'.repeat(151) }, { kind: 'map' }, { x: -1 }, { y: 101 }, { x: '50' }, { x: null }, { notes: 'n'.repeat(4001) }, { location: 'l'.repeat(201) }, { characters: 'c'.repeat(4001) }]) {
        await dm(path, 'PUT', { ...current, canvas: { title: 'Board', points: [point(patch)] } }, 400);
      }
      const p = point();
      await dm(path, 'PUT', { ...current, canvas: { title: 'Board', points: [p, { ...p, id: p.id.toUpperCase() }] } }, 400);
      for (const x of [NaN, Infinity, -Infinity]) assert.throws(() => adventure({ ...current, canvas: { title: 'Board', points: [point({ x })] } }), /number from 0 to 100/);
      for (const field of ['title', 'synopsis', 'storyline', 'dmGuidance']) await dm(path, 'PUT', { ...current, [field]: null }, 400);
      const oversized = { ...current, canvas: { title: 'Board', points: Array.from({ length: 26 }, () => point({ notes: 'n'.repeat(4000), characters: 'c'.repeat(4000) })) } };
      assert.match((await dm(path, 'PUT', oversized, 400)).error, /200 KB/);
      assert.deepEqual(await dm(path), current);
    });
    await t.test('valid blank and maximum-size boards, all point kinds and fractional bounds', async () => {
      current = await dm(path, 'PUT', { ...current, canvas: { title: 'Blank board', points: [] } });
      const points = Array.from({ length: 100 }, (_, i) => point({ kind: ['story', 'location', 'encounter', 'npc'][i % 4], x: 12.5, y: 99.75, notes: '', location: '', characters: '' }));
      current = await dm(path, 'PUT', { ...current, canvas: { title: 'Full board', points } });
      assert.deepEqual(current.canvas.points, points);
      current = await dm(path, 'PUT', { ...current, canvas: null });
      assert.equal(current.canvas, null);
    });
    await t.test('multi-row create and update failures roll back atomically', async () => {
      await pool.query(`CREATE FUNCTION adventure_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected transaction failure' USING ERRCODE='23505'; END; $$`);
      try {
        await pool.query('CREATE TRIGGER adventure_test_create BEFORE INSERT ON campaign_adventures FOR EACH ROW EXECUTE FUNCTION adventure_test_reject()');
        const before = (await pool.query('SELECT count(*) FROM campaigns')).rows[0].count;
        await dm('/campaigns', 'POST', { title: 'Must roll back', editionId: campaign.editionId }, 409);
        assert.equal((await pool.query('SELECT count(*) FROM campaigns')).rows[0].count, before);
        await pool.query('DROP TRIGGER adventure_test_create ON campaign_adventures');
        await pool.query('CREATE TRIGGER adventure_test_update BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION adventure_test_reject()');
        await dm(path, 'PUT', { ...current, title: 'Must roll back' }, 409);
        assert.deepEqual(await dm(path), current);
      } finally {
        await pool.query('DROP TRIGGER IF EXISTS adventure_test_create ON campaign_adventures');
        await pool.query('DROP TRIGGER IF EXISTS adventure_test_update ON campaigns');
        await pool.query('DROP FUNCTION adventure_test_reject()');
      }
      await assert.rejects(transaction(async (db) => {
        await db.query('UPDATE campaign_adventures SET synopsis=$1 WHERE campaign_id=$2', ['Rollback fixture', campaign.id]);
        throw new Error('rollback');
      }), /rollback/);
      assert.deepEqual(await dm(path), current);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
