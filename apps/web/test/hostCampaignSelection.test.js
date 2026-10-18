import test from 'node:test';
import assert from 'node:assert/strict';
import { hostCampaignSelection } from '../src/hostCampaignSelection.js';

const a = { id: 'a', title: 'A journal', adventure: { title: 'Adventure A' }, status: 'active', revision: 1 };
const b = { id: 'b', title: 'Adventure B', status: 'active', revision: 1 };

test('peer archives selected A while B remains active: selected A stays visible and cannot host', () => {
  const state = hostCampaignSelection([{ ...a, status: 'archived', revision: 2 }, b], 'a', a);
  assert.deepEqual(state.options, [
    { id: 'a', label: 'Adventure A — Archived', disabled: true },
    { id: 'b', label: 'Adventure B', disabled: false },
  ]);
  assert.equal(state.unavailable, true);
  assert.equal(state.canHost, false);
});

test('archived and missing deep links retain explicit selected options even with no active campaigns', () => {
  for (const campaigns of [[{ ...a, status: 'archived' }, b], [{ ...a, status: 'archived' }], [b], []]) {
    const state = hostCampaignSelection(campaigns, 'a', null);
    assert.equal(state.options[0].id, 'a');
    assert.equal(state.options[0].disabled, true);
    assert.match(state.options[0].label, /Archived|Unavailable/);
    assert.equal(state.canHost, false);
  }
});

test('selecting B cannot submit captured A while B is loading or after a late A response', () => {
  for (const captured of [null, a, { ...a, revision: 99 }]) {
    const state = hostCampaignSelection([a, b], 'b', captured);
    assert.equal(state.options.find(({ id }) => id === 'b').label, 'Adventure B');
    assert.equal(state.canHost, false);
  }
  assert.equal(hostCampaignSelection([a, b], 'b', b).canHost, true);
});

test('authoritative archived detail disables stale active library selection; reactivation requires matching active read', () => {
  const archived = { ...a, status: 'archived', revision: 2 };
  assert.equal(hostCampaignSelection([a, b], 'a', archived).options[0].disabled, true);
  assert.equal(hostCampaignSelection([a, b], 'a', archived).canHost, false);
  const reactivated = { ...a, revision: 3 };
  assert.equal(hostCampaignSelection([reactivated, b], 'a', archived).options[0].disabled, false);
  assert.equal(hostCampaignSelection([reactivated, b], 'a', archived).canHost, false);
  assert.equal(hostCampaignSelection([reactivated, b], 'a', reactivated).canHost, true);
});
