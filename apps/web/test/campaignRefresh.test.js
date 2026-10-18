import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignRefreshPolicy } from '../src/campaignRefresh.js';

test('failed local requests schedule trailing reads without claiming a newer save', () => {
  const policy = createCampaignRefreshPolicy(12);
  const beforeWrite = policy.ticket();
  policy.invalidate();
  assert.equal(policy.pending, true);
  assert.equal(policy.changesAvailable, false);
  // A pre-write read cannot settle the required trailing refresh.
  assert.equal(policy.install(12, beforeWrite), true);
  assert.equal(policy.pending, true);
  assert.equal(policy.changesAvailable, false);
  policy.install(12, policy.ticket());
  assert.equal(policy.pending, false);
});

test('a dirty draft is notified only after a confirmed newer revision or conflict', () => {
  const policy = createCampaignRefreshPolicy(12);
  policy.invalidate();
  policy.observe(12);
  assert.equal(policy.changesAvailable, false);
  policy.observe(13);
  assert.equal(policy.changesAvailable, true);
  policy.install(13, policy.ticket());
  assert.equal(policy.changesAvailable, false);
  policy.markConflict();
  assert.equal(policy.changesAvailable, true);
  policy.invalidate();
  assert.equal(policy.changesAvailable, true);
  policy.install(14, policy.ticket());
  assert.equal(policy.changesAvailable, false);
});

test('local acknowledgements cannot hide a confirmed concurrent save or regress state', () => {
  const policy = createCampaignRefreshPolicy(12);
  policy.observe(14);
  assert.equal(policy.install(13), true);
  assert.equal(policy.changesAvailable, true);
  assert.equal(policy.install(12, policy.ticket()), false);
  assert.equal(policy.changesAvailable, true);
  policy.invalidate();
  policy.install(14, policy.ticket());
  assert.equal(policy.pending, false);
  assert.equal(policy.changesAvailable, false);
});
