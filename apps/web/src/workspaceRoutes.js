export const sections = [['sessions', 'Home', '/'], ['dice', 'Dice roller', '/dice']];

export function workspaceRoute(path) {
  if (path === '/' || path === '/sessions' || path === '/sessions/') return { section: 'sessions' };
  if (path === '/dice' || path === '/dice/') return { section: 'dice' };
  if (/^\/(campaigns|characters|profile)(\/|$)/.test(path)) return { section: 'legacy' };
  if (path === '/sessions/host' || path === '/sessions/host/') return { section: 'sessions', view: 'host' };
  const session = /^\/sessions\/([^/]+)\/?$/.exec(path);
  if (session) {
    try { return { section: 'sessions', id: decodeURIComponent(session[1]) }; }
    catch { return { section: 'missing' }; }
  }
  return { section: 'missing' };
}

export const characterUrl = (id) => `/characters/${encodeURIComponent(id)}`;
export const sessionUrl = (id) => `/sessions/${encodeURIComponent(id)}`;
export const campaignUrl = (id, view) => `/campaigns/${encodeURIComponent(id)}${['planning', 'progress', 'history'].includes(view) ? `/${view}` : ''}`;

export const campaignViews = [[undefined, 'Overview'], ['planning', 'Planning canvas'], ['progress', 'Party & journal'], ['history', 'Version history']];

export function workspaceBreadcrumbs({ section, id, view, name }) {
  if (section === 'table') return [];
  const labels = { sessions: 'Live sessions', campaigns: 'Campaigns', dice: 'Dice roller', legacy: 'Legacy destination', missing: 'Unavailable' };
  const items = [{ label: 'Home', href: '/' }, { label: labels[section] ?? 'Unavailable', href: `/${section}` }];
  if (section === 'sessions') {
    if (view === 'host') items.push({ label: 'Host a session' });
    else if (id) items.push({ label: name || 'Loading session…' });
  } else if (section === 'campaigns' && id) {
    items.push({ label: name || 'Loading campaign…', href: campaignUrl(id) });
    if (view) items.push({ label: campaignViews.find(([key]) => key === view)?.[1] ?? 'Unavailable' });
  }
  // Exactly one current leaf; parents always remain native navigable links.
  delete items[items.length - 1].href;
  return items;
}

export function interceptLink(event, anchor, origin) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return false;
  const url = new URL(anchor.href, origin);
  return url.origin === origin && !url.hash && workspaceRoute(url.pathname).section !== 'missing';
}

// Compare editable values, not sheet-format upgrades or object key order.
export function draftSignature({ name, editionId, sheet }, campaign = false) {
  const { version, hp, ...personal } = sheet;
  const sort = (value) => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])) : value;
  return JSON.stringify(sort({ name: name.trim(), editionId, sheet: campaign ? { ...personal, hp } : personal }));
}
