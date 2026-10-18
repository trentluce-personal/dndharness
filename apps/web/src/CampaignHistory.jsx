import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import PersonalCharacterSheet from './PersonalCharacterSheet.jsx';
import { adventureTitle, coordinateLabel } from './campaignPlanning.js';
import { canRefreshDraft, createRefreshQueue } from './campaignDrafts.js';
import { createCampaignRefreshPolicy } from './campaignRefresh.js';
import { useCampaignRefresh } from './realtime.js';

export function SnapshotRead({ snapshot, editions }) {
  const metadata = snapshot.campaign ?? snapshot;
  const adventure = snapshot.adventure;
  return <div className="snapshot-read">
    <p>Campaign status: {metadata.status} · {editions.find((entry) => entry.id === metadata.editionId)?.name ?? metadata.editionId}</p>
    {adventure ? <section><h3>Adventure source · Spoilers</h3><h4>Adventure title: {adventure.title}</h4><p className="preserve-lines">{adventure.synopsis || 'No synopsis.'}</p><h4>Storyline</h4><p className="preserve-lines">{adventure.storyline || 'No storyline.'}</p><h4>DM guidance</h4><p className="preserve-lines">{adventure.dmGuidance || 'No guidance.'}</p><h4>Planning canvas</h4>{adventure.canvas ? <><p>{adventure.canvas.title} · {adventure.canvas.points.length} {adventure.canvas.points.length === 1 ? 'point' : 'points'}</p>{adventure.canvas.points.map((point) => <article className="history-point" key={point.id}><h5>{point.title} · {point.kind}</h5><p>X {coordinateLabel(point.x)}%, Y {coordinateLabel(point.y)}% · {point.location || 'No location reference'}</p><p className="preserve-lines">{point.notes}</p><p className="preserve-lines">{point.characters}</p></article>)}</> : <p>No canvas.</p>}</section> : <p className="form-note">The adventure title, source, and canvas are not included in this checkpoint.</p>}
    <section><h3>Journal</h3><h4>Journal title: {metadata.title}</h4><p>Session {snapshot.state?.session} · {snapshot.state?.location || 'No location'}</p><p className="preserve-lines">{snapshot.state?.summary || 'No story summary.'}</p><p className="preserve-lines">{snapshot.state?.notes || 'No journal notes.'}</p></section>
    <section><h3>Party · {snapshot.party?.length ?? 0} {snapshot.party?.length === 1 ? 'character' : 'characters'}</h3>{!snapshot.party?.length && <p>No characters.</p>}{snapshot.party?.map((member) => <details key={member.characterId} className="history-character"><summary>{member.name} · HP {member.sheet.hp}/{member.sheet.maxHp} · Level {member.sheet.level}</summary><PersonalCharacterSheet campaign character={{ ...member, editionId: metadata.editionId }} editions={editions} /></details>)}</section>
  </div>;
}

export default function CampaignHistory({ campaign, editions, navigation, onUpdate }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(campaign.revision);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const [changesAvailable, setChangesAvailable] = useState(false);
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const refresh = useCampaignRefresh(campaign.id);
  const refreshQueue = useRef(null);
  const refreshPolicy = useRef(null);
  if (!refreshPolicy.current) refreshPolicy.current = createCampaignRefreshPolicy(campaign.revision);
  refreshPolicy.current.observe(campaign.revision);
  const current = useRef(null);
  current.current = { busy: busy || inFlight.current, confirmation: confirm || reloadConfirm, editor: !!preview, revision };
  useEffect(() => {
    const queue = createRefreshQueue(async (active) => {
      const ticket = refreshPolicy.current.ticket();
      try {
        const [history, next] = await Promise.all([api(`/campaigns/${campaign.id}/history`), api(`/campaigns/${campaign.id}`)]);
        if (!active()) return;
        setRefreshError('');
        refreshPolicy.current.observe(next.revision);
        if (!canRefreshDraft(current.current) || inFlight.current) { setChangesAvailable(refreshPolicy.current.changesAvailable); return; }
        if (!refreshPolicy.current.install(next.revision, ticket)) return;
        setVersions(history); setRevision(next.revision); onUpdate(next); setChangesAvailable(refreshPolicy.current.changesAvailable); setLoaded(true);
      } catch (error) { if (active()) setRefreshError(`History could not refresh: ${error.message}`); }
      finally { if (active()) setLoading(false); }
    });
    refreshQueue.current = queue;
    return () => { queue.dispose(); refreshQueue.current = null; };
  }, [campaign.id]);
  useEffect(() => { refreshPolicy.current.invalidate(campaign.revision); refreshQueue.current?.request(); }, [refresh, campaign.revision, retry]);
  useEffect(() => { if (refreshPolicy.current.pending && canRefreshDraft(current.current)) refreshQueue.current?.request(); }, [preview, busy, confirm, reloadConfirm]);
  useEffect(() => { navigation.protect({ dirty: false, busy }); }, [busy]);
  useEffect(() => () => navigation.protect({ dirty: false, busy: false }), []);
  async function action(work) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); navigation.protect({ dirty: false, busy: true });
    try { await work(); } catch (error) { if (error.status === 409) refreshPolicy.current.markConflict(); setError(error.message); }
    finally { inFlight.current = false; setBusy(false); setChangesAvailable(refreshPolicy.current.changesAvailable); if (refreshPolicy.current.pending) refreshQueue.current?.request(); }
  }
  async function reloadHistory() {
    await action(async () => {
      const ticket = refreshPolicy.current.ticket();
      const [history, next] = await Promise.all([api(`/campaigns/${campaign.id}/history`), api(`/campaigns/${campaign.id}`)]);
      if (!refreshPolicy.current.install(next.revision, ticket)) throw new Error('The campaign changed during reload. Retry loading the latest history.');
      setVersions(history); setRevision(next.revision); onUpdate(next); setLoaded(true); setRefreshError('');
      // Keep all preview/confirmation context mounted until both reads succeed.
      setPreview(null); setConfirm(false); setReloadConfirm(false);
      refreshPolicy.current.invalidate(); refreshQueue.current?.request();
    });
  }
  return <section className="campaign-detail">
    <div className="dashboard-intro"><p className="eyebrow">{adventureTitle(campaign)}</p><h1>Version history</h1><p>Saved changes automatically keep complete campaign versions. Preview source, canvas, journal, and party before reverting. History is retained.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    {refreshError && <div><p className="form-error" role="alert">{refreshError}</p><Button className="secondary" disabled={busy} onClick={() => setRetry((value) => value + 1)}>Retry history refresh</Button></div>}
    {changesAvailable && <p className="saved-changes-note" role="status">Saved changes available. This preview keeps its captured campaign revision. <Button className="text-button" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload history…</Button></p>}
    {reloadConfirm && <Dialog title="Reload saved history?" busy={busy} initialFocus=".keep-history-preview" onClose={() => setReloadConfirm(false)}><p>Load the latest history and campaign revision, then close the current preview and confirmation. If loading fails, your preview is kept.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><Button className="secondary keep-history-preview" disabled={busy} onClick={() => setReloadConfirm(false)}>Keep preview</Button><Button disabled={busy} onClick={reloadHistory}>{busy ? 'Reloading…' : 'Reload history'}</Button></div></Dialog>}
    {loading ? <p role="status">Loading version history…</p> : <section className="workspace-panel"><div className="section-heading"><h2>Complete campaign versions</h2><Button className="secondary" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload history and current revision</Button></div>{loaded && !refreshError && !versions.length && <p className="empty-note">No versions yet. Saved campaign changes will appear here.</p>}<ol className="save-list">{versions.map((version) => <li key={version.id}><span className="save-dot" aria-hidden="true">✦</span><div><h3>{version.label}</h3><p>Version {version.revision} · {new Date(version.createdAt).toLocaleString()}</p><Button className="text-button small" disabled={busy} onClick={() => action(async () => { const full = await api(`/campaigns/${campaign.id}/history/${version.id}`); setPreview({ ...full, expectedRevision: revision }); setConfirm(false); })}>Preview version</Button></div></li>)}</ol></section>}
    {preview && <Dialog className="history-preview-dialog" title={`Version ${preview.revision} · ${preview.label}`} busy={busy} onClose={() => { setPreview(null); setConfirm(false); }}><p className="form-note">Immutable version · {new Date(preview.createdAt).toLocaleString()}</p>{changesAvailable && <p className="saved-changes-note" role="status">Saved changes available. This preview keeps its original campaign revision.</p>}<SnapshotRead snapshot={preview.snapshot} editions={editions} />{error && <p role="alert" className="form-error">{error} This preview is kept. Reload history to review the latest campaign revision before trying again.</p>}<div className="form-actions"><Button className="secondary" disabled={busy} onClick={() => setPreview(null)}>Close preview</Button><Button className="secondary" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload history…</Button><Button disabled={busy} onClick={() => setConfirm(true)}>Revert to this version…</Button></div></Dialog>}
    {confirm && <Dialog title="Revert complete campaign?" initialFocus=".cancel-version-revert" busy={busy} onClose={() => setConfirm(false)}><p>Revert to <strong>version {preview.revision} · {preview.label}</strong>? This replaces the adventure title and source, planning canvas, journal title and contents, campaign status, and entire party.</p><p>A new version is appended. Existing version history and checkpoints are retained, so you can recover this change later.</p>{error && <p role="alert" className="form-error">{error} Your preview is kept. Reload history before retrying a stale revision.</p>}<div className="form-actions"><Button className="secondary cancel-version-revert" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button><Button className="secondary" disabled={busy} onClick={() => setReloadConfirm(true)}>Reload history…</Button><Button disabled={busy} onClick={() => action(async () => {
      const next = await api(`/campaigns/${campaign.id}/history/${preview.id}/restore`, 'POST', { expectedRevision: preview.expectedRevision });
      refreshPolicy.current.invalidate();
      onUpdate(next); if (refreshPolicy.current.install(next.revision)) setRevision(next.revision); setChangesAvailable(refreshPolicy.current.changesAvailable); setPreview(null); setConfirm(false); setMessage('Campaign reverted. A new version was added; history is retained.'); setRetry((value) => value + 1);
    })}>{busy ? 'Reverting…' : 'Revert complete campaign'}</Button></div></Dialog>}
  </section>;
}
