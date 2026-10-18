// Revision belongs to the loaded draft, not to the latest campaign response.
export function journalSaveBody({ title, state, status, revision }, label) {
  return { title, state, status, expectedRevision: revision, ...(label === undefined ? {} : { label }) };
}

export function mergeCanonicalCampaign(campaigns, saved) {
  const canonical = new Map();
  for (const campaign of [...campaigns, saved]) {
    canonical.set(campaign.id, newerCampaign(canonical.get(campaign.id), campaign));
  }
  return [...canonical.values()].sort((a, b) => {
    const updated = (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
    return updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

// Recheck this policy after a fetch, not just before it: typing can start while
// the request is in flight. Captured revisions are part of a protected draft.
export function canRefreshDraft({ dirty, busy, confirmation, editor }) {
  return !dirty && !busy && !confirmation && !editor;
}

export function newerCampaign(current, incoming) {
  return !current || incoming.revision >= current.revision ? incoming : current;
}

// Writes acknowledge only their own revision. Only a canonical refresh started
// after the latest invalidation may settle it. Keep this outside React state so
// responses resolving in the same render turn still compare monotonically.
export function createRevisionRefreshPolicy(initialRevision = 0) {
  let installed = initialRevision, known = initialRevision, generation = 0, pending = false;
  return {
    invalidate(revision = 0) { generation++; known = Math.max(known, revision); pending = true; },
    observe(revision) { known = Math.max(known, revision); if (known > installed) pending = true; },
    ticket() { return generation; },
    install(revision, refreshTicket) {
      known = Math.max(known, revision);
      if (revision < installed) return false;
      installed = revision;
      if (refreshTicket !== undefined && refreshTicket === generation && revision >= known) pending = false;
      if (known > installed) pending = true;
      return true;
    },
    get pending() { return pending; },
  };
}

// Serial, trailing refreshes: a burst coalesces, but an invalidation received
// during a request always gets a fresh request after that request settles.
export function createRefreshQueue(work, delay = 60) {
  let timer, running = false, pending = false, disposed = false;
  async function run() {
    timer = undefined;
    if (disposed || running) return;
    running = true;
    do {
      pending = false;
      try { await work(() => !disposed); } catch { /* work owns visible errors */ }
    } while (pending && !disposed);
    running = false;
  }
  return {
    request() { if (disposed) return; pending = true; if (!running && !timer) timer = setTimeout(run, delay); },
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
