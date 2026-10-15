import { useState } from 'react';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import { SourceReload } from './CampaignOverview.jsx';
import { campaignUrl } from './workspaceRoutes.js';
import { adventureTitle, boardPosition, boundedCoordinate, maxPoints, newPlanningPoint, pointKinds, useCampaignAdventure } from './campaignPlanning.js';
import './campaignPlanning.css';

export default function CampaignPlanningCanvas({ campaign, user, navigation, onUpdate }) {
  const isDm = campaign.dm.id === user.id;
  const source = useCampaignAdventure({ campaign, enabled: isDm, navigation, onUpdate });
  const [selectedId, setSelectedId] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [drag, setDrag] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canvas = source.draft?.canvas;
  const points = canvas?.points ?? [];
  const selected = points.find((point) => point.id === selectedId);
  const full = points.length >= maxPoints;
  function editCanvas(change) {
    source.edit((current) => ({ ...current, canvas: { ...current.canvas, ...change } }));
  }
  function editPoint(id, change) {
    source.edit((current) => ({ ...current, canvas: { ...current.canvas, points: current.canvas.points.map((point) => point.id === id ? { ...point, ...change } : point) } }));
  }
  function addPoint(position) {
    if (source.busy || full) return;
    const point = newPlanningPoint(crypto.randomUUID(), position);
    editCanvas({ points: [...points, point] });
    setSelectedId(point.id); setPlacing(false);
  }
  function moveKey(event, point) {
    const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const vector = vectors[event.key];
    if (!vector || source.busy) return;
    event.preventDefault(); setSelectedId(point.id);
    const step = event.shiftKey ? 5 : 1;
    editPoint(point.id, { x: boundedCoordinate(point.x + vector[0] * step), y: boundedCoordinate(point.y + vector[1] * step) });
  }
  if (!isDm) return <section className="campaign-source workspace-panel"><h1>Planning canvas unavailable</h1><p className="form-note">Only this campaign’s dungeon master can open this destination.</p><a href={campaignUrl(campaign.id)}>Back to campaign overview</a></section>;
  return <section className="campaign-source campaign-planning">
    <header className="source-heading"><p className="eyebrow">{adventureTitle(campaign)}</p><h1>Planning canvas</h1><p><span className="quiet-badge">Private · Dungeon master only</span></p><p>Arrange your adventure’s story points freely. These are source notes, not party progress or a required story order.</p><a href={campaignUrl(campaign.id)}>Back to campaign overview</a></header>
    <>
      {source.error && <p role="alert" className="form-error">{source.error}</p>}
      {source.loading ? <p className="loading-note" role="status">Loading planning canvas…</p> : !source.draft ? <Button className="secondary" onClick={source.load}>Try loading source again</Button> : !canvas ? <section className="workspace-panel"><h2>A blank board to begin</h2><p className="form-note">Create an empty planning canvas, then add your own points.</p><Button disabled={source.busy} onClick={() => source.save({ ...source.draft, canvas: { title: 'Planning canvas', points: [] } })}>{source.busy ? 'Creating…' : 'Create planning canvas'}</Button></section> : <>
        <form className="editor-form planning-form" onSubmit={(event) => { event.preventDefault(); source.save(); }}>
          <div className="source-save-bar"><span role="status">{source.busy ? 'Saving…' : source.dirty ? 'Unsaved canvas changes' : source.message || 'Canvas is saved'}</span><SourceReload source={source} /><Button type="submit" disabled={source.busy || !source.dirty || !!drag}>{source.busy ? 'Saving…' : 'Save planning canvas'}</Button></div>
          <fieldset className="planning-fields" disabled={source.busy}>
            <label>Canvas title<input required maxLength={150} value={canvas.title} onChange={(event) => editCanvas({ title: event.target.value })} /></label>
            <div className="planning-toolbar"><span>{points.length} / {maxPoints} points</span><Button className="secondary" disabled={full || !!drag} aria-pressed={placing} onClick={() => setPlacing((current) => !current)}>{placing ? 'Cancel placing point' : 'Add point'}</Button><Button className="secondary" disabled={full || !!drag} onClick={() => addPoint({ x: 50, y: 50 })}>Add point at center</Button></div>
            <p id="planning-board-hint" className="form-note">{full ? 'This canvas has reached its 100-point capacity. Delete a point to add another.' : placing ? 'Click or tap the board to place a point, or use Add point at center.' : 'Select a marker or a point in the list to edit. Drag markers, use arrow keys (Shift for larger steps), or enter X and Y percentages.'}</p>
            <div className="planning-layout"><div className="planning-board-column">
              <div className={`planning-board${placing ? ' is-placing' : ''}`} role="group" aria-label="Adventure planning board" aria-describedby="planning-board-hint" onClick={(event) => { if (placing && event.target === event.currentTarget) addPoint(boardPosition(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())); }}>
                {!points.length && <div className="planning-board-empty"><span aria-hidden="true">✧</span><p>Your board starts blank.<br />Add a point wherever your adventure needs one.</p></div>}
                {points.map((point, index) => <button key={point.id} type="button" className="planning-marker" style={{ left: `clamp(22px, ${point.x}%, calc(100% - 22px))`, top: `clamp(22px, ${point.y}%, calc(100% - 22px))` }} aria-label={`${point.title}, ${pointKinds[point.kind]}, X ${Math.round(point.x)}%, Y ${Math.round(point.y)}%. Arrow keys move point.`} aria-pressed={selectedId === point.id} title={point.title} onClick={() => { setSelectedId(point.id); setPlacing(false); }} onKeyDown={(event) => moveKey(event, point)} onPointerDown={(event) => {
                  if (source.busy || event.button !== 0 || !event.isPrimary) return;
                  event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
                  setSelectedId(point.id); setPlacing(false);
                  setDrag({ id: point.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: point.x, y: point.y, bounds: event.currentTarget.parentElement.getBoundingClientRect() });
                }} onPointerMove={(event) => {
                  if (source.busy || drag?.id !== point.id || drag.pointerId !== event.pointerId) return;
                  editPoint(point.id, { x: boundedCoordinate(drag.x + (event.clientX - drag.startX) / drag.bounds.width * 100), y: boundedCoordinate(drag.y + (event.clientY - drag.startY) / drag.bounds.height * 100) });
                }} onPointerUp={(event) => { if (drag?.pointerId === event.pointerId) setDrag(null); }} onPointerCancel={() => setDrag(null)} onLostPointerCapture={() => setDrag(null)}><span aria-hidden="true">{index + 1}</span></button>)}
              </div>
              <section className="planning-point-list"><h2>Points <span className="detail-count">{points.length}</span></h2><p className="form-note">List numbers identify markers; they don’t prescribe a story order.</p>{!points.length ? <p className="form-note">No points yet.</p> : <ul>{points.map((point, index) => <li key={point.id}><button type="button" aria-pressed={selectedId === point.id} onClick={() => { setSelectedId(point.id); setPlacing(false); }}><span>{index + 1}</span><span>{point.title || 'Untitled point'}<small>{pointKinds[point.kind]}</small></span></button></li>)}</ul>}</section>
            </div><aside className="workspace-panel planning-point-editor">
              <h2>{selected ? 'Edit point' : 'Point details'}</h2>
              {!selected ? <p className="form-note">Select a point on the board or in the list. Its details will appear here.</p> : <div className="editor-form">
                <label>Point title<input required maxLength={150} value={selected.title} onChange={(event) => editPoint(selected.id, { title: event.target.value })} /></label>
                <label>Kind<select value={selected.kind} onChange={(event) => editPoint(selected.id, { kind: event.target.value })}>{Object.entries(pointKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                <div className="form-grid">{['x', 'y'].map((axis) => <label key={axis}>{axis.toUpperCase()} (%)<input type="number" required min={0} max={100} step="any" value={selected[axis]} onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) editPoint(selected.id, { [axis]: boundedCoordinate(event.target.valueAsNumber) }); }} /></label>)}</div>
                <label>Notes<textarea rows={5} maxLength={4000} value={selected.notes} onChange={(event) => editPoint(selected.id, { notes: event.target.value })} /></label>
                <label>Location reference<input maxLength={200} value={selected.location} onChange={(event) => editPoint(selected.id, { location: event.target.value })} /></label>
                <label>NPC / enemy references<textarea rows={4} maxLength={4000} value={selected.characters} onChange={(event) => editPoint(selected.id, { characters: event.target.value })} aria-describedby="point-reference-hint" /></label><p className="field-hint" id="point-reference-hint">Manual names and references for your preparation.</p>
                <Button className="secondary" onClick={() => setDeleting(selected)}>Delete point</Button>
              </div>}
            </aside></div>
          </fieldset>
        </form>
      </>}
      {deleting && <Dialog title="Delete this point?" initialFocus=".keep-planning-point" onClose={() => setDeleting(null)}><p>Remove <strong>{deleting.title}</strong> and its notes and references from this draft? Save the canvas to make the deletion permanent.</p><div className="form-actions"><Button className="secondary keep-planning-point" onClick={() => setDeleting(null)}>Keep point</Button><Button onClick={() => { editCanvas({ points: points.filter((point) => point.id !== deleting.id) }); setSelectedId(null); setDeleting(null); }}>Delete point</Button></div></Dialog>}
    </>
  </section>;
}
