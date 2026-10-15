export const identityFields = [
  ['playerName', 'Player name'], ['experience', 'Experience points'], ['gender', 'Gender'],
  ['age', 'Age'], ['size', 'Size'], ['height', 'Height'], ['weight', 'Weight'],
  ['alignment', 'Alignment'], ['faith', 'Faith'], ['skin', 'Skin'], ['eyes', 'Eyes'], ['hair', 'Hair'],
];
export const combatFields = [
  ['initiative', 'Initiative'], ['proficiencyBonus', 'Proficiency bonus'],
  ['abilitySaveDc', 'Ability save difficulty (DC)'], ['hitDice', 'Hit dice'],
  ['movement', 'Movement description'], ['passivePerception', 'Passive perception'],
  ['passiveInsight', 'Passive insight'], ['passiveInvestigation', 'Passive investigation'],
  ['weightCarried', 'Weight carried'], ['encumbered', 'Encumbered threshold'], ['pushDragLift', 'Push / drag / lift'],
];
export const narrativeFields = [
  ['defenses', 'Defenses'], ['senses', 'Additional senses'], ['proficiencies', 'Proficiencies & languages'],
  ['actions', 'Actions'], ['features', 'Features & traits'], ['appearance', 'Appearance'],
  ['backstory', 'Backstory'], ['personality', 'Personality traits'], ['ideals', 'Ideals'],
  ['bonds', 'Bonds'], ['flaws', 'Flaws'], ['allies', 'Allies & organizations'], ['additionalNotes', 'Additional notes'],
];
export const rowSections = [
  { key: 'savingThrows', title: 'Saving throws', limit: 6, fields: [['name', 'Ability'], ['modifier', 'Listed modifier']], proficiency: true },
  { key: 'skills', title: 'Skills', limit: 30, fields: [['name', 'Skill'], ['ability', 'Ability'], ['modifier', 'Listed modifier']], proficiency: true },
  { key: 'attacks', title: 'Attacks & cantrips', limit: 50, fields: [['name', 'Name'], ['attackBonus', 'Attack bonus'], ['damage', 'Damage / type'], ['notes', 'Notes']] },
  { key: 'spellcasting', title: 'Spellcasting', limit: 20, fields: [['name', 'Class / source'], ['ability', 'Ability'], ['saveDc', 'Spell save difficulty (DC)'], ['attackBonus', 'Spell attack bonus']] },
  { key: 'spellGroups', title: 'Spell levels & slots', limit: 20, fields: [['name', 'Level heading'], ['slots', 'Listed slots']] },
  { key: 'spells', title: 'Spells', limit: 200, fields: [['name', 'Spell name'], ['prepared', 'Preparation marker (as printed)'], ['source', 'Source'], ['saveHit', 'Save / attack'], ['castingTime', 'Casting time'], ['range', 'Range'], ['components', 'Components'], ['duration', 'Duration'], ['page', 'Page reference'], ['notes', 'Notes']] },
  { key: 'abilityModifiers', title: 'Listed ability modifiers', limit: 6, fields: [['name', 'Ability'], ['modifier', 'Listed modifier']] },
  { key: 'additionalFields', title: 'Other PDF fields', limit: 500, fields: [['name', 'PDF field name'], ['value', 'Value']], long: true },
];

export function emptyDetails() {
  return {
    identity: Object.fromEntries(identityFields.map(([key]) => [key, ''])),
    combat: Object.fromEntries(combatFields.map(([key]) => [key, ''])),
    narrative: Object.fromEntries(narrativeFields.map(([key]) => [key, ''])),
    ...Object.fromEntries(rowSections.map(({ key }) => [key, []])),
  };
}
