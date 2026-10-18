import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { canRefreshDraft, createRefreshQueue } from './campaignDrafts.js';
import { createCampaignRefreshPolicy } from './campaignRefresh.js';
import { useCampaignRefresh } from './realtime.js';

export const pointKinds = { story: 'Story', location: 'Location', encounter: 'Encounter', npc: 'NPC' };
export const maxPoints = 100;
export const maxAdventureBytes = 200000;
export const adventureTitle = (campaign) => campaign.adventure?.title ?? campaign.title;
export const adventureSynopsis = (campaign) => campaign.adventure?.synopsis ?? '';
export const coordinateLabel = (value) => Number(value.toFixed(1));

export function planningCanvasState(saved, draft) {
  return saved?.canvas ? 'saved' : draft?.canvas ? 'draft' : 'absent';
}

export function boundedCoordinate(value) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 50;
}

export function boardPosition(clientX, clientY, bounds) {
  return {
    x: boundedCoordinate((clientX - bounds.left) / bounds.width * 100),
    y: boundedCoordinate((clientY - bounds.top) / bounds.height * 100),
  };
}

export function newPlanningPoint(id, position = { x: 50, y: 50 }) {
  return { id, title: 'Untitled point', kind: 'story', x: boundedCoordinate(position.x), y: boundedCoordinate(position.y), notes: '', location: '', characters: '' };
}

export function adventureSignature(adventure) {
  if (!adventure) return '';
  const sort = (value) => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value;
  const { revision, campaignRevision, expectedRevision, ...content } = adventure;
  return JSON.stringify(sort(content));
}

export function adventureSaveBody(adventure) {
  const { campaignRevision, ...source } = adventure;
  return { ...source, expectedRevision: campaignRevision };
}

export function adventureByteSize(adventure) {
  const { campaignRevision, expectedRevision, ...source } = adventure;
  return new TextEncoder().encode(JSON.stringify(source)).byteLength;
}

// The source is saved as a whole, independently of the existing party journal.
export function useCampaignAdventure({ campaign, enabled, navigation, onUpdate, interactionOpen = false }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const [changesAvailable, setChangesAvailable] = useState(false);
  const live = useRef(false);
  const inFlight = useRef(false);
  const dirty = adventureSignature(saved) !== adventureSignature(draft);
  const refresh = useCampaignRefresh(campaign.id);
  const current = useRef(null);
  const refreshQueue = useRef(null);
  const refreshPolicy = useRef(null);
  if (!refreshPolicy.current) refreshPolicy.current = createCampaignRefreshPolicy();
  refreshPolicy.current.observe(campaign.revision);
  current.current = { dirty, busy: busy || inFlight.current || navigation.actionBusy, confirmation: reloadConfirm || interactionOpen, saved };
  function protect(nextBusy = busy, nextDirty = dirty) {
    navigation.protect({ dirty: nextDirty, busy: nextBusy || navigation.actionBusy });
  }
  useEffect(() => {
    live.current = true;
    if (enabled) load();
    return () => { live.current = false; navigation.protect({ dirty: false, busy: false }); };
  }, [campaign.id, enabled]);
  useEffect(() => { if (enabled) protect(busy || inFlight.current); }, [dirty, busy, enabled, navigation.actionBusy]);
  useEffect(() => {
    if (!enabled) return;
    const queue = createRefreshQueue(async (active) => {
      const ticket = refreshPolicy.current.ticket();
      // Do not advance either revision while a source draft or confirmation is open.
      if (!current.current.saved) return;
      const baseline = current.current.saved;
      try {
        const adventure = await api(`/campaigns/${campaign.id}/adventure`);
        if (!active()) return;
        setRefreshError('');
        refreshPolicy.current.observe(adventure.campaignRevision);
        if (!canRefreshDraft(current.current) || inFlight.current || current.current.saved !== baseline) { setChangesAvailable(refreshPolicy.current.changesAvailable); return; }
        if (!refreshPolicy.current.install(adventure.campaignRevision, ticket)) return;
        setSaved(adventure); setDraft(adventure); setChangesAvailable(refreshPolicy.current.changesAvailable);
      } catch (error) { if (active()) setRefreshError(`Saved source could not refresh: ${error.message}`); }
    });
    refreshQueue.current = queue;
    return () => { queue.dispose(); refreshQueue.current = null; };
  }, [campaign.id, enabled]);
  useEffect(() => {
    refreshPolicy.current.invalidate(campaign.revision);
    if (saved) refreshQueue.current?.request();
  }, [refresh, campaign.revision]);
  useEffect(() => {
    if (saved && refreshPolicy.current.pending && canRefreshDraft(current.current)) refreshQueue.current?.request();
  }, [dirty, busy, reloadConfirm, interactionOpen, navigation.actionBusy, saved?.campaignRevision]);

  function accept(adventure) {
    if (!refreshPolicy.current.install(adventure.campaignRevision)) throw new Error('A newer source revision was already loaded. Reload again to review it.');
    setSaved(adventure); setDraft(adventure); setChangesAvailable(refreshPolicy.current.changesAvailable); setRefreshError('');
    onUpdate(campaign.id);
  }
  async function load() {
    if (inFlight.current || navigation.actionBusy) return;
    inFlight.current = true; setLoading(true); setBusy(true); protect(true); setError(''); setMessage('');
    try {
      const adventure = await api(`/campaigns/${campaign.id}/adventure`);
      if (live.current) { accept(adventure); protect(false, false); setReloadConfirm(false); }
    } catch (error) { if (live.current) setError(error.message); }
    finally { inFlight.current = false; if (live.current) { setLoading(false); setBusy(false); refreshPolicy.current.invalidate(); refreshQueue.current?.request(); } }
  }
  function edit(change) {
    if (inFlight.current || navigation.actionBusy) return;
    setMessage('');
    setDraft((current) => {
      const next = typeof change === 'function' ? change(current) : { ...current, ...change };
      navigation.protect({ dirty: adventureSignature(saved) !== adventureSignature(next), busy: false });
      return next;
    });
  }
  async function save(next = draft) {
    if (!next || inFlight.current || navigation.actionBusy) return false;
    // Retain creation drafts even when client-side size validation rejects them.
    setDraft(next);
    if (adventureByteSize(next) > maxAdventureBytes) {
      setError('This adventure source exceeds the 200 KB limit. Shorten its notes or references before saving. Your draft is kept.');
      protect(false, adventureSignature(saved) !== adventureSignature(next));
      return false;
    }
    inFlight.current = true; setBusy(true); protect(true); setError(''); setMessage('');
    // Creation is also a draft: failed creation must leave the empty board editable.
    setDraft(next);
    let success = false;
    try {
      const adventure = await api(`/campaigns/${campaign.id}/adventure`, 'PUT', adventureSaveBody(next));
      if (live.current) { accept(adventure); protect(false, false); setMessage('Adventure source saved.'); success = true; }
    } catch (error) { if (live.current) { if (error.status === 409) refreshPolicy.current.markConflict(); setError(`${error.message} Your draft is kept. Reload the saved source before retrying if another edit was saved.`); protect(false, adventureSignature(saved) !== adventureSignature(next)); } }
    finally { inFlight.current = false; if (live.current) { setBusy(false); refreshPolicy.current.invalidate(); setChangesAvailable(refreshPolicy.current.changesAvailable); refreshQueue.current?.request(); } }
    return success;
  }
  return { draft, saved, loading, busy: busy || navigation.actionBusy, dirty, error, refreshError, retryRefresh: () => refreshQueue.current?.request(), message, changesAvailable, edit, save, load, reloadConfirm, setReloadConfirm };
}
