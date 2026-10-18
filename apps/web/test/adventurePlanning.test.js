import test from 'node:test';
import { canRefreshDraft } from '../src/campaignDrafts.js';
import assert from 'node:assert/strict';
import { adventureTitle, adventureSynopsis, adventureSignature, adventureSaveBody, adventureByteSize, maxAdventureBytes, boardPosition, boundedCoordinate, coordinateLabel, newPlanningPoint, planningCanvasState } from '../src/campaignPlanning.js';
import { adventure as validateAdventure } from '../../api/src/adventure.js';

test('safe metadata falls back only to the legacy title, never the shared journal', () => {
  const campaign = { title: 'Old journal title', state: { summary: 'Existing party journal', notes: 'Party notes' } };
  assert.equal(adventureTitle(campaign), 'Old journal title');
  assert.equal(adventureSynopsis(campaign), '');
  const updated = { ...campaign, adventure: { title: 'Source title', synopsis: '' } };
  assert.equal(adventureTitle(updated), 'Source title');
  assert.equal(adventureSynopsis(updated), '');
  assert.equal(campaign.title, 'Old journal title');
});
test('source size counts encoded bytes rather than only visible characters', () => {
  const source = { version: 1, revision: 0, title: 'Source', synopsis: '', storyline: '', dmGuidance: '', canvas: null };
  assert.equal(adventureByteSize(source), new TextEncoder().encode(JSON.stringify(source)).byteLength);
  assert.ok(adventureByteSize({ ...source, dmGuidance: '界'.repeat(70000) }) > maxAdventureBytes);
  assert.ok(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(70000) }) < maxAdventureBytes);
  const overhead = adventureByteSize(source);
  assert.equal(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(200000 - overhead) }), maxAdventureBytes);
  assert.ok(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(200001 - overhead) }) > maxAdventureBytes);
});

test('canonical UTF-8 source accepts exactly 200000 bytes without counting concurrency metadata', () => {
  const source = {
    version: 1, revision: 7, title: 'Source', synopsis: '', storyline: '', dmGuidance: '',
    canvas: { title: 'Board', points: Array.from({ length: 20 }, (_, index) => ({
      ...newPlanningPoint(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`),
      notes: '界'.repeat(3000),
    })) },
  };
  // Fill valid point fields to the byte boundary, independent of the frontend
  // size helper. Each multibyte note remains within the API's character limit.
  let remaining = maxAdventureBytes - Buffer.byteLength(JSON.stringify(source), 'utf8');
  assert.ok(remaining > 0);
  for (const point of source.canvas.points) {
    const count = Math.min(remaining, 1000);
    point.notes += 'a'.repeat(count);
    remaining -= count;
  }
  assert.equal(remaining, 0);
  const canonical = validateAdventure(source);
  assert.deepEqual(canonical, source);
  assert.equal(Buffer.byteLength(JSON.stringify(canonical), 'utf8'), 200000);
  assert.equal(adventureByteSize(source), 200000);
  for (const metadata of [
    { campaignRevision: 12 },
    { campaignRevision: 2147483646, expectedRevision: 2147483646 },
    { expectedRevision: 1 },
  ]) {
    const draft = { ...source, ...metadata };
    assert.equal(adventureByteSize(draft), 200000);
    assert.deepEqual(validateAdventure(draft), canonical);
  }
  const request = adventureSaveBody({ ...source, campaignRevision: 12 });
  assert.equal(request.expectedRevision, 12);
  assert.ok(Buffer.byteLength(JSON.stringify(request), 'utf8') > 200000);
  assert.deepEqual(validateAdventure(request), canonical);
  assert.equal(adventureByteSize(request), 200000);

  const oversized = structuredClone(source);
  oversized.canvas.points[0].characters = 'a';
  assert.equal(adventureByteSize(oversized), 200001);
  assert.throws(() => validateAdventure(oversized), /no larger than 200 KB/);
});

test('point placement and movement retain zero edges and bound off-board coordinates', () => {
  const bounds = { left: 20, top: 40, width: 200, height: 100 };
  assert.deepEqual(boardPosition(20, 40, bounds), { x: 0, y: 0 });
  assert.deepEqual(boardPosition(120, 90, bounds), { x: 50, y: 50 });
  assert.deepEqual(boardPosition(300, 0, bounds), { x: 100, y: 0 });
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(boundedCoordinate(value), 50);
  const id = '80cdab8d-8d1b-4d51-9470-a0734b65e127';
  assert.deepEqual(newPlanningPoint(id, { x: 0, y: 100 }), { id, title: 'Untitled point', kind: 'story', x: 0, y: 100, notes: '', location: '', characters: '' });
  assert.equal(newPlanningPoint(id).id, id);
  assert.equal(newPlanningPoint(id).x, 50);
});

test('canvas creation remains an unsaved retry until canonical success', () => {
  const saved = { version: 1, revision: 2, campaignRevision: 7, title: 'Source', canvas: null };
  const draft = { ...saved, canvas: { title: 'Planning canvas', points: [newPlanningPoint('draft-point')] } };
  assert.equal(planningCanvasState(saved, saved), 'absent');
  assert.equal(planningCanvasState(saved, draft), 'draft');
  // Retrying uses the retained canvas and original concurrency checks.
  assert.equal(adventureSaveBody(draft).expectedRevision, 7);
  assert.deepEqual(adventureSaveBody(draft).canvas, draft.canvas);
  assert.equal(saved.canvas, null);
  const canonical = { ...draft, revision: 3, campaignRevision: 8 };
  assert.equal(planningCanvasState(canonical, draft), 'saved');
});

test('coordinate labels round for reading without changing saved precision', () => {
  const point = newPlanningPoint('point', { x: 33.333333333, y: 99.99999 });
  assert.equal(coordinateLabel(point.x), 33.3);
  assert.equal(coordinateLabel(point.y), 100);
  assert.equal(coordinateLabel(0), 0);
  assert.equal(point.x, 33.333333333);
  assert.equal(point.y, 99.99999);
});

test('whole-source save keeps preparation and canvas and uses both loaded revisions', () => {
  const adventure = { version: 1, revision: 7, campaignRevision: 12, title: 'Source', synopsis: 'Safe', storyline: 'Secret story', dmGuidance: 'Secret guidance', canvas: { title: 'Board', points: [newPlanningPoint('80cdab8d-8d1b-4d51-9470-a0734b65e127')] } };
  const copy = structuredClone(adventure);
  const body = adventureSaveBody(adventure);
  assert.equal(body.revision, 7);
  assert.equal(body.expectedRevision, 12);
  assert.equal('campaignRevision' in body, false);
  assert.deepEqual(body.canvas, adventure.canvas);
  assert.equal(body.storyline, 'Secret story');
  assert.equal(body.dmGuidance, 'Secret guidance');
  assert.equal('state' in body, false);
  assert.deepEqual(adventure, copy);
  assert.equal(adventureSignature(adventure), adventureSignature({ ...adventure, revision: 8 }));
  assert.equal(adventureSignature(adventure), adventureSignature({ ...adventure, campaignRevision: 99 }));
  const staleDraft = { ...adventure, title: 'Unsaved title' };
  // A journal-only save changes campaign revision without changing source
  // revision. A protected source must still submit its captured campaign revision.
  const remoteJournalSave = { ...adventure, campaignRevision: 13 };
  assert.equal(remoteJournalSave.revision, staleDraft.revision);
  assert.equal(canRefreshDraft({ dirty: true }), false);
  assert.equal(adventureSaveBody(staleDraft).expectedRevision, 12);
  assert.equal(adventureSaveBody({ ...staleDraft, campaignRevision: 13 }).expectedRevision, 13);
  assert.equal(adventureSignature(adventure), adventureSignature(Object.fromEntries(Object.entries(adventure).reverse())));
  const edited = structuredClone(adventure); edited.canvas.points[0].notes = 'Changed details';
  assert.notEqual(adventureSignature(edited), adventureSignature(adventure));
  assert.notEqual(adventureSignature({ ...adventure, canvas: null }), adventureSignature({ ...adventure, canvas: { title: 'Board', points: [] } }));
});
