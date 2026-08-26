# 05 — Migrate helpers, stores and db onto the adapter

**What to build:** The tested core of the app talks to the Player through the
adapter instead of reaching for the library by name. Seeking, chapter skip,
book play, restore, playback rate, remote play/pause, footprints and player
setup all behave exactly as before — proven by the 81 tests that already cover
them.

**Blocked by:** 02, 04

**Status:** ready-for-agent

## Why this batch first

It is the batch with the strongest safety net. Ten test files and 81 tests sit
directly on this code, and they assert on the **landing spot** — where playback
ends up — rather than on which calls were made. If a call moves rather than
being redirected, these tests say so.

CI stays green batch to batch because the old form still exists: files not yet
migrated keep importing the library directly until ticket 08 forbids it.

## The change — two mechanical edits, nothing else

- A direct library call becomes the same call imported from the adapter.
- Fetching the active item and reading `?.bookId` off it becomes a single
  active-Book read.

⚠ **The null shape changes** from `undefined` to `null` on that read. Truthiness
guards are unaffected; a strict `=== undefined` comparison is not. Grep for one
before assuming there are none.

## Test expectations

Expect **close to a zero-line diff** under `__tests__/`. The fake stays *below*
the adapter, so the existing module mock still intercepts and existing call
assertions still pass — the call now arrives one frame deeper.

⚠ **A test that breaks here is signal, not chores.** It means a call moved
rather than being redirected. Investigate before editing it.

Do **not** write a suite for the adapter. It is covered transitively by these
81 tests, and a suite asserting that a passthrough passes through would test the
implementation rather than any behaviour.

## Acceptance criteria

- [ ] No file under helpers, stores or db imports the Player library directly
- [ ] The active-Book read replaces every fetch-item-then-take-bookId in this
      batch
- [ ] `__tests__/` diff is empty, or every changed line is explained in this
      file under `## Answer`
- [ ] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [ ] The persistence module keeps asking the Player where it is — see ticket
      08's note; do not fix that here
