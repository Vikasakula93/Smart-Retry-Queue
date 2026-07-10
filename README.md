# Smart Retry Queue

Persistent webhook delivery with exponential-backoff retries, an audit log, and a dead-letter queue.

## Run

```bash
npm install
npm start
```

The server starts on `http://localhost:3000`. Copy `.env.example` to `.env` only if you want to change configuration; otherwise the defaults work.

Use `test.http` with the VS Code REST Client extension. `npm run check` performs a syntax check of every source file.

For a fully local receiver, open a second terminal and run `node src/demoReceiver.js`. For a quick dead-letter demonstration only, start the main app with `BACKOFF_DELAYS_MS=1000,1000,1000,1000,1000 npm start`; do not use that override in the normal configuration.

## Important behavior

- A successful 2xx response becomes `DELIVERED` immediately.
- A `410 Gone` becomes `DEAD` immediately.
- Other responses and network/timeout failures are retried until five total failed attempts, then become `DEAD`.
- Every attempt is persisted in SQLite; response text is limited to 500 characters.
- On startup, deliveries left in `PROCESSING` by a crash are returned to `PENDING` for recovery.

See `docs/` for the design explanation and `test.http` for demonstrations.
