# 01 — A no-op remote Next still records a `chapter_change` footprint

**What to build:** `Event.RemoteNext` stops writing a footprint for a press that
changes nothing. The Footprints list stops showing chapter changes that never
happened.

**Status:** resolved

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

- [x] A remote Next press on the last chapter of a **multi-file** book records
      no `chapter_change` footprint, and playback is unchanged
- [x] A remote Next press that *does* change chapter still records one, with the
      pre-press position (not the post-skip position)
- [x] `RemotePrevious` left untouched by this ticket — it *does* write on a
      no-op (answer recorded in `## Scope`), and the skip-previous ticket is
      what fixes it
- [x] The multi-file vs single-file last-chapter asymmetry in `## Open
      questions` is answered in an `## Answer`, not left implicit in the diff
- [x] The single-file last-chapter case has a decided, documented `trigger_type`
- [x] Covered by a test in the `helpers` lane

## Answer

### Where the guard went

`resolveNextPress(book, treatAsSingleFile)` in `src/helpers/chapterSkip.ts`,
beside `skipToPreviousChapter`, with the press itself in
`src/helpers/remoteNext.ts` (`handleRemoteNextPress`). That file is now documented as the home for
**both** transport press decisions, because they are one question asked at
opposite ends of the Queue: *where in the Queue is this press happening?*
Neither native skip reports that it moved nothing, so both ends must ask.

It returns a four-way verdict and performs no action:

| verdict | shape | what the caller does |
| --- | --- | --- |
| `{ kind: 'chapter', seekSeconds }` | legacy single-file, a next chapter exists | footprint, then `seekTo` |
| `{ kind: 'skip' }` | chapter queue, a next queue item exists | footprint, then `skipToNext()` |
| `{ kind: 'finish' }` | legacy single-file, last chapter | mark Finished, footprint, reset, pause |
| `{ kind: 'none' }` | chapter queue, LAST queue item | **nothing at all** |

`Event.RemoteNext` (`src/setup/service.js`) now asks first and records second,
so the write is conditional on a branch that acts. The pre-press position is
still captured before any seek/skip, which is why the call could not simply be
moved below `skipToNext()`.

`treatAsSingleFile` is passed in rather than re-derived: whether a single-file
Book loads as one queue item or one item per chapter is the clipped-chapters
memory gate's call, and the service already holds that verdict. A clipped Book
is single-file in the DB and a chapter queue at runtime — the Queue decides and
its chapter list must not. A test pins that.

`undefined` from `getActiveTrackIndex()` means the index could not be READ, not
that it is the last item, so an unreadable index (or an empty `getQueue()`
read) takes the acting path. Same reasoning, and the same accepted residual, as
the previous side: a transient read failure at the true last item still writes
one footprint rather than silently swallowing a real press.

`recordRemoteChapterChangeFootprint` was left alone — the guard is about
*whether* the caller reaches it, so `remoteFootprints.ts` did not need a
competing copy of the shape, and
`.scratch/active-book-footprints/issues/01-*.md` can still rebase its call
sites onto this.

### Open question 1 — the single-file last-chapter branch's `trigger_type`

**Decided: `seek`, via the existing `recordRemoteSeekFootprint()`.** The branch
marks the Book finished, seeks to 0 and pauses — the press *does* leave a spot,
and it leaves the most perishable one in the app, since the reset that follows
destroys that position outright. So the breadcrumb is kept. But no chapter
changed, and `TRIGGER_LABELS` renders `chapter_change` as "Chapter changed",
which would be a false statement in the Footprints list. `seek` renders as
"Seeked from" and is true. `chapter_restart` was rejected: nothing restarts a
chapter there, the Book restarts.

### Open question 2 — the two Queue shapes disagree about Next-at-the-end

**Decided: the asymmetry stands, and this ticket does not close it.** The
acceptance criteria already settle it — a multi-file end press must leave
"playback unchanged" — so `{ kind: 'none' }` is a no-op and writes nothing,
while the single-file shape keeps finishing the Book. Making the multi-file
branch finish too would be a *new behaviour* on a user-facing press, not a
footprint fix, and it belongs with `02-remote-next-finish-branch-leaves-the-chapter-index-stale.md`,
which is already reworking what "finish and reset" means and has the device
fixtures for it. Recorded here so the next person finds the decision rather
than the silence. Natural playthrough still finishes both shapes via
`applyBookEndDecision` on the progress tick, so nothing is stranded meanwhile.

### What the two-axis review changed

The Standards axis found no hard violation of a documented standard (ADR 0003
clean — nothing new imports RNTP outside the adapter; correct test lane; CRLF
on `service.js` preserved). The Spec axis found the fix correct but its
**riskiest property untested**, and two ordering defects. All three were fixed
before commit:

1. **The record-before-act ordering had nothing pinning it.** `resolveNextPress`
   decides and never records, and `setup/service.js` has no test lane in either
   project — so the exact regression the ticket warns about ("⚠ Do **not**
   simply move the call below `skipToNext()`") would have stayed green. The
   press moved into `src/helpers/remoteNext.ts` as `handleRemoteNextPress`,
   following the `handleRemotePlayPause` precedent: the handler takes its two
   footprint recorders as injected callbacks, and `remoteNext.test.ts` asserts
   the **call order** across recorders and transport calls, not just that a
   recorder ran. This also gives ticket 02's finish-branch work a tested home
   to land in — it does not do that ticket's work.
2. **The finish branch recorded after the finished-mark.** A throw from
   `getBookById`/`updateBookProgress` would have cost the very breadcrumb this
   branch exists to preserve. The recorder now runs before the mark, and a test
   pins `seek_footprint → markFinished → seekTo → pause`.
3. **`recordRemoteSeekFootprint()` re-read the active Book** although the
   handler had `bookId` in hand — a Book switch racing the press would
   misattribute the footprint. It now takes an optional `bookId`, mirroring its
   sibling, and the call site passes it.

Accepted, not changed: the two press helpers keep different contracts
(`skipToPreviousChapter` decides *and* acts; the next side splits decide/act
across two modules) — the split is what made the ordering testable, and
collapsing them would undo finding 1. The two edge-of-queue checks are not
shared: the previous side needs no `getQueue()` read to know it is at index 0,
so a common helper would add a bridge round-trip to buy symmetry.

### Verification

- `src/helpers/__tests__/chapterSkip.next.test.ts` — 8 cases pinning the
  verdict; `src/helpers/__tests__/remoteNext.test.ts` — 6 cases pinning the
  ORDER and the no-op. Both in the `helpers` lane, both run against
  `support/fakePlayer.ts` (which models `skipToNext()` at the last item
  RESOLVING having moved nothing) rather than call spies.
- `npx tsc --noEmit` clean; `eslint` clean on every touched file.
- Full gate cold: **83 suites / 1027 tests passing** (81/1012 before).
- ⚠ **Device verification still pending** — reproduce on `Boundary Multi`
  (8 chapters, multi-item queue, prove the shape with `dumpsys media_session`
  queue size): press Next on Ch08, then confirm via `run-as` that the
  `footprints` table gained no row and the session stayed `PLAYING(3)` on
  Chapter 08.
