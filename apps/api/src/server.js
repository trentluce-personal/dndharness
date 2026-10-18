import { app } from './app.js';
import { pool, migrate } from './db.js';
import { closeRealtime } from './live-routes.js';

await migrate();
const server = app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => console.log('API listening on port ' + (process.env.PORT ?? 3001)));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  closeRealtime();
  server.close(async () => { await pool.end(); process.exit(0); });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
