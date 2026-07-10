# Smart Retry Queue

A lightweight webhook delivery system that never drops a message. Built with Node.js, Express, and SQLite — zero queue dependencies, zero magic, just reliable delivery with full audit logs.

## What it does

You send a webhook request. This service delivers it to the destination. If the destination is down, it retries — 10 seconds, 30 seconds, 2 minutes, 10 minutes. If it's still down after five attempts, the webhook moves to a dead-letter queue where you can inspect it and replay it later. Every single attempt is logged and timestamped.

## Features

- Reliable webhook delivery
- Automatic retry with exponential backoff
- Dead Letter Queue (DLQ)
- Replay failed deliveries
- SQLite persistence
- Delivery audit logs
- Graceful shutdown support
- Crash recovery
- Health check endpoint
- RESTful API

## Architecture at a glance

```
POST /webhooks/send
        │
        ▼
     PENDING
        │
        ▼
  Retry Scheduler
        │
        ▼
   HTTP Dispatcher
        │
 ┌──────┼──────────┐
 │      │          │
 ▼      ▼          ▼
2xx    5xx      Timeout
 │      │          │
 ▼      ▼          ▼
DELIVERED RETRYING RETRYING
               │
               ▼
          Max Retries
               │
               ▼
              DEAD
               │
               ▼
        POST /webhooks/:id/replay
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webhooks/send` | Queue a new webhook delivery |
| `GET` | `/webhooks/:id` | Get delivery details and attempt history |
| `GET` | `/webhooks/dead` | List all dead-letter deliveries |
| `POST` | `/webhooks/:id/replay` | Replay a dead delivery |
| `GET` | `/health` | Health check endpoint |

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

- Node.js
- Express.js
- SQLite
- UUID
- Axios

## Deployment Link 

`URL: ` {https://smart-retry-queue.onrender.com/}

## Live Demo

Base URL

```
https://smart-retry-queue.onrender.com
```

Health Check

```
GET https://smart-retry-queue.onrender.com/health
```

## Example Request

### Queue a Webhook

```http
POST /webhooks/send
Content-Type: application/json
```

```json
{
  "url": "https://webhook.site/YOUR-UNIQUE-ID",
  "payload": {
    "message": "Hello from Smart Retry Queue"
  }
}
```

Example Response

```json
{
  "message": "Delivery queued.",
  "delivery": {
    "id": "083c30d6-e720-41e3-aec6-aa571abca020",
    "status": "PENDING"
  }
}
```

### Check Delivery Status

```http
GET /webhooks/:id
```

Example Response

```json
{
  "status": "DELIVERED",
  "attempt_count": 1,
  "delivered_at": "2026-07-10T07:45:29.915Z"
}
```