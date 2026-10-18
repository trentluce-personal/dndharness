import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { adventure } from '../src/adventure.js';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a dedicated database whose name ends in _test.');
const { app } = await import('../src/app.js');
const { pool, migrate } = await import('../src/db.js');

test('source migration, canonical validation, bounds and open-access revision checks', async (t) => {
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, expected = 200) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  const point = (overrides = {}) => ({ id: randomUUID(), title: 'Hidden ruin', kind: 'location', x: 0, y: 100, notes: 'Point notes', location: 'Forest', characters: 'Keeper', ...overrides });
  let current;
  try {
    await t.test('003 source backfill preserves old shared journal and checkpoint meaning', async () => {
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
      } finally { await db.query('ROLLBACK'); db.release(); }
    });
    const campaign = await request('/campaigns', 'POST', { title: 'Validation campaign', editionId: 'dnd-5e-2024' }, 201);
    const path = `/campaigns/${campaign.id}/adventure`;
    current = await request(path);
    const put = (patch, expected = 200) => request(path, 'PUT', { ...current, expectedRevision: current.campaignRevision, ...patch }, expected);
    assert.deepEqual(current, { version: 1, revision: 0, title: 'Validation campaign', synopsis: '', storyline: '', dmGuidance: '', canvas: null, campaignRevision: 1 });
    await t.test('full-object canonical edits retain stable IDs and independent title', async () => {
      const p = point({ id: randomUUID().toUpperCase(), title: ' Hidden ruin ', ignored: 'STRIPPED POINT' });
      current = await put({ title: ' Source title ', synopsis: ' Public synopsis ', storyline: 'Story', dmGuidance: 'Guidance', ignored: 'STRIPPED ROOT', canvas: { title: ' Blank board ', ignored: 'STRIPPED CANVAS', points: [p] } });
      assert.equal(current.revision, 1);
      assert.equal(current.campaignRevision, 2);
      assert.equal(current.title, 'Source title');
      assert.equal(current.canvas.title, 'Blank board');
      const { ignored, ...canonicalPoint } = p;
      assert.deepEqual(current.canvas.points[0], { ...canonicalPoint, id: p.id.toLowerCase(), title: 'Hidden ruin' });
      assert.equal(current.ignored, undefined);
      assert.equal(current.canvas.ignored, undefined);
      assert.deepEqual(await request(path), current);
      assert.equal((await request(`/campaigns/${campaign.id}`)).title, 'Validation campaign');
    });
    await t.test('invalid versions, shapes, text caps, IDs, kinds, coordinates and sizes', async () => {
      for (const patch of [
        { version: 2 }, { version: undefined }, { revision: -1 }, { revision: 0.5 }, { revision: '0' },
        { title: '' }, { title: 't'.repeat(151) }, { synopsis: 's'.repeat(2001) }, { storyline: 's'.repeat(20001) }, { dmGuidance: 'd'.repeat(20001) },
        { canvas: undefined }, { canvas: [] }, { canvas: { title: '', points: [] } }, { canvas: { title: 'c'.repeat(151), points: [] } },
        { canvas: { title: 'Board', points: Array.from({ length: 101 }, () => point()) } },
      ]) await put(patch, 400);
      for (const patch of [{ id: 'bad' }, { title: '' }, { title: 'p'.repeat(151) }, { kind: 'map' }, { x: -1 }, { y: 101 }, { x: '50' }, { x: null }, { notes: 'n'.repeat(4001) }, { location: 'l'.repeat(201) }, { characters: 'c'.repeat(4001) }]) await put({ canvas: { title: 'Board', points: [point(patch)] } }, 400);
      const p = point();
      await put({ canvas: { title: 'Board', points: [p, { ...p, id: p.id.toUpperCase() }] } }, 400);
      for (const x of [NaN, Infinity, -Infinity]) assert.throws(() => adventure({ ...current, canvas: { title: 'Board', points: [point({ x })] } }), /number from 0 to 100/);
      for (const field of ['title', 'synopsis', 'storyline', 'dmGuidance']) await put({ [field]: null }, 400);
      const oversized = { canvas: { title: 'Board', points: Array.from({ length: 26 }, () => point({ notes: 'n'.repeat(4000), characters: 'c'.repeat(4000) })) } };
      assert.match((await put(oversized, 400)).error, /200 KB/);
      assert.deepEqual(await request(path), current);
    });
    await t.test('blank and maximum-point boards, all kinds and fractional bounds', async () => {
      current = await put({ canvas: { title: 'Blank board', points: [] } });
      const points = Array.from({ length: 100 }, (_, i) => point({ kind: ['story', 'location', 'encounter', 'npc'][i % 4], x: 12.5, y: 99.75, notes: '', location: '', characters: '' }));
      current = await put({ canvas: { title: 'Full board', points } });
      assert.deepEqual(current.canvas.points, points);
      current = await put({ canvas: null });
      assert.equal(current.canvas, null);
    });
    await t.test('UTF-8 byte limit applies to canonical source without campaign metadata', async () => {
      const points = Array.from({ length: 25 }, (_, i) => point({ notes: i < 24 ? 'n'.repeat(4000) : '', characters: i < 24 ? 'c'.repeat(4000) : '' }));
      const draft = { ...current, canvas: { title: 'Byte boundary', points } };
      const padding = 200000 - Buffer.byteLength(JSON.stringify(adventure(draft)), 'utf8');
      assert.ok(padding > 0 && padding <= 8000);
      points[24].notes = 'n'.repeat(Math.min(padding, 4000));
      points[24].characters = 'c'.repeat(Math.max(padding - 4000, 0));
      assert.equal(Buffer.byteLength(JSON.stringify(adventure(draft)), 'utf8'), 200000);
      current = await put({ canvas: draft.canvas, ignored: 'Discarded metadata'.repeat(300) });
      await put({ canvas: { ...draft.canvas, title: 'Byte boundaryé' } }, 400);
      assert.deepEqual(await request(path), current);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
