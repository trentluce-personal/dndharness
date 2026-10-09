import { useState } from 'react';
import Button from './Button.jsx';

export const emptySheet = () => ({ version: 1, ancestry: '', class: '', level: 1, hp: 10, maxHp: 10, ac: 10, speed: 30, background: '', equipment: '', notes: '', abilities: Object.fromEntries(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((key) => [key, 10])) });

export default function CharacterForm({ character, editions, editionId, onSave, onCancel, campaign = false }) {
  const [name, setName] = useState(character?.name ?? '');
  const [edition, setEdition] = useState(character?.editionId ?? editionId);
  const [sheet, setSheet] = useState(() => structuredClone(character?.sheet ?? emptySheet()));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const change = (key, value) => setSheet((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ name, editionId: edition, sheet }); } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="editor-form">
    <p className="form-note">A core editable sheet. Fields and edition-specific rules will evolve later.</p>
    <div className="form-grid"><label>Character name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      {!campaign && <label>Edition<select disabled={!!character} value={edition} onChange={(event) => setEdition(event.target.value)}>{editions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.isDefault ? ' (Default)' : ''}</option>)}</select></label>}
      {['ancestry', 'class', 'background'].map((key) => <label key={key}>{key}<input maxLength={120} value={sheet[key]} onChange={(event) => change(key, event.target.value)} /></label>)}
      {[['level', 'Level', 1, 100], ['hp', 'Current HP', 0, 100000], ['maxHp', 'Maximum HP', 1, 100000], ['ac', 'Armor class', 0, 1000], ['speed', 'Speed', 0, 10000]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" required min={min} max={max} value={sheet[key]} onChange={(event) => change(key, Number(event.target.value))} /></label>)}
    </div>
    <fieldset><legend>Ability scores</legend><div className="ability-grid">{['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map((key) => <label key={key}>{key.slice(0, 3)}<input aria-label={key} type="number" min="1" max="100" required value={sheet.abilities[key]} onChange={(event) => setSheet((current) => ({ ...current, abilities: { ...current.abilities, [key]: Number(event.target.value) } }))} /></label>)}</div></fieldset>
    {['equipment', 'notes'].map((key) => <label key={key}>{key}<textarea maxLength={10000} rows="3" value={sheet[key]} onChange={(event) => change(key, event.target.value)} /></label>)}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="form-actions"><Button className="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : campaign ? 'Save campaign sheet' : 'Save character'}</Button></div>
  </form>;
}
