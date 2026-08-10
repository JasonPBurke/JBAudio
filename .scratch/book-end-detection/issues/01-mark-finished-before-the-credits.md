# 01 — Mark a book finished before its credits, and stop truncating playback

**Status:** ready-for-agent

**Raised by:** the driver, 2026-08-10, during implementation ticket 11's §C5 discussion
(`.scratch/series-implementation/issues/11-series-detail-sheet.md`). **Separate from that
ticket on purpose** — this is playback-service behaviour, not a Series surface — but the two
compose, and this one only became worth doing once §C5 landed.

## The problem

Most audiobooks end with several minutes of non-book audio: credits, an ad for the next
title, a narrator sign-off. The app only marks a book `Finished` when playback reaches the
**true end of the media**, so **the user has to sit through or skip past material that is not
the book in order to get the ✓**. The book is over; the app disagrees.

Under §C5 this now costs twice, because a book that never gets marked finished also never
gets the restart-from-zero treatment on its next play.

## What to build

**D1 — Mark the book `Finished` when playback passes within a lead time of the end**,
defaulting to **60 seconds**. Not at the true end.

**D2 — Marking must NEVER stop, pause or rewind playback.** Driver, verbatim: *"playback
should always continue without user interaction… continue playback but mark the book as
finished while playback is occurring"*, and *"if a user plays through the end, they should
hear all of it."*

> ⚠ **This is the whole trap, and it is why D2 is a separate rule from D1.** Today ONE
> constant does BOTH jobs. `service.js`'s progress handler carries
> `const END_THRESHOLD = 0.2;` and the block it guards marks the book finished **and** writes
> position 0 **and** calls `TrackPlayer.seekTo(0)` and `TrackPlayer.pause()`. At 0.2s those
> are the same instant so the conflation is invisible. **At 60s, changing the constant alone
> would cut every book off sixty seconds early** — and a book whose credits run 10s would
> lose 50s of real content.
>
> So the change is a **split**, not a retune: a lead-time check that only sets the flag, and
> the existing end-of-media handling left to do the stopping.

**D3 — The driver also wants the existing 0.2s stop removed.** Playing through to the true
end should play *all* of it; the queue-ending path already marks the book finished and resets
the position, so the early stop is not load-bearing. Removing it is a real behaviour change
and needs its own device check (below).

**D4 — Multi-file books need a NEW check; they have none.** The per-tick end detection today
lives only in the single-file branch. A multi-file book is finished by
`Event.PlaybackQueueEnded` — i.e. only at the true end. The tick handler already receives
`track`, `position` and `duration` in its event payload, and reads the book from the library
store, so the condition is *last track* **and** *within the lead of that track's end*.

**D5 — Guard against re-marking.** Once marked, the 1 Hz tick keeps firing for the rest of
the lead time — that is ~60 writes, and **each one rewrites `finished_at = new Date()**`,
because the model's `updateBookProgress` sets it for `Finished` and clears it otherwise.
Guard on the book's current progress value; the handler already holds it.

## Cost — this needs no new work per tick

The check the driver worried about **already runs**, and it is free. `handleProgressUpdated`
is invoked at 1 Hz and its single-file branch already computes
`position >= duration - END_THRESHOLD`. `position` and `duration` arrive **in the event
payload** — the comment above the block records that this deliberately avoids a
`getProgress()` round-trip. So the comparison is two numbers already in hand.

**Doing it on pause/save instead was considered and rejected**: it is not cheaper, and it is
inconsistent — a book paused at T−45 would be marked while the same book paused at T−90 would
not, so the same listening session gives different answers depending on where the user
happened to stop.

## Risks to design against

- **A 60-second window trusts the reported duration in a way 0.2s never did.** A mis-tagged
  file that overstates its length marks the book finished early. Because D2 makes marking
  *only* marking, an early mark is cosmetic and recoverable rather than a truncation.
- **A last track shorter than the lead time marks the book finished the moment it starts.**
  For a 45-second credits track that is exactly the desired behaviour; for a genuinely short
  final chapter it is early. Decide whether to clamp (e.g. `min(lead, trackDuration × k)`) or
  accept it, and say which.
- **The lead time should be one named constant**, tunable in one place, since 60 is a first
  guess and the right value is a listening judgement.

## How it composes with §C5 (already shipped)

Well, and it closes the loop the driver described. A book marked finished at T−60 keeps
playing its credits; the user stops whenever. Pressing play on it later from any card
restarts it at 0:00 and flips it back to `Started`, regardless of how it came to be marked.
**Driver, verbatim: *"if the user pauses within the 60secs, a play press starts the book from
the beginning."*** That falls out of §C5 with no extra code — but it is a criterion here,
because it is the behaviour this ticket is for.

⚠ Note while testing: §C5's restart only fires through `handleBookPlay`. Resuming from the
player screen, the floating player, the notification or Android Auto's transport controls
talks to TrackPlayer directly and simply resumes. That is correct, and it is the one place
the two behaviours differ.

## Acceptance criteria

- [ ] **D1** — a book is marked `Finished` once playback passes within the lead time of the
      end, for **both** single-file and multi-file books.
- [ ] **D2** — marking never pauses, stops or seeks. Verified by letting a book run past the
      mark and hearing the remaining audio play uninterrupted.
- [ ] **D3** — the 0.2s stop-and-rewind is gone; playing to the true end plays all of it.
- [ ] **D4** — the multi-file path fires on the last track only. A book sitting near the end
      of chapter 3 of 12 is **not** marked.
- [ ] **D5** — marking happens once. Verified by the absence of repeated writes across the
      lead window, and by `finished_at` holding the time of the FIRST mark.
- [ ] The lead time is a single named constant with a comment saying it is a listening
      judgement, not a measurement.
- [ ] **Pausing inside the lead window and pressing play from a card starts the book from the
      beginning** (§C5's behaviour, asserted here because it is this ticket's motivation).
- [ ] Device-verified on a real multi-file book **and** a real single-file book — the two take
      different code paths and only one of them has any end detection today.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Where the code is

- `src/setup/service.js` — `handleProgressUpdated` (the 1 Hz tick, single-file branch holds
  the existing `END_THRESHOLD` block; the `else` branch is the multi-file path with no check),
  and the `Event.PlaybackQueueEnded` listener (the true-end path for both shapes).
- `src/db/models/Book.ts` — `updateBookProgress` is the single writer that also sets/clears
  `finished_at`.
- ⚠ **`service.js` is not reachable from jest** (it imports TrackPlayer and the database). If
  any of this grows past a comparison, it needs a pure seam the way the Series work did — see
  `src/helpers/` for the pattern.
