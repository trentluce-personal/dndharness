import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceRoute, characterUrl, campaignUrl, sessionUrl, interceptLink, draftSignature, workspaceBreadcrumbs, campaignViews } from '../src/workspaceRoutes.js';

test('dormant breadcrumb helper retains one current leaf for preserved screens', () => {
  for (const [route, expected] of [
    [{ section: 'sessions' }, ['Home', 'Live sessions']],
    [{ section: 'sessions', view: 'host' }, ['Home', 'Live sessions', 'Host a session']],
    [{ section: 'sessions', id: 'one', name: 'Canonical source' }, ['Home', 'Live sessions', 'Canonical source']],
    [{ section: 'sessions', id: 'one' }, ['Home', 'Live sessions', 'Loading session…']],
    [{ section: 'sessions', id: 'one', name: 'Session ended or unavailable' }, ['Home', 'Live sessions', 'Session ended or unavailable']],
    [{ section: 'campaigns', id: 'one', name: 'Canonical source', view: 'history' }, ['Home', 'Campaigns', 'Canonical source', 'Version history']],
  ]) {
    const crumbs = workspaceBreadcrumbs(route);
    assert.deepEqual(crumbs.map(({ label }) => label), expected);
    assert.equal(crumbs.filter(({ href }) => !href).length, 1);
    assert.equal(crumbs.at(-1).href, undefined);
  }
  assert.deepEqual(workspaceBreadcrumbs({ section: 'table' }), []);
});

test('old campaign navigation URLs lead to the unavailable screen while preserving native links', () => {
  assert.deepEqual(campaignViews.map(([, label]) => label), ['Overview', 'Planning canvas', 'Party & journal', 'Version history']);
  for (const [view] of campaignViews) {
    const href = `http://local${campaignUrl('shared / source', view)}`;
    const anchor = { href, target: '', hasAttribute: () => false };
    assert.equal(interceptLink({ button: 0 }, anchor, 'http://local'), true);
    assert.equal(interceptLink({ button: 0, ctrlKey: true }, anchor, 'http://local'), false);
    assert.deepEqual(workspaceRoute(new URL(href).pathname), { section: 'legacy' });
  }
});

test('root and session aliases resolve to the feed; host and encoded session links remain reloadable', () => {
  assert.deepEqual(workspaceRoute('/'), { section: 'sessions' });
  assert.deepEqual(workspaceRoute('/sessions'), { section: 'sessions' });
  assert.deepEqual(workspaceRoute('/sessions/'), { section: 'sessions' });
  assert.deepEqual(workspaceRoute('/sessions/host'), { section: 'sessions', view: 'host' });
  assert.deepEqual(workspaceRoute('/sessions/host/'), { section: 'sessions', view: 'host' });
  const url = sessionUrl('table / friends');
  assert.deepEqual(workspaceRoute(url), { section: 'sessions', id: 'table / friends' });
  assert.deepEqual(workspaceRoute(`${url}/`), { section: 'sessions', id: 'table / friends' });
  assert.equal(interceptLink({ button: 0 }, { href: `http://local${url}`, target: '', hasAttribute: () => false }, 'http://local'), true);
  for (const path of ['/sessions/%invalid', '/sessions/table/ready', '/sessions/table/characters']) assert.equal(workspaceRoute(path).section, 'missing');
});

test('all legacy campaign, character, profile and dice routes are unavailable on fresh loads', () => {
  for (const base of ['/characters', '/campaigns', '/dice', '/profile']) {
    for (const suffix of ['', '/', '/saved', '/saved/history', '/%invalid', '/one/two']) {
      assert.deepEqual(workspaceRoute(`${base}${suffix}`), { section: 'legacy' });
    }
  }
  assert.deepEqual(workspaceRoute(characterUrl('saved id')), { section: 'legacy' });
  for (const url of ['/campaignship', '/profiles', '/unknown']) assert.deepEqual(workspaceRoute(url), { section: 'missing' });
});
test('preserved campaign URL helpers cannot reopen old source, planning, progress or history screens', () => {
  const id = 'saved source/id';
  assert.deepEqual(workspaceRoute(campaignUrl(id)), { section: 'legacy' });
  for (const view of ['planning', 'progress', 'history']) {
    const url = campaignUrl(id, view);
    assert.deepEqual(workspaceRoute(url), { section: 'legacy' });
    assert.deepEqual(workspaceRoute(`${url}/`), { section: 'legacy' });
    assert.equal(interceptLink({ button: 0 }, { href: `http://local${url}`, target: '', hasAttribute: () => false }, 'http://local'), true);
  }
  for (const url of ['/characters/id/planning', '/characters/id/progress', '/campaigns/id/unknown', '/campaigns/%invalid/planning', '/campaigns/id/planning/extra']) assert.equal(workspaceRoute(url).section, 'legacy');
});
test('native new-tab, modified, external and fragment link behavior is preserved', () => {
  const anchor = { href: 'http://local/sessions/one', target: '', hasAttribute: () => false };
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
