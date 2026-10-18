import { createRefreshQueue } from './campaignDrafts.js';

async function boundedRead(read, path, timeout, method, body) {
  let timer;
  try {
    return await Promise.race([
      read(path, method, body),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Session check timed out.')), timeout); }),
    ]);
  } finally { clearTimeout(timer); }
}

// Discovery must work on every workspace route, even with a healthy SSE stream
// that has no new events. Each detail read installs independently of its peers.
export function createMembershipDiscovery({ read, getEpoch, getDetails, onDirectory, install, remove, onError, interval = 30000, timeout = 15000, delay = 60 }) {
  const queue = createRefreshQueue(async (active) => {
    const epoch = getEpoch();
    const known = Object.keys(getDetails());
    const current = () => active() && epoch === getEpoch();
    try {
      const list = await boundedRead(read, '/live-sessions', timeout);
      if (!current()) return;
      onDirectory(list);
      const present = new Set(list.map(({ id }) => id));
      for (const id of known) if (!present.has(id)) remove(id);
      let failed = false;
      await Promise.all(list.map(async ({ id }) => {
        try {
          const detail = await boundedRead(read, `/live-sessions/${id}`, timeout);
          if (current()) install(detail);
        } catch (error) {
          if (!current()) return;
          if (error.status === 404) remove(id);
          else { failed = true; onError(error.message); }
        }
      }));
      if (current() && !failed) onError('');
    } catch (error) { if (current()) onError(error.message); }
  }, delay);
  // Fixed cadence bounds retries and avoids a failed-read/event feedback loop.
  const timer = setInterval(() => queue.request(), interval);
  queue.request();
  return { request: queue.request, dispose() { clearInterval(timer); queue.dispose(); } };
}

export function createMembershipHeartbeat({ read, getEpoch, getDetails, install, onMissing, onError, interval = 30000, timeout = 15000 }) {
  let active = true;
  const requests = new Set();
  async function renew(detail) {
    requests.add(detail.id);
    const epoch = getEpoch();
    try {
      const next = await boundedRead(read, `/live-sessions/${detail.id}/heartbeat`, timeout, 'POST', {});
      if (active && epoch === getEpoch() && getDetails()[detail.id]?.self.joined) {
        install(next);
        onError(detail.id, '');
      }
    } catch (error) {
      if (!active || epoch !== getEpoch()) return;
      if (error.status === 404) onMissing(detail.id);
      else onError(detail.id, `Presence could not be renewed: ${error.message}. Retrying every 30 seconds; membership expires after 5 minutes without renewal.`);
    } finally { requests.delete(detail.id); }
  }
  const request = () => {
    if (!active) return;
    for (const detail of Object.values(getDetails())) {
      if (detail.self.joined && !requests.has(detail.id)) renew(detail);
    }
  };
  const timer = setInterval(request, interval);
  return { request, dispose() { active = false; clearInterval(timer); } };
}
