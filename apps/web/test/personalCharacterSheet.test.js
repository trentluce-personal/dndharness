import assert from 'node:assert/strict';
import test from 'node:test';
import { abilityReferences, listedValue, proficiencyReference } from '../src/personalCharacterSheet.js';

test('legacy scores do not produce inferred modifiers; missing and zero remain distinct', () => {
  const rows = abilityReferences({ abilities: { strength: 18, dexterity: 0 } });
  assert.equal(rows[0].score, 18);
  assert.deepEqual(rows[0].modifiers, []);
  assert.equal(listedValue(rows[1].score), '0');
  assert.equal(listedValue(rows[2].score), 'Not recorded');
  assert.equal(listedValue(''), 'Not recorded');
});

test('listed labels match case/abbreviations without losing duplicate or unfamiliar references', () => {
  const sheet = { details: { abilityModifiers: [{ name: ' STR ', modifier: '0' }, { name: 'Strength', modifier: '+4 (printed)' }, { name: 'Other label', modifier: '+99' }] } };
  assert.deepEqual(abilityReferences(sheet)[0].modifiers, ['0', '+4 (printed)']);
  assert.equal(sheet.details.abilityModifiers.length, 3);
  assert.deepEqual(proficiencyReference('unknown'), ['?', 'Unknown marker']);
  assert.deepEqual(proficiencyReference(undefined), ['—', 'Not recorded']);
});
