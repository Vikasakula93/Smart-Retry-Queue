# Tradeoffs

## Persistence choice

SQLite fits this project perfectly. It's durable, needs zero setup, supports indexes and atomic writes, and restart recovery is straightforward. No Docker containers, no database server, no connection pools to tune.

But let's be honest — if this needed to scale across multiple servers handling thousands of deliveries per second, SQLite would be the wrong choice. Its writes are serialized, so it bottlenecks under heavy concurrent load. PostgreSQL would be the next step up. For this assignment though? SQLite is the right tool for the job, and knowing when not to over-engineer is part of the craft.


## Concurrency and correctness

The conditional claim update is the quiet hero of this project. When the scheduler wakes up and multiple workers grab the same due delivery, only one wins the UPDATE. The others get zero affected rows and move on. No locks, no distributed coordination, no drama.

I also capped parallel outgoing requests at five. One slow endpoint shouldn't hold up everything else.

Everything state-changing runs inside a transaction. If the attempt log gets written, the delivery status update gets written. There's no scenario where you have a log entry but the delivery status is stuck in limbo.

`The one thing I can't fully solve`. If the process crashes between the receiver accepting the request and the database saving DELIVERED, that delivery will be retried on restart. That's the at-least-once delivery problem. I can't fix it completely with plain HTTP, so I added an x-delivery-id header so the receiver can deduplicate on their end. It's an honest limitation, not a bug.

## Retry policy detail

I went with 10 seconds, 30 seconds, 2 minutes, 10 minutes, 30 minutes.

Here's where it gets tricky. If the rule says `Five failed attempts total,` that means there are only four gaps between attempts. The fifth attempt either succeeds or goes to dead — so the final 30-minute delay in the array never actually gets used. I kept it in the config anyway because it documents the intent, and if the requirement actually means `five retries after the first attempt,` you just bump MAX_ATTEMPTS to 6 and every delay fires. The code is ready either way, and I called this out in the docs instead of pretending it's not there.

## Improvements with more time

None of these are excuses — they're honest gaps I'd close if the deadline stretched.

- `Integration tests`. A local fake webhook receiver, automated end-to-end. Would catch regressions fast.
- `Authentication on replay`. Right now anyone who hits the endpoint can replay dead deliveries. That should be locked down with audit logging.
- `Encrypt sensitive fields`. Headers and payloads can contain credentials or personal data. At rest and in logs, they should be masked or encrypted.
- `Heartbeat for workers`. If a worker freezes mid-request without crashing, the current system won't detect it until something breaks. A lease mechanism would fix that.
- `Metrics and structured logs.` Right now it's just console output. Pagination on the DLQ endpoint, per-destination retry rules, structured logging — all nice-to-haves that would make this production-ready.
