# Skip-to-Previous: Restart-Current-Chapter Threshold

**Date:** 2026-07-19
**Status:** Approved

## Problem

The skip-to-previous button (notification player, Android Auto) always jumps
to the previous chapter regardless of position in the current chapter.
Desired: pressing it more than 15 seconds into a chapter restarts that
chapter; only a press within the first 15 seconds goes to the previous
chapter. (Standard behavior in Spotify, Smart AudioBook Player, etc.)

## Behavior

- Elapsed-in-chapter **> 15s** → seek to the current chapter's start.
- Elapsed-in-chapter **≤ 15s** (inclusive) → go to the previous chapter's
  start (chapter 1: book start, unchanged from today).
- Threshold compares playback position, not wall clock (at 2× speed the
  window passes in ~7.5 real seconds) — standard for this feature.
- Applies to **all book types**: legacy single-file (one queue item,
  chapters as seek offsets), multi-file, and clipped-chapter books (one
  queue item per chapter).

## Design

Follows the `relativeSeek.ts` mirroring pattern: one shared helper, two
press-sites that can't drift.

1. **Pure math** — `getPreviousPressTargetSeconds(chapters, positionSeconds,
   thresholdSeconds)` in `src/helpers/singleFileBook.ts`. Returns the seek
   target for a single-file book per the rules above. Unit-tested.
2. **Orchestration** — `skipToPreviousChapter()` in new
   `src/helpers/chapterSkip.ts`, with the single knob
   `RESTART_CHAPTER_THRESHOLD_SECONDS = 15`:
   - Single-item queue with chapter data → seek to the pure function's
     answer.
   - Single-item queue without chapter data → `seekTo(0)` (previously an
     unhandled `skipToPrevious()` rejection).
   - Multi-item queue (`getProgress().position` is already
     chapter-relative) → `> 15s` ? `seekTo(0)` : `skipToPrevious()`, with a
     catch falling back to `seekTo(0)` (RNTP rejects `skipToPrevious` on
     the first queue item — previously unhandled).
3. **Call sites** — `RemotePrevious` in `src/setup/service.js` keeps its
   `recordRemoteChapterChangeFootprint` await (a chapter restart is a jump
   worth a footprint; it captures the pre-press position), then delegates.
   `SkipToPreviousButton` in `src/components/PlayerControls.tsx` becomes
   just the helper call (component is currently unrendered but kept in
   parity intentionally).

## Out of scope

- `SkipToNextButton` / `RemoteNext` — unchanged.
- Explicit chapter-list selections (`chapterPlayback.ts`) — an explicit
  pick must always go where the user pointed.
- Making the threshold user-configurable (possible later; the constant is
  the seam).

## Testing

Jest unit tests for the pure function (threshold boundary at exactly 15s,
chapter 1, unsorted/zero `startMs` guards) and for
`skipToPreviousChapter()` with mocked TrackPlayer + library store,
following `relativeSeek.test.ts` conventions.
