# 02 — `handleBookPlay`'s `restartFromZero` zeroes the DB chapter index but not the store

**What's wrong:** `src/helpers/handleBookPlay.ts:147` writes
`updateChapterIndexInDB(book.bookId, 0)` with **no matching store write**. Until
the first player event arrives, `playbackIndex[bookId]` still holds the previous
listen's chapter — and `chapterList` consults the store *first*, so it
highlights the chapter the Book was just rewound away from.

**Status:** ready-for-agent — see the Agent Brief at the bottom of this file.

**Blocked by:** `01-collapse-the-chapter-position-writes.md` — the fix calls
`setChapterIndex`, which exists only on ticket 01's branch and not on `main`.
Do not start until 01 has landed.

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

### It has been run

**2026-08-28 — observed, not merely argued.** A throwaway probe appended to
`handleBookPlay.test.ts`'s existing harness (its mocks and `finishedBook()`
fixture already set up the demote path) substituted a stateful stand-in store
seeded with `playbackIndex = { b1: 1 }`, took the `restartFromZero` path, and
asserted the store had reached `0`:

```
PROBE RESULT -> DB index: 0, store playbackIndex.b1: 1

● PROBE site F › leaves the store index at the previous listen while the DB row goes to 0
    Expected: 0
    Received: 1
```

So the drift is real and reproducible in the `helpers` lane: the DB row goes to
`0`, the store keeps `1`, and `chapterList` reads the store first.

The probe was **deleted rather than committed** — a red test on ticket 01's
branch would break its suite, and the assertion belongs to this ticket. Recreate
it from the steps above; it is ~25 lines appended to the existing describe
block, and no `fakePlayer` queue driving turned out to be necessary, because the
window under test is the one *before* any player event. Treat the
`fakePlayer` reference in this ticket's parent as satisfied by the stand-in
store: the mechanism is a missing store write, not a queue behaviour.

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

---

**2026-08-29 — triaged to `ready-for-agent`.**

> *This was generated by AI during triage.*

`wontfix` was reconsidered on the maintainer's read that the bug is rare and
hard to reach. That read is correct about **severity** and was not the deciding
axis. Two findings from re-tracing the code moved it:

- **The stale precondition is the normal finish, not an exotic one.** Book-end
  detection marks a Book `Finished` at *lead time*, a minute before the audio
  ends, and marks only — no seek, no pause. The store zeroing lives in
  `resetBookToStart`, which runs on `Event.PlaybackQueueEnded`. A listener who
  stops when the story ends rather than sitting through the credits therefore
  leaves `playbackIndex[bookId]` pointing at the last chapter of a `Finished`
  Book **as the default outcome**. What stays genuinely rare is only the
  same-session replay on top of it.
- **"Sub-second" assumes playback starts.** The correction is a player event.
  A queue that fails to load, or a pause before the first tick, leaves the
  drift for the rest of the session.

Against a two-line change into a helper that already exists, with the fixture
and mocks already in place, that is not enough to leave `handleBookPlay` as the
one index-write site that does not use the shared unit — which is exactly the
inconsistency that produced this drift shape twice.

**Verification.** Confirmed by code path on 2026-08-29, not by re-running the
2026-08-28 probe: `handleBookPlay` holds zero store references; `chapterList`
resolves its highlight store-first; `playbackIndex` is session-scoped with no
`persist` middleware; lead-time marking leaves the store stale. The mechanism
is real. The failing test is still to be written — it is the first acceptance
criterion.

## Agent Brief

**Category:** bug
**Summary:** Restarting a `Finished` Book from zero updates the persisted
chapter index but not the in-memory one, so the chapter list highlights the
chapter the Book was just rewound away from.

**Prerequisite:** this brief assumes `setChapterIndex` — the shared
store-plus-DB chapter-index write — is present. It is delivered by ticket 01
and does not exist on `main`. If it is absent, stop: this ticket is blocked,
not an invitation to inline the pair a fifth time.

**Current behavior:**
A Book's chapter index is held in two places: the Zustand library store's
`playbackIndex`, keyed by Book id, and the Book's persisted
`currentChapterIndex`. The chapter list resolves its highlight as
`storeIndex ?? persistedIndex ?? -1`, so the store is consulted first and the
persisted row is only a fallback for `undefined` — a stale store entry beats a
correct persisted one.

The play helper's restart-from-zero branch — taken when a `Finished` Book is
demoted back to Started on play — zeroes the persisted chapter index and the
persisted chapter progress, and writes nothing to the store. That helper writes
no store state anywhere. Until a player event arrives and rewrites it, the
store still holds the previous listen's chapter, and the chapter list
highlights it.

**Desired behavior:**
The restart-from-zero branch moves both halves of the chapter index together,
through the shared write, so the store and the persisted row agree the moment
the branch completes and before any player event is required. The chapter list
highlights the first chapter immediately.

The ordering the branch already protects is unchanged: both zeroing writes
still complete **before** playback is started, so the queue, the notification
and the floating player never observe a half-applied restart. The existing
comment explaining that ordering should survive, extended rather than replaced
if the store write makes it inaccurate.

**Key interfaces:**
- `setChapterIndex(bookId, index)` — the shared unit that writes the store half
  synchronously and then awaits the persisted half. The restart branch becomes
  its fifth caller, replacing the bare persisted-index write. Do not re-implement
  the pair inline; do not reorder its two halves.
- The chapter-**progress** write in the same branch stays exactly as it is: a
  direct persisted write, unpaired. There is deliberately no
  `setChapterProgress`, and this ticket must not create one.
- The restart branch's guard — Book was `Finished` **and** the demotion actually
  landed — is unchanged. The store write is conditional on the same guard, for
  the same reason: an unconsumed restart costs the user their whole listen.

**Acceptance criteria:**
- [ ] A test in the `helpers` lane that fails against today's play helper and
      passes after the change: with a store seeded to a non-zero chapter index
      for the Book, taking the restart-from-zero path leaves **both** the store
      index and the persisted index at `0`, with no player event delivered.
- [ ] The restart branch writes the chapter index via the shared
      `setChapterIndex` unit rather than the bare persisted write.
- [ ] Both zeroing writes still complete before playback starts.
- [ ] The chapter-progress axis is untouched — same call, same shape, no new
      shared unit for it.
- [ ] Every existing test for the play helper passes unchanged, and the full
      suite is green. Do not update an existing expectation to accommodate the
      change; if one breaks, that is a finding to report, not to absorb.
- [ ] `tsc` and `eslint` clean.

**Device pass:** in one session, finish a Book by stopping during the credits
(so the queue never ends), confirm it shows as Finished, then play it again and
open the chapter list. The first chapter is highlighted. Ticket 01's device
pass carries a warning about this collision — if that pass has already run and
observed the wrong highlight, that observation resolves here, and this pass
confirms the fix rather than re-discovering the bug.

**Out of scope:**
- Pairing the chapter-progress writes, here or anywhere. That needs its own
  argument; see ticket 01's rejection of the progress axis.
- The chapter-list tap handler, which writes the persisted chapter index with
  no store write of the same shape. It is very likely masked — the skip it
  performs fires a track-change event that writes the store — but ticket 01's
  survey never examined it, so it is neither confirmed safe nor in this ticket.
  File it separately if you look and it does drift.
- Changing how the store is constructed. `playbackIndex` staying session-scoped
  with no persistence is what bounds this bug; adding persistence is a
  different, larger decision.
- Changing book-end detection's lead-time marking, or making it zero the store.
