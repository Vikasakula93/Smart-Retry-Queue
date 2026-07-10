# Smart Retry Queue

A lightweight webhook delivery system that never drops a message. Built with Node.js, Express, and SQLite — zero queue dependencies, zero magic, just reliable delivery with full audit logs.

## What it does

You send a webhook request. This service delivers it to the destination. If the destination is down, it retries — 10 seconds, 30 seconds, 2 minutes, 10 minutes. If it's still down after five attempts, the webhook moves to a dead-letter queue where you can inspect it and replay it later. Every single attempt is logged and timestamped.

## Architecture at a glance

```
POST /webhooks/send  →  PENDING  →  PROCESSING  →  HTTP POST  
                                                      ↓  
                                          ┌──────┬──────┬──────┐  
                                        2xx    410   Timeout/5xx  
                                          ↓       ↓       ↓  
                                      DELIVERED  DEAD   RETRYING  
                                                          ↓  
                                                   Backoff & retry  
                                                          ↓  
                                                   After 5 → DEAD  
```

The scheduler polls every two seconds. SQLite is the source of truth — timers are just a wake-up mechanism.

## Project structure

```bash
src/
  app.js                         Express setup and error handler
  server.js                      Boots database, starts scheduler, graceful shutdown
  config/database.js             SQLite connection and schema
  controllers/webhookController.js  Input validation and HTTP responses
  routes/webhookRoutes.js        Endpoint mapping
  storage/webhookRepository.js   All delivery and log database operations
  services/backoffService.js     Retry timing and attempt limits
  workers/retryScheduler.js      Polling, claiming, bounded concurrent dispatch
  workers/webhookDispatcher.js   HTTP POST, timeout, state transitions
```


## Endpoints
| Method | Endpoint | What it does |  
|--------|----------|-------------|  
| `POST` | `/webhooks/send` | Accept a new webhook delivery request |  
| `GET` | `/webhooks/delivery/:id` | Check status and see all attempt logs |  
| `GET` | `/webhooks/dead-letter` | List all dead deliveries |  
| `POST` | `/webhooks/replay/:id` | Replay a dead delivery back into the queue |  

## Key design decisions

1. Why SQLite and not a queue library. SQLite is durable, needs zero setup, and makes restart recovery trivial. A queue library would add complexity without solving any real problem here.

2. How we prevent duplicate processing. Workers claim deliveries with a conditional SQL UPDATE. If two workers grab the same row, only one wins. The other moves on.

3. Why the queue survives crashes. On startup, any delivery stuck in PROCESSING gets reset to PENDING. The database never lies about what state a delivery is in.

4. The at-least-once problem. If the process crashes between the destination accepting the request and saving DELIVERED, that delivery retries. We send an x-delivery-id header so the receiver can deduplicate. Exactly-once delivery isn't possible with plain HTTP, and we don't pretend otherwise.

5. Retry timing. 10s → 30s → 2m → 10m → 30m. Five attempts total. The fifth attempt either succeeds or moves to dead — the 30m delay before it never actually fires, but it's kept in the config for clarity.

## Getting started
```bash
git clone <your-repo-url>
cd webhook-retry-queue
npm install
npm start
```
The server starts on port 3000. Use test.http or any HTTP client to send requests.

## What I'd add with more time

- Integration tests with a fake webhook receiver
Authentication on the replay endpoint
- Encryption for sensitive payload and header data
- Worker heartbeat mechanism for hung processes
- Metrics, structured logging, and paginated DLQ

## Built with
Node.js, Express, SQLite, and the kind of thinking that comes from breaking things and fixing them properly.

## Deployment Link 

`URL: ` {https://smart-retry-queue.onrender.com/}