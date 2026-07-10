const { app } = require('./app');
const { initializeDatabase, databasePath } = require('./config/database');
const { RetryScheduler } = require('./workers/retryScheduler');
async function main() {
  await initializeDatabase(); const scheduler = new RetryScheduler(); await scheduler.start(); const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => console.log(`API listening on http://localhost:${port} (database: ${databasePath})`));
  const shutdown = () => { scheduler.stop(); server.close(() => process.exit(0)); }; process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
main().catch((error) => { console.error('Could not start application:', error); process.exit(1); });
