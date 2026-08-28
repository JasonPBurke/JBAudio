# 01 — Skip-previous does nothing at the first chapter of a multi-item Book

**What to build:** A skip-previous press inside the first 15 seconds of the first
Chapter of a multi-item Book restarts the Book, the way the same press already
does on a one-item Book. Today it silently does nothing — and records a footprint
saying it did something.

**Status:** resolved

**Found:** 2026-08-27, on the driver's device, while running ticket 08's
Remote-control device pass (`.scratch/player-seam/issues/08-...md`). Pre-existing;
the Player-seam work neither caused nor touched it.

## The problem

`src/helpers/chapterSkip.ts:73-83`, the multi-item branch:

```ts
if (position > RESTART_CHAPTER_THRESHOLD_SECONDS) {
  await notifyBeforeSkip('restart');
  await seekTo(0);
} else {
  await notifyBeforeSkip('previous');
  try {
    await skipToPrevious();
  } catch {
    // First queue item has no previous — restart the book instead.
    await seekTo(0);
  }
}
```

**That comment is false, and the `catch` is dead code.** `skipToPrevious()` never
rejects for "no previous item", so at the first queue item the press resolves
having done nothing at all.

Traced through the native stack rather than assumed:

- `MusicModule.kt:380-389` calls `musicService.skipToPrevious()` and then
  `callback.resolve(null)` **unconditionally**. There is no reject path.
- `MusicService.kt:540-542` is `player.previous()`.
- `QueuedAudioPlayer.kt:191-194` is `exoPlayer.seekToPreviousMediaItem()`, and its
  own doc comment says it: *"Does nothing if there is no previous item to skip
  to."* Note it is `seekToPreviousMediaItem()`, **not** media3's `seekToPrevious()`
  — the latter does fall back to seeking to the start of the current item, which
  is very likely where the belief came from.

So three readings agree: the native call is a silent no-op, the JS `catch` cannot
fire, and the driver observed exactly that on device.

## The root cause is not the try/catch

`skipToPreviousChapter` **never asks where in the Queue it is.** It reads
`getQueue()` (for length) and `getProgress()` (for position), and then relies on a
throw to discover it is at the start. The adapter already exports
`getActiveTrackIndex()`; nothing consults it.

That is also why the one-item branch is correct and this one is not — the one-item
branch computes its target from the Chapter table (`getPreviousPressTarget`) and
never needs to be told it is at the beginning.

## ⚠ A green test is guarding the dead code

`src/helpers/__tests__/chapterSkip.test.ts:121-128`:

```ts
it('falls back to restarting when skipToPrevious rejects (first queue item)', async () => {
  mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });
  mockSkipToPrevious.mockRejectedValue(new Error('no previous track'));
  await skipToPreviousChapter();
  expect(mockSeekTo).toHaveBeenCalledWith(0);
});
```

It passes, and it certifies nothing: it *makes* the mock reject, which the real
bridge never does. Deleting the `catch` would turn this test red while the app got
no worse — the exact inversion that makes a suite untrustworthy.

⚠ This file hand-rolls its mocks instead of using
`src/helpers/__tests__/support/fakePlayer.ts`, which exists precisely because a
`seekTo` spy hid a real bug for a month. **The fake should learn that
`skipToPrevious()` at index 0 resolves and moves nothing**, and this test should
be rewritten against it. Fixing the source without fixing the fake leaves the next
queue-position bug just as invisible.

## Both press sites are affected, not just the remote one

- In-app: `src/components/PlayerControls.tsx:337`
- Notification / Android Auto / headset: `src/setup/service.js:521`

Both call the same helper, so both are dead at the first Chapter. The driver found
it from the notification.

## Second-order defect: a footprint for a move that never happened

`notifyBeforeSkip('previous')` runs **before** `skipToPrevious()`, so the press
records a `chapter_change` footprint (`service.js:521-527`) and then does not
change chapter. The footprint list gains a breadcrumb back to a jump that never
occurred. Whatever the fix, the footprint must end up labelled by what actually
happened — `chapter_restart` for a restart.

**The invariant, stated once for both tickets:** a footprint is a breadcrumb
back to a spot the user left. If the press does not leave, there is no
breadcrumb. This ticket and
`.scratch/remote-noop-footprint/issues/01-no-op-remote-next-records-a-chapter-change.md`
are the same violation of it, mirrored at opposite ends of the Queue, and the
same missing knowledge causes both: **neither site asks where in the Queue it
is** before committing. One leans on a `catch` that cannot fire; the other on
nothing at all.

⚠ **This side needs no conditional write.** Fixing the behaviour *is* the
footprint fix here — once the press at index 0 actually restarts the Book, the
footprint stops being a lie and becomes a real `chapter_restart`. Do not add a
"did anything move?" guard to the previous path: after this ticket that branch
always acts, so the guard would be dead the day it was written. The `RemoteNext`
side genuinely needs one, because there a no-op press is the *correct*
behaviour.

⚠ **Work this ticket FIRST.** The remote-noop ticket listed `RemotePrevious` as
"probably not affected" and asked a verifier to confirm it. That claim is wrong
on multi-item Books — `## The problem` above is the trace — and this ticket is
what makes it true. That ticket has been amended to depend on this one; working
them in the other order means either rediscovering this bug from the Footprints
screen, or "verifying" `RemotePrevious` on a one-item Book, where it is
genuinely clean, and ticking the box wrongly.

## Scope

- One-item Books are **correct today** and must stay correct — that branch returns
  at `chapterSkip.ts:68` and should not be touched.
- Do not change the 15 s threshold, and do not change behaviour at any queue index
  other than the first.
- `getActiveTrackIndex()` returns `number | undefined` (ticket 04's ratified
  surface). Treat `undefined` as "unknown", not as 0 — guessing 0 would convert a
  transient read failure into a spurious restart.

## Acceptance criteria

- [x] At the first queue item of a multi-item Book, within 15 s, the press
      restarts the Book (Position 0, still item 1)
- [x] At any other queue item the press still goes to the previous Chapter
- [x] Past 15 s the press still restarts the current Chapter, at every index
- [x] The recorded footprint names the action that actually happened
- [x] The dead `catch` and its false comment are gone
- [x] `fakePlayer.ts` models `skipToPrevious()` at index 0 as resolve-and-no-op,
      and the replaced test asserts the landing spot through it
- [x] `tsc` 0, `eslint` 0, test count at or above the Player-seam baseline
- [ ] Device-verified on a multi-file Book from **both** the in-app control and
      the notification — checklist below

---

## Answer

Fixed in `c1acfee`. `tsc` 0, `eslint` 0, jest **81 suites / 1012 tests** (baseline
was 80 / 1006).

### What changed

`skipToPreviousChapter` now **asks** where it is instead of discovering it from a
failure. The multi-item within-threshold branch reads `getActiveTrackIndex()`
from the adapter and, at index 0, takes the same restart path the past-threshold
branch takes:

```ts
const activeIndex = await getActiveTrackIndex();
if (activeIndex === 0) {
  await notifyBeforeSkip('restart');
  await seekTo(0);
  return;
}

await notifyBeforeSkip('previous');
await skipToPrevious();
```

The dead `catch` and its false comment are gone. The three branches were also
flattened to early `return`s so each one reads top-to-bottom.

**The footprint needed no separate fix**, exactly as the ticket predicted: the
press now resolves to `'restart'`, and `service.js:521` already maps
`kind === 'restart'` to `chapter_restart`. No conditional write was added to the
previous path.

`undefined` is treated as unknown and takes the ordinary previous path. That
leaves one **accepted residual**, called out in a code comment: an index that
could not be read but was really 0 still records a `chapter_change` for a press
that went nowhere. Guarding it is what the ticket forbids, and the window is a
failed bridge read.

### The fake was lying, in both directions

`fakePlayer.ts` modelled `skipToNext` / `skipToPrevious` as **clamps** — at index
0, `skipToPrevious()` reset the position to 0, i.e. the fake accidentally
simulated the fix and would have hidden this bug forever. Native models them as
**edge no-ops**: `QueuedAudioPlayer.kt` `previous()` is
`exoPlayer.seekToPreviousMediaItem()` and `next()` is `seekToNextMediaItem()`,
both documented "does nothing if there is no next/previous item", and
`MusicModule.kt` resolves the promise unconditionally either way.

Both directions were corrected, not just `previous`. The spec review flagged the
`next` half as scope creep; it was **kept deliberately** — a harness that is
accurate about one direction and wrong about the other, inside the same two-line
helper, is the precise failure mode this fake exists to prevent.

### Tests

- `chapterSkip.queuePosition.test.ts` (new) — fake-backed, asserts the **landing
  spot** at both ends of the queue. Its first test is red against the old source:
  the press left the position at 10.
- `chapterSkip.test.ts` — the dead-catch test is gone, replaced by a real
  index-0 case plus an unknown-index (`undefined`) case, and by a
  `'restart'`-label case in the callback block. Its RNTP mock gained
  `getActiveTrackIndex`, defaulted to `1` in `beforeEach` so index 0 is always
  opted into explicitly.

### Code review

Two-axis review run against `c1acfee`. **No hard standards violations**; ADR 0003
(adapter-only RNTP imports) and the `helpers`-lane rules are respected. Three
judgement calls raised, two accepted (header said "first Chapter" where the guard
tests a **queue item** — CONTEXT.md keeps those separate; and a duplicated
`'restart'`-label assertion across both test files, dropped from the landing-spot
file). One declined: the repeated `notifyBeforeSkip('restart') + seekTo(0)` pair
appears three times, but each occurrence carries a distinct guard and comment,
and the early-`return` shape is worth more than the extraction. Spec axis found
**nothing implemented wrongly**.

## Device pass — PENDING

Needs a **multi-file** Book (prove the shape at runtime with
`adb shell dumpsys media_session` — queue size > 1, never assume it).

| # | Where | Setup | Press | Expect |
|---|-------|-------|-------|--------|
| 1 | In-app | Chapter 1, position ~5 s | Skip-previous | Restarts to 0:00, **still chapter 1** |
| 2 | Notification | Chapter 1, position ~5 s | Skip-previous | Restarts to 0:00, still chapter 1 |
| 3 | Notification | Chapter 1, position ~5 s | Skip-previous, then open Footprints | One `chapter_restart`, **no** `chapter_change` |
| 4 | In-app | Chapter 1, position ~40 s | Skip-previous | Restarts to 0:00 (unchanged behaviour) |
| 5 | In-app | Chapter 3, position ~5 s | Skip-previous | Lands at start of chapter 2 |
| 6 | Notification | Chapter 3, position ~5 s | Skip-previous | Lands at start of chapter 2 |
| 7 | In-app | Chapter 3, position ~40 s | Skip-previous | Restarts chapter 3, stays on chapter 3 |
| 8 | In-app | **One-item** Book, chapter 1, ~5 s | Skip-previous | Restarts the book — the untouched branch, regression check |

Row 3 is the only place the footprint half is observable: the in-app
`SkipToPreviousButton` (`PlayerControls.tsx:333`) passes no `onBeforeSkip` and so
records nothing. Rows 5–7 are the regression rows; a failure there means the
index read broke a path that was already correct.

⚠ Once this is device-verified, `.scratch/remote-noop-footprint/issues/01-...md`
is unblocked — its `RemotePrevious` "probably not affected" claim is true only
after this ticket.
