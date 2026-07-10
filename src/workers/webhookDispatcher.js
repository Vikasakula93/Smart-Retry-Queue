const { saveAttemptOutcome } = require('../storage/webhookRepository');
const { MAX_ATTEMPTS, nextAttemptAtAfterFailure } = require('../services/backoffService');
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 5000);
const truncate = (value) => String(value || '').slice(0, 500);

async function dispatch(delivery) {
  const attemptNumber = delivery.attempt_count + 1;
  let httpStatus = null; let errorType = null; let responseBody = '';
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try { response = await fetch(delivery.url, { method: 'POST', headers: { ...delivery.headers, 'content-type': 'application/json', 'x-delivery-id': delivery.id }, body: JSON.stringify(delivery.payload), signal: controller.signal }); }
    finally { clearTimeout(timer); }
    httpStatus = response.status;
    try { responseBody = truncate(await response.text()); } catch { responseBody = ''; }
  } catch (error) { errorType = error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'; responseBody = truncate(error.message); }
  if (httpStatus >= 200 && httpStatus < 300) {
    await saveAttemptOutcome({ deliveryId: delivery.id, attemptNumber, httpStatus, errorType: null, responseBody, status: 'DELIVERED' }); return;
  }
  if (httpStatus === 410) {
    await saveAttemptOutcome({ deliveryId: delivery.id, attemptNumber, httpStatus, errorType: 'GONE', responseBody, status: 'DEAD', deadReason: 'Receiver returned 410 Gone' }); return;
  }
  const status = attemptNumber >= MAX_ATTEMPTS ? 'DEAD' : 'RETRYING';
  await saveAttemptOutcome({ deliveryId: delivery.id, attemptNumber, httpStatus, errorType: errorType || 'HTTP_ERROR', responseBody, status,
    nextAttemptAt: status === 'RETRYING' ? nextAttemptAtAfterFailure(attemptNumber) : null,
    deadReason: status === 'DEAD' ? `Failed ${MAX_ATTEMPTS} attempts` : null });
}
module.exports = { dispatch };
