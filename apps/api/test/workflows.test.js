import test from 'node:test';
import assert from 'node:assert/strict';

if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a dedicated database whose name ends in _test.');
const { app } = await import('../src/app.js');
const { pool, migrate } = await import('../src/db.js');

test('accounts, ownership, edition constraints, immutable saves, and restoration', async () => {
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  function client() {
    let cookie = '';
    return async (path, method = 'GET', body, expected = 200) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: 'http://127.0.0.1:5173' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const data = await response.json();
      assert.equal(response.status, expected, JSON.stringify(data));
      return data;
    };
  }
  const dm = client(); const player = client(); const outsider = client();
  try {
    await pool.query('TRUNCATE users,characters,campaigns,campaign_party,campaign_saves,sessions CASCADE');
    await dm('/characters', 'GET', null, 401);
    const account = await dm('/auth/register', 'POST', { email: 'dm@example.test', password: 'Example-password-123', displayName: 'The DM' }, 201);
    assert.equal(account.user.password_hash, undefined);
    await player('/auth/register', 'POST', { email: 'player@example.test', password: 'Example-password-123', displayName: 'The Player' }, 201);
    await outsider('/auth/register', 'POST', { email: 'outsider@example.test', password: 'Example-password-123', displayName: 'Outsider' }, 201);
    const character = await player('/characters', 'POST', { editionId: 'dnd-5e-2024', name: 'Rowan', sheet: {} }, 201);
    await dm(`/characters/${character.id}`, 'PATCH', { name: 'Stolen', sheet: {} }, 404);
    const oldCharacter = await player('/characters', 'POST', { editionId: 'dnd-5e-2014', name: 'Old rules', sheet: {} }, 201);
    const campaign = await dm('/campaigns', 'POST', { title: 'Lantern Road', editionId: 'dnd-5e-2024', state: { location: 'The inn' } }, 201);
    await player('/campaigns/join', 'POST', { inviteCode: campaign.inviteCode, characterId: oldCharacter.id }, 400);
    await player('/campaigns/join', 'POST', { inviteCode: campaign.inviteCode, characterId: character.id });
    const view = await player(`/campaigns/${campaign.id}`);
    assert.equal(view.inviteCode, undefined);
    assert.equal(view.party[0].displayName, 'The Player');
    assert.equal(view.party[0].email, undefined);
    await outsider(`/campaigns/${campaign.id}`, 'GET', null, 404);
    await player(`/campaigns/${campaign.id}/saves`, 'POST', { label: 'Forbidden' }, 403);
    const save = await dm(`/campaigns/${campaign.id}/saves`, 'POST', { label: 'At the inn' }, 201);
    await outsider(`/campaigns/${campaign.id}/saves`, 'GET', null, 404);
    await player(`/campaigns/${campaign.id}/saves/${save.id}/restore`, 'POST', {}, 403);
    await player(`/campaigns/${campaign.id}/party/${character.id}`, 'PATCH', { name: 'Rowan', sheet: {} }, 403);
    await dm(`/campaigns/${campaign.id}/party/${character.id}`, 'PATCH', { name: 'Rowan', sheet: { hp: 3 } });
    assert.equal((await player('/characters'))[0].sheet.hp, 10);
    await dm(`/campaigns/${campaign.id}`, 'PATCH', { title: 'Lantern Road', state: { location: 'The ruins', session: 2 } });
    const restored = await dm(`/campaigns/${campaign.id}/saves/${save.id}/restore`, 'POST', {});
    assert.equal(restored.state.location, 'The inn');
    assert.equal(restored.party[0].sheet.hp, 10);
    assert.deepEqual((await player(`/campaigns/${campaign.id}/saves`))[0].snapshot, save.snapshot);
    await assert.rejects(pool.query('UPDATE campaign_saves SET label=$1 WHERE id=$2', ['mutated', save.id]), /immutable/);
    await pool.query("INSERT INTO editions(id,name,short_name,description,sort_order) VALUES ('test-rules','Test rules','Test','Data-driven edition',3)");
    assert.ok((await dm('/editions')).some((edition) => edition.id === 'test-rules'));
    await pool.query("DELETE FROM editions WHERE id='test-rules'");
    await player('/characters', 'POST', { editionId: 'missing', name: 'No rules', sheet: {} }, 400);
    await player('/characters', 'POST', { editionId: 'dnd-5e-2024', name: 'Bad HP', sheet: { hp: 20, maxHp: 10 } }, 400);
    const profile = await player('/profile', 'PATCH', { displayName: 'Updated', realName: 'Optional Name', bio: 'Hello' });
    assert.equal(profile.user.realName, 'Optional Name');
    await player('/profile/password', 'POST', { currentPassword: 'Example-password-123', newPassword: 'New-password-123' });
    await player('/auth/logout', 'POST', {});
    assert.equal((await player('/auth/me')).user, null);
    await player('/auth/login', 'POST', { email: 'player@example.test', password: 'New-password-123' });
    const forbidden = await fetch(base + '/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.test' }, body: '{}' });
    assert.equal(forbidden.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
