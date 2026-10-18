import { randomUUID } from 'node:crypto';
import { pool, transaction } from './db.js';
import { fail, integer, text, uuid, campaignState } from './validation.js';
import { adventureColumns } from './adventure.js';
import { events } from './events.js';

export async function readCampaign(id, client = pool, lock = false) {
  const result = await client.query(`SELECT * FROM campaigns WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [uuid(id)]);
  if (!result.rowCount) fail('Campaign not found.', 404);
  return result.rows[0];
}

export async function campaignView(campaign, client) {
  const party = await client.query('SELECT character_id AS "characterId",name,sheet FROM campaign_characters WHERE campaign_id=$1 ORDER BY name,character_id', [campaign.id]);
  const source = await client.query('SELECT title,synopsis FROM campaign_adventures WHERE campaign_id=$1', [campaign.id]);
  return {
    id: campaign.id, title: campaign.title, editionId: campaign.edition_id,
    status: campaign.status, state: campaign.state, updatedAt: campaign.updated_at,
    revision: campaign.revision, party: party.rows, adventure: source.rows[0],
  };
}

export async function readAdventure(id, client) {
  return (await client.query(`SELECT ${adventureColumns} FROM campaign_adventures WHERE campaign_id=$1`, [id])).rows[0];
}

export async function recordHistory(client, campaign, label) {
  const view = await campaignView(campaign, client);
  const snapshot = {
    version: 2,
    campaign: { title: view.title, editionId: view.editionId, status: view.status },
    adventure: await readAdventure(campaign.id, client), state: view.state, party: view.party,
  };
  await client.query('INSERT INTO campaign_history(id,campaign_id,revision,label,snapshot) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), campaign.id, campaign.revision, label, snapshot]);
  return view;
}

// Lock the campaign before touching its source, sheets, checkpoints or history.
export async function mutateCampaign(id, expectedRevision, label, work) {
  const committed = await transaction(async (client) => {
    const campaign = await readCampaign(id, client, true);
    integer(expectedRevision, 'Expected revision', 1, 2147483646);
    if (campaign.revision !== expectedRevision) fail('This campaign changed elsewhere. Reload before saving.', 409);
    const result = await work(client, campaign);
    const changed = await client.query('UPDATE campaigns SET revision=revision+1,updated_at=now() WHERE id=$1 RETURNING *', [campaign.id]);
    const view = await recordHistory(client, changed.rows[0], label);
    return { view, result };
  });
  events.campaignChanged(committed.view);
  return committed;
}

export async function updateJournal(client, campaign, body) {
  const title = body.title === undefined ? campaign.title : text(body.title, 'Campaign title', 150, true);
  const state = body.state === undefined ? campaign.state : campaignState(body.state);
  const status = body.status === undefined ? campaign.status : body.status;
  if (!['active', 'archived'].includes(status)) fail('Invalid campaign status.');
  await client.query('UPDATE campaigns SET title=$1,state=$2,status=$3 WHERE id=$4', [title, state, status, campaign.id]);
}

// Historical JSON stays untouched in storage; expose only checkpoint content.
export function checkpointSnapshot(snapshot) {
  return {
    version: snapshot.version, title: snapshot.title, editionId: snapshot.editionId,
    status: snapshot.status, state: snapshot.state,
    party: snapshot.party.map(({ characterId, name, sheet }) => ({ characterId, name, sheet })),
  };
}

export async function replaceParty(client, id, party) {
  await client.query('DELETE FROM campaign_characters WHERE campaign_id=$1', [id]);
  for (const member of party) {
    // Preserve old sheet formats/current HP exactly rather than revalidating/upgrading history.
    await client.query('INSERT INTO campaign_characters(campaign_id,character_id,name,sheet) VALUES ($1,$2,$3,$4)', [id, member.characterId, member.name, member.sheet]);
  }
}

export async function restoreJournal(client, id, snapshot) {
  // These are immutable server-written records, not new user drafts. Do not
  // normalize historical text or drop fields from an older journal format.
  await client.query('UPDATE campaigns SET title=$1,state=$2,status=$3 WHERE id=$4', [snapshot.title, snapshot.state, snapshot.status, id]);
}

export async function consistentRead(work) {
  return transaction(async (client) => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    return work(client);
  });
}
