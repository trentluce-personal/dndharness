import test from 'node:test';
import assert from 'node:assert/strict';
import { adventureTitle, adventureSynopsis, adventureSignature, adventureSaveBody, adventureByteSize, maxAdventureBytes, boardPosition, boundedCoordinate, newPlanningPoint } from '../src/campaignPlanning.js';

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
  assert.equal(adventureByteSize(source), new TextEncoder().encode(JSON.stringify(adventureSaveBody(source))).byteLength);
  assert.ok(adventureByteSize({ ...source, dmGuidance: '界'.repeat(70000) }) > maxAdventureBytes);
  assert.ok(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(70000) }) < maxAdventureBytes);
  const overhead = adventureByteSize(source);
  assert.equal(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(200000 - overhead) }), maxAdventureBytes);
  assert.ok(adventureByteSize({ ...source, dmGuidance: 'a'.repeat(200001 - overhead) }) > maxAdventureBytes);
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

test('whole-source save keeps private content and canvas and uses the canonical revision', () => {
  const adventure = { version: 1, revision: 7, title: 'Source', synopsis: 'Safe', storyline: 'Secret story', dmGuidance: 'Secret guidance', canvas: { title: 'Board', points: [newPlanningPoint('80cdab8d-8d1b-4d51-9470-a0734b65e127')] } };
  const copy = structuredClone(adventure);
  const body = adventureSaveBody(adventure);
  assert.equal(body.revision, 7);
  assert.equal('expectedRevision' in body, false);
  assert.deepEqual(body.canvas, adventure.canvas);
  assert.equal(body.storyline, 'Secret story');
  assert.equal(body.dmGuidance, 'Secret guidance');
  assert.equal('state' in body, false);
  assert.deepEqual(adventure, copy);
  assert.equal(adventureSignature(adventure), adventureSignature({ ...adventure, revision: 8 }));
  assert.equal(adventureSignature(adventure), adventureSignature(Object.fromEntries(Object.entries(adventure).reverse())));
  const edited = structuredClone(adventure); edited.canvas.points[0].notes = 'Changed details';
  assert.notEqual(adventureSignature(edited), adventureSignature(adventure));
  assert.notEqual(adventureSignature({ ...adventure, canvas: null }), adventureSignature({ ...adventure, canvas: { title: 'Board', points: [] } }));
});
