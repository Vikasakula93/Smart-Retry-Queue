# Architecture

## Project structure

```
src/
  app.js                         — Express setup, error handler
  server.js                      — Boots the DB, starts the scheduler, shuts down       gracefully
  config/database.js             — SQLite connection + schema creation
  controllers/webhookController.js  — Validates input, sends responses
  routes/webhookRoutes.js        — Maps endpoints to controllers
  storage/webhookRepository.js   — Every database operation for deliveries and logs
  services/backoffService.js     — Calculates retry timing, enforces attempt limit
  workers/retryScheduler.js      — Polls, claims, dispatches with bounded concurrency
  workers/webhookDispatcher.js   — Sends HTTP POST, handles timeout, decides next state
```

## Data model 

Two tables, nothing fancy.

1. `deliveries` — URL, payload, headers, status, attempt count, next_attempt_at. That's it.
2. `attempt_logs` — Every execution, written once, never touched again. Immutable record.

The key index is `(status, next_attempt_at)` on deliveries. That's what makes the polling fast — the scheduler only touches rows that are actually due. The logs table has its own index for the status endpoint. Quick lookups, no table scans.


## Data flow

`Step by step:`

1. `POST /webhooks/send` — Validate the input, insert a PENDING record, due right now.
2. `Scheduler wakes up` — Queries only PENDING or RETRYING rows that are past their next_attempt_at. Respects the concurrency limit — won't grab more than it can handle.
3. `Claim the row` — A conditional UPDATE flips it to PROCESSING. If two workers picked up the same ID, only one wins. The other's update affects zero rows and moves on. No locks, no drama.
4. `Fire the request` — Native fetch, five-second timeout. If the other end is slow, we cut it off.
5. `Write the result` — The attempt log and the new delivery state go into a single SQLite transaction. Either both write or neither does. No partial state.


## Scheduler and restart safety

`Why it doesn't lose data on restart`

Timers are just a wake-up call. The database is the real boss.

On startup, every `PROCESSING` row gets reset to `PENDING` and marked as due immediately. If the process crashed while waiting for a response — doesn't matter. That delivery goes back in the queue and gets retried.

Since all state transitions run through a single SQLite connection, there's no risk of overlapping transactions. Five deliveries might finish at the same time, but the database serializes them. No corruption, no race conditions.

## Why it's fast

The dispatcher doesn't wait in line. Up to five deliveries can be waiting for external responses simultaneously. One slow endpoint can't hold up the others. They each get their own `fetch call`, their own timeout, their own outcome.

The architecture is simple because simple is hard to break. No queue libraries, no message brokers, no distributed locks. Just SQLite, `fetch`s, and a scheduler that knows when to get out of the way.
