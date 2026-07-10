const repository = require('../storage/webhookRepository');
const { dispatch } = require('./webhookDispatcher');
class RetryScheduler {
  constructor({ intervalMs = Number(process.env.POLL_INTERVAL_MS || 2000), concurrency = Number(process.env.MAX_CONCURRENT_DELIVERIES || 5) } = {}) { this.intervalMs = intervalMs; this.concurrency = concurrency; this.timer = null; this.isPolling = false; }
  async start() { const recovered = await repository.recoverProcessingDeliveries(); if (recovered) console.log(`Recovered ${recovered} interrupted delivery(s).`); await this.poll(); this.timer = setInterval(() => this.poll(), this.intervalMs); console.log(`Retry scheduler polling every ${this.intervalMs}ms.`); }
  async poll() {
    if (this.isPolling) return; this.isPolling = true;
    try { const ids = await repository.findDueDeliveryIds(this.concurrency); await Promise.allSettled(ids.map(async (id) => { const delivery = await repository.claimDueDelivery(id); if (delivery) await dispatch(delivery); })); }
    catch (error) { console.error('Retry scheduler error:', error); } finally { this.isPolling = false; }
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}
module.exports = { RetryScheduler };
