import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import LandingHero from './LandingHero.jsx';
import FolioCover from './FolioCover.jsx';
import { sessionUrl } from './workspaceRoutes.js';
import { createRefreshQueue } from './campaignDrafts.js';

function SessionStatus({ live }) {
  const renewalError = Object.entries(live.heartbeatErrors).find(([id, message]) => message && live.details[id]?.self.joined)?.[1];
  const error = live.error || renewalError;
  return <div className="session-feed-status">
    <span className="quiet-badge" role={error ? 'alert' : 'status'}>{error ? `Session update failed: ${error}` : live.status === 'live' ? 'Connected' : live.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</span>
    {(error || live.status !== 'live') && <Button className="text-button" onClick={live.retry}>Retry session check</Button>}
  </div>;
}

export function SessionDirectory({ live, onHost }) {
  return <div className="workspace-home">
    <LandingHero onHost={onHost} />
    <section className="collection-section" aria-labelledby="sessions-title">
    <div className="section-heading">
      <h2 id="sessions-title">Open sessions</h2>
      <SessionStatus live={live} />
    </div>
    {live.loading ? <p className="workspace-panel session-feed-empty" role="status">Loading sessions…</p> : !live.sessions.length ? <p className="workspace-panel session-feed-empty">{live.error ? 'Sessions could not be loaded.' : 'No sessions are live right now.'}</p> : <ul className="campaign-library-grid session-feed-list">
      {live.sessions.map((session) => <li className="campaign-folio session-folio" key={session.id}>
        <FolioCover title={session.title} />
        <div className="campaign-folio-content">
          <dl className="campaign-folio-metadata">
            <div><dt>Hosted by</dt><dd>{session.hostName}</dd></div>
            <div><dt>At the table</dt><dd>{session.participantCount} {session.participantCount === 1 ? 'person' : 'people'}</dd></div>
          </dl>
          <a className="action-button secondary campaign-folio-open" href={sessionUrl(session.id)} aria-label={`${live.details[session.id]?.self.joined ? 'Open' : 'Join'} ${session.title}`}>{live.details[session.id]?.self.joined ? 'Open' : 'Join'} <span aria-hidden="true">→</span></a>
        </div>
      </li>)}
    </ul>}
    </section>
  </div>;
}

export function HostSession({ live, navigation, onClose }) {
  const [title, setTitle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const dirty = !!title.trim() || !!displayName.trim();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; navigation.protect({ dirty: false, busy: false }); }; }, []);
  useEffect(() => { navigation.protect({ dirty, busy }); }, [dirty, busy]);

  async function host(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    navigation.protect({ dirty, busy: true }); setBusy(true); setError('');
    let hosted = false;
    try {
      const detail = await api('/live-sessions', 'POST', { title: title.trim(), displayName: displayName.trim() });
      if (!mounted.current) return;
      hosted = true;
      live.membershipChanged(); live.accept(detail); live.retry();
      navigation.protect({ dirty: false, busy: false });
      navigation.navigate(sessionUrl(detail.id), { force: true });
    } catch (error) { if (mounted.current) setError(error.message); }
    finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); navigation.protect({ dirty: !hosted && dirty, busy: false }); }
    }
  }

  return <Dialog title="Host a session" eyebrow="Gather your party" className="session-dialog" initialFocus="#session-name" busy={busy} onClose={onClose}>
    <form className="editor-form" onSubmit={host}>
      <fieldset disabled={busy}>
        <label htmlFor="session-name">Session name</label>
        <input id="session-name" name="title" required minLength={1} maxLength={150} pattern={'.*\\S.*'} value={title} onChange={(event) => {
          setTitle(event.target.value); navigation.protect({ dirty: !!event.target.value.trim() || !!displayName.trim(), busy: inFlight.current });
        }} />
        <label htmlFor="host-name">Your name</label>
        <input id="host-name" name="displayName" autoComplete="nickname" required minLength={1} maxLength={100} pattern={'.*\\S.*'} value={displayName} onChange={(event) => {
          setDisplayName(event.target.value); navigation.protect({ dirty: !!title.trim() || !!event.target.value.trim(), busy: inFlight.current });
        }} />
      </fieldset>
      <p className="form-note">Sessions close after the host is disconnected for 5 minutes or the server restarts.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <Button className="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? 'Hosting…' : 'Host session'}</Button>
      </div>
    </form>
  </Dialog>;
}

export function LiveSession({ id, live, navigation }) {
  const detail = live.details[id];
  const [direct, setDirect] = useState(null);
  const [terminal, setTerminal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const actionEpoch = useRef(0);
  const session = detail ?? direct;
  const dirty = !session?.self.joined && !!displayName.trim() && !terminal;
  useEffect(() => { navigation.protect({ dirty, busy }); }, [dirty, busy]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; navigation.protect({ dirty: false, busy: false }); };
  }, []);
  useEffect(() => {
    if (terminal) return;
    let active = true;
    const queue = createRefreshQueue(async (current) => {
      const epoch = actionEpoch.current;
      try {
        const next = await api(`/live-sessions/${encodeURIComponent(id)}`);
        if (active && current() && epoch === actionEpoch.current && !inFlight.current) { setDirect(next); live.accept(next); setLoading(false); setError(''); }
      } catch (error) {
        if (active && current() && epoch === actionEpoch.current && !inFlight.current) {
          if (error.status === 404) { setTerminal(true); live.forget(id, true); }
          else setError(error.message);
          setLoading(false);
        }
      }
    });
    queue.request();
    return () => { active = false; queue.dispose(); };
  }, [id, live.sessions, live.refresh.all, retry, terminal]);

  async function action(kind) {
    if (inFlight.current) return;
    inFlight.current = true; actionEpoch.current++; live.membershipChanged();
    navigation.protect({ dirty, busy: true }); setBusy(true); setError('');
    let keepDraft = dirty;
    try {
      const next = await api(`/live-sessions/${encodeURIComponent(id)}/${kind}`, 'POST', kind === 'join' ? { displayName: displayName.trim() } : {});
      if (!mounted.current) return;
      if (kind === 'join') { live.membershipChanged(); live.accept(next); setDirect(next); setDisplayName(''); keepDraft = false; }
      else { live.forget(id, kind === 'end'); setDirect(null); if (kind === 'end') setTerminal(true); else setRetry((value) => value + 1); }
      setEnding(false); live.retry();
    } catch (error) {
      if (mounted.current) {
        if (error.status === 404) { setTerminal(true); live.forget(id, true); keepDraft = false; }
        else setError(error.message);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); navigation.protect({ dirty: keepDraft, busy: false }); }
    }
  }

  return <section className="live-session">
    <a className="session-back" href="/" aria-disabled={busy || undefined}>← Back to Home</a>
    {terminal ? <div className="dashboard-intro"><p className="eyebrow">Live session</p><h1>This session has ended</h1></div> : !session ? <>
      <div className="dashboard-intro"><p className="eyebrow">Live session</p><h1>Session</h1></div>
      {loading ? <p role="status">Loading session…</p> : <><p className="form-error" role="alert">{error || 'This session could not load.'}</p><Button className="secondary" onClick={() => setRetry((value) => value + 1)}>Try again</Button></>}
    </> : <>
      <div className="dashboard-intro"><p className="eyebrow">Live session</p><h1>{session.title}</h1><p>Hosted by {session.hostName}</p><SessionStatus live={live} /></div>
      <section className="workspace-panel session-table-panel" aria-labelledby="roster-title">
      <div className="section-heading"><h2 id="roster-title">At the table</h2><span className="quiet-badge">{session.participants.length} {session.participants.length === 1 ? 'participant' : 'participants'}</span></div>
      <ul className="session-roster">{session.participants.map((person) => <li key={person.id}>
        <span>{person.displayName}{person.id === session.self.participantId && ' (you)'}</span>{person.isHost && <span className="quiet-badge">Host</span>}
      </li>)}</ul>
      {session.self.joined ? <div className="form-actions">
        {session.self.isHost ? <Button className="secondary" disabled={busy} onClick={() => setEnding(true)}>End session…</Button> : <Button className="secondary" disabled={busy} onClick={() => action('leave')}>{busy ? 'Leaving…' : 'Leave session'}</Button>}
      </div> : <form className="editor-form session-join" onSubmit={(event) => { event.preventDefault(); action('join'); }}>
        <label htmlFor="join-name">Your name</label>
        <input id="join-name" name="displayName" required autoComplete="nickname" minLength={1} maxLength={100} pattern={'.*\\S.*'} disabled={busy} value={displayName} onChange={(event) => {
          setDisplayName(event.target.value); navigation.protect({ dirty: !!event.target.value.trim(), busy: inFlight.current });
        }} />
        <Button type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join session'}</Button>
      </form>}
      {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </>}
    {ending && !terminal && <Dialog title="End this session?" eyebrow={null} className="session-dialog" initialFocus=".keep-live-session" busy={busy} onClose={() => setEnding(false)}>
      <p>This closes the session for everyone.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions">
        <Button className="secondary keep-live-session" disabled={busy} onClick={() => setEnding(false)}>Cancel</Button>
        <Button disabled={busy} onClick={() => action('end')}>{busy ? 'Ending…' : 'End session'}</Button>
      </div>
    </Dialog>}
  </section>;
}
