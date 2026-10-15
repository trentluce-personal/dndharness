import { useLayoutEffect, useRef, useState } from 'react';
import { draftSignature } from './workspaceRoutes.js';
import Button from './Button.jsx';
import { emptyInventory, EquipmentEditor } from './Equipment.jsx';
import { CharacterDetailsEditor } from './CharacterDetails.jsx';
import DeleteCharacter from './DeleteCharacter.jsx';

export const emptySheet = () => ({ version: 3, ancestry: '', class: '', level: 1, maxHp: 10, ac: 10, speed: 30, background: '', equipment: '', inventory: emptyInventory(), notes: '', abilities: Object.fromEntries(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((key) => [key, 10])) });

export default function CharacterForm({ character, draft, editions, editionId, onSave, onCancel, onDelete, onBusyChange, onDirtyChange, externalBusy = false, page = false, campaign = false, exitLabel }) {
  const [discard, setDiscard] = useState(false);
  const [name, setName] = useState(character?.name ?? draft?.name ?? '');
  const [edition, setEdition] = useState(character?.editionId ?? (editions.some((entry) => entry.id === draft?.suggestedEdition) ? draft.suggestedEdition : editionId));
  const [sheet, setSheet] = useState(() => structuredClone(character?.sheet ?? draft?.sheet ?? emptySheet()));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const baseline = useRef(draftSignature({ name, editionId: edition, sheet }, campaign));
  const signature = draftSignature({ name, editionId: edition, sheet }, campaign);
  useLayoutEffect(() => { onDirtyChange?.(signature !== baseline.current); }, [signature]);
  const change = (key, value) => setSheet((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); if (busy || externalBusy) return; setBusy(true); setError('');
    onBusyChange?.(true);
    const { hp, ...personalSheet } = sheet;
    try { const saved = await onSave({ name, editionId: edition, sheet: { ...(campaign ? sheet : personalSheet), version: 3 } }); if (page && saved) { baseline.current = draftSignature(saved, campaign); setName(saved.name); setSheet(structuredClone(saved.sheet)); onDirtyChange?.(false); } } catch (error) { setError(error.message); } finally { setBusy(false); onBusyChange?.(false); }
  }
  return <form onSubmit={submit} className={`editor-form character-form${draft ? ' imported-character-form' : ''}`} onInvalidCapture={(event) => {
    let parent = event.target.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }}>
    <fieldset disabled={busy || externalBusy} className={`character-fields ${draft ? 'import-form-content' : 'character-form-content'}`}>
    {draft && <section className="character-reveal" aria-label="Imported character">
      <span className="reveal-seal" aria-hidden="true">✦</span>
      <div><p className="eyebrow">Your character, found</p><h3>{name || 'Your new character'}</h3><p>{[sheet.level !== '' ? `Level ${sheet.level}${sheet.class ? ` ${sheet.class}` : ''}` : sheet.class, sheet.ancestry, sheet.background].filter(Boolean).join(' · ')}</p>
      <div className="reveal-counts"><span>{sheet.inventory?.items.length ?? 0} equipment {sheet.inventory?.items.length === 1 ? 'entry' : 'entries'}</span><span>{draft.spellCount ?? 0} {draft.spellCount === 1 ? 'spell' : 'spells'} found</span></div></div>
    </section>}
    {!draft && <p className="form-note">{campaign ? 'Campaign copy · Personal sheet unchanged' : 'Your personal sheet · Enter values from your game sheet. Rules are not calculated automatically.'}</p>}
    {draft && <p className="form-note">Review your rules edition and details below. Skills, attacks, spells, and features have separate editable reference sections.</p>}
    <div className="form-grid"><label>Character name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      {!campaign && <label>Rules edition<select disabled={!!character} value={edition} aria-describedby="character-edition-hint" onChange={(event) => setEdition(event.target.value)}>{editions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.isDefault ? ' (Default)' : ''}</option>)}</select><span className="field-hint" id="character-edition-hint">{character ? 'Fixed when this character was created.' : 'Ask your DM which version to use. It must match the campaign and cannot be changed later.'}</span></label>}
      {[['ancestry', 'Ancestry', 'e.g. Human or Elf'], ['class', 'Class', 'e.g. Fighter or Wizard'], ['background', 'Background', 'e.g. Soldier or Scholar']].map(([key, label, placeholder]) => <label key={key}>{label} (optional)<input placeholder={placeholder} maxLength={120} value={sheet[key]} onChange={(event) => change(key, event.target.value)} /></label>)}
      {[['level', 'Level', 1, 100], ...(campaign ? [['hp', 'Current health (HP)', 0, 100000]] : []), ['maxHp', 'Maximum health (HP)', 1, 100000], ['ac', 'Armor class (AC)', 0, 1000], ['speed', 'Movement speed', 0, 10000]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" required min={min} max={max} value={sheet[key]} onChange={(event) => change(key, event.target.value === '' ? '' : Number(event.target.value))} /></label>)}
    </div>
    <fieldset><legend>Ability scores</legend><p className="form-note">Your character’s physical and mental abilities. Copy these from your sheet or ask your DM.</p><div className="ability-grid">{['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((key) => <label key={key}>{key}<input type="number" min="1" max="100" required value={sheet.abilities?.[key] ?? ''} onChange={(event) => setSheet((current) => ({ ...current, abilities: { ...current.abilities, [key]: event.target.value === '' ? '' : Number(event.target.value) } }))} /></label>)}</div></fieldset>
    <EquipmentEditor inventory={sheet.inventory ?? emptyInventory()} legacy={sheet.equipment} onChange={(inventory) => setSheet((current) => ({ ...current, version: 3, inventory }))} onLegacyChange={(equipment) => change('equipment', equipment)} />
    <CharacterDetailsEditor details={sheet.details} onChange={(details) => setSheet((current) => ({ ...current, version: 3, details }))} />
    <label>Notes (optional)<textarea maxLength={10000} rows="3" value={sheet.notes} onChange={(event) => change('notes', event.target.value)} /></label>
    {character && !campaign && onDelete && <DeleteCharacter name={character.name} disabled={busy || externalBusy} onDelete={onDelete} />}
    </fieldset>
    <div className={draft ? 'import-form-footer' : ''}>
      {error && <p role="alert" className="form-error">{error}</p>}
      {discard ? <div className="form-actions"><span className="draft-status">Discard this unsaved character?</span><Button className="secondary" onClick={() => setDiscard(false)}>Keep editing</Button><Button onClick={onCancel}>Discard draft</Button></div> : <div className="form-actions">{draft && <span className="draft-status">Not saved yet</span>}{page && <span className="draft-status">{signature !== baseline.current ? 'Unsaved changes' : 'All changes saved'}</span>}<Button className="secondary" disabled={busy || externalBusy} onClick={() => draft ? setDiscard(true) : onCancel()}>{exitLabel ?? (page ? 'Back to characters' : 'Cancel')}</Button><Button type="submit" disabled={busy || externalBusy}>{busy ? 'Saving…' : draft ? 'Add character' : campaign ? 'Save campaign sheet' : 'Save character'}</Button></div>}
    </div>
  </form>;
}
