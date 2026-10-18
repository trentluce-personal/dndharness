import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import { campaignUrl } from './workspaceRoutes.js';
import { adventureTitle, adventureSynopsis, planningCanvasState, useCampaignAdventure } from './campaignPlanning.js';
import './campaignPlanning.css';

export function SourceReload({ source }) {
  return <>
    {source.refreshError && <span className="form-error" role="alert">{source.refreshError} <Button className="text-button" disabled={source.busy} onClick={source.retryRefresh}>Retry refresh</Button></span>}
    {source.changesAvailable && <span className="saved-changes-note" role="status">Saved changes available. Your draft and its original revisions are kept.</span>}
    <Button className="secondary" disabled={source.busy} onClick={() => source.setReloadConfirm(true)}>Reload saved source</Button>
    {source.reloadConfirm && <Dialog title="Reload saved source?" busy={source.busy} initialFocus=".keep-source-editing" onClose={() => source.setReloadConfirm(false)}>
      <p>This loads the latest saved adventure source and discards any unsaved source changes on this page.</p>
      {source.changesAvailable && <p role="status">Saved changes available. Your current draft still uses its original revisions.</p>}
      {source.error && <p className="form-error" role="alert">{source.error}</p>}
      <div className="form-actions"><Button className="secondary keep-source-editing" disabled={source.busy} onClick={() => source.setReloadConfirm(false)}>Keep editing</Button><Button disabled={source.busy} onClick={source.load}>{source.busy ? 'Reloading…' : 'Discard changes and reload'}</Button></div>
    </Dialog>}
  </>;
}

export default function CampaignOverview({ campaign, editions, navigation, onUpdate }) {
  const source = useCampaignAdventure({ campaign, enabled: true, navigation, onUpdate });
  const { draft } = source;
  const canvasState = planningCanvasState(source.saved, draft);
  const edition = editions.find((entry) => entry.id === campaign.editionId);
  return <section className="campaign-source">
    <header className="source-heading">
      <p className="eyebrow">{edition?.name ?? campaign.editionId} · Adventure source</p>
      <h1>Campaign overview</h1>
      <p>{adventureTitle(campaign)}</p>
      <p><span className="quiet-badge">Shared campaign · Anyone can edit</span></p>
      <p>The editable foundation of this adventure: its storyline, DM guidance, and planned places and characters. Opening it doesn’t start a live game.</p>
    </header>
    <section className="workspace-panel source-synopsis"><h2>About this adventure</h2><p className="preserve-lines">{adventureSynopsis(campaign) || 'No player-safe synopsis yet.'}</p></section>
    <>
      {source.error && <p className="form-error" role="alert">{source.error}</p>}
      {source.loading ? <p className="loading-note" role="status">Loading adventure source…</p> : !draft ? <Button className="secondary" onClick={source.load}>Try loading source again</Button> : <>
        <section className="workspace-panel source-planning-entry"><div><h2>Planning canvas</h2><p className="form-note">Shared preparation · Contains spoilers. An open board for story points, locations, encounters, and NPCs.</p></div>
          {canvasState === 'saved' ? <a className="action-button secondary" href={campaignUrl(campaign.id, 'planning')}>Open planning canvas</a> : <Button disabled={source.busy || (source.dirty && canvasState === 'absent')} onClick={async () => { if (await source.save({ ...draft, canvas: draft.canvas ?? { title: 'Planning canvas', points: [] } })) navigation.navigate(campaignUrl(campaign.id, 'planning'), { force: true }); }}>{source.busy ? 'Saving…' : canvasState === 'draft' ? 'Save canvas draft and open' : 'Create planning canvas'}</Button>}
          {canvasState === 'draft' && <p className="form-note">This canvas has not been saved. Retry here, or save it with your adventure source below.</p>}
          {source.dirty && canvasState === 'absent' && <p className="form-note">Save your source edits before creating a canvas.</p>}
        </section>
        <form className="editor-form workspace-panel source-editor" onSubmit={(event) => { event.preventDefault(); source.save(); }}>
          <h2>Edit adventure source</h2>
          <fieldset disabled={source.busy}><legend>Adventure summary · Shared library</legend>
            <label>Adventure title<input required maxLength={150} value={draft.title} onChange={(event) => source.edit({ title: event.target.value })} /></label>
            <label>Player-safe synopsis<textarea rows={4} maxLength={2000} value={draft.synopsis} onChange={(event) => source.edit({ synopsis: event.target.value })} aria-describedby="synopsis-hint" /></label>
            <p className="field-hint" id="synopsis-hint">This synopsis appears in the library and overview. Put preparation spoilers below; everyone can still open them.</p>
          </fieldset>
          <fieldset disabled={source.busy}><legend>Preparation · Spoilers, not confidential</legend>
            <label>Storyline<textarea rows={8} maxLength={20000} value={draft.storyline} onChange={(event) => source.edit({ storyline: event.target.value })} /></label>
            <label>DM guidance<textarea rows={6} maxLength={20000} value={draft.dmGuidance} onChange={(event) => source.edit({ dmGuidance: event.target.value })} /></label>
          </fieldset>
          <div className="source-save-bar"><span role="status">{source.busy ? 'Saving…' : source.dirty ? 'Unsaved source changes' : source.message || 'Source is saved'}</span><SourceReload source={source} /><Button type="submit" disabled={source.busy || !source.dirty}>{source.busy ? 'Saving…' : 'Save adventure source'}</Button></div>
        </form>
      </>}
    </>
  </section>;
}
