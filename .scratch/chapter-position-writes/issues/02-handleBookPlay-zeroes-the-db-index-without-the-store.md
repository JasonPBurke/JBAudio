# 02 — `handleBookPlay`'s `restartFromZero` zeroes the DB chapter index but not the store

**What's wrong:** `src/helpers/handleBookPlay.ts:147` writes
`updateChapterIndexInDB(book.bookId, 0)` with **no matching store write**. Until
the first player event arrives, `playbackIndex[bookId]` still holds the previous
listen's chapter — and `chapterList` consults the store *first*, so it
highlights the chapter the Book was just rewound away from.

**Status:** needs-triage

**Found:** 2026-08-28, while resolving site F of
`01-collapse-the-chapter-position-writes.md`. That ticket required F to be
decided in writing rather than by omission, and offered two readings. **Reading
2 was selected**; this is the ticket it asks for.

## Why reading 2 and not reading 1

Reading 1 was "correct as-is — the store entry is about to be written by the
first progress tick, and writing it here is what would race." It does not
survive contact with the file:

- `handleBookPlay.ts` contains **zero** references to `useLibraryStore`,
  `setPlaybackIndex` or `setPlaybackProgress`. So there is no store write to
  race with. The comment above `:147` warns about racing *the first progress
  tick*, and that warning is about the **DB** write, which is why the DB write
  is placed before `play()`. It does not argue against a store write, which is
  synchronous, in-process, and cannot race a native callback that has not
  happened yet.
- `chapterList.tsx:56` resolves its highlight as
  `storeIndex ?? book.bookProgress?.currentChapterIndex ?? -1`. The store beats
  the DB. So a correct DB row does not rescue a stale store entry — the exact
  asymmetry that made ticket 01's index pairing a correctness property.

## The window, honestly

Both bounds matter, because they are what keeps this a low-severity ticket
rather than an urgent one.

**It cannot outlive the process.** `src/store/library.tsx` builds the store with
a plain `create<LibraryState>()(...)` — no `persist` middleware, no
AsyncStorage. `playbackIndex` is session-scoped, so after any app restart the
selector is `undefined` and `chapterList` correctly falls through to the DB row.
The drift is same-session only.

**It is normally sub-second.** `handleBookPlay` ends with `play()`, and
`progressUpdateEventInterval` is 1, so on the happy path the store is corrected
within ~1s:

- multi-file: `Event.PlaybackActiveTrackChanged` (site D) writes the store
- single-file: the first `handleProgressUpdated` tick (site A) writes it

**It persists indefinitely when the tick never comes** — a queue that fails to
load, playback that never starts, or a user who pauses before the first tick.
That is the case worth fixing.

**It is further gated.** `chapterList`'s `activeIndex` also returns `-1` unless
`activeBookId === book.bookId`. That narrows the blast radius to the currently
loaded Book — but `restartFromZero` is precisely the path making that Book
active, so the gate is open exactly when this fires.

## Reproducing it

`restartFromZero` is `wasFinished && demoted`, so the setup is: a Book marked
Finished that never reached `Event.PlaybackQueueEnded` (book-end detection
marks before the credits — see the lead-time work), so no `resetBookToStart`
ever zeroed its store entry, then demoted and replayed **in the same session**.

Suggested repro against `src/helpers/__tests__/fakePlayer.ts`, in the `helpers`
lane:

1. Seed `playbackIndex['b1'] = 1` in the real store (or assert on a spied
   `setPlaybackIndex`).
2. Call `handleBookPlay(finishedBook(), …)` with `getChapterProgressInDB`
   returning `{ chapterIndex: 1, progress: 300 }` and the demote path taken —
   `handleBookPlay.test.ts` already has this exact fixture and mock set.
3. Assert `updateChapterIndexInDB` was called with `('b1', 0)` — it is today.
4. Assert the store index is `0`. **This is the failing assertion.**
5. Do not deliver any player event. The point of the test is the window before
   the first tick, so `fakePlayer` is there to hold the queue still rather than
   to advance it.

⚠ The by-construction half of this (step 4 fails because the module never
writes the store) is established. The repro above is **specified, not yet
run** — writing and running it is this ticket's first task, so that the fix has
a red test to turn green.

## The fix, if it triages in

One line, and the home already exists — `src/helpers/setChapterIndex.ts`, built
by ticket 01 for exactly this pairing:

```ts
if (restartFromZero && book.bookId) {
  await setChapterIndex(book.bookId, 0);
  await updateChapterProgressInDB(book.bookId, 0);
}
```

That replaces the bare `updateChapterIndexInDB` call and makes F the fifth
caller of the shared unit.

⚠ **Do not reflexively pair the progress half too.** `setChapterProgress` does
not and should not exist — see `01`'s `## Considered and rejected: the progress
axis`. The store progress entry is stale here in the same way, but nothing
reads it in a way that beats a DB row into a *wrong* result, which is the whole
distinction. If the progress half is wanted, argue it separately.

## Acceptance criteria

- [ ] A `helpers`-lane test that fails on today's `handleBookPlay` and passes
      after the fix, per the repro above
- [ ] `restartFromZero` writes both halves of the chapter index via
      `setChapterIndex`
- [ ] The DB write still happens **before** `play()` — the ordering the
      existing comment at `:143`–`:146` protects is not disturbed
- [ ] The progress axis is untouched
- [ ] Existing `handleBookPlay.test.ts` cases still pass unchanged

## Comments

> *This was generated by AI during ticket 01's implementation.*

**2026-08-28 — filed, not fixed.** Ticket 01 explicitly forbids smuggling this
into its refactor: 01 claims *no behaviour change* and needs a device pass that
says so, and a state-write added to the play path is a behaviour change wearing
a refactor's clothes. So 01 shipped the helper and left F alone; this ticket
inherits the fix and the (much smaller) verification burden.

The alternative considered was `wontfix`: same-session only, normally
sub-second, no user report. Rejected because the indefinite case is real, the
fix is one line against a helper that now exists, and this is the *second* time
this exact drift shape has been found — which is the argument 01 itself was
built on.
