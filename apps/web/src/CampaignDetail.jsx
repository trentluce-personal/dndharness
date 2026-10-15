import { useEffect, useState } from 'react';
import { api } from './api.js';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import CharacterForm from './CharacterForm.jsx';
import { EquipmentRead } from './Equipment.jsx';
import { CharacterDetailsRead } from './CharacterDetails.jsx';

export default function CampaignDetail({ initial, user, characters, editions, onBack, onUpdate }) {
  const [campaign, setCampaign] = useState(initial); const [saves, setSaves] = useState([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); const [preview, setPreview] = useState(null); const [restore, setRestore] = useState(null);
  const [title, setTitle] = useState(initial.title); const [state, setState] = useState(initial.state); const [label, setLabel] = useState(''); const [attach, setAttach] = useState('');
  const isDm = campaign.dm.id === user.id;
  const edition = editions.find((entry) => entry.id === campaign.editionId);
  const available = characters.filter((character) => character.editionId === campaign.editionId && !campaign.party.some((member) => member.characterId === character.id));
  useEffect(() => { api(`/campaigns/${campaign.id}/saves`).then(setSaves).catch((error) => setError(error.message)); }, [campaign.id]);
  function update(next) { setCampaign(next); setTitle(next.title); setState(next.state); onUpdate(next); }
  async function action(work, success) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); setMessage(success); } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  const saveState = () => api(`/campaigns/${campaign.id}`, 'PATCH', { title, state, status: campaign.status });
  return <section className="campaign-detail">
    <Button className="text-button secondary" onClick={onBack}>← Campaign overview</Button>
    <div className="dashboard-intro"><p className="eyebrow">{edition?.name} · {campaign.status}</p><h1>Existing play progress</h1><p>{campaign.title} · Existing shared journal, party records, and saved checkpoints.</p><p>Dungeon master (DM): {campaign.dm.displayName} <span className="quiet-badge">{isDm ? 'You are the DM' : 'You are a player · Read-only'}</span></p></div>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="success-message">{message}</p>}
    <div className="campaign-layout"><div>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">The present chapter</p><h2>Campaign journal</h2></div><span className="quiet-badge">Session {campaign.state.session}</span></div>
        <p className="form-note">Shared with everyone in this campaign.</p>
        {isDm ? <form className="editor-form" onSubmit={(event) => { event.preventDefault(); action(async () => update(await saveState()), 'Journal updated.'); }}>
          <label>Campaign title<input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="form-grid"><label>Session number<input required type="number" min="1" max="100000" value={state.session} onChange={(event) => setState({ ...state, session: Number(event.target.value) })} /></label><label>Location<input maxLength={200} value={state.location} onChange={(event) => setState({ ...state, location: event.target.value })} /></label></div>
          <label>Story so far<textarea rows="3" maxLength={2000} value={state.summary} onChange={(event) => setState({ ...state, summary: event.target.value })} /></label><label>Campaign notes <span className="field-hint">Visible to the party</span><textarea rows="5" maxLength={20000} value={state.notes} onChange={(event) => setState({ ...state, notes: event.target.value })} /></label>
          <div className="form-actions"><Button className="secondary" disabled={busy} onClick={() => action(async () => update(await api(`/campaigns/${campaign.id}`, 'PATCH', { title, state, status: campaign.status === 'active' ? 'archived' : 'active' })), 'Campaign status updated.')}>{campaign.status === 'active' ? 'Archive campaign' : 'Reactivate campaign'}</Button><Button type="submit" disabled={busy}>Update journal</Button></div>
        </form> : <div className="journal-read"><h3>{campaign.state.location || 'An unwritten destination'}</h3><p>{campaign.state.summary || 'The story is just beginning.'}</p><hr /><p>{campaign.state.notes || 'No notes yet.'}</p></div>}
      </section>
      <section className="workspace-panel"><div className="section-heading"><div><p className="eyebrow">Companions on the road</p><h2>The party</h2></div><span className="quiet-badge">{campaign.party.length} {campaign.party.length === 1 ? 'character' : 'characters'}</span></div>
        <p className="form-note">Characters in this adventure · Campaign copies, separate from personal sheets.</p>
        {campaign.party.length === 0 && <p className="empty-note">{isDm ? 'No characters have joined yet. Share the invite code below so players can join with their characters.' : 'No characters in the party yet.'}</p>}
        <div className="party-list">{campaign.party.map((member) => <article key={member.characterId} className="party-card"><span className="character-monogram" aria-hidden="true">{member.name.slice(0, 1)}</span><div><h3>{member.name}</h3><p>{member.displayName} · Level {member.sheet.level} {member.sheet.class || 'Adventurer'}</p><div className="stat-strip"><span>HP <strong>{member.sheet.hp}/{member.sheet.maxHp}</strong></span><span>AC <strong>{member.sheet.ac}</strong></span></div></div><div className="party-actions"><Button className="secondary small" onClick={() => setEditing(member)}>{isDm ? 'Edit sheet' : 'View sheet'}</Button>{isDm && <Button className="text-button small" disabled={busy} onClick={() => action(async () => { await api(`/campaigns/${campaign.id}/party/${member.characterId}`, 'DELETE', {}); update(await api(`/campaigns/${campaign.id}`)); }, 'Character removed from this campaign.')}>Remove</Button>}</div></article>)}</div>
        {isDm && campaign.status === 'active' && available.length > 0 && <div className="inline-form"><label>Add your character<select value={attach} onChange={(event) => setAttach(event.target.value)}><option value="">Choose a matching character</option>{available.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label><Button disabled={!attach || busy} onClick={() => action(async () => { update(await api(`/campaigns/${campaign.id}/party`, 'POST', { characterId: attach })); setAttach(''); }, 'Character joined the party.')}>Add to party</Button></div>}
        {isDm && <div className="invite-panel"><div><span className="eyebrow">Invite your party</span><code>{campaign.inviteCode}</code></div><Button className="secondary small" onClick={() => action(async () => { await navigator.clipboard.writeText(campaign.inviteCode); }, 'Invite code copied.')}>Copy code</Button><p>Share this code. Players join with a character using {edition?.shortName}.</p></div>}
      </section>
    </div><aside>
      <section className="workspace-panel saves-panel"><div className="section-heading"><div><p className="eyebrow">Keep a place in the story</p><h2>Saved checkpoints</h2></div></div>
        <p className="form-note">A checkpoint keeps a fixed copy of the journal and party. {isDm ? 'You can restore it later to return the campaign to that moment.' : 'Only the DM can create or restore checkpoints.'}</p>
        {isDm && <form className="editor-form" onSubmit={(event) => { event.preventDefault(); action(async () => { update(await saveState()); const save = await api(`/campaigns/${campaign.id}/saves`, 'POST', { label }); setSaves((current) => [save, ...current]); setLabel(''); }, 'Checkpoint saved. This saved copy will never change.'); }}><label>Checkpoint name<input required maxLength={150} placeholder="Before entering the ruins…" value={label} onChange={(event) => setLabel(event.target.value)} /></label><Button type="submit" disabled={busy}>Save checkpoint <span aria-hidden="true">✦</span></Button><p className="form-note">Also saves your current journal edits, DM public identity, party account links, and campaign sheets.</p></form>}
        {saves.length === 0 && <p className="empty-note">{isDm ? 'No checkpoints yet. Enter a name above to save the current campaign.' : 'No checkpoints yet. They’ll appear here when your DM saves one.'}</p>}
        <ol className="save-list">{saves.map((save) => <li key={save.id}><span className="save-dot" aria-hidden="true">✦</span><div><h3>{save.label}</h3><p>{new Date(save.createdAt).toLocaleString()} · Session {save.snapshot.state.session}</p><div className="save-actions"><Button className="text-button small" onClick={() => setPreview(save)}>View checkpoint</Button>{isDm && <Button className="text-button small" onClick={() => setRestore(save)}>Restore</Button>}</div></div></li>)}</ol>
      </section>
    </aside></div>
    {editing && <Dialog title={`${isDm ? 'Edit' : 'View'} · ${editing.name}`} onClose={() => setEditing(null)}>{isDm ? <CharacterForm campaign character={editing} editions={editions} onCancel={() => setEditing(null)} onSave={async (body) => { update(await api(`/campaigns/${campaign.id}/party/${editing.characterId}`, 'PATCH', body)); setEditing(null); }} /> : <SheetRead member={editing} />}</Dialog>}
    {preview && <Dialog title={preview.label} onClose={() => setPreview(null)}><div className="snapshot-read"><p className="form-note">Immutable snapshot · {new Date(preview.createdAt).toLocaleString()}</p><h3>{preview.snapshot.title}</h3><p>DM: {preview.snapshot.dm.displayName} · Session {preview.snapshot.state.session}</p><p>{preview.snapshot.state.location}</p><p>{preview.snapshot.state.summary}</p><p className="preserve-lines">{preview.snapshot.state.notes}</p>{preview.snapshot.party.map((member) => <SheetRead key={member.characterId} member={member} />)}</div></Dialog>}
    {restore && <Dialog title="Restore this checkpoint?" onClose={() => setRestore(null)}><p>Restore <strong>{restore.label}</strong>? This replaces the current campaign title, status, journal, and party with the saved copy. Unsaved changes to the current campaign are replaced; personal sheets and save history remain intact. Restoring the saved party can give previously removed players access again.</p><div className="form-actions"><Button className="secondary" onClick={() => setRestore(null)}>Cancel</Button><Button disabled={busy} onClick={() => action(async () => { update(await api(`/campaigns/${campaign.id}/saves/${restore.id}/restore`, 'POST', {})); setRestore(null); }, 'Campaign restored. History preserved.')}>Restore checkpoint</Button></div></Dialog>}
  </section>;
}
function SheetRead({ member }) {
  return <article className="sheet-read"><h3>{member.name}</h3><p>{member.displayName} · Level {member.sheet.level} {member.sheet.class} · {member.sheet.ancestry}</p><div className="stat-strip"><span>HP <strong>{member.sheet.hp}/{member.sheet.maxHp}</strong></span><span>AC <strong>{member.sheet.ac}</strong></span><span>Speed <strong>{member.sheet.speed}</strong></span></div><div className="stat-strip">{Object.entries(member.sheet.abilities).map(([key, value]) => <span key={key}>{key.slice(0, 3).toUpperCase()} <strong>{value}</strong></span>)}</div><p>Background: {member.sheet.background || '—'}</p><EquipmentRead sheet={member.sheet} /><CharacterDetailsRead details={member.sheet.details} /><p className="preserve-lines">{member.sheet.notes}</p></article>;
}
