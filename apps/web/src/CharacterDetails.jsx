import { useRef, useState } from 'react';
import Button from './Button.jsx';
import { createUiId } from './uiId.js';
import { combatFields, emptyDetails, identityFields, narrativeFields, rowSections } from './characterDetails.js';

function ReferenceRows({ section, rows, onChange }) {
  const ids = useRef(rows.map(() => createUiId()));
  const [removed, setRemoved] = useState(null);
  const container = useRef(null);
  const update = (index, key, value) => onChange(rows.map((row, position) => position === index ? { ...row, [key]: value } : row));
  return <details className="character-detail-section" ref={container}>
    <summary>{section.title} <span className="detail-count">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span></summary>
    <div className="character-detail-content">
      {rows.length === 0 && <p className="form-note">No entries recorded.</p>}
      {rows.map((row, index) => <details className="reference-row" key={ids.current[index]} ref={(node) => { if (node && !row.name) node.open = true; }}>
        <summary>{row.name || 'New entry'}{row.modifier ? ` · ${row.modifier}` : ''}{row.proficiency && row.proficiency !== 'none' ? ` · ${row.proficiency}` : ''}</summary>
        <div className="reference-row-fields form-grid">
          {section.fields.map(([key, label]) => <label key={key}>{label}{key === 'name' && section.key !== 'spellGroups' ? '' : ' (optional)'}{key === 'notes' || key === 'value' ? <textarea rows="3" maxLength={key === 'value' ? 10000 : 2000} value={row[key] ?? ''} onChange={(event) => update(index, key, event.target.value)} /> : <input required={key === 'name' && section.key !== 'spellGroups'} maxLength="200" value={row[key] ?? ''} onChange={(event) => update(index, key, event.target.value)} />}</label>)}
          {section.proficiency && <label>Proficiency<select value={row.proficiency ?? 'none'} onChange={(event) => update(index, 'proficiency', event.target.value)}><option value="none">Not proficient</option><option value="proficient">Proficient</option><option value="expertise">Expertise</option><option value="unknown">Unknown marker — review PDF fields</option></select></label>}
        </div>
        <Button className="secondary small" aria-label={`Remove ${section.title.toLowerCase()} entry ${index + 1}: ${row.name || 'unnamed'}`} onClick={() => {
          const [id] = ids.current.splice(index, 1);
          setRemoved({ row, index, id });
          onChange(rows.filter((_, position) => position !== index));
          requestAnimationFrame(() => container.current?.querySelector('.reference-undo button')?.focus());
        }}>Remove entry</Button>
      </details>)}
      {removed && <div className="reference-undo inventory-undo"><p role="status">{removed.row.name || 'Entry'} removed.</p><Button className="text-button small" disabled={rows.length >= section.limit} onClick={() => {
        const restored = [...rows];
        const index = Math.min(removed.index, rows.length);
        restored.splice(index, 0, removed.row);
        ids.current.splice(index, 0, removed.id);
        onChange(restored);
        setRemoved(null);
        requestAnimationFrame(() => container.current?.querySelectorAll('.reference-row > summary')[index]?.focus());
      }}>Undo</Button></div>}
      <Button className="secondary small" disabled={rows.length >= section.limit} onClick={() => {
        ids.current.push(createUiId());
        onChange([...rows, { ...Object.fromEntries(section.fields.map(([key]) => [key, ''])), ...(section.proficiency ? { proficiency: 'none' } : {}) }]);
        requestAnimationFrame(() => container.current?.querySelector('.reference-row:last-of-type input')?.focus());
      }}>Add entry</Button>
    </div>
  </details>;
}

export function CharacterDetailsEditor({ details, onChange }) {
  const data = { ...emptyDetails(), ...details };
  const group = (key, title, fields, multiline = false) => <details className="character-detail-section">
    <summary>{title}</summary>
    <div className={`character-detail-content${multiline ? '' : ' form-grid'}`}>
      {fields.map(([field, label]) => <label key={field}>{label} (optional){multiline ? <textarea rows="3" maxLength="10000" value={data[key]?.[field] ?? ''} onChange={(event) => onChange({ ...data, [key]: { ...data[key], [field]: event.target.value } })} /> : <input maxLength="200" value={data[key]?.[field] ?? ''} onChange={(event) => onChange({ ...data, [key]: { ...data[key], [field]: event.target.value } })} />}</label>)}
    </div>
  </details>;
  return <section className="character-details-editor" aria-label="Character details">
    <h3>Character details & references</h3>
    <p className="form-note">Listed values are editable references, not automatically calculated rules. Spell preparation markers are kept as printed; “O” alone does not tell us whether a spell is prepared. Saved campaign details are shared with everyone using this app.</p>
    {group('identity', 'Identity & description', identityFields)}
    {group('combat', 'Combat & movement reference', combatFields)}
    {rowSections.filter(({ key }) => key !== 'additionalFields').map((section) => <ReferenceRows key={section.key} section={section} rows={data[section.key]} onChange={(rows) => onChange({ ...data, [section.key]: rows })} />)}
    {group('narrative', 'Features, actions & story', narrativeFields, true)}
    <p className="form-note">Other PDF fields retain filled values we could not map. Review these before saving.</p>
    <ReferenceRows section={rowSections.find(({ key }) => key === 'additionalFields')} rows={data.additionalFields} onChange={(rows) => onChange({ ...data, additionalFields: rows })} />
  </section>;
}

export function CharacterDetailsRead({ details }) {
  if (!details) return null;
  return <section className="character-details-read" aria-label="Character details">
    {[[identityFields, details.identity, 'Identity & description'], [combatFields, details.combat, 'Combat & movement reference'], [narrativeFields, details.narrative, 'Features, actions & story']].map(([fields, values, title]) => fields.some(([key]) => values?.[key]) && <details className="character-detail-section" key={title}><summary>{title}</summary><dl className="reference-read">{fields.filter(([key]) => values?.[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="preserve-lines">{values[key]}</dd></div>)}</dl></details>)}
    {rowSections.map((section) => details[section.key]?.length > 0 && <details className="character-detail-section" key={section.key}><summary>{section.title} <span className="detail-count">{details[section.key].length}</span></summary>{details[section.key].map((row, index) => <dl className="reference-read" key={index}>{section.fields.filter(([key]) => row[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="preserve-lines">{row[key]}</dd></div>)}{section.proficiency && <div><dt>Proficiency</dt><dd>{row.proficiency === 'none' ? 'Not proficient' : row.proficiency}</dd></div>}</dl>)}</details>)}
  </section>;
}
