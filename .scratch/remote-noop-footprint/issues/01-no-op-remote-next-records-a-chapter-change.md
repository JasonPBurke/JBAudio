# 01 — A no-op remote Next still records a `chapter_change` footprint

**What to build:** `Event.RemoteNext` stops writing a footprint for a press that
changes nothing. The Footprints list stops showing chapter changes that never
happened.

**Status:** ready-for-agent

**Depends on:**
`.scratch/skip-previous-first-chapter/issues/01-restart-book-at-first-queue-item.md`
— work that one first. It removes this ticket's `RemotePrevious` question
entirely rather than answering it; see `## Scope`.

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

**The invariant, stated once for both tickets:** a footprint is a breadcrumb
back to a spot the user left. If the press does not leave, there is no
breadcrumb. This ticket and the skip-previous ticket named under `**Depends
on:**` are the same violation of it at opposite ends of the Queue; the shared
cause is that **neither site asks where in the Queue it is** before committing.

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
- **`RemotePrevious` IS affected on multi-item Books — traced, not assumed.**
  The `onBeforeSkip` reasoning holds only for the **one-item** Queue shape:
  `getPreviousPressTarget` is reached exclusively inside the `if (queue.length
  === 1)` guard (`src/helpers/chapterSkip.ts:48`, call at `:56`). The
  multi-item branch (`chapterSkip.ts:73-83`) calls
  `notifyBeforeSkip('previous')` unconditionally
  and *then* `skipToPrevious()`, which is a silent no-op at index 0 — so a press
  at the very start of chapter 1 **does** write a footprint for a move that
  never happened. ⚠ Do not re-verify this on a one-item Book: that shape is
  genuinely clean and will tick the box wrongly. The native trace and the fix
  live in
  `.scratch/skip-previous-first-chapter/issues/01-restart-book-at-first-queue-item.md`,
  which dissolves it by making the press restart the Book — so no guard is
  needed on the previous side and **`RemotePrevious` is not in this ticket's
  scope at all.**
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

⚠ **Put the guard where the shape already lives, not inline in `service.js`.**
`recordRemoteChapterChangeFootprint` (`src/helpers/remoteFootprints.ts:40-55`)
is, in that ticket's own words, "the same shape already extracted" —
`.scratch/active-book-footprints/issues/01-collapse-the-active-book-footprint-shape.md`
censuses it. An inline guard here grows a competing copy beside it. ⚠ But do
**not** merge the two tickets either: that one is explicitly a *locality*
ticket whose `## Not in scope` bars "any change to what gets recorded, or
when", which is precisely what this ticket changes. Keep them separate and let
whichever lands second rebase its call sites onto the other.

## Open questions

**First: the trigger type of the single-file last-chapter branch.** It marks the
book finished, seeks to 0 and pauses. That *is* a state change, so a footprint
there is arguably correct — but it is not a *chapter change*, and
`chapter_change` may be the wrong `trigger_type` for it. Decide deliberately;
the `footprints.trigger_type` column already carries `play`, `seek`,
`chapter_change` and `chapter_restart`.

**Second: the two Queue shapes disagree about what Next-at-the-end means.**
Found while confirming this ticket against the skip-previous one; recorded here
because it decides the shape of the fix. `RemoteNext` on a **single-file**
Book's last chapter marks it Finished, seeks to 0 and pauses. On a
**multi-file** Book the `else` branch just calls `skipToNext()`, which does
nothing at the last queue item — no finish mark, no reset. Natural playthrough
still finishes both shapes via `applyBookEndDecision` on the progress tick
(`service.js:308-321`), so this affects only a deliberate press at the end; but
"Next at the end of the book" currently does two different things depending on
how the Book was authored. ⚠ Answer this **before** choosing where the guard
goes: if the multi-file branch ought to finish the Book too, then it is not a
no-op, and the footprint question changes from "suppress the write" to "label
the write correctly" — the same resolution the skip-previous ticket reaches on
its own side.

## Acceptance criteria

- [ ] A remote Next press on the last chapter of a **multi-file** book records
      no `chapter_change` footprint, and playback is unchanged
- [ ] A remote Next press that *does* change chapter still records one, with the
      pre-press position (not the post-skip position)
- [ ] `RemotePrevious` left untouched by this ticket — it *does* write on a
      no-op (answer recorded in `## Scope`), and the skip-previous ticket is
      what fixes it
- [ ] The multi-file vs single-file last-chapter asymmetry in `## Open
      questions` is answered in an `## Answer`, not left implicit in the diff
- [ ] The single-file last-chapter case has a decided, documented `trigger_type`
- [ ] Covered by a test in the `helpers` lane
