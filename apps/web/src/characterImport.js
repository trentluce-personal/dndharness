const abilities = { STR: 'strength', DEX: 'dexterity', CON: 'constitution', INT: 'intelligence', WIS: 'wisdom', CHA: 'charisma' };

export function mapCharacterFields(fields) {
  const consumed = new Set();
  const value = (...names) => {
    const selected = names.find((name) => fields[name]?.trim());
    const result = selected ? fields[selected].trim() : '';
    names.filter((name) => fields[name]?.trim() === result).forEach((name) => consumed.add(name));
    return result;
  };
  const number = (label, names, min, max, leading = false) => {
    const raw = value(...names);
    const match = leading ? raw.match(/^\d+(?:\.\d+)?/)?.[0] : raw;
    const parsed = match ? Number(match) : NaN;
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      missing.push(label);
      names.forEach((name) => consumed.delete(name));
      return '';
    }
    return parsed;
  };
  if (!value('CharacterName', 'CharacterName2', 'CharacterName4')) throw new Error('No character found. Choose a filled D&D Beyond PDF with editable form fields.');
  const missing = [];
  const classLevel = value('CLASS LEVEL', 'CLASS  LEVEL', 'CLASS LEVEL2', 'CLASS  LEVEL2');
  const classes = [...classLevel.matchAll(/([^/\d]+?)\s+(\d+)(?=\s*(?:\/|$))/g)];
  const level = classes.length ? classes.reduce((sum, entry) => sum + Number(entry[2]), 0) : '';
  if (!level || level > 100) missing.push('Level');
  const sheet = {
    version: 3,
    ancestry: value('RACE', 'RACE2', 'SPECIES'),
    class: classes.length ? classes.map((entry) => entry[1].trim()).join(' / ') : classLevel,
    background: value('BACKGROUND', 'BACKGROUND2'),
    level: level && level <= 100 ? level : '',
    maxHp: number('Maximum health', ['MaxHP', 'HPMax'], 1, 100000),
    ac: number('Armor class', ['AC'], 0, 1000),
    speed: number('Movement speed', ['Speed'], 0, 10000, true),
    abilities: Object.fromEntries(Object.entries(abilities).map(([key, label]) => [label, number(label, [key], 1, 100)])),
    equipment: '', notes: '',
  };
  const indexed = (prefix) => Object.keys(fields).filter((key) => key.startsWith(prefix) && /^\d+$/.test(key.slice(prefix.length))).sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
  const equipment = indexed('Eq Name').filter((key) => value(key)).map((key) => {
    const index = key.slice('Eq Name'.length);
    const rawQuantity = value(`Eq Qty${index}`);
    const quantity = /^\d+$/.test(rawQuantity) && Number(rawQuantity) <= 100000 ? Number(rawQuantity) : null;
    if (rawQuantity && quantity === null) consumed.delete(`Eq Qty${index}`);
    return { name: value(key), quantity, weight: value(`Eq Weight${index}`) === '--' ? '' : value(`Eq Weight${index}`) };
  });
  const coins = Object.fromEntries(['CP', 'SP', 'EP', 'GP', 'PP'].map((key) => {
    const raw = value(key);
    const amount = /^\d+$/.test(raw) && Number(raw) <= 1000000000 ? Number(raw) : null;
    if (raw && amount === null) consumed.delete(key);
    return [key.toLowerCase(), amount];
  }));
  sheet.inventory = { items: equipment, coins };
  const details = emptyDetails();
  const mapGroup = (group, mapping) => {
    for (const [key, names] of Object.entries(mapping)) details[group][key] = value(...names);
  };
  mapGroup('identity', { playerName: ['PLAYER NAME', 'PLAYER NAME2'], experience: ['EXPERIENCE POINTS', 'EXPERIENCE POINTS2'], gender: ['GENDER'], age: ['AGE'], size: ['SIZE'], height: ['HEIGHT'], weight: ['WEIGHT'], alignment: ['ALIGNMENT'], faith: ['FAITH'], skin: ['SKIN'], eyes: ['EYES'], hair: ['HAIR'] });
  mapGroup('combat', { initiative: ['Init'], proficiencyBonus: ['ProfBonus'], abilitySaveDc: ['AbilitySaveDC', 'Ability Save DC'], hitDice: ['Total'], movement: ['Speed'], passivePerception: ['Passive1'], passiveInsight: ['Passive2'], passiveInvestigation: ['Passive3'], weightCarried: ['Weight Carried'], encumbered: ['Encumbered'], pushDragLift: ['PushDragLift'] });
  mapGroup('narrative', { defenses: ['Defenses'], senses: ['AdditionalSenses'], proficiencies: ['ProficienciesLang'], appearance: ['Appearance', 'CHARACTER APPEARANCE'], backstory: ['Backstory'], personality: ['PersonalityTraits'], ideals: ['Ideals'], bonds: ['Bonds'], flaws: ['Flaws'], allies: ['Allies'], additionalNotes: ['AdditionalNotes'] });
  details.narrative.actions = [value('Actions1'), value('Actions2')].filter(Boolean).join('\n\n');
  details.narrative.features = [value('FeaturesTraits1'), value('FeaturesTraits2'), value('FeaturesTraits3')].filter(Boolean).join('\n\n');
  const proficiency = (raw) => /^(E|expertise)$/i.test(raw) ? 'expertise' : /^(P|proficient|yes|on|true|1|•|●)$/i.test(raw) ? 'proficient' : raw && !/^(off|no|false|0)$/i.test(raw) ? 'unknown' : 'none';
  for (const [key, name] of Object.entries(abilities)) {
    const label = name[0].toUpperCase() + name.slice(1);
    const modifier = value(`${key}mod`, key === 'CHA' ? 'CHamod' : `${key}mod`);
    if (modifier) details.abilityModifiers.push({ name: label, modifier });
    const savingModifier = value(`ST ${label}`);
    const markerKey = `${label.slice(0, 3)}Prof`;
    const marker = value(markerKey, `${key}Prof`);
    if (savingModifier || marker) details.savingThrows.push({ name: label, modifier: savingModifier, proficiency: proficiency(marker) });
    if (proficiency(marker) === 'unknown') { consumed.delete(markerKey); consumed.delete(`${key}Prof`); }
  }
  const skillNames = { Acrobatics: 'Acrobatics', Animal: 'Animal handling', Arcana: 'Arcana', Athletics: 'Athletics', Deception: 'Deception', History: 'History', Insight: 'Insight', Intimidation: 'Intimidation', Investigation: 'Investigation', Medicine: 'Medicine', Nature: 'Nature', Perception: 'Perception', Performance: 'Performance', Persuasion: 'Persuasion', Religion: 'Religion', SleightofHand: 'Sleight of hand', Stealth: 'Stealth', Survival: 'Survival' };
  for (const [key, name] of Object.entries(skillNames)) {
    const modifier = value(key), ability = value(`${key}Mod`), marker = value(`${key}Prof`);
    if (modifier || ability || marker) details.skills.push({ name, modifier, ability, proficiency: proficiency(marker) });
    if (proficiency(marker) === 'unknown') consumed.delete(`${key}Prof`);
  }
  const weaponIndices = [...new Set(Object.keys(fields).flatMap((key) => {
    const match = key.match(/^Wpn Name(?: (\d+))?$/);
    return match ? [Number(match[1] ?? 1)] : [];
  }))].sort((a, b) => a - b);
  details.attacks = weaponIndices.map((index) => ({ name: value(index === 1 ? 'Wpn Name' : `Wpn Name ${index}`), attackBonus: value(`Wpn${index} AtkBonus`), damage: value(`Wpn${index} Damage`), notes: value(`Wpn Notes ${index}`) })).filter((attack) => attack.name);
  const spells = indexed('spellName').filter((key) => value(key)).map((key) => {
    const index = key.slice('spellName'.length);
    return { name: value(key), prepared: value(`spellPrepared${index}`), source: value(`spellSource${index}`), saveHit: value(`spellSaveHit${index}`), castingTime: value(`spellCastingTime${index}`), range: value(`spellRange${index}`), components: value(`spellComponents${index}`), duration: value(`spellDuration${index}`), page: value(`spellPage${index}`), notes: value(`spellNotes${index}`) };
  });
  details.spells = spells;
  details.spellcasting = indexed('spellCastingClass').map((key) => {
    const index = key.slice('spellCastingClass'.length);
    return { name: value(key), ability: value(`spellCastingAbility${index}`), saveDc: value(`spellSaveDC${index}`), attackBonus: value(`spellAtkBonus${index}`) };
  }).filter((entry) => Object.values(entry).some(Boolean));
  const groupIndices = [...new Set([...indexed('spellHeader'), ...indexed('spellSlotHeader')].map((key) => key.match(/\d+$/)[0]))].sort((a, b) => Number(a) - Number(b));
  details.spellGroups = groupIndices.map((index) => ({ name: value(`spellHeader${index}`), slots: value(`spellSlotHeader${index}`) }));
  // Repeated identity fields and campaign-only health are not extra references.
  ['CharacterName', 'CLASS LEVEL', 'CLASS  LEVEL', 'PLAYER NAME', 'RACE', 'BACKGROUND', 'EXPERIENCE POINTS'].forEach((prefix) => indexed(prefix).filter((key) => fields[key]?.trim() === fields[prefix]?.trim()).forEach((key) => consumed.add(key)));
  details.additionalFields = Object.entries(fields).filter(([key, raw]) => raw.trim() && !consumed.has(key) && !/^(CurrentHP|HPCurrent|HP|TempHP|TemporaryHP)$/i.test(key)).map(([name, raw]) => ({ name, value: raw.trim() }));
  sheet.details = details;
  if (Object.values(details.narrative).some((entry) => entry.length > 10000) || details.additionalFields.some((entry) => entry.value.length > 10000) || new TextEncoder().encode(JSON.stringify(sheet)).length > 200000) throw new Error('This sheet has more reference text than the current character form can hold. No data has been saved.');
  const allText = Object.values(fields).join(' ');
  return { name: value('CharacterName', 'CharacterName2', 'CharacterName4'), sheet, missing, spellCount: spells.length, suggestedEdition: /PHB-2024/.test(allText) ? 'dnd-5e-2024' : null };
}

export async function importCharacterPdf(file) {
  if (!file || !/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF character sheet.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF smaller than 10 MB.');
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } = await import('pdf-lib');
  let document;
  try { document = await PDFDocument.load(await file.arrayBuffer()); }
  catch { throw new Error('This PDF could not be read. Choose an unencrypted character-sheet PDF.'); }
  let fields;
  try {
    fields = {};
    for (const field of document.getForm().getFields()) {
      if (field instanceof PDFTextField) fields[field.getName()] = field.getText() ?? '';
      else if (field instanceof PDFCheckBox) fields[field.getName()] = field.acroField.getValue().decodeText();
      else if (field instanceof PDFDropdown || field instanceof PDFOptionList) fields[field.getName()] = field.getSelected().join(', ');
      else if (field instanceof PDFRadioGroup) fields[field.getName()] = field.getSelected() ?? '';
    }
  }
  catch { throw new Error('This PDF’s form fields could not be read. Try exporting the sheet again.'); }
  {
    const { getDocument, GlobalWorkerOptions } = typeof window === 'undefined' ? await import('pdfjs-dist/legacy/build/pdf.mjs') : await import('pdfjs-dist/build/pdf.mjs');
    if (typeof window !== 'undefined') {
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, isEvalSupported: false });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 20) throw new Error('Choose a character sheet with no more than 20 pages.');
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        for (const field of await page.getAnnotations()) {
          if (field.fieldName && ['Tx', 'Btn', 'Ch'].includes(field.fieldType) && !field.pushButton && field.fieldValue != null) {
            const key = field.fieldName.trim();
            const raw = Array.isArray(field.fieldValue) ? field.fieldValue.join(', ') : String(field.fieldValue);
            if (!fields[key]?.trim()) fields[key] = raw;
          }
        }
      }
    } catch (error) {
      if (error.message.includes('20 pages')) throw error;
      throw new Error('This PDF’s character fields could not be read. Try exporting the sheet again.');
    } finally { await task.destroy(); }
  }
  if (!Object.keys(fields).length) throw new Error('No editable fields found. Scanned and flattened PDFs are not supported yet. Choose a form-fillable D&D Beyond export.');
  return mapCharacterFields(fields);
}
import { emptyDetails } from './characterDetails.js';
