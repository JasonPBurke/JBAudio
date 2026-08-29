# 01 — The in-app next button never joined the extracted next-press decision

**What to build:** `SkipToNextButton` delegates to the same shared next-press
decision the notification player and Android Auto use, the way
`SkipToPreviousButton` already delegates to `skipToPreviousChapter`. Today it
carries a fourth, hand-rolled copy of that decision that has already drifted
from the extracted one in five separate ways.

**Status:** needs-triage

**Found:** 2026-08-29, in the whole-branch Standards review of the player seam
(branch `review/player-seam-full`, base `4b8fe75`), as finding 4. Pre-existing —
the seam work extracted the previous side and the remote next side, and left
this one behind.

**Not a live user-facing bug.** `SkipToNextButton` currently has **zero render
sites** (confirmed: `grep -rn SkipToNextButton src` returns only its own
definition and a comment in `remoteNext.ts:13` noting the fact). The driver has
ruled it is kept deliberately, for a future in-app skip-forward surface. That
ruling is what makes this worth fixing rather than deleting: the copy is
unrendered and untested, so it drifts silently and will be wrong on the day it
is finally wired up.

## The asymmetry

The previous side was extracted. `src/components/PlayerControls.tsx:323`:

```ts
export function SkipToPreviousButton({ iconSize = 30 }: PlayerButtonProps) {
  const handlePress = async () => {
    // Shared with the RemotePrevious handler in setup/service.ts: >15s into
    // a chapter restarts it, within the first 15s goes to the previous
    // chapter — notification, Android Auto and in-app behave identically.
    await skipToPreviousChapter();
  };
```

One line, one shared helper (`chapterSkip.ts:47`), an optional `onBeforeSkip`
callback that `service.ts:533` passes and the button deliberately does not.
That is the target shape.

The next side was not. `src/components/PlayerControls.tsx:343-383` still holds
the whole decision inline:

```ts
const queue = await getQueue();
const isSingleFile = queue.length === 1;

if (isSingleFile && book?.chapters && book.chapters.length > 1) {
  const { position } = await getProgress();
  const nextStart = getNextChapterStartSeconds(book.chapters, position);
  if (nextStart !== null) {
    await seekTo(nextStart);
  } else {
    // At last chapter: mark finished, reset and stop
    if (activeBookId) {
      const bookModel = await getBookById(activeBookId);
      if (bookModel) {
        await bookModel.updateBookProgress(BookProgressState.Finished);
      }
    }
    await seekTo(0);
    await pause();
  }
} else {
  await skipToNext();
}
```

Meanwhile the same decision lives, tested, in `chapterSkip.ts:166
resolveNextPress` (which returns `'chapter' | 'skip' | 'finish' | 'none'`) and
is executed by `remoteNext.ts:79 handleRemoteNextPress`, whose sole caller is
`service.ts:517`.

## How the copy has already drifted

Five differences, each traced against the extracted path:

1. **No `'none'` case.** `resolveNextPress` returns `{ kind: 'none' }` at the
   last queue item and `handleRemoteNextPress` returns early. The button calls
   `skipToNext()` unconditionally on that branch. Per the repo's own finding,
   `skipToNext()` at the queue edge is a **silent no-op that resolves** — so the
   button's else-branch cannot tell "moved" from "did nothing".

2. **It derives queue shape from `queue.length === 1`.** `resolveNextPress`
   takes `treatAsSingleFile` as a **parameter**, and `chapterSkip.ts:159`
   explains why at length: whether a single-file Book loads as one queue item or
   one item per chapter is the clipped-chapters memory gate's verdict, not the
   chapter list's. A clipped Book is single-file in the DB and a chapter queue at
   runtime. The button re-derives it from the one mechanism ADR 0003 explicitly
   defers to `.scratch/queue-shape/spec.md` as one of five competing answers.

3. **It records no footprints.** `handleRemoteNextPress` takes
   `onBeforeChapterChange` and `onBeforeLeaveBook`, awaited **before** the
   seek/skip, because a footprint is a breadcrumb to the spot the user left. An
   in-app next press would leave no breadcrumb while the identical notification
   press leaves one.

4. **Its finish branch still carries a bug that was already found and fixed on
   the remote side.** `remoteNext.ts:115-140` does three things the button does
   not:
   - guards the mark with `book?.bookProgressValue !== BookProgressState.Finished`,
     so a press inside the lead window does not rewrite an already-set
     `finished_at`;
   - calls `resetBookToStart(bookId, chapterTracking)` last — **this is exactly
     `.scratch/remote-noop-footprint/issues/02-*.md`**, whose symptom was "the
     chapter list highlights the last chapter of a Book that had just been reset
     to 0". The button reproduces the pre-fix code verbatim;
   - documents the ordering (reset LAST, deliberately) that the fix depends on.

5. **No failure isolation.** `remoteNext.ts:69 withoutBlockingThePress` wraps
   every bookkeeping call so a DB failure cannot cost the user the press. In the
   button, a throw from `getBookById` or `updateBookProgress` escapes
   `handlePress` and skips the `seekTo(0)` and `pause()` below it.

## Decisions the driver must make

- **Which module owns the shared next press.** The previous side put it in
  `chapterSkip.ts`; the next side's executor is in `remoteNext.ts`, whose name
  says "remote" and would then have a non-remote caller. Renaming it (or moving
  it to `chapterSkip.ts` beside its sibling) is the CONTEXT.md rule — *name a
  key after the question it answers* — applied to a module. Deciding this is
  most of the ticket.

- **How the button gets `treatAsSingleFile` and `chapterTracking`.** Both are
  module-private in `service.ts` (`:89` and `:94`); `singleFileChapterState` is
  mutable module state the service owns. The button cannot reach either today,
  and exporting service state to a component is very likely the wrong answer.

- **Whether the in-app press should record a footprint at all.** The previous
  side's answer was *no* — `SkipToPreviousButton` passes no callback, because
  footprints exist for presses the user makes when they cannot see the app.
  Same answer here would be consistent; it should be stated, not defaulted.

## Acceptance criteria

- [ ] `SkipToNextButton` contains no queue-shape branch, no
      `getNextChapterStartSeconds` call, and no finished-marking of its own.
- [ ] The next press has exactly **one** implementation of the
      `chapter`/`skip`/`finish`/`none` decision. `relativeSeek.ts:188`'s
      finish-a-Book triple is reviewed in the same pass and either folded in or
      explicitly justified as distinct.
- [ ] The button's finish path performs the `Finished` guard and the
      `resetBookToStart` rewind, so ticket `remote-noop-footprint/02`'s bug
      cannot come back through this door.
- [ ] The three decisions above are recorded in this file under `## Answer`.
- [ ] Tests cover the button's press through the shared helper. `fakePlayer.ts`
      already simulates the native seek clamp and queue-edge no-op, so the
      queue-edge case is assertable without a device.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green.

## Notes

- ⚠ **Do not delete `SkipToNextButton`.** Driver ruling, 2026-08-29: it is kept
  for a future in-app skip-forward surface.
- ⚠ **Do not "fix" the `queue.length === 1` question here.** That is
  `.scratch/queue-shape/spec.md`, still `needs-triage`, and ADR 0003 deliberately
  refuses to answer it inside the adapter. This ticket adopts whatever the
  extracted path already does and changes no verdicts.
- The device pass for this is cheap only once the button is rendered somewhere.
  Until then the acceptance gate is the test suite, not a device.
