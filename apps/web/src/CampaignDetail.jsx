import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import CharacterForm from './CharacterForm.jsx';
import CharacterImport from './CharacterImport.jsx';
import PersonalCharacterSheet from './PersonalCharacterSheet.jsx';
import { adventureTitle } from './campaignPlanning.js';
import { SnapshotRead } from './CampaignHistory.jsx';
import { canRefreshDraft, createRefreshQueue, journalSaveBody } from './campaignDrafts.js';
import { createCampaignRefreshPolicy } from './campaignRefresh.js';
import { useCampaignRefresh } from './realtime.js';

export default function CampaignDetail({ initial, editions, navigation, onUpdate }) {
  const [campaign, setCampaign] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [state, setState] = useState(() => structuredClone(initial.state));
  const [revision, setRevision] = useState(initial.revision);
  const [label, setLabel] = useState('');
  const [saves, setSaves] = useState([]);
  const [savesError, setSavesError] = useState('');
  const [savesRetry, setSavesRetry] = useState(0);
  const [savesLoading, setSavesLoading] = useState(true);
  const [savesLoaded, setSavesLoaded] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [message, setMessage] = useState('');
  const [actionScope, setActionScope] = useState('journal');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [modal, setModal] = useState(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [discardEditor, setDiscardEditor] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [changesAvailable, setChangesAvailable] = useState(false);
  const dirty = title !== campaign.title || JSON.stringify(state) !== JSON.stringify(campaign.state) || !!label.trim();
  const protectedDraft = dirty || editorDirty || !!modal?.draft;
  const edition = editions.find((entry) => entry.id === campaign.editionId);
  const refresh = useCampaignRefresh(campaign.id);
  const refreshQueue = useRef(null);
  const refreshPolicy = useRef(null);
  if (!refreshPolicy.current) refreshPolicy.current = createCampaignRefreshPolicy(initial.revision);
  refreshPolicy.current.observe(initial.revision);
  const current = useRef(null);
  current.current = { dirty: protectedDraft, busy: busy || editorBusy || inFlight.current, confirmation: reloadConfirm || discardEditor, editor: modal && modal.type !== 'sheet', campaign, modal };
  useEffect(() => {
    const queue = createRefreshQueue(async (active) => {
      const ticket = refreshPolicy.current.ticket();
      try {
        const next = await api(`/campaigns/${campaign.id}`);
        if (!active()) return;
        setRefreshError('');
        refreshPolicy.current.observe(next.revision);
        if (next.revision < current.current.campaign.revision) return;
        if (!canRefreshDraft(current.current) || inFlight.current) { setChangesAvailable(refreshPolicy.current.changesAvailable); return; }
        if (!refreshPolicy.current.install(next.revision, ticket)) return;
        setCampaign(next); setTitle(next.title); setState(structuredClone(next.state)); setRevision(next.revision); setChangesAvailable(refreshPolicy.current.changesAvailable); onUpdate(next);
        if (current.current.modal?.type === 'sheet') {
          const member = next.party.find((entry) => entry.characterId === current.current.modal.member.characterId);
          setModal(member ? { type: 'sheet', member, revision: next.revision } : null);
        }
      } catch (error) { if (active()) setRefreshError(`Saved campaign could not refresh: ${error.message}`); }
    });
    refreshQueue.current = queue;
    return () => { queue.dispose(); refreshQueue.current = null; };
  }, [campaign.id]);
  useEffect(() => { refreshPolicy.current.invalidate(initial.revision); refreshQueue.current?.request(); }, [refresh, initial.revision]);
  const savesQueue = useRef(null);
  const savesGeneration = useRef(0);
  useEffect(() => {
    const queue = createRefreshQueue(async (active) => {
      const generation = savesGeneration.current;
      setSavesLoading(true);
      try {
        const checkpoints = await api(`/campaigns/${campaign.id}/saves`);
        if (active() && generation !== savesGeneration.current) { queue.request(); return; }
        if (active()) { setSaves(checkpoints); setSavesError(''); setSavesLoaded(true); }
      } catch (error) { if (active()) setSavesError(`Checkpoints could not load: ${error.message}`); }
      finally { if (active()) setSavesLoading(false); }
    });
    savesQueue.current = queue;
    return () => { queue.dispose(); savesQueue.current = null; };
  }, [campaign.id]);
  useEffect(() => { savesQueue.current?.request(); }, [refresh, initial.revision, savesRetry]);
  useEffect(() => { if (refreshPolicy.current.pending && canRefreshDraft(current.current)) refreshQueue.current?.request(); }, [protectedDraft, busy, editorBusy, modal, reloadConfirm, discardEditor]);
  useEffect(() => { navigation.protect({ dirty: protectedDraft, busy: busy || editorBusy }); }, [protectedDraft, busy, editorBusy]);
  useEffect(() => () => navigation.protect({ dirty: false, busy: false }), []);
  function accept(next, resetJournal = true) {
    if (!refreshPolicy.current.install(next.revision)) throw new Error('A newer campaign revision was already loaded. Reload again to review it.');
    setCampaign(next); onUpdate(next); setChangesAvailable(refreshPolicy.current.changesAvailable); setRefreshError('');
    if (resetJournal) { setTitle(next.title); setState(structuredClone(next.state)); setRevision(next.revision); }
  }
  async function action(work, success, scope = 'journal') {
    if (inFlight.current) return;
    inFlight.current = true; savesGeneration.current++; setBusy(true); setError(''); setMessage(''); setActionScope(scope);
    navigation.protect({ dirty: protectedDraft, busy: true });
    try { await work(); setMessage(success); }
    catch (error) { if (error.status === 409) refreshPolicy.current.markConflict(); setError(`${error.message} Your drafts are kept.${error.status === 409 ? ' Reload the saved campaign before retrying.' : ' Try again when ready.'}`); }
    finally { inFlight.current = false; savesGeneration.current++; setBusy(false); refreshPolicy.current.invalidate(); setChangesAvailable(refreshPolicy.current.changesAvailable); refreshQueue.current?.request(); savesQueue.current?.request(); }
  }
  function closeEditor() {
    if (editorBusy) return;
    if (editorDirty || modal?.draft) setDiscardEditor(true);
    else { setModal(null); setEditorDirty(false); }
  }
  // Party mutations cannot silently rebase a journal draft. Require it to be
  // saved/discarded first; each editor/confirmation captures its own revision.
  const journalBody = journalSaveBody({ title, state, status: campaign.status, revision });
  const feedback = (scope) => actionScope === scope && <div className="journal-save-feedback">{error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="success-message">{message}</p>}</div>;
  return <section className="campaign-detail">
    <div className="dashboard-intro"><p className="eyebrow">{edition?.name} · {campaign.status}</p><h1>Party &amp; journal</h1><p>{adventureTitle(campaign)} · Shared characters, journal, and checkpoints. Anyone can edit and save.</p></div>
    {refreshError && <div><p role="alert" className="form-error">{refreshError}</p><Button className="secondary" onClick={() => refreshQueue.current?.request()}>Retry campaign refresh</Button></div>}
    {changesAvailable && <p className="saved-changes-note" role="status">Saved changes available. Your draft and captured revisions are kept. <Button className="text-button" disabled={busy || editorBusy} onClick={() => setReloadConfirm(true)}>Reload saved campaign…</Button></p>}
    <div className="campaign-layout"><div>
      <section className="workspace-panel"><h2>Campaign journal</h2><p className="form-note">Shared with everyone using this app. Session number is a journal reference, not a live session.</p>
        <form className="editor-form" onChange={() => setMessage('')} onSubmit={(event) => { event.preventDefault(); action(async () => accept(await api(`/campaigns/${campaign.id}`, 'PATCH', journalBody)), 'Journal updated.'); }}>
          <fieldset disabled={busy || editorBusy}>
            <label>Journal title<input required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} aria-describedby="journal-title-hint" /></label>
            <p className="field-hint" id="journal-title-hint">Names this journal; does not rename the adventure.</p>
            <div className="form-grid"><label>Session number<input required type="number" min="1" max="100000" value={state.session} onChange={(event) => setState({ ...state, session: event.target.value === '' ? '' : Number(event.target.value) })} /></label><label>Location<input maxLength={200} value={state.location} onChange={(event) => setState({ ...state, location: event.target.value })} /></label></div>
            <label>Story so far<textarea rows="3" maxLength={2000} value={state.summary} onChange={(event) => setState({ ...state, summary: event.target.value })} /></label><label>Campaign notes<textarea rows="5" maxLength={20000} value={state.notes} onChange={(event) => setState({ ...state, notes: event.target.value })} /></label>
          </fieldset>
          {feedback('journal')}
          <div className="form-actions"><Button type="submit" disabled={busy || editorBusy}>Save journal</Button><Button className="secondary" disabled={busy || editorBusy} onClick={() => setReloadConfirm(true)}>Reload saved campaign</Button></div>
          <p role="status" className="draft-status">{dirty ? 'Unsaved journal or checkpoint draft' : 'Journal is saved'}</p>
        </form>
      </section>
      <section className="workspace-panel"><div className="section-heading"><h2>The party</h2><span className="quiet-badge">{campaign.party.length} {campaign.party.length === 1 ? 'character' : 'characters'}</span></div><p className="form-note">Campaign-owned sheets. Import a form-fillable D&amp;D Beyond PDF; no personal library is needed.</p>
        {feedback('party')}
        {dirty && <p className="form-note">Save the journal and clear the checkpoint name, or reload, before changing the party. Your journal draft keeps its original revision.</p>}
        {!campaign.party.length && <p className="empty-note">No characters yet. Import a character sheet to start the party.</p>}
        <div className="party-list">{campaign.party.map((member) => <article key={member.characterId} className="party-card"><span className="character-monogram" aria-hidden="true">{member.name.slice(0, 1)}</span><div><h3>{member.name}</h3><p>Level {member.sheet.level} {member.sheet.class || 'Adventurer'}</p><div className="stat-strip"><span>HP <strong>{member.sheet.hp}/{member.sheet.maxHp}</strong></span><span>AC <strong>{member.sheet.ac}</strong></span></div></div><div className="party-actions"><Button className="secondary small" disabled={busy} onClick={() => setModal({ type: 'sheet', member, revision: campaign.revision })}>Open sheet</Button><Button className="text-button small" disabled={busy || dirty} onClick={() => setModal({ type: 'remove', member, revision: campaign.revision })}>Remove</Button></div></article>)}</div>
        <Button disabled={busy || dirty || campaign.status === 'archived'} onClick={() => setModal({ type: 'import', revision: campaign.revision })}>Import character sheet</Button>
        {campaign.status === 'archived' && <p className="form-note">Reactivate this campaign before importing another character.</p>}
      </section>
      <section className="workspace-panel campaign-settings"><h2>Campaign status</h2><p className="form-note">{campaign.status === 'active' ? 'Archiving marks the campaign inactive and prevents new imports and hosting. Saved content stays editable.' : 'This campaign is archived. Reactivate it to import characters or host a new session.'}</p>
        {feedback('status')}
        <Button className="secondary" disabled={busy || editorBusy || protectedDraft} onClick={() => { if (!protectedDraft) action(async () => accept(await api(`/campaigns/${campaign.id}`, 'PATCH', { status: campaign.status === 'active' ? 'archived' : 'active', expectedRevision: revision })), 'Campaign status saved.', 'status'); }}>{campaign.status === 'active' ? 'Archive campaign' : 'Reactivate campaign'}</Button>
        {dirty && <p className="form-note">Save the journal and save or clear the checkpoint name first, or <Button className="text-button" disabled={busy || editorBusy} onClick={() => setReloadConfirm(true)}>Discard drafts and reload…</Button></p>}
      </section>
    </div><aside><section className="workspace-panel saves-panel"><h2>Saved checkpoints</h2><p className="form-note">Fixed copies of the journal title, status, journal, and party. Adventure source and canvas are excluded; use version history for complete recovery.</p>
      <form className="editor-form" onChange={() => setMessage('')} onSubmit={(event) => { event.preventDefault(); action(async () => {
        const save = await api(`/campaigns/${campaign.id}/saves`, 'POST', journalSaveBody({ title, state, status: campaign.status, revision }, label));
        accept(save.campaign); setSaves((current) => [save, ...current.filter((entry) => entry.id !== save.id)]); setLabel('');
      }, 'Checkpoint and journal saved together.', 'checkpoint'); }}><label>Checkpoint name<input required maxLength={150} value={label} placeholder="Before entering the ruins…" disabled={busy || editorBusy} onChange={(event) => setLabel(event.target.value)} /></label>{feedback('checkpoint')}<Button type="submit" disabled={busy || editorBusy}>Save checkpoint</Button><p className="form-note">Also saves the journal edits shown here in one operation.</p></form>
      {savesLoading && <p role="status">Loading checkpoints…</p>}
      {savesError && <><p className="form-error" role="alert">{savesError}{saves.length > 0 ? ' Previously loaded checkpoints are shown.' : ''}</p><Button className="secondary" disabled={savesLoading} onClick={() => setSavesRetry((value) => value + 1)}>Retry loading checkpoints</Button></>}
      {savesLoaded && !savesLoading && !savesError && !saves.length && <p className="empty-note">No checkpoints yet.</p>}
      <ol className="save-list">{saves.map((save) => <li key={save.id}><span className="save-dot" aria-hidden="true">✦</span><div><h3>{save.label}</h3><p>{new Date(save.createdAt).toLocaleString()}</p><div className="save-actions"><Button className="text-button small" disabled={busy} onClick={() => setModal({ type: 'checkpoint', save, revision: campaign.revision })}>View checkpoint</Button></div></div></li>)}</ol>
    </section></aside></div>
    {modal?.type === 'import' && <Dialog title="Import into this campaign" onClose={closeEditor}><p className="form-note">{edition?.name} · This character belongs to {adventureTitle(campaign)}.</p>{changesAvailable && <p role="status">Saved changes available. This import keeps its original campaign revision.</p>}<CharacterImport onImport={(draft) => setModal({ ...modal, type: 'edit', draft })} /></Dialog>}
    {modal?.type === 'sheet' && <Dialog className="campaign-sheet-dialog" title="Character sheet" initialFocus={modal.focusEdit ? '.personal-sheet-edit' : undefined} onClose={closeEditor}><PersonalCharacterSheet campaign character={{ ...modal.member, editionId: campaign.editionId }} editions={editions} onEdit={dirty ? undefined : () => { setMessage(''); setError(''); setModal({ ...modal, type: 'edit' }); }} />{actionScope === 'party' && message && <p role="status" className="success-message">{message}</p>}{dirty && <p className="form-note">Save or discard the journal draft before editing this sheet.</p>}</Dialog>}
    {modal?.type === 'edit' && <Dialog className={modal.draft ? 'import-review-dialog' : ''} title={modal.draft ? 'Review imported character' : `Edit · ${modal.member.name}`} busy={editorBusy} onClose={closeEditor}><CharacterForm campaign character={modal.member} draft={modal.draft} editions={editions} editionId={campaign.editionId} onDirtyChange={setEditorDirty} onBusyChange={setEditorBusy} onCancel={closeEditor} onSave={async ({ name, sheet }) => {
      try {
        const next = await api(`/campaigns/${campaign.id}/characters${modal.member ? `/${modal.member.characterId}` : ''}`, modal.member ? 'PATCH' : 'POST', { name, sheet, expectedRevision: modal.revision });
        accept(next);
        setModal(modal.draft ? null : { type: 'sheet', member: next.party.find((member) => member.characterId === modal.member.characterId), revision: next.revision, focusEdit: true });
        setEditorDirty(false); setActionScope('party'); setMessage(modal.draft ? 'Character imported into the party.' : 'Campaign sheet saved.');
        setError('');
      } catch (error) { if (error.status === 409) refreshPolicy.current.markConflict(); throw new Error(`${error.message} Your sheet draft is kept. Reloading the saved campaign will discard it; copy any changes you need before reloading.`); }
      finally { refreshPolicy.current.invalidate(); setChangesAvailable(refreshPolicy.current.changesAvailable); refreshQueue.current?.request(); }
    }} />{changesAvailable && <p role="status">Saved changes available. Your sheet draft and its original campaign revision are kept.</p>}{!editorBusy && <Button className="text-button" onClick={() => setReloadConfirm(true)}>Reload saved campaign…</Button>}</Dialog>}
    {modal?.type === 'remove' && <Dialog title="Remove this character?" busy={busy} initialFocus=".keep-party-character" onClose={() => setModal(null)}><p>Remove <strong>{modal.member.name}</strong> from this campaign? A complete version is kept in history, where you can recover the party by reverting.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button className="secondary keep-party-character" disabled={busy} onClick={() => setModal(null)}>Keep character</Button><Button disabled={busy} onClick={() => action(async () => { accept(await api(`/campaigns/${campaign.id}/characters/${modal.member.characterId}`, 'DELETE', { expectedRevision: modal.revision })); setModal(null); }, 'Character removed. Recoverable in version history.', 'party')}>Remove character</Button><Button className="secondary" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload saved campaign…</Button></div></Dialog>}
    {modal?.type === 'checkpoint' && <Dialog title={modal.save.label} onClose={() => setModal(null)}><SnapshotRead snapshot={modal.save.snapshot} editions={editions} /><Button className="secondary" disabled={busy || dirty} onClick={() => setModal({ ...modal, type: 'restore' })}>Restore checkpoint…</Button>{dirty && <p className="form-note">Save or discard your journal draft before restoring.</p>}</Dialog>}
    {modal?.type === 'restore' && <Dialog title="Restore checkpoint?" initialFocus=".cancel-checkpoint-restore" busy={busy} onClose={() => setModal(null)}><p>Restore <strong>{modal.save.label}</strong>? This replaces the journal title, campaign status, journal, and party. The adventure title, preparation, and canvas stay as they are. Checkpoints and complete version history are retained.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button className="secondary cancel-checkpoint-restore" disabled={busy} onClick={() => setModal(null)}>Cancel</Button><Button disabled={busy} onClick={() => action(async () => { accept(await api(`/campaigns/${campaign.id}/saves/${modal.save.id}/restore`, 'POST', { expectedRevision: modal.revision })); setModal(null); }, 'Checkpoint restored. History retained.')}>Restore checkpoint</Button><Button className="secondary" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload saved campaign…</Button></div></Dialog>}
    {discardEditor && <Dialog title="Discard character draft?" initialFocus=".keep-sheet-editing" onClose={() => setDiscardEditor(false)}><p>This sheet and your changes have not been saved.</p><div className="form-actions"><Button className="secondary keep-sheet-editing" onClick={() => setDiscardEditor(false)}>Keep editing</Button><Button onClick={() => { setModal(null); setEditorDirty(false); setDiscardEditor(false); }}>Discard draft</Button></div></Dialog>}
    {reloadConfirm && <Dialog title="Reload saved campaign?" busy={busy} initialFocus=".keep-progress-editing" onClose={() => setReloadConfirm(false)}><p>Load the latest campaign and discard unsaved journal, checkpoint-name, and character drafts. Failed reloads keep your drafts.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button className="secondary keep-progress-editing" disabled={busy} onClick={() => setReloadConfirm(false)}>Keep editing</Button><Button disabled={busy} onClick={() => action(async () => { accept(await api(`/campaigns/${campaign.id}`)); setLabel(''); setModal(null); setEditorDirty(false); setReloadConfirm(false); }, 'Latest campaign loaded.')}>Discard drafts and reload</Button></div></Dialog>}
  </section>;
}
