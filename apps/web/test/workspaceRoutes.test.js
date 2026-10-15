import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceRoute, characterUrl, campaignUrl, interceptLink, draftSignature } from '../src/workspaceRoutes.js';

test('sections and stable character links resolve on a fresh load', () => {
  for (const [url, section] of [['/', 'table'], ['/characters', 'characters'], ['/campaigns', 'campaigns'], ['/dice', 'dice'], ['/profile', 'profile']]) assert.deepEqual(workspaceRoute(url), { section });
  assert.deepEqual(workspaceRoute(characterUrl('saved id')), { section: 'characters', id: 'saved id' });
  assert.equal(workspaceRoute('/characters/%invalid').section, 'missing');
  assert.equal(workspaceRoute('/characters/one/two').section, 'missing');
});
test('campaign source, planning and existing progress have distinct reloadable URLs', () => {
  const id = 'saved source/id';
  assert.deepEqual(workspaceRoute(campaignUrl(id)), { section: 'campaigns', id });
  for (const view of ['planning', 'progress']) {
    const url = campaignUrl(id, view);
    assert.deepEqual(workspaceRoute(url), { section: 'campaigns', id, view });
    assert.deepEqual(workspaceRoute(`${url}/`), { section: 'campaigns', id, view });
    assert.equal(interceptLink({ button: 0 }, { href: `http://local${url}`, target: '', hasAttribute: () => false }, 'http://local'), true);
  }
  for (const url of ['/characters/id/planning', '/characters/id/progress', '/campaigns/id/unknown', '/campaigns/%invalid/planning', '/campaigns/id/planning/extra']) assert.equal(workspaceRoute(url).section, 'missing');
});
test('native new-tab, modified, external and fragment link behavior is preserved', () => {
  const anchor = { href: 'http://local/characters/one', target: '', hasAttribute: () => false };
  assert.equal(interceptLink({ button: 0 }, anchor, 'http://local'), true);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'defaultPrevented']) assert.equal(interceptLink({ button: 0, [modifier]: true }, anchor, 'http://local'), false);
  assert.equal(interceptLink({ button: 1 }, anchor, 'http://local'), false);
  for (const change of [{ target: '_blank' }, { href: 'http://elsewhere/characters/one' }, { href: 'http://local/#main-content' }, { hasAttribute: () => true }]) assert.equal(interceptLink({ button: 0 }, { ...anchor, ...change }, 'http://local'), false);
});
test('meaningful drafts ignore format-only changes but protect nested reference edits', () => {
  const saved = { name: 'Rowan', editionId: '2014', sheet: { version: 1, hp: 4, maxHp: 12, notes: '', details: { spells: [{ name: 'Light', page: '292' }] } } };
  const upgrade = structuredClone(saved); upgrade.sheet.version = 3; delete upgrade.sheet.hp;
  assert.equal(draftSignature(saved), draftSignature(upgrade));
  upgrade.sheet.details.spells[0].page = '293';
  assert.notEqual(draftSignature(saved), draftSignature(upgrade));
  assert.notEqual(draftSignature(saved, true), draftSignature({ ...saved, sheet: { ...saved.sheet, hp: 2 } }, true));
  assert.equal(draftSignature(saved), draftSignature({ ...saved, sheet: { ...saved.sheet, hp: 2 } }));
});
