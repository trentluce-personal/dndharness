import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. See README.md.');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function migrate() {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(840021)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(name, directory), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      console.log(`Applied migration ${name}`);
    }
  });
}
