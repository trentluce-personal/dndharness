import express from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import { pool, transaction } from './db.js';
import { authenticate, requireUser, hashPassword, verifyPassword, newSession, sessionToken, hashToken, clearSession, userColumns } from './auth.js';
import { fail, text, uuid, email, password, sheet, campaignState } from './validation.js';

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const allowed = (process.env.APP_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',');
    if (req.headers.origin && !allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'This origin is not allowed.' });
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
app.get('/api/editions', async (req, res) => {
  const result = await pool.query('SELECT id,name,short_name AS "shortName",description,is_default AS "isDefault" FROM editions ORDER BY sort_order,id');
  res.json(result.rows);
});
app.use(authenticate);

// Bounded in-memory login throttle for this local single API process.
const attempts = new Map();
app.use('/api/auth', (req, res, next) => {
  if (!['/login', '/register'].includes(req.path)) return next();
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
  entry.count++;
  attempts.set(key, entry);
  if (entry.count > 40) return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
  next();
});
app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
app.post('/api/auth/register', async (req, res) => {
  const address = email(req.body.email);
  const secret = password(req.body.password);
  const name = text(req.body.displayName, 'Display name', 80, true);
  const result = await pool.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES ($1,$2,$3,$4) RETURNING ${userColumns}`, [randomUUID(), address, await hashPassword(secret), name]);
  await newSession(res, result.rows[0].id);
  res.status(201).json({ user: result.rows[0] });
});
app.post('/api/auth/login', async (req, res) => {
  const address = email(req.body.email);
  const secret = password(req.body.password);
  const result = await pool.query('SELECT * FROM users WHERE email=$1', [address]);
  // Do comparable password work for unknown accounts.
  const stored = result.rows[0]?.password_hash ?? `scrypt:00000000000000000000000000000000:${'00'.repeat(64)}`;
  if (!await verifyPassword(secret, stored) || !result.rowCount) fail('Email or password is incorrect.', 401);
  await newSession(res, result.rows[0].id);
  const user = await pool.query(`SELECT ${userColumns} FROM users WHERE id=$1`, [result.rows[0].id]);
  res.json({ user: user.rows[0] });
});
app.post('/api/auth/logout', async (req, res) => {
  const token = sessionToken(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]);
  clearSession(res);
  res.json({ ok: true });
});
app.use(requireUser);
app.patch('/api/profile', async (req, res) => {
  const values = [text(req.body.displayName, 'Display name', 80, true), text(req.body.realName ?? '', 'Real name', 120), text(req.body.bio ?? '', 'Bio', 1000), req.user.id];
  const result = await pool.query(`UPDATE users SET display_name=$1,real_name=$2,bio=$3 WHERE id=$4 RETURNING ${userColumns}`, values);
  res.json({ user: result.rows[0] });
});
app.post('/api/profile/password', async (req, res) => {
  const current = password(req.body.currentPassword);
  const next = password(req.body.newPassword);
  const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!await verifyPassword(current, result.rows[0].password_hash)) fail('Current password is incorrect.', 401);
  await transaction(async (client) => {
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(next), req.user.id]);
    await client.query('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
  });
  await newSession(res, req.user.id);
  res.json({ ok: true });
});

const characterColumns = 'id,user_id AS "userId",edition_id AS "editionId",name,sheet,updated_at AS "updatedAt"';
async function ensureEdition(id, client = pool) {
  const result = await client.query('SELECT id FROM editions WHERE id=$1', [text(id, 'Edition', 100, true)]);
  if (!result.rowCount) fail('Edition does not exist.');
}
app.get('/api/characters', async (req, res) => {
  const result = await pool.query(`SELECT ${characterColumns} FROM characters WHERE user_id=$1 ORDER BY updated_at DESC`, [req.user.id]);
  res.json(result.rows);
});
app.post('/api/characters', async (req, res) => {
  await ensureEdition(req.body.editionId);
  const result = await pool.query(`INSERT INTO characters(id,user_id,edition_id,name,sheet) VALUES ($1,$2,$3,$4,$5) RETURNING ${characterColumns}`, [randomUUID(), req.user.id, req.body.editionId, text(req.body.name, 'Character name', 100, true), sheet(req.body.sheet)]);
  res.status(201).json(result.rows[0]);
});
app.patch('/api/characters/:id', async (req, res) => {
  const result = await pool.query(`UPDATE characters SET name=$1,sheet=$2,updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING ${characterColumns}`, [text(req.body.name, 'Character name', 100, true), sheet(req.body.sheet), uuid(req.params.id), req.user.id]);
  if (!result.rowCount) fail('Character not found.', 404);
  res.json(result.rows[0]);
});

async function accessCampaign(id, userId, client = pool, dmOnly = false, lock = false) {
  const result = await client.query(`SELECT c.*,u.display_name AS dm_name FROM campaigns c JOIN users u ON u.id=c.dm_id WHERE c.id=$1 ${lock ? 'FOR UPDATE OF c' : ''}`, [uuid(id)]);
  const campaign = result.rows[0];
  if (!campaign) fail('Campaign not found.', 404);
  if (campaign.dm_id !== userId) {
    if (dmOnly) fail('Only the dungeon master can do that.', 403);
    const member = await client.query('SELECT 1 FROM campaign_party WHERE campaign_id=$1 AND user_id=$2', [id, userId]);
    if (!member.rowCount) fail('Campaign not found.', 404);
  }
  return campaign;
}
async function campaignView(campaign, client, viewerId) {
  const party = await client.query('SELECT p.character_id AS "characterId",p.user_id AS "userId",p.name,p.sheet,u.display_name AS "displayName" FROM campaign_party p JOIN users u ON u.id=p.user_id WHERE p.campaign_id=$1 ORDER BY p.name,p.character_id', [campaign.id]);
  return {
    id: campaign.id, title: campaign.title, editionId: campaign.edition_id,
    status: campaign.status, state: campaign.state, updatedAt: campaign.updated_at,
    dm: { id: campaign.dm_id, displayName: campaign.dm_name },
    ...(viewerId === campaign.dm_id ? { inviteCode: campaign.invite_code } : {}),
    party: party.rows,
  };
}
app.get('/api/campaigns', async (req, res) => {
  const result = await pool.query('SELECT c.*,u.display_name AS dm_name FROM campaigns c JOIN users u ON u.id=c.dm_id WHERE c.dm_id=$1 OR EXISTS (SELECT 1 FROM campaign_party p WHERE p.campaign_id=c.id AND p.user_id=$1) ORDER BY c.updated_at DESC', [req.user.id]);
  res.json(await Promise.all(result.rows.map((campaign) => campaignView(campaign, pool, req.user.id))));
});
app.post('/api/campaigns', async (req, res) => {
  await ensureEdition(req.body.editionId);
  const result = await pool.query('INSERT INTO campaigns(id,dm_id,edition_id,title,invite_code,state) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), req.user.id, req.body.editionId, text(req.body.title, 'Campaign title', 150, true), randomBytes(8).toString('hex').toUpperCase(), campaignState(req.body.state)]);
  res.status(201).json(await campaignView({ ...result.rows[0], dm_name: req.user.displayName }, pool, req.user.id));
});
app.get('/api/campaigns/:id', async (req, res) => {
  const campaign = await accessCampaign(req.params.id, req.user.id);
  res.json(await campaignView(campaign, pool, req.user.id));
});
app.patch('/api/campaigns/:id', async (req, res) => {
  const result = await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    const status = req.body.status ?? campaign.status;
    if (!['active', 'archived'].includes(status)) fail('Invalid campaign status.');
    await client.query('UPDATE campaigns SET title=$1,state=$2,status=$3,updated_at=now() WHERE id=$4', [text(req.body.title, 'Campaign title', 150, true), campaignState(req.body.state), status, campaign.id]);
    return campaignView(await accessCampaign(campaign.id, req.user.id, client), client, req.user.id);
  });
  res.json(result);
});
async function attachCharacter(client, campaign, characterId, ownerId) {
  if (campaign.status !== 'active') fail('Archived campaigns cannot accept characters.');
  const character = await client.query('SELECT * FROM characters WHERE id=$1 AND user_id=$2', [uuid(characterId), ownerId]);
  if (!character.rowCount) fail('Choose one of your own characters.', 404);
  const row = character.rows[0];
  if (row.edition_id !== campaign.edition_id) fail('Character and campaign must use the same edition.');
  await client.query('INSERT INTO campaign_party(campaign_id,character_id,user_id,name,sheet) VALUES ($1,$2,$3,$4,$5)', [campaign.id, row.id, ownerId, row.name, row.sheet]);
  await client.query('UPDATE campaigns SET updated_at=now() WHERE id=$1', [campaign.id]);
}
app.post('/api/campaigns/join', async (req, res) => {
  const code = text(req.body.inviteCode, 'Invite code', 32, true).toUpperCase();
  const result = await transaction(async (client) => {
    const found = await client.query('SELECT c.*,u.display_name AS dm_name FROM campaigns c JOIN users u ON u.id=c.dm_id WHERE invite_code=$1 FOR UPDATE OF c', [code]);
    if (!found.rowCount) fail('Invite code not found.', 404);
    await attachCharacter(client, found.rows[0], req.body.characterId, req.user.id);
    return campaignView(found.rows[0], client, req.user.id);
  });
  res.json(result);
});
app.post('/api/campaigns/:id/party', async (req, res) => {
  const result = await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    await attachCharacter(client, campaign, req.body.characterId, req.user.id);
    return campaignView(campaign, client, req.user.id);
  });
  res.json(result);
});
app.patch('/api/campaigns/:id/party/:characterId', async (req, res) => {
  const result = await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    const changed = await client.query('UPDATE campaign_party SET name=$1,sheet=$2 WHERE campaign_id=$3 AND character_id=$4', [text(req.body.name, 'Character name', 100, true), sheet(req.body.sheet), campaign.id, uuid(req.params.characterId)]);
    if (!changed.rowCount) fail('Party character not found.', 404);
    await client.query('UPDATE campaigns SET updated_at=now() WHERE id=$1', [campaign.id]);
    return campaignView(campaign, client, req.user.id);
  });
  res.json(result);
});
app.delete('/api/campaigns/:id/party/:characterId', async (req, res) => {
  await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    const changed = await client.query('DELETE FROM campaign_party WHERE campaign_id=$1 AND character_id=$2', [campaign.id, uuid(req.params.characterId)]);
    if (!changed.rowCount) fail('Party character not found.', 404);
    await client.query('UPDATE campaigns SET updated_at=now() WHERE id=$1', [campaign.id]);
  });
  res.json({ ok: true });
});
app.get('/api/campaigns/:id/saves', async (req, res) => {
  await accessCampaign(req.params.id, req.user.id);
  const result = await pool.query('SELECT id,label,created_at AS "createdAt",snapshot FROM campaign_saves WHERE campaign_id=$1 ORDER BY created_at DESC,id', [req.params.id]);
  res.json(result.rows);
});
app.post('/api/campaigns/:id/saves', async (req, res) => {
  const result = await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    const view = await campaignView(campaign, client, req.user.id);
    const snapshot = { version: 1, title: view.title, editionId: view.editionId, status: view.status, dm: view.dm, party: view.party, state: view.state };
    const saved = await client.query('INSERT INTO campaign_saves(id,campaign_id,label,snapshot) VALUES ($1,$2,$3,$4) RETURNING id,label,created_at AS "createdAt",snapshot', [randomUUID(), campaign.id, text(req.body.label, 'Save name', 150, true), snapshot]);
    return saved.rows[0];
  });
  res.status(201).json(result);
});
app.post('/api/campaigns/:id/saves/:saveId/restore', async (req, res) => {
  const result = await transaction(async (client) => {
    const campaign = await accessCampaign(req.params.id, req.user.id, client, true, true);
    const found = await client.query('SELECT snapshot FROM campaign_saves WHERE id=$1 AND campaign_id=$2', [uuid(req.params.saveId), campaign.id]);
    if (!found.rowCount) fail('Save not found.', 404);
    const snapshot = found.rows[0].snapshot;
    await client.query('UPDATE campaigns SET title=$1,state=$2,status=$3,updated_at=now() WHERE id=$4', [snapshot.title, snapshot.state, snapshot.status, campaign.id]);
    await client.query('DELETE FROM campaign_party WHERE campaign_id=$1', [campaign.id]);
    for (const member of snapshot.party) {
      await client.query('INSERT INTO campaign_party(campaign_id,character_id,user_id,name,sheet) VALUES ($1,$2,$3,$4,$5)', [campaign.id, member.characterId, member.userId, member.name, member.sheet]);
    }
    return campaignView(await accessCampaign(campaign.id, req.user.id, client), client, req.user.id);
  });
  res.json(result);
});
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (error.code === '23505') return res.status(409).json({ error: 'That account or party entry already exists.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
