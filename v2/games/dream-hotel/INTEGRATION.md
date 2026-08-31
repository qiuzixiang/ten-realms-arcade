# Dream Hotel v2 integration contract

`dream-hotel` is currently self-contained. Its return links resolve to `../../`
(`/v2/`) and it does not import anything from the 1.0 `shared/` directory.

## Private storage

Every local key starts with `ten-realms-v2:games:dream-hotel:`:

- `session:v1` — current puzzle, per-run ID, formal rooms, notes, history,
  cursor, time, and pending/delivered completion state;
- `settings:v1` — mute, difficulty and last level;
- `tutorial:v1` — first-entry tutorial acknowledgement;
- `records:v1` — compendium, ratings, achievements, earned reward IDs, and a
  bounded set of idempotently settled run outcomes.

Malformed values fall back to clean defaults. No 1.0 key is read, written or
removed.

## Completion

One solved run creates an immutable payload with schema
`ten-realms-v2/game-completion@1`. It includes:

`gameId`, `runId`, `levelId`, `difficulty`, `tier`, `puzzleSeed`, `moves`, `par`,
`elapsedMs`, `rating`, `oneStroke`, `noRework`, `roomTypes`, `rewardIds`,
`completedAt`, and `eventId`.

Delivery order is:

1. `window.TenRealmsV2.complete(payload)` when the future v2 shell provides it;
2. otherwise `window.RealmArcade.complete(payload)` for the current integration
   bridge;
3. otherwise append to `window.__realmCompletionQueue` (bounded to 100 items).

If either shared API throws, the same payload falls back to the in-page queue.
A completion remains pending in the private session until one of the shared
APIs accepts it; queue-only retention deliberately stays pending because that
queue does not survive a page reload. A pending solved session requeues or
retries after reload. Local records are settled by `runId`, so a retry replays
the original reward outcome without incrementing completion counts or the
compendium twice. After canonical API/queue retention, the page also dispatches
`ten-realms-v2:game-complete` as an observation-only `CustomEvent`; reward
consumers must not treat that mirror as a second completion channel.

Every restart or new puzzle receives a fresh `runId`. A victory's stable
`eventId` is `dream-hotel:${runId}:complete`; repeated publication of a retained
ID in one page lifetime is an idempotent no-op. `rewardIds` are stable and
stored before delivery. Because a page may stop after an API accepts an event
but before the delivered flag is saved, the future shell must deduplicate the
stable `eventId` across reloads. The deferred victory presentation is
generation-guarded so an old win cannot appear over a new puzzle or another
modal.

`difficulty` remains `easy | medium | hard`; `tier` is the reward-engine value
`1 | 2 | 3` respectively. `par` is the number of rooms in the solved floor.

## Host control API

The page registers `window.TenRealmsV2Games["dream-hotel"]` with API version 1:

- `getSnapshot()`
- `getRecords()`
- `openTutorial()`
- `setDifficulty("easy" | "medium" | "hard")`
- `newPuzzle()`

## Later `/v2/` shell work

The repository's current 1.0 build script intentionally copies only the root
site, `games/`, and `shared/`. When the v2 shell lands, it must copy and
precache `v2/`; this game should not be moved or rewritten for that step.
