const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const databasePath = path.resolve(process.env.DATABASE_PATH || './data/retry-queue.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new sqlite3.Database(databasePath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (error) {
    if (error) return reject(error);
    resolve({ lastID: this.lastID, changes: this.changes });
  }));
}
function get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (e, row) => e ? reject(e) : resolve(row))); }
function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows))); }

async function initializeDatabase() {
  await run('PRAGMA foreign_keys = ON');
  await run('PRAGMA journal_mode = WAL');
  await run(`CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY, url TEXT NOT NULL, payload TEXT NOT NULL, headers TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'PROCESSING', 'RETRYING', 'DELIVERED', 'DEAD')),
    attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, processing_started_at TEXT,
    dead_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, delivered_at TEXT, dead_at TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS attempt_logs (
    id TEXT PRIMARY KEY, delivery_id TEXT NOT NULL, attempt_number INTEGER NOT NULL, http_status INTEGER,
    error_type TEXT, response_body TEXT NOT NULL DEFAULT '', attempted_at TEXT NOT NULL,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_deliveries_due ON deliveries(status, next_attempt_at)');
  await run('CREATE INDEX IF NOT EXISTS idx_attempt_logs_delivery ON attempt_logs(delivery_id, attempted_at)');
}
module.exports = { db, run, get, all, initializeDatabase, databasePath };
