export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function text(value, label, max = 200, required = false) {
  if (typeof value !== 'string') fail(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) fail(`${label} must contain ${required ? '1' : '0'}–${max} characters.`);
  return result;
}
export function integer(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail('Invalid ID.');
  return value;
}
export function email(value) {
  const result = text(value, 'Email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid email address.');
  return result;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128) fail('Password must contain 10–128 characters.');
  return value;
}
export function sheet(value, { campaign = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Character sheet is required.');
  if (value.version !== undefined && ![1, 2, 3].includes(value.version)) fail('Unsupported character sheet version.');
  const result = { version: 3 };
  for (const key of ['ancestry', 'class', 'background']) result[key] = text(value[key] ?? '', key, 120);
  for (const key of ['equipment', 'notes']) result[key] = text(value[key] ?? '', key, 10000);
  result.level = integer(value.level ?? 1, 'Level', 1, 100);
  result.maxHp = integer(value.maxHp ?? 10, 'Maximum HP', 1, 100000);
  if (campaign) {
    result.hp = integer(value.hp ?? result.maxHp, 'Current HP', 0, 100000);
    if (result.hp > result.maxHp) fail('Current HP cannot exceed maximum HP.');
  }
  if (value.inventory !== undefined) {
    const inventory = value.inventory;
    if (!inventory || !Array.isArray(inventory.items) || inventory.items.length > 200) fail('Equipment must contain no more than 200 items.');
    result.inventory = { items: inventory.items.map((item) => {
      if (!item || typeof item !== 'object') fail('Equipment item is required.');
      return { name: text(item.name, 'Item name', 200, true), quantity: item.quantity === null ? null : integer(item.quantity, 'Item quantity', 0, 100000), weight: text(item.weight ?? '', 'Item weight', 80) };
    }), coins: {} };
    for (const denomination of ['cp', 'sp', 'ep', 'gp', 'pp']) result.inventory.coins[denomination] = inventory.coins?.[denomination] == null ? null : integer(inventory.coins[denomination], `${denomination.toUpperCase()} coins`, 0, 1000000000);
  }
  result.ac = integer(value.ac ?? 10, 'Armor class', 0, 1000);
  result.speed = integer(value.speed ?? 30, 'Speed', 0, 10000);
  result.abilities = {};
  for (const key of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) {
    result.abilities[key] = integer(value.abilities?.[key] ?? 10, key, 1, 100);
  }
  if (value.details !== undefined) result.details = characterDetails(value.details);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 200000) fail('Character sheet must be smaller than 200 KB.');
  return result;
}
export function campaignState(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Campaign state must be an object.');
  return {
    session: integer(value.session ?? 1, 'Session number', 1, 100000),
    location: text(value.location ?? '', 'Location', 200),
    summary: text(value.summary ?? '', 'Summary', 2000),
    notes: text(value.notes ?? '', 'Campaign notes', 20000),
  };
}
import { characterDetails } from './character-details.js';
