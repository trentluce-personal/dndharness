// Always target a separate database, never campaign data.
import pg from 'pg';
import { spawn } from 'node:child_process';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Run this in the API container.');
const target = new URL(process.env.DATABASE_URL);
target.pathname = '/dndharness_test';
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname='dndharness_test'");
  if (!exists.rowCount) await admin.query('CREATE DATABASE dndharness_test');
} finally { await admin.end(); }
const child = spawn(process.execPath, ['--test', '--test-concurrency=1', 'test/workflows.test.js', 'test/adventure.test.js'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: target.toString() },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
