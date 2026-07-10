const express = require('express');
const webhookRoutes = require('./routes/webhookRoutes');
const app = express();
app.use(express.json({ limit: '1mb' }));

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'Smart Retry Queue API is running 🚀'
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/webhooks', webhookRoutes);
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Unexpected server error.' }); });
module.exports = { app };
