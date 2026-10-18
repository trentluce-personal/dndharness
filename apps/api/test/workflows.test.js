import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a dedicated database whose name ends in _test.');
const { app } = await import('../src/app.js');
const { pool, migrate } = await import('../src/db.js');

test('accountless migration and complete transactional version history', async (t) => {
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, expected = 200, headers = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (Array.isArray(expected)) assert.ok(expected.includes(response.status), JSON.stringify(data));
    else assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  let campaign; let source; let checkpoint; let characterId;
  const history = () => request(`/campaigns/${campaign.id}/history`);
  const detail = (id) => request(`/campaigns/${campaign.id}/history/${id}`);
  const get = () => request(`/campaigns/${campaign.id}`);
  const mutate = async (suffix, method, body, expected = 200) => {
    const value = await request(`/campaigns/${campaign.id}${suffix}`, method, { expectedRevision: campaign.revision, ...body }, expected);
    if (value.id === campaign.id) campaign = value;
    if (value.campaign) campaign = value.campaign;
    if (value.campaignRevision) campaign = await get();
    return value;
  };
  async function assertLatest() {
    const entries = await history();
    assert.equal(entries.length, campaign.revision);
    assert.deepEqual(entries.map((entry) => entry.revision), Array.from({ length: campaign.revision }, (_, i) => campaign.revision - i));
    assert.deepEqual(Object.keys(entries[0]).sort(), ['id', 'revision', 'label', 'createdAt'].sort());
    const latest = await detail(entries[0].id);
    const { campaignRevision, ...adventure } = await request(`/campaigns/${campaign.id}/adventure`);
    assert.deepEqual(latest.snapshot, { version: 2, campaign: { title: campaign.title, editionId: campaign.editionId, status: campaign.status }, adventure, state: campaign.state, party: campaign.party });
  }
  try {
    await t.test('forward migration preserves all legacy data and distinct campaign copies', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('CREATE SCHEMA accountless_migration_fixture');
        await client.query('SET LOCAL search_path TO accountless_migration_fixture');
        for (const file of ['001_initial.sql', '002_character_deletion.sql', '003_campaign_adventures.sql']) await client.query(await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8'));
        const userId = randomUUID(); const personalId = randomUUID(); const orphanId = randomUUID();
        const ids = [randomUUID(), randomUUID()];
        await client.query('INSERT INTO users(id,email,password_hash,display_name,real_name,bio) VALUES ($1,$2,$3,$4,$5,$6)', [userId, 'private@example.test', 'retained hash', 'Legacy player', 'Private name', 'Private bio']);
        await client.query('INSERT INTO characters(id,user_id,edition_id,name,sheet) VALUES ($1,$2,$3,$4,$5),($6,$2,$3,$4,$5)', [personalId, userId, 'dnd-5e-2024', 'Personal', { version: 1, hp: 12 }, orphanId]);
        const legacy = { version: 1, title: 'Checkpoint title', editionId: 'dnd-5e-2024', status: 'active', dm: { id: userId, displayName: 'Legacy DM' }, state: { summary: 'Shared journal' }, party: [{ characterId: personalId, userId, displayName: 'Legacy player', name: 'Saved copy', sheet: { version: 1, hp: 2, maxHp: 12, equipment: 'Old gear' } }] };
        for (const [index, id] of ids.entries()) {
          await client.query('INSERT INTO campaigns(id,dm_id,edition_id,title,invite_code,state) VALUES ($1,$2,$3,$4,$5,$6)', [id, userId, 'dnd-5e-2024', 'Old campaign', `CODE${index}`, legacy.state]);
          await client.query('INSERT INTO campaign_adventures(campaign_id,title,storyline,canvas) VALUES ($1,$2,$3,$4)', [id, 'Source title', 'Existing preparation', { title: 'Existing board', points: [] }]);
          await client.query('INSERT INTO campaign_party VALUES ($1,$2,$3,$4,$5)', [id, personalId, userId, `Copy ${index}`, { version: 1, hp: index + 3, maxHp: 12 }]);
        }
        await client.query('INSERT INTO campaign_saves VALUES ($1,$2,$3,$4,now())', [randomUUID(), ids[0], 'Old checkpoint', legacy]);
        await client.query(await readFile(new URL('../../db/migrations/004_accountless_campaign_history.sql', import.meta.url), 'utf8'));
        const copies = (await client.query('SELECT * FROM campaign_characters ORDER BY name')).rows;
        assert.equal(copies.length, 2);
        assert.deepEqual(copies.map((row) => row.sheet.hp), [3, 4]);
        assert.ok(copies.every((row) => row.character_id === personalId));
        assert.equal((await client.query('SELECT count(*) FROM characters')).rows[0].count, '2');
        assert.equal((await client.query('SELECT real_name FROM users')).rows[0].real_name, 'Private name');
        assert.deepEqual((await client.query('SELECT snapshot FROM campaign_saves')).rows[0].snapshot, legacy);
        const versions = (await client.query('SELECT * FROM campaign_history ORDER BY snapshot->\'party\'->0->>\'name\'')).rows;
        assert.equal(versions.length, 2);
        assert.equal(versions[0].revision, 1);
        assert.equal(versions[0].snapshot.adventure.storyline, 'Existing preparation');
        assert.deepEqual(versions[0].snapshot.state, legacy.state);
        assert.equal(versions[0].snapshot.party[0].sheet.hp, 3);
        assert.equal(versions[0].snapshot.party[0].userId, undefined);
        await client.query('INSERT INTO campaigns(id,edition_id,title,state) VALUES ($1,$2,$3,$4)', [randomUUID(), 'dnd-5e-2024', 'No account', {}]);
        await assert.rejects(client.query('DELETE FROM campaign_history'), /immutable/);
      } finally { await client.query('ROLLBACK'); client.release(); }
    });
    await pool.query('TRUNCATE users,characters,campaigns,campaign_party,campaign_saves,sessions CASCADE');
    await t.test('open-access routes and exact sanitized view contract', async () => {
      for (const [path, method] of [['/auth/me', 'GET'], ['/auth/login', 'POST'], ['/auth/register', 'POST'], ['/auth/logout', 'POST'], ['/profile', 'PATCH'], ['/profile/password', 'POST'], ['/characters', 'GET'], ['/characters', 'POST'], ['/campaigns/join', 'POST']]) await request(path, method, method === 'GET' ? undefined : {}, 404);
      assert.equal((await request('/editions'))[1].id, 'dnd-5e-2024');
      await request('/campaigns', 'POST', { title: 'Missing rules', editionId: 'missing' }, 400);
      campaign = await request('/campaigns', 'POST', { title: 'Lantern Road', editionId: 'dnd-5e-2024' }, 201);
      assert.deepEqual(Object.keys(campaign).sort(), ['id', 'title', 'editionId', 'status', 'state', 'updatedAt', 'revision', 'party', 'adventure'].sort());
      assert.equal(campaign.revision, 1);
      assert.deepEqual(await get(), campaign);
      assert.deepEqual(await request('/campaigns'), [campaign]);
      await assertLatest();
      await request(`/campaigns/${randomUUID()}`, 'GET', undefined, 404);
      await request(`/campaigns/${campaign.id}/party`, 'POST', {}, 404);
    });
    await t.test('origin, JSON, revision and journal validation retain data', async () => {
      const before = structuredClone(campaign);
      await request(`/campaigns/${campaign.id}`, 'PATCH', {}, 403, { Origin: 'https://untrusted.test' });
      await request(`/campaigns/${campaign.id}`, 'PATCH', {}, 415, { 'Content-Type': 'text/plain' });
      await request(`/campaigns/${campaign.id}`, 'PATCH', [], 400);
      const malformed = await fetch(base + `/campaigns/${campaign.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{' });
      assert.equal(malformed.status, 400);
      for (const revision of [undefined, 0, -1, 1.5, '1', null]) await request(`/campaigns/${campaign.id}`, 'PATCH', { expectedRevision: revision }, 400);
      for (const body of [{ state: null }, { state: [] }, { state: { session: 0 } }, { status: 'deleted' }, { title: '' }]) await mutate('', 'PATCH', body, 400);
      assert.deepEqual(await get(), before);
      await assertLatest();
    });
    await t.test('campaign-owned sheets preserve structured data and initialize missing HP', async () => {
      const inventory = { items: [{ name: 'Book', quantity: 2, weight: '10 lb.' }, { name: 'Book', quantity: null, weight: '' }], coins: { gp: 60, cp: 0 } };
      const details = { skills: [{ name: 'Investigation', ability: 'INT', modifier: '+7', proficiency: 'expertise' }], spells: [{ name: 'Light', prepared: 'O', page: 'PHB-2024 292' }], narrative: { features: 'Original feature text' }, additionalFields: [{ name: 'Custom reference', value: 'Keep this' }] };
      await mutate('/characters', 'POST', { name: 'Rowan', sheet: { maxHp: 12, inventory, details, equipment: 'Legacy compass' } }, 201);
      characterId = campaign.party[0].characterId;
      assert.equal(campaign.party[0].sheet.hp, 12);
      assert.equal(campaign.party[0].sheet.details.skills[0].proficiency, 'expertise');
      assert.equal(campaign.party[0].sheet.equipment, 'Legacy compass');
      assert.equal(campaign.party[0].sheet.inventory.items[1].quantity, null);
      assert.deepEqual(Object.keys(campaign.party[0]).sort(), ['characterId', 'name', 'sheet']);
      await assertLatest();
      for (const invalid of [{ hp: 20, maxHp: 10 }, { version: 99 }, { inventory: { items: [{ name: 'Book', quantity: -1 }], coins: {} } }, ...[{ skills: [{ name: 'Arcana', proficiency: 'automatic' }] }, { spells: Array.from({ length: 201 }, () => ({ name: 'Spell' })) }, { identity: [] }, { spells: [{ name: 'Spell', page: 13 }] }, { identity: null }, { skills: null }, { skills: [{ name: 'Arcana', proficiency: null }] }, { skills: [{ name: 'Arcana', modifier: null }] }].map((details) => ({ details }))]) {
        await mutate('/characters', 'POST', { name: 'Invalid', sheet: invalid }, 400);
        await mutate(`/characters/${characterId}`, 'PATCH', { sheet: invalid }, 400);
      }
      await mutate(`/characters/${characterId}`, 'PATCH', { sheet: { ...campaign.party[0].sheet, hp: 3 } });
      assert.equal(campaign.party[0].sheet.hp, 3);
      await assertLatest();
      await mutate(`/characters/${randomUUID()}`, 'PATCH', { name: 'Missing' }, 404);
      await mutate(`/characters/${randomUUID()}`, 'DELETE', {}, 404);
    });
    await t.test('archived campaigns reject current and stale character imports without changing party or history', async () => {
      const importDraft = { name: 'Pending import', sheet: { maxHp: 12 }, expectedRevision: campaign.revision };
      await mutate('', 'PATCH', { status: 'archived' });
      const archived = structuredClone(campaign);
      const archivedHistory = await history();
      const archivedVersion = await detail(archivedHistory[0].id);
      const rejection = await mutate('/characters', 'POST', { name: importDraft.name, sheet: importDraft.sheet }, 400);
      assert.equal(rejection.error, 'Archived campaigns cannot accept characters.');
      assert.deepEqual(await get(), archived);
      assert.deepEqual(await history(), archivedHistory);
      assert.deepEqual(await detail(archivedHistory[0].id), archivedVersion);
      const stale = await request(`/campaigns/${campaign.id}/characters`, 'POST', importDraft, 409);
      assert.equal(stale.error, 'This campaign changed elsewhere. Reload before saving.');
      assert.deepEqual(await get(), archived);
      assert.deepEqual(await history(), archivedHistory);
      assert.deepEqual(await detail(archivedHistory[0].id), archivedVersion);
      await assertLatest();
      await mutate('', 'PATCH', { status: 'active' });
    });
    await t.test('source and canvas changes appear in complete snapshots', async () => {
      source = await request(`/campaigns/${campaign.id}/adventure`);
      source = await mutate('/adventure', 'PUT', { ...source, storyline: 'Complete storyline', dmGuidance: 'Complete guidance', canvas: { title: 'Board', points: [{ id: randomUUID(), title: 'Ruin', kind: 'location', x: 12.5, y: 99.75, notes: 'Clue', location: 'Forest', characters: 'Keeper' }] } });
      assert.equal(source.revision, 1);
      assert.equal(source.campaignRevision, campaign.revision);
      assert.deepEqual(campaign.adventure, { title: source.title, synopsis: source.synopsis });
      await assertLatest();
      await mutate('/adventure', 'PUT', { ...source, revision: 0 }, 409);
      assert.deepEqual(await request(`/campaigns/${campaign.id}/adventure`), source);
    });
    await t.test('checkpoint atomically saves journal but retains independent source meaning', async () => {
      checkpoint = await mutate('/saves', 'POST', { label: 'At the inn', title: 'Checkpoint title', state: { session: 2, location: 'The inn', notes: 'Draft journal' }, status: 'archived' }, 201);
      assert.equal(checkpoint.snapshot.state.notes, 'Draft journal');
      assert.equal(campaign.state.notes, 'Draft journal');
      assert.deepEqual(Object.keys(checkpoint.snapshot).sort(), ['version', 'title', 'editionId', 'status', 'party', 'state'].sort());
      await assertLatest();
      await mutate('', 'PATCH', { status: 'active', title: 'Changed title', state: { location: 'The ruins' } });
      source = await mutate('/adventure', 'PUT', { ...source, title: 'Changed source' });
      const sourceBefore = structuredClone(source);
      await mutate(`/characters/${characterId}`, 'DELETE', {});
      await assertLatest();
      await mutate(`/saves/${checkpoint.id}/restore`, 'POST', {});
      assert.deepEqual(campaign.party, checkpoint.snapshot.party);
      assert.equal(campaign.title, 'Checkpoint title');
      assert.equal(campaign.status, 'archived');
      assert.deepEqual(await request(`/campaigns/${campaign.id}/adventure`), { ...sourceBefore, campaignRevision: campaign.revision });
      await assertLatest();
      await assert.rejects(pool.query('UPDATE campaign_saves SET label=$1 WHERE id=$2', ['Changed', checkpoint.id]), /immutable/);
      await assert.rejects(pool.query('DELETE FROM campaign_saves WHERE id=$1', [checkpoint.id]), /immutable/);
    });
    await t.test('legacy checkpoints sanitize responses without changing JSON or personal data', async () => {
      const userId = randomUUID(); const legacyId = randomUUID(); const saveId = randomUUID();
      const oldSheet = { version: 1, hp: 4, maxHp: 12, equipment: 'Original legacy gear' };
      await pool.query('INSERT INTO users(id,email,password_hash,display_name,real_name,bio) VALUES ($1,$2,$3,$4,$5,$6)', [userId, 'private@example.test', 'legacy hash', 'Legacy player', 'Private name', 'Private bio']);
      await pool.query('INSERT INTO characters(id,user_id,edition_id,name,sheet,deleted_at) VALUES ($1,$2,$3,$4,$5,now())', [legacyId, userId, campaign.editionId, 'Hidden personal', { version: 1, hp: 12 }]);
      const legacy = { version: 1, title: 'Legacy title', editionId: campaign.editionId, status: 'active', state: { session: 1, location: 'Original', summary: '', notes: '  Historical spacing  ', legacyField: 'Retained' }, dm: { id: userId, displayName: 'Legacy DM' }, party: [{ characterId: legacyId, userId, displayName: 'Legacy player', name: 'Saved character', sheet: oldSheet }] };
      await pool.query('INSERT INTO campaign_saves(id,campaign_id,label,snapshot) VALUES ($1,$2,$3,$4)', [saveId, campaign.id, 'Legacy checkpoint', legacy]);
      const visible = (await request(`/campaigns/${campaign.id}/saves`)).find((save) => save.id === saveId).snapshot;
      assert.equal(visible.dm, undefined);
      assert.equal(visible.party[0].userId, undefined);
      assert.equal(visible.party[0].displayName, undefined);
      const sourceBefore = await request(`/campaigns/${campaign.id}/adventure`);
      await mutate(`/saves/${saveId}/restore`, 'POST', {});
      assert.deepEqual(campaign.party[0].sheet, oldSheet);
      assert.deepEqual(campaign.state, legacy.state);
      assert.deepEqual(await request(`/campaigns/${campaign.id}/adventure`), { ...sourceBefore, campaignRevision: campaign.revision });
      assert.deepEqual((await pool.query('SELECT snapshot FROM campaign_saves WHERE id=$1', [saveId])).rows[0].snapshot, legacy);
      assert.deepEqual((await pool.query('SELECT sheet FROM characters WHERE id=$1', [legacyId])).rows[0].sheet, { version: 1, hp: 12 });
      await assertLatest();
    });
    await t.test('complete revert appends a version, advances source and is itself reversible', async () => {
      const before = await detail((await history())[0].id);
      const first = (await history()).at(-1);
      const revision = campaign.revision;
      const sourceRevision = (await request(`/campaigns/${campaign.id}/adventure`)).revision;
      await mutate(`/history/${first.id}/restore`, 'POST', {});
      assert.equal(campaign.revision, revision + 1);
      assert.equal(campaign.party.length, 0);
      assert.equal(campaign.title, 'Lantern Road');
      const restoredSource = await request(`/campaigns/${campaign.id}/adventure`);
      assert.equal(restoredSource.revision, sourceRevision + 1);
      assert.equal(restoredSource.canvas, null);
      await assertLatest();
      await mutate(`/history/${before.id}/restore`, 'POST', {});
      assert.deepEqual(campaign.party, before.snapshot.party);
      assert.deepEqual(campaign.state, before.snapshot.state);
      assert.equal((await request(`/campaigns/${campaign.id}/adventure`)).revision, sourceRevision + 2);
      await assertLatest();
      assert.deepEqual(await detail(before.id), before);
      await assert.rejects(pool.query('UPDATE campaign_history SET label=$1 WHERE id=$2', ['Changed', before.id]), /immutable/);
      await assert.rejects(pool.query('DELETE FROM campaign_history WHERE id=$1', [before.id]), /immutable/);
      await mutate(`/history/${randomUUID()}/restore`, 'POST', {}, 404);
      await request(`/campaigns/${campaign.id}/history/${randomUUID()}`, 'GET', undefined, 404);
    });
    await t.test('campaign lock serializes cross-content races and rejects stale writes', async () => {
      const revision = campaign.revision;
      const currentSource = await request(`/campaigns/${campaign.id}/adventure`);
      const results = await Promise.all([
        request(`/campaigns/${campaign.id}`, 'PATCH', { expectedRevision: revision, title: 'Race winner journal' }, [200, 409]),
        request(`/campaigns/${campaign.id}/adventure`, 'PUT', { ...currentSource, expectedRevision: revision, title: 'Race winner source' }, [200, 409]),
      ]);
      assert.equal(results.filter((result) => result.error).length, 1);
      campaign = await get();
      assert.equal(campaign.revision, revision + 1);
      await assertLatest();
      const stale = { expectedRevision: revision };
      for (const [suffix, method, body] of [['', 'PATCH', {}], ['/adventure', 'PUT', currentSource], ['/characters', 'POST', { name: 'Stale', sheet: {} }], [`/characters/${campaign.party[0].characterId}`, 'PATCH', { name: 'Stale' }], [`/characters/${campaign.party[0].characterId}`, 'DELETE', {}], ['/saves', 'POST', { label: 'Stale' }], [`/saves/${checkpoint.id}/restore`, 'POST', {}], [`/history/${(await history())[0].id}/restore`, 'POST', {}]]) {
        await request(`/campaigns/${campaign.id}${suffix}`, method, { ...body, ...stale }, 409);
        await request(`/campaigns/${campaign.id}${suffix}`, method, { ...body }, 400);
      }
      await assertLatest();
    });
    await t.test('history insertion failures roll back every content mutation and checkpoint', async () => {
      await pool.query(`CREATE FUNCTION history_test_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected history failure' USING ERRCODE='23505'; END; $$`);
      await pool.query('CREATE TRIGGER history_test_failure BEFORE INSERT ON campaign_history FOR EACH ROW EXECUTE FUNCTION history_test_reject()');
      try {
        const before = await get();
        const beforeSource = await request(`/campaigns/${campaign.id}/adventure`);
        const beforeSaves = await request(`/campaigns/${campaign.id}/saves`);
        const count = (await pool.query('SELECT count(*) FROM campaigns')).rows[0].count;
        await request('/campaigns', 'POST', { title: 'Must roll back', editionId: campaign.editionId }, 409);
        assert.equal((await pool.query('SELECT count(*) FROM campaigns')).rows[0].count, count);
        for (const [suffix, method, body] of [['', 'PATCH', { title: 'Must roll back', state: { notes: 'Must roll back' }, status: 'archived' }], ['/adventure', 'PUT', { ...beforeSource, title: 'Must roll back' }], ['/characters', 'POST', { name: 'Must roll back', sheet: {} }], [`/characters/${campaign.party[0].characterId}`, 'PATCH', { name: 'Must roll back' }], [`/characters/${campaign.party[0].characterId}`, 'DELETE', {}], ['/saves', 'POST', { label: 'Must roll back', state: { notes: 'Must roll back' } }], [`/saves/${checkpoint.id}/restore`, 'POST', {}], [`/history/${(await history()).at(-1).id}/restore`, 'POST', {}]]) {
          await mutate(suffix, method, body, 409);
          assert.deepEqual(await get(), before);
          assert.deepEqual(await request(`/campaigns/${campaign.id}/adventure`), beforeSource);
          assert.deepEqual(await request(`/campaigns/${campaign.id}/saves`), beforeSaves);
          await assertLatest();
        }
      } finally {
        await pool.query('DROP TRIGGER history_test_failure ON campaign_history');
        await pool.query('DROP FUNCTION history_test_reject()');
      }
    });
    await t.test('history and checkpoint IDs cannot cross campaign boundaries; edition options are data-driven', async () => {
      const other = await request('/campaigns', 'POST', { title: 'Other campaign', editionId: 'dnd-5e-2014' }, 201);
      const version = (await history())[0];
      await request(`/campaigns/${other.id}/history/${version.id}`, 'GET', undefined, 404);
      await request(`/campaigns/${other.id}/history/${version.id}/restore`, 'POST', { expectedRevision: other.revision }, 404);
      await request(`/campaigns/${other.id}/saves/${checkpoint.id}/restore`, 'POST', { expectedRevision: other.revision }, 404);
      await pool.query("INSERT INTO editions(id,name,short_name,description,sort_order) VALUES ('test-rules','Test rules','Test','Data-driven edition',3)");
      assert.ok((await request('/editions')).some((edition) => edition.id === 'test-rules'));
      await pool.query("DELETE FROM editions WHERE id='test-rules'");
    });
    await t.test('opt-in demo seed creates accountless campaign, baseline and checkpoint without credentials', async () => {
      const run = promisify(execFile);
      const seed = fileURLToPath(new URL('../src/seed-demo.js', import.meta.url));
      const accountsBefore = (await pool.query('SELECT count(*) FROM users')).rows[0].count;
      const { stdout } = await run(process.execPath, [seed], { env: process.env });
      assert.match(stdout, /Fictional demo campaign created/);
      assert.equal((await pool.query('SELECT count(*) FROM users')).rows[0].count, accountsBefore);
      const demo = (await request('/campaigns')).find((entry) => entry.title === 'Demo · The Last Lantern');
      assert.equal(demo.revision, 1);
      assert.equal(demo.party[0].sheet.hp, 24);
      assert.equal((await request(`/campaigns/${demo.id}/history`)).length, 1);
      const saves = await request(`/campaigns/${demo.id}/saves`);
      assert.equal(saves.length, 1);
      assert.deepEqual(saves[0].snapshot.party, demo.party);
      await assert.rejects(run(process.execPath, [seed], { env: process.env }), /Demo campaign already exists/);
      assert.equal((await request('/campaigns')).filter((entry) => entry.title === demo.title).length, 1);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
