# 02 — `RemoteNext`'s finish branch resets position but not the chapter index

**What to build:** Pressing Next on the last chapter of a single-file Book leaves
the chapter list highlighting the last chapter, even though the Book has been
reset to the beginning. The two "reset to the start" paths stop disagreeing.

**Status:** ready-for-agent

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
      chapter 1
- [ ] The persisted `current_chapter_index` is 0 after that press, verified on a
      Book never reset via `PlaybackQueueEnded`
- [ ] The highlight is still correct after an app restart
- [ ] `PlaybackQueueEnded`'s behaviour is unchanged
- [ ] The shared reset has one home, not two copies
- [ ] Covered by a test in the `helpers` lane
