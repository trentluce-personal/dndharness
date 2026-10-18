// IndexedDB readwrite transactions serialize across tabs, including HTTP LAN.
// This stores only an in-flight marker, never a cookie or equivalent secret.
const recovery = 'Live browser setup is still pending in another tab. Wait and try again. If it stays blocked, close all tabs for this app, clear this site’s data in browser settings, enable site storage and cookies, then reopen it.';
const unsupported = 'Safe live browser setup is unavailable. Enable site storage and cookies, then reload in a browser with IndexedDB support.';

export function createInitializationStore(indexedDB) {
  let opening;
  function database() {
    if (!indexedDB) return Promise.reject(new Error(unsupported));
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open('dndharness-live-browser', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('initialization');
      request.onerror = () => reject(new Error(unsupported));
      request.onblocked = () => reject(new Error(unsupported));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return opening;
  }
  async function update(remove) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('initialization', 'readwrite');
      const store = transaction.objectStore('initialization');
      let claimed = false;
      if (remove) store.delete('in-flight');
      else {
        const request = store.get('in-flight');
        request.onsuccess = () => {
          if (request.result === undefined) {
            store.put(true, 'in-flight');
            claimed = true;
          }
        };
      }
      // Do not issue a cookie request until the claim transaction commits.
      transaction.oncomplete = () => resolve(claimed);
      transaction.onabort = transaction.onerror = () => reject(new Error(unsupported));
    });
  }
  return { claim: () => update(false), release: () => update(true) };
}

export function createBrowserCapabilityCoordinator({
  fetch: request = (...args) => globalThis.fetch(...args),
  store = createInitializationStore(globalThis.indexedDB),
  timeoutMs = 12000,
  pollMs = 150,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let pending;
  async function setup() {
    const deadline = now() + timeoutMs;
    // Abort is for bounding the caller only. It cannot prove that Set-Cookie
    // cannot arrive later, so an ambiguous failure NEVER releases the claim.
    const controller = new AbortController();
    let timer;
    const expired = new Promise((resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error(recovery)); }, timeoutMs);
    });
    let claimed = false;
    async function bootstrap(probe) {
      if (controller.signal.aborted) throw new Error(recovery);
      const response = await request('/api/live-browser', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(probe ? { probe: true } : {}), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Live browser setup failed.');
      return data.ready === true;
    }
    async function initialize() {
      if (await bootstrap(true)) return;
      while (now() < deadline && !controller.signal.aborted) {
        if (await store.claim()) {
          claimed = true;
          // A different tab might have finished between our probe and claim.
          if (!await bootstrap(true)) {
            await bootstrap(false);
            if (!await bootstrap(true)) throw new Error('Live browser cookies are blocked. Enable cookies and clear this site’s data before retrying.');
          }
          await store.release();
          claimed = false;
          return;
        }
        await sleep(pollMs);
        if (await bootstrap(true)) return;
      }
      throw new Error(recovery);
    }
    try {
      await Promise.race([initialize(), expired]);
    } catch (error) {
      if (claimed || controller.signal.aborted) throw new Error(recovery, { cause: error });
      throw error;
    } finally { clearTimeout(timer); }
  }
  return function ensureStableBrowser() {
    if (!pending) pending = setup().finally(() => { pending = undefined; });
    return pending;
  };
}

export const ensureStableBrowser = createBrowserCapabilityCoordinator();
