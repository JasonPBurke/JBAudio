# 01 — A no-op remote Next still records a `chapter_change` footprint

**What to build:** `Event.RemoteNext` stops writing a footprint for a press that
changes nothing. The Footprints list stops showing chapter changes that never
happened.

**Status:** ready-for-agent

**Found:** 2026-08-27, on a device, during ticket 10's chapter-boundary pass
(`.scratch/player-seam/issues/10-close-the-ban-and-verify-chapter-boundaries.md`).
Reported by the driver from the Footprints screen. Pre-existing; **not** caused
by the Player-seam migration.

## The problem

`src/setup/service.js:475`, in the `Event.RemoteNext` handler, records the
footprint **unconditionally, before** anything has decided whether a chapter
change will actually occur:

```js
subscribe(Event.RemoteNext, async () => {
  const bookId = await getActiveBookId();
  if (!bookId) { await skipToNext(); return; }

  // Awaited before the seek/skip to capture the pre-press spot.
  await recordRemoteChapterChangeFootprint(bookId);   // <-- always runs

  const book = useLibraryStore.getState().books[bookId];
  if (treatAsSingleFile(book) && book.chapters && book.chapters.length > 1) {
    ...                       // single-file: seek, or mark finished + reset
  } else {
    await skipToNext();       // multi-file: NO-OP at the last queue item
  }
});
```

Pressing Next on the **last chapter of a multi-file book** takes the `else`
branch. `skipToNext()` has no next queue item, so playback does not move — but a
`chapter_change` footprint has already been written.

Awaiting the write before the action is deliberate and correct (it captures the
pre-press spot). The bug is that it is not *conditional* on an action following.

## Evidence — device, not inference

Book `Boundary Multi`, 8 chapters x 70 s, multi-item queue (`queueTitle=null,
size=8` from `dumpsys media_session`). Rows from the app's own `footprints`
table, pulled via `run-as`:

```
21:04:10  chapter_change  chapter_index=6 (Ch07)  pos=61.3s   <- real change: Ch07 -> Ch08
21:04:24  chapter_change  chapter_index=7 (Ch08)  pos=14.1s   <- NO-OP: stayed on Ch08
```

The session's metadata read `Chapter 08` before and after the second press, and
`state` stayed `PLAYING(3)`. The footprint at 21:04:24 records a chapter change
that did not happen, and it appears in the Footprints list.

## Scope

- **`RemoteNext` is the defect.** One unconditional call site,
  `src/setup/service.js:475`.
- **`RemotePrevious` looks correct and is probably not affected**
  (`service.js:523`): it writes from an `onBeforeSkip` callback that
  `skipToPreviousChapter` only invokes *after* `getPreviousPressTarget` resolves
  a target and a kind (`src/helpers/chapterSkip.ts:56-61`). **Verify rather than
  assume** — confirm a press at the very start of chapter 1 records nothing.
- The in-app path cannot reach this: `SkipToNextButton` is exported from
  `src/components/PlayerControls.tsx:352` but has **zero render sites** in
  `src/`. The notification / Android Auto is the only skip-forward surface.

## The fix, roughly

Move the write so it happens only on a branch that acts. The pre-press spot must
still be captured *before* the seek/skip, so read the position first and write
after the branch commits — or give the `else` branch a guard that a next item
exists (`getQueue()` / `getActiveTrackIndex()`) and skip the write when it does
not.

⚠ Do **not** simply move the call below `skipToNext()`: that loses the pre-press
position the footprint exists to record.

## Open question

The single-file branch at the last chapter marks the book finished, seeks to 0
and pauses. That *is* a state change, so a footprint there is arguably correct —
but it is not a *chapter change*, and `chapter_change` may be the wrong
`trigger_type` for it. Decide deliberately; the `footprints.trigger_type` column
already carries `play`, `seek`, `chapter_change` and `chapter_restart`.

## Acceptance criteria

- [ ] A remote Next press on the last chapter of a **multi-file** book records
      no `chapter_change` footprint, and playback is unchanged
- [ ] A remote Next press that *does* change chapter still records one, with the
      pre-press position (not the post-skip position)
- [ ] `RemotePrevious` verified at the start of chapter 1 — states whether it
      writes on a no-op, with the answer recorded here
- [ ] The single-file last-chapter case has a decided, documented `trigger_type`
- [ ] Covered by a test in the `helpers` lane
