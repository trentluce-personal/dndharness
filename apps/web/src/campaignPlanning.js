import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export const pointKinds = { story: 'Story', location: 'Location', encounter: 'Encounter', npc: 'NPC' };
export const maxPoints = 100;
export const maxAdventureBytes = 200000;
export const adventureTitle = (campaign) => campaign.adventure?.title ?? campaign.title;
export const adventureSynopsis = (campaign) => campaign.adventure?.synopsis ?? '';

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
  const { revision, ...content } = adventure;
  return JSON.stringify(sort(content));
}

export function adventureSaveBody(adventure) {
  return { ...adventure };
}

export function adventureByteSize(adventure) {
  return new TextEncoder().encode(JSON.stringify(adventureSaveBody(adventure))).byteLength;
}

// The source is saved as a whole, independently of the existing party journal.
export function useCampaignAdventure({ campaign, enabled, navigation, onUpdate }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadConfirm, setReloadConfirm] = useState(false);
  const live = useRef(false);
  const inFlight = useRef(false);
  const dirty = adventureSignature(saved) !== adventureSignature(draft);
  function protect(nextBusy = busy, nextDirty = dirty) {
    navigation.protect({ dirty: nextDirty, busy: nextBusy || navigation.actionBusy });
  }
  useEffect(() => {
    live.current = true;
    if (enabled) load();
    return () => { live.current = false; navigation.protect({ dirty: false, busy: false }); };
  }, [campaign.id, enabled]);
  useEffect(() => { if (enabled) protect(busy || inFlight.current); }, [dirty, busy, enabled, navigation.actionBusy]);

  function accept(adventure) {
    setSaved(adventure); setDraft(adventure);
    onUpdate({ ...campaign, adventure: { title: adventure.title, synopsis: adventure.synopsis } });
  }
  async function load() {
    if (inFlight.current || navigation.actionBusy) return;
    inFlight.current = true; setLoading(true); setBusy(true); protect(true); setError(''); setMessage('');
    try {
      const adventure = await api(`/campaigns/${campaign.id}/adventure`);
      if (live.current) { accept(adventure); protect(false, false); setReloadConfirm(false); }
    } catch (error) { if (live.current) setError(error.message); }
    finally { inFlight.current = false; if (live.current) { setLoading(false); setBusy(false); } }
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
    if (adventureByteSize(next) > maxAdventureBytes) {
      setError('This adventure source exceeds the 200 KB limit. Shorten its notes or references before saving. Your draft is kept.');
      return false;
    }
    inFlight.current = true; setBusy(true); protect(true); setError(''); setMessage('');
    // Creation is also a draft: failed creation must leave the empty board editable.
    setDraft(next);
    let success = false;
    try {
      const adventure = await api(`/campaigns/${campaign.id}/adventure`, 'PUT', adventureSaveBody(next));
      if (live.current) { accept(adventure); protect(false, false); setMessage('Adventure source saved.'); success = true; }
    } catch (error) { if (live.current) { setError(`${error.message} Your draft is kept. Reload the saved source before retrying if another edit was saved.`); protect(false, adventureSignature(saved) !== adventureSignature(next)); } }
    finally { inFlight.current = false; if (live.current) setBusy(false); }
    return success;
  }
  return { draft, saved, loading, busy: busy || navigation.actionBusy, dirty, error, message, edit, save, load, reloadConfirm, setReloadConfirm };
}
