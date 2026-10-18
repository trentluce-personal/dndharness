import test from 'node:test';
import assert from 'node:assert/strict';
import { canRefreshDraft, createRefreshQueue, createRevisionRefreshPolicy, journalSaveBody, mergeCanonicalCampaign, newerCampaign } from '../src/campaignDrafts.js';

test('delayed write acknowledgement cannot consume a newer invalidation; idle trailing refresh catches up', async () => {
  const policy = createRevisionRefreshPolicy(10);
  let displayed = { revision: 10, notes: 'Before save' };
  let busy = true;
  let releaseWrite;
  const delayedWrite = new Promise((resolve) => { releaseWrite = resolve; });
  let blocked, refreshed;
  const sawBlocked = new Promise((resolve) => { blocked = resolve; });
  const sawRefreshed = new Promise((resolve) => { refreshed = resolve; });
  const remote = { revision: 12, notes: 'Browser B saved after A committed' };
  const queue = createRefreshQueue(async () => {
    const ticket = policy.ticket();
    const canonical = await Promise.resolve(remote);
    policy.observe(canonical.revision);
    if (!canRefreshDraft({ busy })) { blocked(); return; }
    if (policy.install(canonical.revision, ticket)) displayed = canonical;
    refreshed();
  }, 0);
  const save = (async () => {
    const acknowledgement = await delayedWrite;
    if (policy.install(acknowledgement.revision)) displayed = acknowledgement;
    busy = false;
    if (policy.pending && canRefreshDraft({ busy })) queue.request();
  })();
  // A committed r11, but its response is held. B commits r12; its event and
  // canonical GET both arrive before A's older response.
  policy.invalidate(); queue.request(); await sawBlocked;
  assert.equal(policy.pending, true);
  releaseWrite({ revision: 11, notes: 'A saved' }); await save;
  assert.equal(displayed.revision, 11);
  assert.equal(policy.pending, true, 'older acknowledgement must retain the saved-changes notice');
  await sawRefreshed; queue.dispose();
  assert.equal(displayed, remote);
  assert.equal(policy.pending, false);
  assert.equal(policy.install(11), false, 'late responses cannot roll back installed canonical state');
});

test('refresh started before another invalidation cannot clear pending changes even at the same revision', () => {
  const policy = createRevisionRefreshPolicy(7);
  policy.invalidate();
  const oldTicket = policy.ticket();
  policy.invalidate(); // Reconnect/event arrives while the GET is in flight.
  assert.equal(policy.install(8, oldTicket), true);
  assert.equal(policy.pending, true);
  assert.equal(policy.install(8), true, 'write acknowledgements never settle invalidation generations');
  assert.equal(policy.pending, true);
  assert.equal(policy.install(8, policy.ticket()), true);
  assert.equal(policy.pending, false);
});

test('protected source and restore previews retain captured revisions after a delayed write settles', () => {
  for (const protection of [{ dirty: true }, { editor: true }, { confirmation: true }]) {
    const policy = createRevisionRefreshPolicy(20);
    const captured = { revision: 3, campaignRevision: 20, expectedRevision: 20, notes: 'Keep these edits' };
    policy.invalidate(22); // A journal-only save can leave source revision at 3.
    policy.observe(22);
    policy.install(21); // Delayed source save / complete-history revert response.
    assert.equal(policy.pending, true);
    if (canRefreshDraft(protection)) captured.campaignRevision = 22;
    assert.deepEqual(captured, { revision: 3, campaignRevision: 20, expectedRevision: 20, notes: 'Keep these edits' });
    assert.equal(policy.install(21, policy.ticket()), true);
    assert.equal(policy.pending, true, 'a fresh but older-than-known response cannot hide the notice');
    assert.equal(policy.install(22, policy.ticket()), true);
    assert.equal(policy.pending, false);
  }
});

test('workspace discovery inserts campaigns and preserves monotonically newer data', () => {
  const existing = { id: 'one', revision: 8, updatedAt: '2026-10-01T00:00:00Z' };
  const discovered = { id: 'two', revision: 1, updatedAt: '2026-10-02T00:00:00Z' };
  const merged = [discovered, { id: 'one', revision: 7 }].reduce(mergeCanonicalCampaign, [existing]);
  assert.deepEqual(merged, [discovered, existing]);
  assert.equal(newerCampaign(existing, { id: 'one', revision: 7 }), existing);
});

test('SSE discovery before create response deduplicates and orders canonical updates like the server', () => {
  const created = { id: 'b', revision: 1, updatedAt: '2026-10-02T00:00:00Z' };
  const peerSaved = { ...created, revision: 2, updatedAt: '2026-10-04T00:00:00Z', adventure: { title: 'Saved elsewhere' } };
  const older = { id: 'c', revision: 5, updatedAt: '2026-10-01T00:00:00Z' };
  const tied = { id: 'a', revision: 3, updatedAt: peerSaved.updatedAt };
  let campaigns = [peerSaved, older, tied].reduce(mergeCanonicalCampaign, []);
  campaigns = mergeCanonicalCampaign(campaigns, created);
  assert.deepEqual(campaigns.map(({ id }) => id), ['a', 'b', 'c']);
  assert.equal(campaigns[1], peerSaved, 'late create acknowledgement never rolls back an SSE-discovered revision');
  const newest = { ...older, revision: 6, updatedAt: '2026-10-05T00:00:00Z' };
  campaigns = mergeCanonicalCampaign(campaigns, newest);
  assert.deepEqual(campaigns.map(({ id }) => id), ['c', 'a', 'b']);
  campaigns = mergeCanonicalCampaign([...campaigns, created], created);
  assert.equal(campaigns.length, 3, 'existing duplicate IDs are also reconciled');
  assert.equal(campaigns[2], peerSaved);
});

test('a refresh must recheck drafts after async completion, retaining captured revisions', async () => {
  const draft = { revision: 4, dirty: false, busy: false, confirmation: false, editor: false };
  assert.equal(canRefreshDraft(draft), true);
  const response = Promise.resolve({ revision: 5 });
  draft.dirty = true; // User types after the request starts.
  const saved = await response;
  if (canRefreshDraft(draft)) draft.revision = saved.revision;
  assert.equal(draft.revision, 4);
  for (const blocker of ['dirty', 'busy', 'confirmation', 'editor']) assert.equal(canRefreshDraft({ [blocker]: true }), false);
  assert.equal(canRefreshDraft({}), true);
});

test('refresh queue coalesces bursts and serializes trailing invalidations', async () => {
  let calls = 0, concurrent = 0, maximum = 0, release;
  const first = new Promise((resolve) => { release = resolve; });
  let finished;
  const done = new Promise((resolve) => { finished = resolve; });
  const queue = createRefreshQueue(async () => {
    calls++; concurrent++; maximum = Math.max(maximum, concurrent);
    if (calls === 1) await first;
    concurrent--;
    if (calls === 2) finished();
  }, 0);
  queue.request(); queue.request(); queue.request();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 1);
  queue.request(); queue.request(); release();
  await done; queue.dispose();
  assert.equal(calls, 2); assert.equal(maximum, 1);
});

test('disposed refresh responses cannot apply to an unmounted view', async () => {
  let release, started;
  const began = new Promise((resolve) => { started = resolve; });
  const response = new Promise((resolve) => { release = resolve; });
  let applied = false;
  const queue = createRefreshQueue(async (active) => { started(); await response; if (active()) applied = true; }, 0);
  queue.request(); await began; queue.dispose(); release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(applied, false);
});

test('journal and atomic checkpoint bodies retain the draft revision across fresh campaign reads', () => {
  const draft = { title: 'Draft title', status: 'active', revision: 4, state: { session: 2, notes: 'Unsaved journal' } };
  const fresh = { id: 'one', title: 'Someone else saved', revision: 5, state: { session: 3 }, party: [] };
  assert.deepEqual(journalSaveBody(draft), { title: 'Draft title', status: 'active', state: draft.state, expectedRevision: 4 });
  const body = journalSaveBody(draft, 'Before the ruins');
  assert.equal(body.expectedRevision, 4);
  assert.equal(body.label, 'Before the ruins');
  assert.equal(body.state.notes, 'Unsaved journal');
  assert.equal('adventure' in body, false);
  assert.equal('party' in body, false);
  assert.equal(mergeCanonicalCampaign([{ id: 'one', revision: 4 }], fresh)[0], fresh);
  assert.equal(journalSaveBody(draft).expectedRevision, 4);
});

test('out-of-order canonical responses do not replace newer party/journal/source data', () => {
  const newest = { id: 'one', revision: 9, party: [{ name: 'Newest sheet' }], state: { notes: 'Newest journal' }, adventure: { title: 'Newest source' } };
  const unrelated = { id: 'two', revision: 1 };
  const merged = mergeCanonicalCampaign([newest, unrelated], { id: 'one', revision: 8, party: [], state: {}, adventure: { title: 'Older source' } });
  assert.equal(merged[0], newest);
  assert.equal(merged[1], unrelated);
  const canonical = { ...newest, revision: 10, party: [] };
  assert.equal(mergeCanonicalCampaign(merged, canonical)[0], canonical);
});
