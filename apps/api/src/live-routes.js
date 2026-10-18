import { Router } from 'express';
import { transaction } from './db.js';
import { readCampaign, campaignView } from './campaigns.js';
import { integer, fail, text } from './validation.js';
import { browserPrincipal, requireBrowserPrincipal, createLiveSessions } from './live-sessions.js';
import { events } from './events.js';

export const liveSessions = createLiveSessions({ publish: events.publish });
const unsubscribe = events.onCampaignChange((view) => liveSessions.campaignChanged(view));
export function closeRealtime() { unsubscribe(); liveSessions.close(); events.close(); }

export const liveRoutes = Router();
export function initializeLiveBrowser(req, res) {
  if (req.body.probe !== undefined && typeof req.body.probe !== 'boolean') fail('Probe must be a boolean.');
  res.json({ ready: !!browserPrincipal(req, res, req.body.probe !== true) });
}
liveRoutes.get('/', (req, res) => res.json(liveSessions.list()));
liveRoutes.post('/', async (req, res) => {
  const principal = requireBrowserPrincipal(req, res);
  const displayName = text(req.body.displayName, 'Display name', 100, true);
  if (!Object.hasOwn(req.body, 'campaignId')) {
    return res.status(201).json(liveSessions.createStandalone(req.body.title, principal, displayName));
  }
  const campaign = await transaction(async (client) => {
    const current = await readCampaign(req.body.campaignId, client, true);
    integer(req.body.expectedRevision, 'Expected revision', 1, 2147483646);
    if (current.revision !== req.body.expectedRevision) fail('This campaign changed elsewhere. Reload before hosting.', 409);
    if (current.status !== 'active') fail('Archived campaigns cannot host a new live session.');
    return campaignView(current, client);
  });
  // Synchronous registration after commit rechecks uniqueness and capacity.
  // Hosting never writes a revision, checkpoint or history entry.
  res.status(201).json(liveSessions.create(campaign, principal, displayName));
});
liveRoutes.get('/:id', (req, res) => res.json(liveSessions.detail(req.params.id, browserPrincipal(req, res))));
liveRoutes.post('/:id/join', (req, res) => res.json(liveSessions.join(req.params.id, requireBrowserPrincipal(req, res), req.body.displayName)));
liveRoutes.post('/:id/heartbeat', (req, res) => res.json(liveSessions.heartbeat(req.params.id, browserPrincipal(req, res))));
liveRoutes.post('/:id/leave', (req, res) => { liveSessions.leave(req.params.id, browserPrincipal(req, res)); res.json({ ok: true }); });
liveRoutes.post('/:id/end', (req, res) => { liveSessions.end(req.params.id, browserPrincipal(req, res)); res.json({ ok: true }); });
