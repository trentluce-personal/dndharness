import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { createMembershipDiscovery, createMembershipHeartbeat } from './liveMembership.js';

export default function useLiveWorkspace() {
  const [sessions, setSessions] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('connecting');
  const [heartbeatErrors, setHeartbeatErrors] = useState({});
  const [refresh, setRefresh] = useState({ all: 0 });
  const controls = useRef(null);
  const membershipEpoch = useRef(0);
  const detailsRef = useRef(details);
  function updateDetails(update) {
    detailsRef.current = update(detailsRef.current);
    setDetails(detailsRef.current);
  }
  function accept(detail) {
    updateDetails((current) => current[detail.id]?.revision > detail.revision ? current : { ...current, [detail.id]: detail });
  }
  useEffect(() => {
    let live = true;
    const directory = createMembershipDiscovery({
      read: api,
      getEpoch: () => membershipEpoch.current,
      getDetails: () => detailsRef.current,
      onDirectory: (list) => { setSessions(list); setLoading(false); },
      install: accept,
      remove: (id) => { updateDetails((current) => { const next = { ...current }; delete next[id]; return next; }); setSessions((current) => current.filter((entry) => entry.id !== id)); },
      onError: (message) => { setError(message); setLoading(false); },
    });
    const stream = new EventSource('/api/events');
    let opened = false;
    stream.onopen = () => { if (live) { setStatus('live'); opened = true; } };
    stream.onerror = () => { if (live) setStatus(opened ? 'reconnecting' : 'connecting'); };
    const sync = () => {
      directory.request();
      setRefresh((current) => ({ ...current, all: current.all + 1 }));
    };
    stream.addEventListener('sync-required', sync);
    stream.addEventListener('live-sessions-changed', () => directory.request());
    stream.addEventListener('live-session-changed', () => directory.request());
    const heartbeat = createMembershipHeartbeat({
      read: api,
      getEpoch: () => membershipEpoch.current,
      getDetails: () => detailsRef.current,
      install: accept,
      onMissing: (id) => { updateDetails((current) => { const next = { ...current }; delete next[id]; return next; }); directory.request(); },
      onError: (id, message) => setHeartbeatErrors((current) => ({ ...current, [id]: message })),
    });
    const wake = () => { if (document.visibilityState === 'visible') { directory.request(); heartbeat.request(); } };
    controls.current = { directory, heartbeat };
    document.addEventListener('visibilitychange', wake);
    return () => {
      live = false; stream.close(); heartbeat.dispose(); directory.dispose();
      document.removeEventListener('visibilitychange', wake); controls.current = null;
      // Never leave on route changes, reload, or cleanup. The server lease owns expiry.
    };
  }, []);
  function forget(id, ended = false) {
    membershipEpoch.current++;
    updateDetails((current) => { const next = { ...current }; delete next[id]; return next; });
    if (ended) setSessions((current) => current.filter((entry) => entry.id !== id));
    controls.current?.directory.request();
  }
  return { sessions, details, loading, error, status, heartbeatErrors, refresh, accept, forget, membershipChanged: () => { membershipEpoch.current++; }, retry: () => { controls.current?.directory.request(); controls.current?.heartbeat.request(); } };
}
