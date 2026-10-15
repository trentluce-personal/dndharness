export const sheetAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

export const hasListedValue = (value) => value !== null && value !== undefined && value !== '';
export const listedValue = (value) => hasListedValue(value) ? String(value) : 'Not recorded';

// Match labels only. Scores never supply a calculated modifier or rule default.
export function abilityReferences(sheet) {
  return sheetAbilities.map((name) => ({
    name,
    score: sheet.abilities?.[name],
    modifiers: (sheet.details?.abilityModifiers ?? []).filter((row) => {
      const label = row.name?.trim().toLowerCase();
      return label === name || label === name.slice(0, 3);
    }).map((row) => row.modifier),
  }));
}

export function proficiencyReference(value) {
  return ({ none: ['○', 'Not proficient'], proficient: ['●', 'Proficient'], expertise: ['◆', 'Expertise'], unknown: ['?', 'Unknown marker'] })[value] ?? ['—', 'Not recorded'];
}
