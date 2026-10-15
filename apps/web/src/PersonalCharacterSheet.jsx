import { useId, useRef, useState } from 'react';
import Button from './Button.jsx';
import { EquipmentRead } from './Equipment.jsx';
import { combatFields, identityFields, narrativeFields, rowSections } from './characterDetails.js';
import { abilityReferences, hasListedValue, listedValue, proficiencyReference } from './personalCharacterSheet.js';

const tabs = ['Actions', 'Spells', 'Inventory', 'Features', 'Background', 'Notes'];

function medallionClass(value) {
  const text = String(value);
  const numeric = /^[+-]?\d+$/.test(text);
  return `personal-sheet-medallion${!hasListedValue(value) ? ' personal-sheet-medallion-missing' : numeric && text.length <= 7 ? ` personal-sheet-medallion-length-${text.length}` : numeric ? ' personal-sheet-medallion-long-number' : ' personal-sheet-medallion-reference'}`;
}

function Fields({ title, fields, values }) {
  const recorded = fields.filter(([key]) => hasListedValue(values?.[key]));
  return <section className="personal-sheet-reference"><h3>{title}</h3>{recorded.length ? <dl>{recorded.map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="preserve-lines">{String(values[key])}</dd></div>)}</dl> : <p className="personal-sheet-empty">No {title.toLowerCase()} recorded.</p>}</section>;
}

function Rows({ sectionKey, details }) {
  const section = rowSections.find(({ key }) => key === sectionKey);
  const rows = details?.[sectionKey] ?? [];
  return <section className="personal-sheet-reference"><h3>{section.title}</h3>{rows.length ? rows.map((row, index) => <article className="personal-sheet-entry" key={index}>
    <h4>{listedValue(row.name)}</h4><dl>{section.fields.filter(([key]) => key !== 'name' && hasListedValue(row[key])).map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="preserve-lines">{String(row[key])}</dd></div>)}</dl>
  </article>) : <p className="personal-sheet-empty">No {section.title.toLowerCase()} recorded.</p>}</section>;
}

function Checks({ title, rows = [], skills = false }) {
  return <section className="personal-sheet-panel personal-sheet-checks"><h2>{title}</h2>{rows.length ? <ul>{rows.map((row, index) => {
    const [marker, label] = proficiencyReference(row.proficiency);
    return <li key={index}><span className="personal-sheet-proficiency" aria-hidden="true">{marker}</span><div><strong>{listedValue(row.name)}</strong>{skills && <span className="personal-sheet-check-ability">{hasListedValue(row.ability) ? ` · ${row.ability}` : ' · Ability not recorded'}</span>}<small>{label}</small></div><span className="personal-sheet-check-modifier" aria-label={`Listed modifier: ${listedValue(row.modifier)}`}>{hasListedValue(row.modifier) ? String(row.modifier) : '—'}</span></li>;
  })}</ul> : <p className="personal-sheet-empty">No {title.toLowerCase()} recorded. Add listed references in Edit character.</p>}</section>;
}

function TabContent({ tab, sheet }) {
  const details = sheet.details;
  const narrative = (keys) => narrativeFields.filter(([key]) => keys.includes(key));
  const combat = (keys) => combatFields.filter(([key]) => keys.includes(key));
  if (tab === 'Actions') return <><Rows sectionKey="attacks" details={details} /><Fields title="Actions" fields={narrative(['actions'])} values={details?.narrative} /><Fields title="Combat & movement reference" fields={combat(['abilitySaveDc', 'hitDice', 'movement'])} values={details?.combat} /></>;
  if (tab === 'Spells') return <><p className="personal-sheet-note">Markers and slot headings are shown as printed. “O” is not interpreted as prepared or unprepared; slots are references, not tracked resources.</p>{['spellcasting', 'spellGroups', 'spells'].map((key) => <Rows key={key} sectionKey={key} details={details} />)}</>;
  if (tab === 'Inventory') return <><p className="personal-sheet-note">Quantities and weights are listed values; no totals or weight units are inferred.</p>{!sheet.inventory?.items?.length && <p className="personal-sheet-empty">No structured equipment recorded.</p>}<EquipmentRead sheet={sheet} />{!sheet.equipment && <p className="personal-sheet-empty">No equipment notes recorded.</p>}<Fields title="Carrying reference" fields={combat(['weightCarried', 'encumbered', 'pushDragLift'])} values={details?.combat} /></>;
  if (tab === 'Features') return <Fields title="Features & proficiencies" fields={narrative(['features', 'defenses', 'proficiencies'])} values={details?.narrative} />;
  if (tab === 'Background') return <><Fields title="Background" fields={[[ 'background', 'Background' ]]} values={sheet} /><Fields title="Identity & description" fields={identityFields} values={details?.identity} /><Fields title="Story & personality" fields={narrative(['appearance', 'backstory', 'personality', 'ideals', 'bonds', 'flaws', 'allies'])} values={details?.narrative} /></>;
  return <><Fields title="Notes" fields={[[ 'notes', 'Personal sheet notes' ]]} values={sheet} /><Fields title="Additional notes" fields={narrative(['additionalNotes'])} values={details?.narrative} /><Rows sectionKey="abilityModifiers" details={details} /><p className="personal-sheet-note">All saved modifier labels are retained here, including labels that do not match an ability plaque.</p><Rows sectionKey="additionalFields" details={details} /></>;
}

export default function PersonalCharacterSheet({ character, editions, onEdit, editRef }) {
  const sheet = character.sheet;
  const [tab, setTab] = useState('Actions');
  const [focusedTab, setFocusedTab] = useState('Actions');
  const tabRefs = useRef([]);
  const id = useId();
  const stats = [['Maximum health (HP)', sheet.maxHp], ['Armor class (AC)', sheet.ac], ['Movement speed', sheet.speed], ...combatFields.filter(([key]) => ['proficiencyBonus', 'initiative'].includes(key) && hasListedValue(sheet.details?.combat?.[key])).map(([key, label]) => [label, sheet.details.combat[key]])];
  return <div className="personal-sheet">
    <header className="personal-sheet-identity"><span className="personal-sheet-seal" aria-hidden="true">✦</span><div><p className="eyebrow">Personal character sheet</p><h1>{character.name}</h1><p>{editions.find((entry) => entry.id === character.editionId)?.name ?? character.editionId} · Level {listedValue(sheet.level)} · {sheet.class || 'Class not recorded'} · {sheet.ancestry || 'Ancestry not recorded'}</p></div><Button ref={editRef} className="secondary" onClick={onEdit}>Edit character</Button></header>
    <p className="personal-sheet-note personal-sheet-scope">Personal library copy · Listed values, no calculated rules. Campaign sheets and checkpoints are separate; current health belongs to campaigns.</p>
    <section className="personal-sheet-abilities" aria-label="Ability scores and listed modifiers">{abilityReferences(sheet).map(({ name, score, modifiers }) => <div className="personal-sheet-plaque" key={name}><h2>{name}</h2><div className="personal-sheet-modifier"><span className="personal-sheet-stat-label">Listed modifier</span><strong className={medallionClass(modifiers.length ? modifiers.map(listedValue).join(' / ') : undefined)}><span className="personal-sheet-medallion-value">{modifiers.length ? modifiers.map(listedValue).join(' / ') : '—'}</span></strong>{!modifiers.length && <span className="personal-sheet-missing">Not recorded</span>}</div><div className="personal-sheet-score"><span>Score</span><strong className={medallionClass(score)}><span className="personal-sheet-medallion-value">{hasListedValue(score) ? String(score) : '—'}</span></strong>{!hasListedValue(score) && <span>Not recorded</span>}</div></div>)}</section>
    <dl className="personal-sheet-stats">{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={medallionClass(value)}><span className="personal-sheet-medallion-value">{listedValue(value)}</span></dd></div>)}</dl>
    <div className="personal-sheet-columns"><div className="personal-sheet-left"><Checks title="Saving throws" rows={sheet.details?.savingThrows} /><section className="personal-sheet-panel personal-sheet-senses"><h2>Senses</h2><Fields title="Passive senses" fields={combatFields.filter(([key]) => ['passivePerception', 'passiveInsight', 'passiveInvestigation'].includes(key))} values={sheet.details?.combat} /><Fields title="Additional senses" fields={narrativeFields.filter(([key]) => key === 'senses')} values={sheet.details?.narrative} /></section></div><Checks title="Skills" rows={sheet.details?.skills} skills />
      <section className="personal-sheet-panel personal-sheet-tabs-panel" aria-label="Character references"><div className="personal-sheet-tabs" role="tablist" aria-label="Character sheet sections">{tabs.map((name, index) => <button type="button" key={name} ref={(node) => { tabRefs.current[index] = node; }} role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={tab === name} tabIndex={focusedTab === name ? 0 : -1} onFocus={() => setFocusedTab(name)} onClick={() => setTab(name)} onKeyDown={(event) => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); setFocusedTab(tabs[next]); tabRefs.current[next]?.focus(); }
      }}>{name}</button>)}</div>{tabs.map((name, index) => <div key={name} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} tabIndex={0} hidden={tab !== name} className="personal-sheet-tab-content"><TabContent tab={name} sheet={sheet} /></div>)}</section>
    </div>
  </div>;
}
