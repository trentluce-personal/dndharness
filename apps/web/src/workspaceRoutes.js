export const sections = [['table', 'Home', '/'], ['characters', 'Characters', '/characters'], ['campaigns', 'Campaigns', '/campaigns'], ['dice', 'Dice roller', '/dice'], ['profile', 'Profile', '/profile']];

export function workspaceRoute(path) {
  const section = sections.find(([, , url]) => url === path);
  if (section) return { section: section[0] };
  const match = /^\/(characters|campaigns)\/([^/]+)(?:\/(planning|progress))?\/?$/.exec(path);
  if (!match) return { section: 'missing' };
  if (match[3] && match[1] !== 'campaigns') return { section: 'missing' };
  try { return { section: match[1], id: decodeURIComponent(match[2]), ...(match[3] ? { view: match[3] } : {}) }; }
  catch { return { section: 'missing' }; }
}

export const characterUrl = (id) => `/characters/${encodeURIComponent(id)}`;
export const campaignUrl = (id, view) => `/campaigns/${encodeURIComponent(id)}${['planning', 'progress'].includes(view) ? `/${view}` : ''}`;

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
