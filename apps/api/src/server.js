import { app } from './app.js';
import { pool, migrate } from './db.js';

await migrate();
await pool.query('DELETE FROM sessions WHERE expires_at < now()');
const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => console.log('API listening on port ' + (process.env.PORT ?? 3001)));
async function stop() { server.close(async () => { await pool.end(); process.exit(0); }); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
