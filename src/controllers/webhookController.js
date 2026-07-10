const repository = require('../storage/webhookRepository');
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function validUrl(value) { try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } }
async function send(req, res, next) {
  try { const { url, payload, headers = {} } = req.body || {};
    if (!validUrl(url) || !isPlainObject(payload) || !isPlainObject(headers)) return res.status(400).json({ error: 'url must be http(s), and payload and headers must be JSON objects.' });
    return res.status(202).json({ message: 'Delivery queued.', delivery: await repository.createDelivery({ url, payload, headers }) });
  } catch (error) { next(error); }
}
async function getById(req, res, next) { try { const delivery = await repository.getDeliveryWithLogs(req.params.id); return delivery ? res.json(delivery) : res.status(404).json({ error: 'Delivery not found.' }); } catch (error) { next(error); } }
async function listDead(_req, res, next) { try { return res.json({ deliveries: await repository.listDeadDeliveries() }); } catch (error) { next(error); } }
async function replay(req, res, next) {
  try { const existing = await repository.getDeliveryById(req.params.id); if (!existing) return res.status(404).json({ error: 'Delivery not found.' }); if (existing.status !== 'DEAD') return res.status(409).json({ error: 'Only DEAD deliveries can be replayed.' }); return res.status(202).json({ message: 'Dead delivery replay queued.', delivery: await repository.replayDeadDelivery(req.params.id) }); } catch (error) { next(error); }
}
module.exports = { send, getById, listDead, replay };
