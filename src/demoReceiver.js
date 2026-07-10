// Optional local webhook target used only by test.http demonstrations.
const express = require('express');
const app = express();
app.use(express.json());

let flakyCalls = 0;
app.post('/success', (_req, res) => res.status(204).send());
app.post('/fail', (_req, res) => res.status(500).send('Temporary receiver failure'));
app.post('/gone', (_req, res) => res.status(410).send('This endpoint was permanently removed'));
app.post('/flaky', (_req, res) => {
  flakyCalls += 1;
  if (flakyCalls <= 2) return res.status(503).send(`Try again; local failure ${flakyCalls}`);
  return res.status(200).json({ received: true, attempt: flakyCalls });
});

app.listen(4000, () => console.log('Demo receiver listening on http://localhost:4000'));
