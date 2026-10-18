import { ensureStableBrowser } from './browserCapability.js';

export async function api(path, method = 'GET', body) {
  if (method.toUpperCase() === 'POST' && (/^\/live-sessions\/?$/i.test(path) || /^\/live-sessions\/[^/]+\/join\/?$/i.test(path))) await ensureStableBrowser();
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error ?? 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
