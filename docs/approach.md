## Approach

## Understanding the problem
A webhook system that never forgets. Every request comes in, gets delivered in the background, and every single outcome gets recorded. If the destination temporarily fails — it stays in the queue, safe. On a `200 OK`, we're done. On a `410 Gone`, we respect that and send it straight to the dead-letter queue — no point hammering an endpoint that told us to stop. And if the whole process crashes? The queue and every audit log survive. That's non-negotiable.

## How we get there

`The foundation`. Two SQLite tables — one for deliveries, one for attempt logs. Small, fast, persistent. No magic, just data that stays where it belongs.

`The logic stays clean`. Repository functions sit between the database and everything else. SQL doesn't leak into routes or worker code. That means when something breaks, you know exactly where to look.

`The endpoints`. Four Express routes. Simple, predictable, does what it says on the tin.

`The worker`. A polling scheduler. No queue package, no external dependencies — just `setInterval` doing a job every two seconds. Why? Because for this scope, a third-party queue is overkill. We keep control, we keep it simple, we keep it ours.

`The lock.` Every delivery gets claimed with a conditional SQL `UPDATE` — not a variable in memory, not a flag in JavaScript. The database is the source of truth. If the process dies mid-request, that delivery stays `PROCESSING` and gets reset on startup. No lost messages.

## The where we drew the line

1. An attempt is one HTTP POST. Straightforward.
2. Five failed attempts and it's dead. Not three (too aggressive), not ten (too slow). Five is the sweet spot.
3. Payload is JSON, headers are JSON. No guessing, no parsing surprises.
4. Everything except 2xx and 410 is retryable. Network timeout, DNS failure, 500 error — try again.
5. Timestamps are ISO-8601 UTC. Sort correctly in SQLite, readable in the API, no timezone confusion.

## The flow — start to end

A delivery starts as `PENDING`. The worker picks it up — it becomes `PROCESSING`. Then one of three things happens:

1. 2xx → `DELIVERED`. Done.
2. 410 Gone → `DEAD`. Respect the signal.
3. Anything else → `RETRYING.` Try again.
`RETRYING` goes back into the pool like `PENDING.` Same worker, same logic. After five failures, it lands in DEAD. Dead and delivered are terminal — unless an admin replays a dead one.

The worker fires immediately on startup, not after two seconds. Every two seconds after that. Small choice, but it means no delay on the first batch.