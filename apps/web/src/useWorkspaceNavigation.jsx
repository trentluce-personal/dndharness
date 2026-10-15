import { useEffect, useRef, useState } from 'react';
import { interceptLink, workspaceRoute } from './workspaceRoutes.js';

export default function useWorkspaceNavigation() {
  const [path, setPath] = useState(window.location.pathname);
  const [pending, setPending] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const protection = useRef({ dirty: false, busy: false });
  const position = useRef(history.state?.workspaceIndex ?? 0);
  const epoch = useRef(history.state?.workspaceEpoch ?? crypto.randomUUID());
  const currentUrl = useRef(location.pathname + location.search + location.hash);
  const restoreTimer = useRef(null);
  const restoring = useRef(false);
  const approvedPop = useRef(false);
  const pendingRef = useRef(null);

  function commit(url) {
    position.current += 1;
    history.pushState({ ...history.state, workspaceIndex: position.current, workspaceEpoch: epoch.current }, '', url);
    currentUrl.current = location.pathname + location.search + location.hash;
    setPath(new URL(url, location.origin).pathname);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  }
  function request(action) {
    if (protection.current.busy || pendingRef.current || restoring.current) return;
    if (protection.current.dirty) {
      pendingRef.current = action;
      setPending(action);
    } else run(action);
  }
  async function run(action) {
    if (!action.busy) { action.run(); return; }
    protection.current.busy = true;
    setActionBusy(true);
    try { await action.run(); }
    finally { protection.current.busy = false; setActionBusy(false); }
  }
  function navigate(url, { force = false } = {}) {
    if (url === location.pathname) return;
    if (force) commit(url);
    else request({ run: () => commit(url) });
  }
  function resolve(discard) {
    const action = pendingRef.current;
    if (restoring.current || protection.current.busy) return;
    pendingRef.current = null;
    setPending(null);
    if (discard) { if (!action?.busy) protection.current.dirty = false; if (action) run(action); }
  }
  useEffect(() => {
    const stamp = () => history.replaceState({ ...history.state, workspaceIndex: position.current, workspaceEpoch: epoch.current }, '', location.href);
    stamp();
    function click(event) {
      const anchor = event.target.closest?.('a');
      if (anchor?.classList.contains('skip-link') && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const main = document.getElementById('main-content');
        main?.focus(); main?.scrollIntoView();
        return;
      }
      if (!interceptLink(event, anchor, location.origin)) return;
      event.preventDefault();
      navigate(anchor.pathname + anchor.search);
    }
    function pop(event) {
      const url = location.pathname + location.search + location.hash;
      const target = event.state?.workspaceEpoch === epoch.current && Number.isInteger(event.state?.workspaceIndex) ? event.state.workspaceIndex : null;
      if (restoring.current && url === currentUrl.current) {
        clearTimeout(restoreTimer.current); restoring.current = false; return;
      }
      if (restoring.current) {
        // Rapid traversal or an unexpected native entry: recover without another go().
        clearTimeout(restoreTimer.current); restoring.current = false;
        epoch.current = crypto.randomUUID(); position.current = 0;
        history.replaceState({ workspaceIndex: position.current, workspaceEpoch: epoch.current }, '', currentUrl.current);
        return;
      }
      const samePage = location.pathname === new URL(currentUrl.current, location.origin).pathname;
      if (samePage && !approvedPop.current) {
        // Hash entries do not unmount the draft. Native entries have no distance
        // we can safely infer; start a new indexed segment instead of treating null as 0.
        if (target === null) { epoch.current = crypto.randomUUID(); position.current = 0; stamp(); }
        else position.current = target;
        currentUrl.current = url;
        return;
      }
      if (approvedPop.current === url) {
        approvedPop.current = false;
      } else if (protection.current.dirty || protection.current.busy || pendingRef.current) {
        approvedPop.current = false;
        const delta = target === null ? null : target - position.current;
        const fallback = () => {
          restoring.current = false;
          epoch.current = crypto.randomUUID(); position.current = 0;
          history.replaceState({ workspaceIndex: 0, workspaceEpoch: epoch.current }, '', currentUrl.current);
        };
        if (delta) {
          restoring.current = true;
          history.go(-delta);
          // A native/unindexed entry can invalidate an inferred distance. Never
          // leave controls permanently locked if go() produces no expected event.
          restoreTimer.current = setTimeout(fallback, 750);
        } else fallback();
        if (!protection.current.busy && !pendingRef.current) {
          const savedEpoch = epoch.current;
          const action = { run: () => {
            if (delta && savedEpoch === epoch.current) { approvedPop.current = url; history.go(delta); }
            else commit(url);
          } };
          pendingRef.current = action;
          setPending(action);
        }
        return;
      }
      if (target === null) { epoch.current = crypto.randomUUID(); position.current = 0; stamp(); }
      else position.current = target;
      currentUrl.current = url;
      setPath(location.pathname);
      window.scrollTo(0, 0);
      requestAnimationFrame(() => document.getElementById('main-content')?.focus());
    }
    function unload(event) {
      if (!protection.current.dirty && !protection.current.busy) return;
      event.preventDefault(); event.returnValue = '';
    }
    document.addEventListener('click', click);
    window.addEventListener('popstate', pop);
    window.addEventListener('beforeunload', unload);
    return () => {
      clearTimeout(restoreTimer.current);
      document.removeEventListener('click', click);
      window.removeEventListener('popstate', pop);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
  return { route: workspaceRoute(path), navigate, request, pending, resolve, actionBusy, protect: (state) => { protection.current = state; } };
}
