import { fail, text } from './validation.js';

const groups = {
  identity: ['playerName', 'experience', 'gender', 'age', 'size', 'height', 'weight', 'alignment', 'faith', 'skin', 'eyes', 'hair'],
  combat: ['initiative', 'proficiencyBonus', 'abilitySaveDc', 'hitDice', 'movement', 'passivePerception', 'passiveInsight', 'passiveInvestigation', 'weightCarried', 'encumbered', 'pushDragLift'],
  narrative: ['defenses', 'senses', 'proficiencies', 'actions', 'features', 'appearance', 'backstory', 'personality', 'ideals', 'bonds', 'flaws', 'allies', 'additionalNotes'],
};
const rows = {
  savingThrows: [6, ['name', 'modifier', 'proficiency']],
  skills: [30, ['name', 'ability', 'modifier', 'proficiency']],
  attacks: [50, ['name', 'attackBonus', 'damage', 'notes']],
  spellcasting: [20, ['name', 'ability', 'saveDc', 'attackBonus']],
  spellGroups: [20, ['name', 'slots']],
  spells: [200, ['name', 'prepared', 'source', 'saveHit', 'castingTime', 'range', 'components', 'duration', 'page', 'notes']],
  abilityModifiers: [6, ['name', 'modifier']],
  additionalFields: [500, ['name', 'value']],
};
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
}

export function characterDetails(value) {
  object(value, 'Character details');
  const result = {};
  for (const [group, keys] of Object.entries(groups)) {
    const source = value[group] === undefined ? {} : value[group];
    object(source, group);
    result[group] = Object.fromEntries(keys.map((key) => [key, text(source[key] === undefined ? '' : source[key], key, group === 'narrative' ? 10000 : 200)]));
  }
  for (const [section, [limit, keys]] of Object.entries(rows)) {
    const source = value[section] === undefined ? [] : value[section];
    if (!Array.isArray(source) || source.length > limit) fail(`${section} must contain no more than ${limit} entries.`);
    result[section] = source.map((row) => {
      object(row, section);
      return Object.fromEntries(keys.map((key) => {
        if (key === 'proficiency') {
          const proficiency = row[key] === undefined ? 'none' : row[key];
          if (!['none', 'proficient', 'expertise', 'unknown'].includes(proficiency)) fail('Choose a valid proficiency.');
          return [key, proficiency];
        }
        return [key, text(row[key] === undefined ? '' : row[key], `${section} ${key}`, key === 'value' ? 10000 : key === 'notes' ? 2000 : 200, key === 'name' && section !== 'spellGroups')];
      }));
    });
  }
  return result;
}
