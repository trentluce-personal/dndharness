import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import { campaignUrl } from './workspaceRoutes.js';
import { adventureTitle, adventureSynopsis, useCampaignAdventure } from './campaignPlanning.js';
import './campaignPlanning.css';

export function SourceReload({ source }) {
  return <>
    <Button className="secondary" disabled={source.busy} onClick={() => source.setReloadConfirm(true)}>Reload saved source</Button>
    {source.reloadConfirm && <Dialog title="Reload saved source?" busy={source.busy} initialFocus=".keep-source-editing" onClose={() => source.setReloadConfirm(false)}>
      <p>This loads the latest saved adventure source and discards any unsaved source changes on this page.</p>
      <div className="form-actions"><Button className="secondary keep-source-editing" disabled={source.busy} onClick={() => source.setReloadConfirm(false)}>Keep editing</Button><Button disabled={source.busy} onClick={source.load}>{source.busy ? 'Reloading…' : 'Discard changes and reload'}</Button></div>
    </Dialog>}
  </>;
}

export default function CampaignOverview({ campaign, user, editions, navigation, onUpdate }) {
  const isDm = campaign.dm.id === user.id;
  const source = useCampaignAdventure({ campaign, enabled: isDm, navigation, onUpdate });
  const { draft } = source;
  const edition = editions.find((entry) => entry.id === campaign.editionId);
  return <section className="campaign-source">
    <header className="source-heading">
      <p className="eyebrow">{edition?.name ?? campaign.editionId} · Adventure source</p>
      <h1>{adventureTitle(campaign)}</h1>
      <p>Dungeon master (DM): {campaign.dm.displayName} <span className="quiet-badge">{isDm ? 'You are the DM' : 'You are a player'}</span></p>
      <p>The editable foundation of this adventure: its storyline, DM guidance, and planned places and characters. Opening it doesn’t start a live game.</p>
    </header>
    <section className="workspace-panel source-synopsis"><h2>About this adventure</h2><p className="preserve-lines">{adventureSynopsis(campaign) || 'No player-safe synopsis yet.'}</p></section>
    {isDm && <>
      {source.error && <p className="form-error" role="alert">{source.error}</p>}
      {source.loading ? <p className="loading-note" role="status">Loading adventure source…</p> : !draft ? <Button className="secondary" onClick={source.load}>Try loading source again</Button> : <>
        <section className="workspace-panel source-planning-entry"><div><h2>Planning canvas</h2><p className="form-note">A private, open board for story points, locations, encounters, and NPCs. Begin blank and arrange points freely.</p></div>
          {draft.canvas ? <a className="action-button secondary" href={campaignUrl(campaign.id, 'planning')}>Open planning canvas</a> : <Button disabled={source.busy || source.dirty} onClick={async () => { if (await source.save({ ...draft, canvas: { title: 'Planning canvas', points: [] } })) navigation.navigate(campaignUrl(campaign.id, 'planning'), { force: true }); }}>{source.busy ? 'Saving…' : 'Create planning canvas'}</Button>}
          {source.dirty && !draft.canvas && <p className="form-note">Save your source edits before creating a canvas.</p>}
        </section>
        <form className="editor-form workspace-panel source-editor" onSubmit={(event) => { event.preventDefault(); source.save(); }}>
          <h2>Edit adventure source</h2>
          <fieldset disabled={source.busy}><legend>Campaign profile · Visible to members</legend>
            <label>Adventure title<input required maxLength={150} value={draft.title} onChange={(event) => source.edit({ title: event.target.value })} /></label>
            <label>Player-safe synopsis<textarea rows={4} maxLength={2000} value={draft.synopsis} onChange={(event) => source.edit({ synopsis: event.target.value })} aria-describedby="synopsis-hint" /></label>
            <p className="field-hint" id="synopsis-hint">Members see this synopsis in the library and overview. Keep spoilers in the private fields below.</p>
          </fieldset>
          <fieldset disabled={source.busy}><legend>Private · Dungeon master only</legend>
            <label>Storyline<textarea rows={8} maxLength={20000} value={draft.storyline} onChange={(event) => source.edit({ storyline: event.target.value })} /></label>
            <label>DM guidance<textarea rows={6} maxLength={20000} value={draft.dmGuidance} onChange={(event) => source.edit({ dmGuidance: event.target.value })} /></label>
          </fieldset>
          <div className="source-save-bar"><span role="status">{source.busy ? 'Saving…' : source.dirty ? 'Unsaved source changes' : source.message || 'Source is saved'}</span><SourceReload source={source} /><Button type="submit" disabled={source.busy || !source.dirty}>{source.busy ? 'Saving…' : 'Save adventure source'}</Button></div>
        </form>
      </>}
    </>}
    <footer className="source-legacy-link"><a href={campaignUrl(campaign.id, 'progress')}>Existing play progress</a><p>Existing party records, shared journals, and saved checkpoints are kept here.</p></footer>
  </section>;
}
