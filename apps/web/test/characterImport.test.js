import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { importCharacterPdf, mapCharacterFields } from '../src/characterImport.js';

const fields = { CharacterName: 'Example Mage', 'CLASS LEVEL': 'Wizard 2', RACE: 'Dragonborn', BACKGROUND: 'Sage', STR: '8', DEX: '12', CON: '13', INT: '17', WIS: '15', CHA: '10', AC: '12', MaxHP: '12', Speed: '30 ft. (Walking)', FeaturesTraits1: 'Example feature · PHB-2024 165', 'Eq Name0': 'Book', 'Eq Qty0': '1', spellName0: 'Example spell', spellDuration0: '1 minute' };

test('reads a form-fillable PDF with structured equipment and no campaign HP', async () => {
  const document = await PDFDocument.create();
  document.addPage();
  for (const [name, text] of Object.entries(fields)) document.getForm().createTextField(name).setText(text);
  const bytes = await document.save({ updateFieldAppearances: false });
  const result = await importCharacterPdf({ name: 'example.pdf', size: bytes.length, arrayBuffer: async () => bytes });
  assert.equal(result.name, 'Example Mage');
  assert.equal(result.sheet.level, 2);
  assert.equal(result.sheet.class, 'Wizard');
  assert.equal(result.sheet.abilities.strength, 8);
  assert.equal(result.sheet.hp, undefined);
  assert.deepEqual(result.missing, []);
  assert.equal(result.sheet.speed, 30);
  assert.equal(result.suggestedEdition, 'dnd-5e-2024');
  assert.deepEqual(result.sheet.inventory.items, [{ name: 'Book', quantity: 1, weight: '' }]);
  assert.equal(result.sheet.details.spells[0].name, 'Example spell');
});

test('ignores campaign HP and totals multiclass levels, but rejects invalid scores', () => {
  const result = mapCharacterFields({ ...fields, CurrentHP: '0', STR: '-1', 'CLASS LEVEL': 'Fighter 1 / Wizard 2' });
  assert.equal(result.sheet.hp, undefined);
  assert.equal(result.sheet.level, 3);
  assert.equal(result.sheet.class, 'Fighter / Wizard');
  assert.equal(result.sheet.abilities.strength, '');
  assert.ok(result.missing.includes('strength'));
});

test('reads page widget fields when the PDF lacks a catalog form', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage();
  const form = document.getForm();
  for (const [name, text] of Object.entries({ ...fields, 'CLASS  LEVEL': 'Wizard 2' })) {
    const field = form.createTextField(name);
    field.setText(text.replace('·', '-'));
    field.addToPage(page);
  }
  document.catalog.delete(PDFName.of('AcroForm'));
  const bytes = await document.save({ updateFieldAppearances: false });
  const result = await importCharacterPdf({ name: 'widgets.pdf', size: bytes.length, arrayBuffer: async () => bytes });
  assert.equal(result.sheet.level, 2);
  assert.equal(result.sheet.abilities.intelligence, 17);
  assert.equal(result.sheet.hp, undefined);
});

test('rejects unreadable, non-PDF, oversized and fieldless documents', async () => {
  await assert.rejects(importCharacterPdf({ name: 'sheet.txt', size: 1 }), /Choose a PDF/);
  await assert.rejects(importCharacterPdf({ name: 'sheet.pdf', size: 11 * 1024 * 1024 }), /10 MB/);
  await assert.rejects(importCharacterPdf({ name: 'sheet.pdf', size: 1, arrayBuffer: async () => new Uint8Array([0]) }), /could not be read/);
  const document = await PDFDocument.create();
  document.addPage();
  const bytes = await document.save();
  await assert.rejects(importCharacterPdf({ name: 'sheet.pdf', size: bytes.length, arrayBuffer: async () => bytes }), /No editable fields/);
});

test('merges page-only references into a partially catalogued form', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage();
  const form = document.getForm();
  const name = form.createTextField('CharacterName');
  name.setText('Partial Mage'); name.addToPage(page);
  const feature = form.createTextField('FeaturesTraits1');
  feature.setText('Page-only feature'); feature.addToPage(page);
  form.acroForm.dict.set(PDFName.of('Fields'), document.context.obj([name.ref]));
  const bytes = await document.save({ updateFieldAppearances: false });
  const result = await importCharacterPdf({ name: 'partial.pdf', size: bytes.length, arrayBuffer: async () => bytes });
  assert.match(result.sheet.details.narrative.features, /Page-only feature/);
});

test('does not silently truncate reference text', () => {
  assert.throws(() => mapCharacterFields({ ...fields, FeaturesTraits1: 'x'.repeat(10001) }), /more reference text/);
});

test('keeps duplicate items, listed weights, unknown quantities and separate coins', () => {
  const result = mapCharacterFields({ ...fields, 'Eq Name1': 'Book', 'Eq Qty1': '', 'Eq Weight0': '5 lb.', GP: '60', CP: '0' });
  assert.deepEqual(result.sheet.inventory.items, [{ name: 'Book', quantity: 1, weight: '5 lb.' }, { name: 'Book', quantity: null, weight: '' }]);
  assert.equal(result.sheet.inventory.coins.gp, 60);
  assert.equal(result.sheet.inventory.coins.cp, 0);
  assert.equal(result.sheet.inventory.coins.sp, null);
});

test('maps proficiency, attacks, full spell references and unmapped values separately', () => {
  const result = mapCharacterFields({ ...fields, STRmod: '-1', CHamod: '+0', 'ST Intelligence': '+5', IntProf: '•', Investigation: '+7', InvestigationMod: 'INT', InvestigationProf: 'E', 'Wpn Name': 'Dagger', 'Wpn1 AtkBonus': '+3', 'Wpn1 Damage': '1d4+1 Piercing', 'Wpn Name 2': 'Dagger', 'Wpn2 AtkBonus': '+3', spellPrepared0: 'O', spellPage0: 'PHB-2024 292', spellCastingClass0: 'Wizard', spellSaveDC0: '13', spellHeader0: 'Cantrips', spellSlotHeader0: '(At Will)', spellHeader1: '1st level', spellSlotHeader1: '3 Slots OOO', SIZE: 'Medium', CustomReference: 'Keep this', CurrentHP: '2', TempHP: '3' });
  assert.equal(result.sheet.version, 3);
  const details = result.sheet.details;
  assert.deepEqual(details.savingThrows, [{ name: 'Intelligence', modifier: '+5', proficiency: 'proficient' }]);
  assert.deepEqual(details.skills[0], { name: 'Investigation', modifier: '+7', ability: 'INT', proficiency: 'expertise' });
  assert.equal(details.attacks.length, 2);
  assert.equal(details.spells[0].prepared, 'O');
  assert.equal(details.spells[0].page, 'PHB-2024 292');
  assert.equal(details.spellcasting[0].saveDc, '13');
  assert.equal(details.spellGroups[1].slots, '3 Slots OOO');
  assert.equal(details.identity.size, 'Medium');
  assert.deepEqual(details.additionalFields, [{ name: 'CustomReference', value: 'Keep this' }]);
  assert.equal(result.sheet.notes, '');
});

test('reads checkbox and dropdown form values and preserves unknown proficiency markers', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage();
  const form = document.getForm();
  form.createTextField('CharacterName').setText('Form Example');
  const check = form.createCheckBox('IntProf');
  check.addToPage(page);
  check.check();
  const custom = form.createCheckBox('spellPrepared0');
  custom.addToPage(page);
  const appearance = custom.acroField.getWidgets()[0].dict.lookup(PDFName.of('AP'));
  const normal = appearance.lookup(PDFName.of('N'));
  normal.set(PDFName.of('CustomPrepared'), normal.get(PDFName.of('Yes')));
  normal.delete(PDFName.of('Yes'));
  custom.acroField.setValue(PDFName.of('CustomPrepared'));
  form.createTextField('spellName0').setText('Light');
  form.createDropdown('SIZE').addOptions(['Medium', 'Small']);
  form.getDropdown('SIZE').select('Medium');
  form.createTextField('ArcanaProf').setText('Custom marker');
  const bytes = await document.save({ updateFieldAppearances: false });
  const result = await importCharacterPdf({ name: 'choices.pdf', size: bytes.length, arrayBuffer: async () => bytes });
  assert.equal(result.sheet.details.savingThrows[0].proficiency, 'proficient');
  assert.equal(result.sheet.details.identity.size, 'Medium');
  assert.equal(result.sheet.details.spells[0].prepared, 'CustomPrepared');
  assert.equal(result.sheet.details.skills[0].proficiency, 'unknown');
  assert.deepEqual(result.sheet.details.additionalFields, [{ name: 'ArcanaProf', value: 'Custom marker' }]);
});

test('preserves conflicting aliases and quantities that cannot be represented', () => {
  const result = mapCharacterFields({ ...fields, Appearance: 'First description', 'CHARACTER APPEARANCE': 'Different description', 'Eq Qty0': 'Unknown - see notes' });
  assert.equal(result.sheet.details.narrative.appearance, 'First description');
  assert.equal(result.sheet.inventory.items[0].quantity, null);
  assert.deepEqual(result.sheet.details.additionalFields, [{ name: 'Eq Qty0', value: 'Unknown - see notes' }, { name: 'CHARACTER APPEARANCE', value: 'Different description' }]);
});
