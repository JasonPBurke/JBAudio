# 02 — `RemoteNext`'s finish branch resets position but not the chapter index

**What to build:** Pressing Next on the last chapter of a single-file Book leaves
the chapter list highlighting the last chapter, even though the Book has been
reset to the beginning. The two "reset to the start" paths stop disagreeing.

**Status:** resolved — code complete, **device test PENDING** (see below)

**Found:** 2026-08-27, on a physical Pixel 7 Pro, during ticket 10's
chapter-boundary device pass. Reported by the driver. Pre-existing; **not**
caused by the Player-seam migration — the finish branch never wrote the index.

## The problem

Two code paths both "finish the Book and reset it to the start", and only one of
them resets the chapter index.

**`Event.PlaybackQueueEnded`** (`src/setup/service.js:570`) — the natural
end-of-book path — resets all four pieces of state:

```js
setPlaybackProgress(trackToUpdate.bookId, 0);
setPlaybackIndex(trackToUpdate.bookId, 0);            // in-memory
await updateChapterProgressInDB(trackToUpdate.bookId, 0);
await updateChapterIndexInDB(trackToUpdate.bookId, 0); // persisted
```

**`Event.RemoteNext`'s last-chapter branch** (`src/setup/service.js:~488`) — the
deliberate press — resets only playback:

```js
const alreadyFinished = book?.bookProgressValue === BookProgressState.Finished;
if (!alreadyFinished) { ...updateBookProgress(BookProgressState.Finished); }
await seekTo(0);
await pause();
// no setPlaybackIndex, no updateChapterIndexInDB
```

`chapterList` resolves its highlight from `useLibraryStore.playbackIndex[bookId]`
and only falls back to `book.bookProgress?.currentChapterIndex` when that
selector is `undefined` — so a stale store entry wins over a correct DB row.

## Evidence — device

Book `Boundary End`, single-file, 3 auto-chapters (0:00 / 30:00 / 60:00–65:00),
one-item queue.

- **Via `RemoteNext` at the last chapter:** playback correctly reset — session
  went `PAUSED(2)` at `pos=0s`, `book_progress_value=2.0`, `finished_at` stamped
  — but **the chapter list still highlighted the last chapter.**
- **Via playing to the true end (`PlaybackQueueEnded`):** the chapter list reset
  correctly to chapter 1.

Same Book, same reset, two different outcomes.

## ⚠ One thing traced but NOT confirmed on the device

Whether the **persisted** `current_chapter_index` is also left stale. The code
says it must be — the branch has no `updateChapterIndexInDB` call — but the DB
read after the repro showed `current_chapter_index=0.0`, which is explained by
this Book having previously been reset through the `PlaybackQueueEnded` path in
the same session. **Confirm on a Book that has only ever been finished via a
remote Next press**, and note that if the DB is stale too the wrong highlight
survives an app restart, which is materially worse than an in-memory glitch.

⚠ A fixture for this needs a last chapter that can actually be seeked into — see
ticket 03's amended fixture recipe in `.scratch/player-seam/issues/`. A duration
that is an exact multiple of the auto-chapter interval leaves a ~58 ms final
chapter that cannot be reached.

## The fix, roughly

Reset the index in the finish branch the same way `PlaybackQueueEnded` does. The
two paths are now duplicating a four-line reset with one of the four missing,
which is what let them drift — prefer extracting a single
`resetBookToStart(bookId)` used by both over adding the two calls in a second
place.

Check `singleFileChapterState` too: `PlaybackQueueEnded` also resets
`lastChapterIndex` / `bookId`, and the remote branch does not.

## Related

Same handler, separate defect: a no-op remote Next still records a
`chapter_change` footprint — see `01-no-op-remote-next-records-a-chapter-change.md`.
A fix that restructures `RemoteNext` should address both together.

## Acceptance criteria

- [ ] After a remote Next press on the last chapter, the chapter list highlights
      chapter 1 — **device only** (E1)
- [ ] The persisted `current_chapter_index` is 0 after that press, verified on a
      Book never reset via `PlaybackQueueEnded` — **device only** (E2)
- [ ] The highlight is still correct after an app restart — **device only** (E3)
- [x] `PlaybackQueueEnded`'s behaviour is unchanged — the extracted helper is
      equivalent to the five lines it replaced
- [x] The shared reset has one home, not two copies — `helpers/resetBookToStart.ts`
- [x] Covered by a test in the `helpers` lane — `resetBookToStart.test.ts` (3) plus
      four new cases in `remoteNext.test.ts`

## The fix, as built

`src/helpers/resetBookToStart.ts` — `resetBookToStart(bookId, tracking)` does the
four state writes (store progress, store index, `updateChapterProgressInDB`,
`updateChapterIndexInDB`) **plus** the fifth piece the ticket asked us to check:
it rewinds `singleFileChapterState`. The detector is passed in rather than owned
because `handleProgressUpdated` reads and writes it on every tick.

Both callers now hold that one home:

- `Event.PlaybackQueueEnded`'s single-file branch (`service.js:~545`)
- `RemoteNext`'s finish branch, via `handleRemoteNextPress`, which takes the
  detector as a new `chapterTracking` field on `RemoteNextPress`

⚠ **The reset runs LAST in the remote branch — after `seekTo(0)` and `pause()` —
where `PlaybackQueueEnded` runs it first. That asymmetry is deliberate; do not
"align" them.** A 1 Hz progress tick can land on any `await` in the branch. After
the seek the Book really is at 0, so the worst a tick can do is write the same
zeroes. Resetting *first* would leave the detector at chapter 0 while `position`
is still in the last chapter, and that tick would write the stale index straight
back — re-opening this exact bug.

The call is wrapped in the same swallow the footprint recorders use: the press
has already been served by then, so a DB failure in the bookkeeping behind it
must not surface as a rejected handler.

## Device test — PENDING

Fixture: a **single-file** Book whose last chapter can actually be seeked into —
see ticket 03's amended fixture recipe in `.scratch/player-seam/issues/`. A
duration that is an exact multiple of the auto-chapter interval leaves a ~58 ms
final chapter that cannot be reached.

⚠ E2 is the criterion the original report could not settle: use a Book that has
**never** been finished via `PlaybackQueueEnded` in its life on the device, or
the DB row will read 0 for the wrong reason. A freshly scanned Book is the safe
choice.

| # | Steps | Before | After (expected) |
|---|---|---|---|
| E1 | Seek **into** the last chapter. Press **Next** on the notification player. Open the chapter list. | Highlight stuck on the **last** chapter. | Highlight on **chapter 1**. |
| E2 | On a Book never finished via `PlaybackQueueEnded`, repeat E1, then read `books.current_chapter_index`. | Stale (expected non-zero — unconfirmed in the original report). | `0.0`. |
| E3 | After E1, force-stop and reopen the app. Open the chapter list. | — | Still **chapter 1**. |
| E4 **guard** | Play a single-file Book to its true end (`PlaybackQueueEnded`). Open the chapter list. | Chapter 1. | Identical — this path is unchanged. |
| E5 **guard** | After E1, press **play**. Watch the Footprints list. | — | **No** spurious "Chapter changed" row at 0:00 — the detector was rewound with the index. |
| E6 **guard** | Re-run ticket 01's C1/C2 rows. | — | Identical; the footprint ordering is untouched. |

Reading the DB: use the `adb run-as` + WAL recipe in ticket 01's "Reading the DB"
section — the main file is a 4 KB stub without `-wal`/`-shm`, and there is no
`sqlite3` binary on device or host.

## Comments

**2026-08-28 — implemented, two-axis review run.**

Accepted and actioned:

- The reset call was left unwrapped while its comment promised it could not cost
  the user their press. Now goes through the recorders' swallow, renamed
  `record` → `withoutBlockingThePress` since it is no longer only recording.
  Covered by a new test.

Noted, deliberately **not** actioned — out of this ticket's scope:

- The same four-write shape survives at other sites in `service.js` (`:250`,
  `:553`, `:666`), differing only in the values. `resetBookToStart` is the
  zero-valued special case of a `setChapterPosition(bookId, index, position)`.
  Wider than "the shared reset has one home", so it is now its own ticket:
  **`.scratch/chapter-position-writes/issues/01-collapse-the-chapter-position-writes.md`**
  — which also records that two of those sites write half the shape on purpose,
  so it is not a mechanical extraction.
- `PlaybackQueueEnded`'s **multi-file** and fallback branches still never touch
  `singleFileChapterState`. Pre-existing, and correct-looking (the detector is
  for single-file Books), but the asymmetry is now more conspicuous sitting next
  to a helper that does rewind it.
- **Residual race, pre-existing and not closed by this fix:** `pause()` fires
  `Event.PlaybackState → Paused`, whose handler (`service.js:~592`) writes
  `updateChapterProgressInDB` from a fresh `getProgress()`. If that read lags the
  seek it can re-persist a non-zero *chapter progress* after our zero. The
  chapter **index** is unaffected, so E1–E3 still hold; but if E3 shows chapter 1
  highlighted with a non-zero position inside it, this is why.
