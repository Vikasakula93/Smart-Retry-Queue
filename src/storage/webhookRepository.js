const { randomUUID } = require('node:crypto');
const { run, get, all } = require('../config/database');
const now = () => new Date().toISOString();
// sqlite3 has one connection here. This small promise chain keeps each multi-query
// log + state transition transaction together when several HTTP calls finish together.
let outcomeWriteQueue = Promise.resolve();

function parseDelivery(row) { return row && { ...row, payload: JSON.parse(row.payload), headers: JSON.parse(row.headers) }; }
async function createDelivery({ url, payload, headers }) {
  const timestamp = now(); const id = randomUUID();
  await run(`INSERT INTO deliveries (id,url,payload,headers,status,attempt_count,next_attempt_at,created_at,updated_at)
    VALUES (?,?,?,?, 'PENDING',0,?,?,?)`, [id, url, JSON.stringify(payload), JSON.stringify(headers || {}), timestamp, timestamp, timestamp]);
  return getDeliveryById(id);
}
async function getDeliveryById(id) { return parseDelivery(await get('SELECT * FROM deliveries WHERE id = ?', [id])); }
async function getDeliveryWithLogs(id) {
  const delivery = await getDeliveryById(id); if (!delivery) return null;
  const attempts = await all(`SELECT id,attempt_number,http_status,error_type,response_body,attempted_at FROM attempt_logs
    WHERE delivery_id=? ORDER BY attempt_number,attempted_at`, [id]);
  return { ...delivery, attempts };
}
async function listDeadDeliveries() { return (await all("SELECT * FROM deliveries WHERE status='DEAD' ORDER BY dead_at DESC")).map(parseDelivery); }
async function findDueDeliveryIds(limit) {
  const rows = await all(`SELECT id FROM deliveries WHERE status IN ('PENDING','RETRYING') AND next_attempt_at <= ?
    ORDER BY next_attempt_at LIMIT ?`, [now(), limit]); return rows.map((row) => row.id);
}
async function claimDueDelivery(id) {
  const timestamp = now();
  const result = await run(`UPDATE deliveries SET status='PROCESSING',processing_started_at=?,updated_at=?
    WHERE id=? AND status IN ('PENDING','RETRYING') AND next_attempt_at <= ?`, [timestamp, timestamp, id, timestamp]);
  return result.changes === 1 ? getDeliveryById(id) : null;
}
async function saveAttemptOutcome({ deliveryId, attemptNumber, httpStatus, errorType, responseBody, status, nextAttemptAt = null, deadReason = null }) {
  const work = async () => {
    const timestamp = now(); await run('BEGIN IMMEDIATE');
    try {
      await run(`INSERT INTO attempt_logs (id,delivery_id,attempt_number,http_status,error_type,response_body,attempted_at)
        VALUES (?,?,?,?,?,?,?)`, [randomUUID(), deliveryId, attemptNumber, httpStatus, errorType, String(responseBody || '').slice(0, 500), timestamp]);
      await run(`UPDATE deliveries SET status=?,attempt_count=?,next_attempt_at=?,processing_started_at=NULL,dead_reason=?,updated_at=?,
        delivered_at=CASE WHEN ?='DELIVERED' THEN ? ELSE delivered_at END, dead_at=CASE WHEN ?='DEAD' THEN ? ELSE dead_at END WHERE id=?`,
      [status, attemptNumber, nextAttemptAt || timestamp, deadReason, timestamp, status, timestamp, status, timestamp, deliveryId]);
      await run('COMMIT');
    } catch (error) { await run('ROLLBACK'); throw error; }
  };
  const result = outcomeWriteQueue.then(work, work);
  outcomeWriteQueue = result.catch(() => undefined);
  return result;
}
async function replayDeadDelivery(id) {
  const timestamp = now(); const result = await run(`UPDATE deliveries SET status='PENDING',attempt_count=0,next_attempt_at=?,
    processing_started_at=NULL,dead_reason=NULL,dead_at=NULL,updated_at=? WHERE id=? AND status='DEAD'`, [timestamp, timestamp, id]);
  return result.changes === 1 ? getDeliveryById(id) : null;
}
async function recoverProcessingDeliveries() {
  const timestamp = now(); const result = await run(`UPDATE deliveries SET status='PENDING',next_attempt_at=?,processing_started_at=NULL,
    updated_at=? WHERE status='PROCESSING'`, [timestamp, timestamp]); return result.changes;
}
module.exports = { createDelivery, getDeliveryById, getDeliveryWithLogs, listDeadDeliveries, findDueDeliveryIds, claimDueDelivery, saveAttemptOutcome, replayDeadDelivery, recoverProcessingDeliveries };
