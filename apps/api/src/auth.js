import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';
import { fail } from './validation.js';

const scrypt = promisify(scryptCallback);
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [, salt, encoded] = stored.split(':');
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(encoded, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}
export const userColumns = 'id, email, display_name AS "displayName", real_name AS "realName", bio, created_at AS "createdAt"';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 7 * 86400000 };
export async function newSession(res, userId) {
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval \'7 days\')', [hashToken(token), userId]);
  res.cookie('dnd_session', token, cookieOptions);
}
export function sessionToken(req) {
  const match = (req.headers.cookie ?? '').match(/(?:^|;\s*)dnd_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1];
}
export function clearSession(res) { res.clearCookie('dnd_session', { ...cookieOptions, maxAge: undefined }); }
export async function authenticate(req, res, next) {
  const token = sessionToken(req);
  if (token) {
    const result = await pool.query(`SELECT ${userColumns} FROM users WHERE id=(SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now())`, [hashToken(token)]);
    req.user = result.rows[0] ?? null;
  } else req.user = null;
  next();
}
export function requireUser(req, res, next) {
  if (!req.user) fail('Log in to continue.', 401);
  next();
}
