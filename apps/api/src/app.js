import express from 'express';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.js';
import { fail, text, uuid, sheet, campaignState } from './validation.js';
import { adventure, adventureColumns } from './adventure.js';
import { readCampaign, campaignView, readAdventure, recordHistory, mutateCampaign, updateJournal, checkpointSnapshot, replaceParty, restoreJournal, consistentRead } from './campaigns.js';
import { allowedOrigins, hostingInfo } from './origins.js';
import { events } from './events.js';
import { liveRoutes, initializeLiveBrowser } from './live-routes.js';

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const path = req.path.toLowerCase();
  if (path === '/api' || path.startsWith('/api/')) {
    if (req.headers.origin !== undefined && !allowedOrigins.includes(req.headers.origin)) return res.status(403).json({ error: 'This origin is not allowed.' });
    if (req.method === 'POST' && (path.replace(/\/$/, '') === '/api/live-browser' || path === '/api/live-sessions' || path.startsWith('/api/live-sessions/')) && !allowedOrigins.includes(req.headers.origin)) return res.status(403).json({ error: 'An allowed Origin is required for live session actions.' });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Use application/json.' });
  }
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'A JSON object is required.' });
  next();
});
app.get('/api/health', async (req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); });
app.get('/api/hosting', (req, res) => res.json(hostingInfo()));
app.get('/api/events', events.connect);
app.post('/api/live-browser', initializeLiveBrowser);
app.use('/api/live-sessions', liveRoutes);
app.get('/api/editions', async (req, res) => {
  const result = await pool.query('SELECT id,name,short_name AS "shortName",description,is_default AS "isDefault" FROM editions ORDER BY sort_order,id');
  res.json(result.rows);
});
app.get('/api/campaigns', async (req, res) => {
  res.json(await consistentRead(async (client) => {
    const campaigns = await client.query('SELECT * FROM campaigns ORDER BY updated_at DESC,id');
    const views = [];
    for (const campaign of campaigns.rows) views.push(await campaignView(campaign, client));
    return views;
  }));
});
app.post('/api/campaigns', async (req, res) => {
  const result = await transaction(async (client) => {
    const editionId = text(req.body.editionId, 'Edition', 100, true);
    if (!(await client.query('SELECT 1 FROM editions WHERE id=$1', [editionId])).rowCount) fail('Edition does not exist.');
    const title = text(req.body.title, 'Campaign title', 150, true);
    const created = await client.query('INSERT INTO campaigns(id,edition_id,title,state) VALUES ($1,$2,$3,$4) RETURNING *', [randomUUID(), editionId, title, campaignState()]);
    await client.query('INSERT INTO campaign_adventures(campaign_id,title) VALUES ($1,$2)', [created.rows[0].id, title]);
    return recordHistory(client, created.rows[0], 'Campaign created');
  });
  events.campaignChanged(result);
  res.status(201).json(result);
});
app.get('/api/campaigns/:id', async (req, res) => {
  res.json(await consistentRead(async (client) => campaignView(await readCampaign(req.params.id, client), client)));
});
app.patch('/api/campaigns/:id', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Campaign updated', (client, campaign) => updateJournal(client, campaign, req.body));
  res.json(view);
});
app.get('/api/campaigns/:id/adventure', async (req, res) => {
  res.json(await consistentRead(async (client) => {
    const campaign = await readCampaign(req.params.id, client);
    return { ...await readAdventure(campaign.id, client), campaignRevision: campaign.revision };
  }));
});
app.put('/api/campaigns/:id/adventure', async (req, res) => {
  const { result, view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Adventure updated', async (client, campaign) => {
    const { expectedRevision, campaignRevision, ...source } = req.body;
    const draft = adventure(source);
    const current = await readAdventure(campaign.id, client);
    if (current.revision !== draft.revision) fail('This campaign image changed elsewhere. Reload before saving.', 409);
    const changed = await client.query(`UPDATE campaign_adventures SET revision=revision+1,title=$1,synopsis=$2,storyline=$3,dm_guidance=$4,canvas=$5 WHERE campaign_id=$6 RETURNING ${adventureColumns}`, [draft.title, draft.synopsis, draft.storyline, draft.dmGuidance, draft.canvas, campaign.id]);
    return changed.rows[0];
  });
  res.json({ ...result, campaignRevision: view.revision });
});
app.post('/api/campaigns/:id/characters', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Character added', async (client, campaign) => {
    if (campaign.status !== 'active') fail('Archived campaigns cannot accept characters.');
    await client.query('INSERT INTO campaign_characters(campaign_id,character_id,name,sheet) VALUES ($1,$2,$3,$4)', [campaign.id, randomUUID(), text(req.body.name, 'Character name', 100, true), sheet(req.body.sheet, { campaign: true })]);
  });
  res.status(201).json(view);
});
app.patch('/api/campaigns/:id/characters/:characterId', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Character updated', async (client, campaign) => {
    const found = await client.query('SELECT name,sheet FROM campaign_characters WHERE campaign_id=$1 AND character_id=$2', [campaign.id, uuid(req.params.characterId)]);
    if (!found.rowCount) fail('Campaign character not found.', 404);
    const name = req.body.name === undefined ? found.rows[0].name : text(req.body.name, 'Character name', 100, true);
    const changedSheet = req.body.sheet === undefined ? found.rows[0].sheet : sheet(req.body.sheet, { campaign: true });
    await client.query('UPDATE campaign_characters SET name=$1,sheet=$2 WHERE campaign_id=$3 AND character_id=$4', [name, changedSheet, campaign.id, req.params.characterId]);
  });
  res.json(view);
});
app.delete('/api/campaigns/:id/characters/:characterId', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Character deleted', async (client, campaign) => {
    const changed = await client.query('DELETE FROM campaign_characters WHERE campaign_id=$1 AND character_id=$2', [campaign.id, uuid(req.params.characterId)]);
    if (!changed.rowCount) fail('Campaign character not found.', 404);
  });
  res.json(view);
});
const historyColumns = 'id,revision,label,created_at AS "createdAt"';
app.get('/api/campaigns/:id/history', async (req, res) => {
  await readCampaign(req.params.id);
  res.json((await pool.query(`SELECT ${historyColumns} FROM campaign_history WHERE campaign_id=$1 ORDER BY revision DESC`, [req.params.id])).rows);
});
app.get('/api/campaigns/:id/history/:historyId', async (req, res) => {
  await readCampaign(req.params.id);
  const found = await pool.query(`SELECT ${historyColumns},snapshot FROM campaign_history WHERE campaign_id=$1 AND id=$2`, [req.params.id, uuid(req.params.historyId)]);
  if (!found.rowCount) fail('Version not found.', 404);
  res.json(found.rows[0]);
});
app.post('/api/campaigns/:id/history/:historyId/restore', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Version restored', async (client, campaign) => {
    const found = await client.query('SELECT snapshot FROM campaign_history WHERE campaign_id=$1 AND id=$2', [campaign.id, uuid(req.params.historyId)]);
    if (!found.rowCount) fail('Version not found.', 404);
    const snapshot = found.rows[0].snapshot;
    await restoreJournal(client, campaign.id, { ...snapshot.campaign, state: snapshot.state });
    await client.query('UPDATE campaigns SET edition_id=$1 WHERE id=$2', [snapshot.campaign.editionId, campaign.id]);
    const source = snapshot.adventure;
    await client.query('UPDATE campaign_adventures SET revision=revision+1,title=$1,synopsis=$2,storyline=$3,dm_guidance=$4,canvas=$5 WHERE campaign_id=$6', [source.title, source.synopsis, source.storyline, source.dmGuidance, source.canvas, campaign.id]);
    await replaceParty(client, campaign.id, snapshot.party);
  });
  res.json(view);
});
app.get('/api/campaigns/:id/saves', async (req, res) => {
  await readCampaign(req.params.id);
  const found = await pool.query('SELECT id,label,created_at AS "createdAt",snapshot FROM campaign_saves WHERE campaign_id=$1 ORDER BY created_at DESC,id', [req.params.id]);
  res.json(found.rows.map((save) => ({ ...save, snapshot: checkpointSnapshot(save.snapshot) })));
});
app.post('/api/campaigns/:id/saves', async (req, res) => {
  const { view, result } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Checkpoint saved', async (client, campaign) => {
    await updateJournal(client, campaign, req.body);
    const current = await campaignView(await readCampaign(campaign.id, client), client);
    const snapshot = checkpointSnapshot({ version: 1, ...current });
    const saved = await client.query('INSERT INTO campaign_saves(id,campaign_id,label,snapshot) VALUES ($1,$2,$3,$4) RETURNING id,label,created_at AS "createdAt",snapshot', [randomUUID(), campaign.id, text(req.body.label, 'Save name', 150, true), snapshot]);
    return saved.rows[0];
  });
  res.status(201).json({ ...result, campaign: view });
});
app.post('/api/campaigns/:id/saves/:saveId/restore', async (req, res) => {
  const { view } = await mutateCampaign(req.params.id, req.body.expectedRevision, 'Checkpoint restored', async (client, campaign) => {
    const found = await client.query('SELECT snapshot FROM campaign_saves WHERE id=$1 AND campaign_id=$2', [uuid(req.params.saveId), campaign.id]);
    if (!found.rowCount) fail('Save not found.', 404);
    const snapshot = found.rows[0].snapshot;
    await restoreJournal(client, campaign.id, snapshot);
    await replaceParty(client, campaign.id, snapshot.party);
  });
  res.json(view);
});
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ error: 'That campaign entry already exists.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
