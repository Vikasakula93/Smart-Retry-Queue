# AI tools and prompt diary

## Tool used

I used an AI coding assistant as a drafting tool and a second pair of eyes. Nothing more. Every decision in the final code was made by me — the AI helped me get there faster, but the assignment requirements were the final say. If the AI suggested something wrong, I caught it and fixed it.

## Prompts used

`Three prompts, three iterations, one solid outcome.`

1. “Create a beginner-friendly Node.js Express and SQLite webhook retry queue with persistent attempt logs, dead-letter support, replay, and a database polling scheduler. 
Do not use queue libraries.”

- This was the starting point. Gave the AI the full picture upfront — what I wanted, what I didn't want, and the level of simplicity I was aiming for.


2. “Review the scheduler for duplicate processing, restart recovery, timeout handling, and atomic state/log writes.”

- This is where the real work happened. I took the first draft and stress-tested it in my head. Did I ask the AI to check the things that would actually break? Yes. Did I verify the answers myself? Also yes. 

3. “Write concise assignment documentation explaining approach, architecture, persistence, concurrency, tradeoffs, and test requests.”

- The last step. Turn everything into something someone else can read and understand in five minutes.

## What needed correction or manual judgment

1. `In-memory setTimeout for retries`. The first draft suggested this. Looks clean in a demo. Dies the moment the process restarts. I threw it out and stored next_attempt_at in SQLite instead. The database doesn't forget when you crash.

2. `SELECT-then-UPDATE claiming`. Two workers read the same row, both think it's theirs, both try to process it. Classic race condition. The fix was a single conditional UPDATE — if it affects zero rows, the worker steps aside. No locks, no drama.

3. `Concurrent completion writes`. Multiple deliveries finishing at the same moment can overlap their database transactions. SQLite doesn't handle that well unless you force it. The fix was serializing state transitions through a single connection so they queue up instead of colliding.

4. `"Five attempts" ambiguity`. The spec says five attempts total. But with five backoff values, the fifth delay value technically never gets used if the delivery succeeds or dies on the fifth attempt. The code implements five total attempts and the documentation calls this out instead of hiding it. Honest, clear, intentional.

## What I'd tell another developer

The AI got me maybe 60% of the way there. The other 40% was knowing which suggestions to reject, which edge cases to test, and when to trust my own judgment over a confident-sounding answer. That's not something a prompt can replace.