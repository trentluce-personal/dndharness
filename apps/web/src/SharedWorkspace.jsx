import { useLayoutEffect, useRef } from 'react';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import DiceTray from './DiceTray.jsx';
import useLiveWorkspace from './useLiveWorkspace.js';
import { sections } from './workspaceRoutes.js';
import { HostSession, LiveSession, SessionDirectory } from './LiveSessions.jsx';

export default function SharedWorkspace({ navigation }) {
  const { route } = navigation;
  const live = useLiveWorkspace();
  const workspace = useRef(null);
  const previousRoute = useRef(route);
  useLayoutEffect(() => {
    const previous = previousRoute.current;
    previousRoute.current = route;
    if (previous.section !== 'sessions' || previous.view !== 'host' ||
        route.section !== 'sessions' || route.id || route.view) return;
    // Navigation queues main focus before this committed route's layout effect.
    // Restore the dialog trigger after that handoff, including browser Back.
    const frame = requestAnimationFrame(() => workspace.current?.querySelector('#home-host-session')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [route.section, route.id, route.view]);

  return <div ref={workspace} className="account-workspace">
    <nav className="workspace-nav" aria-label="Workspace">
      <div className="workspace-tabs">{sections.map(([section, label, href]) => <a
        key={section} href={href}
        className={`action-button nav-tab${route.section === section ? ' selected' : ''}`}
        aria-current={route.section === section && !route.id && !route.view ? 'page' : undefined}
      >{label}</a>)}</div>
    </nav>
    {route.section === 'dice' ? <DiceTray /> : route.section !== 'sessions' ? <section className="dashboard-intro">
      <p className="eyebrow">Your local table</p>
      <h1>This page is unavailable</h1>
      <div className="form-actions"><a className="action-button secondary" href="/">Back to Home</a></div>
    </section> : route.id ? <LiveSession key={route.id} id={route.id} live={live} navigation={navigation} /> : <>
      <SessionDirectory live={live} onHost={() => navigation.navigate('/sessions/host')} />
      {route.view === 'host' && <HostSession live={live} navigation={navigation} onClose={() => navigation.navigate('/')} />}
    </>}
    {navigation.pending && <Dialog title="Discard your entries?" eyebrow={null} className="session-dialog" initialFocus=".keep-session-editing" onClose={() => navigation.resolve(false)}>
      <p>Your entries have not been submitted.</p>
      <div className="form-actions">
        <Button className="secondary keep-session-editing" onClick={() => navigation.resolve(false)}>Keep editing</Button>
        <Button onClick={() => navigation.resolve(true)}>Discard entries</Button>
      </div>
    </Dialog>}
  </div>;
}
