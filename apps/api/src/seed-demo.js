import { randomUUID } from 'node:crypto';
import { pool, migrate, transaction } from './db.js';
import { sheet, campaignState } from './validation.js';
import { recordHistory, checkpointSnapshot } from './campaigns.js';

await migrate();
try {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(840022)');
    const title = 'Demo · The Last Lantern';
    if ((await client.query('SELECT 1 FROM campaigns WHERE title=$1', [title])).rowCount) throw new Error('Demo campaign already exists. No data changed.');
    const campaignId = randomUUID();
    const state = campaignState({ session: 2, location: 'The Lanternwood', summary: 'A village lantern has gone dark. The party follows a trail of silver leaves.', notes: 'Fictional demo campaign. A quiet forest, an old promise, and a missing light.' });
    const created = await client.query('INSERT INTO campaigns(id,edition_id,title,state) VALUES ($1,$2,$3,$4) RETURNING *', [campaignId, 'dnd-5e-2024', title, state]);
    await client.query('INSERT INTO campaign_adventures(campaign_id,title) VALUES ($1,$2)', [campaignId, title]);
    const characterSheet = sheet({ ancestry: 'Human', class: 'Ranger', level: 3, maxHp: 24, ac: 14, background: 'Wanderer', equipment: 'Longbow, travel cloak, a tarnished compass', notes: 'Fictional demo character. Looking for the lantern that never goes out.', abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 15, charisma: 11 } }, { campaign: true });
    await client.query('INSERT INTO campaign_characters(campaign_id,character_id,name,sheet) VALUES ($1,$2,$3,$4)', [campaignId, randomUUID(), 'Rowan Ashford', characterSheet]);
    const view = await recordHistory(client, created.rows[0], 'Demo campaign created');
    await client.query('INSERT INTO campaign_saves(id,campaign_id,label,snapshot) VALUES ($1,$2,$3,$4)', [randomUUID(), campaignId, 'Demo · Into the Lanternwood', checkpointSnapshot({ version: 1, ...view })]);
  });
  console.log('Fictional demo campaign created. Open Demo · The Last Lantern in Campaigns.');
} finally { await pool.end(); }
