import { randomBytes, randomUUID } from 'node:crypto';
import { pool, migrate, transaction } from './db.js';
import { hashPassword } from './auth.js';
import { sheet, campaignState } from './validation.js';

await migrate();
const password = randomBytes(12).toString('base64url');
try {
  await transaction(async (client) => {
    const exists = await client.query("SELECT 1 FROM users WHERE email IN ('dm@demo.test','player@demo.test')");
    if (exists.rowCount) throw new Error('Demo accounts already exist. No data changed.');
    const dmId = randomUUID(); const playerId = randomUUID(); const characterId = randomUUID(); const campaignId = randomUUID();
    const hash = await hashPassword(password);
    await client.query('INSERT INTO users(id,email,password_hash,display_name,bio) VALUES ($1,$2,$3,$4,$5),($6,$7,$3,$8,$5)', [dmId, 'dm@demo.test', hash, 'Demo · The Storykeeper', 'Fictional demo account.', playerId, 'player@demo.test', 'Demo · Rowan']);
    const characterSheet = sheet({ ancestry: 'Human', class: 'Ranger', level: 3, hp: 24, maxHp: 24, ac: 14, background: 'Wanderer', equipment: 'Longbow, travel cloak, a tarnished compass', notes: 'Fictional demo character. Looking for the lantern that never goes out.', abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 15, charisma: 11 } });
    await client.query('INSERT INTO characters(id,user_id,edition_id,name,sheet) VALUES ($1,$2,$3,$4,$5)', [characterId, playerId, 'dnd-5e-2024', 'Rowan Ashford', characterSheet]);
    const state = campaignState({ session: 2, location: 'The Lanternwood', summary: 'A village lantern has gone dark. The party follows a trail of silver leaves.', notes: 'Fictional demo campaign. A quiet forest, an old promise, and a missing light.' });
    await client.query('INSERT INTO campaigns(id,dm_id,edition_id,title,invite_code,state) VALUES ($1,$2,$3,$4,$5,$6)', [campaignId, dmId, 'dnd-5e-2024', 'Demo · The Last Lantern', randomBytes(8).toString('hex').toUpperCase(), state]);
    await client.query('INSERT INTO campaign_adventures(campaign_id,title) VALUES ($1,$2)', [campaignId, 'Demo · The Last Lantern']);
    const campaignSheet = { ...characterSheet, hp: characterSheet.maxHp };
    await client.query('INSERT INTO campaign_party(campaign_id,character_id,user_id,name,sheet) VALUES ($1,$2,$3,$4,$5)', [campaignId, characterId, playerId, 'Rowan Ashford', campaignSheet]);
    const snapshot = { version: 1, title: 'Demo · The Last Lantern', editionId: 'dnd-5e-2024', status: 'active', dm: { id: dmId, displayName: 'Demo · The Storykeeper' }, state, party: [{ characterId, userId: playerId, name: 'Rowan Ashford', displayName: 'Demo · Rowan', sheet: campaignSheet }] };
    await client.query('INSERT INTO campaign_saves(id,campaign_id,label,snapshot) VALUES ($1,$2,$3,$4)', [randomUUID(), campaignId, 'Demo · Into the Lanternwood', snapshot]);
  });
  console.log(`Fictional demo created. Accounts: dm@demo.test and player@demo.test\nGenerated password for both: ${password}\nKeep this locally; it is not stored in Git. Change it in Profile if you keep these accounts.`);
} finally { await pool.end(); }
