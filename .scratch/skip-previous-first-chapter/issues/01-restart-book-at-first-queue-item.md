# 01 — Skip-previous does nothing at the first chapter of a multi-item Book

**What to build:** A skip-previous press inside the first 15 seconds of the first
Chapter of a multi-item Book restarts the Book, the way the same press already
does on a one-item Book. Today it silently does nothing — and records a footprint
saying it did something.

**Status:** ready-for-agent

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

- [ ] At the first queue item of a multi-item Book, within 15 s, the press
      restarts the Book (Position 0, still item 1)
- [ ] At any other queue item the press still goes to the previous Chapter
- [ ] Past 15 s the press still restarts the current Chapter, at every index
- [ ] The recorded footprint names the action that actually happened
- [ ] The dead `catch` and its false comment are gone
- [ ] `fakePlayer.ts` models `skipToPrevious()` at index 0 as resolve-and-no-op,
      and the replaced test asserts the landing spot through it
- [ ] `tsc` 0, `eslint` 0, test count at or above the Player-seam baseline
- [ ] Device-verified on a multi-file Book from **both** the in-app control and
      the notification
