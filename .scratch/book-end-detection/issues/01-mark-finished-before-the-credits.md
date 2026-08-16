# 01 — Mark a book finished before its credits, and stop truncating playback

**Status:** needs-triage — first implementation built, then REVERTED by the driver 2026-08-15.
Three open decisions need a ruling before the next pass; the body below is still accurate
EXCEPT for its two-way file-shape model, corrected by "CORRECTION 1" in `## Comments`.

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
- `src/db/models/Book.ts` — `updateBookProgress` is the single MODEL METHOD that sets/clears
  `finished_at`. ⚠ **It is NOT called from a single place**: `service.js` alone calls it from
  three (the 1 Hz tick, `PlaybackQueueEnded`, `RemoteNext`), plus `relativeSeek.ts`,
  `handleBookPlay.ts`, `titleDetails.tsx` and `PlayerControls.tsx`. See finding 1 in the
  Comments — this sentence originally said "single writer" and that reading cost a review cycle.
- ⚠ **`service.js` is not reachable from jest** (it imports TrackPlayer and the database). If
  any of this grows past a comparison, it needs a pure seam the way the Series work did — see
  `src/helpers/` for the pattern.

## Comments

### 2026-08-15 — built, then REVERTED by the driver. Read this before the next pass.

**The code is not lost.** The full implementation is parked on branch
**`parked/book-end-detection-01`** (commit `96b10f3`) — `git show 96b10f3` or
`git cherry-pick 96b10f3`. It was `tsc` 0 / eslint 0 / jest 803 green and code-reviewed on
both axes, but never device-verified. `feature/series-styling` was reset back to `1d8df4b`,
so nothing from it is in the working tree.

It was pulled because the driver spotted that the lead time **cannot reach across a track
boundary**, which makes the 60s a lie on exactly the books it was designed for. That is a
design question, not a bug in the code, and it needs deciding before anything is rebuilt.

---

#### ⚠ CORRECTION 1 — this ticket's two-way file-shape model is wrong

The body above talks about "the single-file branch" and "the multi-file path" as if there are
two kinds of book. There are **four authoring shapes**, and — the part that actually matters —
they collapse into **TWO runtime queue shapes**, which is what the 1 Hz tick's `position` and
`duration` mean. The mapping is NOT the obvious one.

| # | Authoring shape | `shouldUseClippedChapters` | Queue built | Service branch |
|---|---|---|---|---|
| A | **Multi-file** — N files, one chapter each | false (not single-file) | **N items**, one per file | `else` |
| B | **Single file + REAL chapter markers**, sample table fits the heap | **true** | **N items**, one per chapter, all same URL, clipped windows | `else` |
| C | **Single file + REAL chapter markers**, sample table too big | false (heap gate) | **ONE item**, whole book | single-file |
| D | **Single file + AUTO-generated chapters** (no built-in markers) | false (auto excluded) | **ONE item**, whole book | single-file |
| E | **Single file, ONE chapter**, possibly hours long | false (needs >1 chapter) | **ONE item** | `else` (branch also requires `chapters.length > 1`) |

⚠ **Two things here contradict the mental model we started from:**

1. **Auto-chaptered books (D) do NOT load stacked.** They are explicitly excluded from
   clipping — `clippedChapters.ts:75`, `chapters!.some(ch => ch.isAutoGenerated)`. The reason
   is recorded there: synthetic boundaries have no real seek point in an MP3, so ExoPlayer
   resolves the clip start from a bitrate-estimated byte offset that lands ±seconds off and
   audibly skips or repeats at every boundary. They load as ONE track and take the
   **single-file** branch, same as C.
2. **There is a shape we never listed: C.** A single-file book with genuine chapter markers
   falls back to ONE track whenever its estimated sample table exceeds half the heap
   (`estimateClippedTransitionPeakBytes` vs `getHeapLimitBytes()`, device-verified at ~107 MB
   per period on a 28.7 h book). **So the SAME book is shape B on a big-heap device and shape C
   on a small one.** Any rule that depends on queue shape is therefore device-dependent.

`CLIPPED_CHAPTERS_SPIKE` is currently **`true`** (`src/constants/featureFlags.ts`). If it is
ever flipped off, B collapses into C and the stacked shape disappears for single-file books
entirely.

**What this means for end detection:** the only thing the tick handler can see is which of the
two runtime shapes it is in.

- **ONE-item shapes (C, D, E):** `duration` is the WHOLE BOOK, `position` is absolute. "Within
  60s of the end" is exact and needs no cleverness. There is no "final chapter" at the queue
  level at all — the chapter rows exist in the DB but the queue knows nothing about them.
- **N-item shapes (A, B):** `duration` is ONE file's or ONE chapter's, `position` is
  chapter-relative. The lead can only be measured inside the final item — which is the whole
  problem below.

---

#### ⚠ CORRECTION 2 — the lead time cannot cross a track boundary

In the reverted implementation the effective lead on an N-item book was:

```
min(FINISH_LEAD_SECONDS, lastTrackDuration / 2)
```

| Final track | Window opened | Actual lead |
|---|---|---|
| 8 min | 420s in | 60s (full) |
| 120s | 60s in | 60s (the exact boundary) |
| 90s | 45s in | 45s |
| 45s | 22.5s in | 22.5s |
| **30s** | **15s in** | **15s** |
| 10s | 5s in | 5s |

The `/2` is a clamp that existed because two cases are indistinguishable from `duration` alone:
the final track being **the credits** (want to mark at its START) versus being **genuinely short
content** (want to mark near its END). Halving splits the difference. ⚠ **It is wrong in both
directions, just never very wrong** — and on the driver's 30s example it produces a 15s lead,
barely different from the 0.2s behaviour this ticket exists to replace.

**Driver's question, answered: no.** With a 30-second final chapter, nothing is marked during
the second-to-last chapter. The check was gated on `isLastTrack`, so the second-to-last track
returned "not near the end" regardless of position.

---

#### The driver's proposal for the next pass

> *"if a final chapter <= 60 seconds, then just mark it finished"*

i.e. drop the clamp and mark the moment the final track starts, when that track is shorter than
the lead. **This is sound for A and B, and the research says it is safer than it first looks:**

- It only ever applies to N-item shapes, which is where a short final track is genuinely likely
  to be credits or an outro.
- ⚠ **It must be evaluated against the QUEUE, never against the DB chapter rows.** For shape D
  the final chapter row is a **remainder** — `autoChapterGenerator.ts:40`,
  `Math.min(intervalMs, remainingMs)` — so a book whose duration is not a multiple of the 30/60
  min interval ends with an arbitrarily short final chapter row (possibly 3 seconds) that has
  NOTHING to do with content. Reading chapter rows would make the rule fire on a slicing
  artifact. Reading the queue makes D immune, because D has only one queue item.

**The alternative worth weighing against it: measure remaining audio across the whole BOOK.**

```
remaining = (duration - position) + Σ chapterDuration of all later tracks
mark when remaining <= FINISH_LEAD_SECONDS
```

The data is already in the store — every chapter row carries `chapterDuration`
(`library.tsx:56`), so this needs no bridge call. This gives a true 60s lead on every shape,
deletes the clamp, and makes the 30s case mark 30s into the second-to-last chapter.
⚠ **But it contradicts D4's literal wording** ("fires on the last track only"), so D4 would
need rewording to "within the lead of the BOOK's end". ⚠ Also note `startMs` is **0 on every
multi-file chapter row** (`scanLibrary.ts:520`) — it is NOT a cumulative timeline, so any
book-level arithmetic must sum `chapterDuration` and must not trust `startMs` outside shapes
B/C/D.

---

#### OPEN DECISION 1 — what a play press does after an early mark

Today, pressing play on a `Finished` book from any card **restarts it from 0:00** and demotes it
to `Started` (§C5, `handleBookPlay.ts`; the demotion is what makes the restart a once-per-listen
event). That is correct for a book finished at its true end. With an early mark it introduces a
case that did not exist before:

> user is inside the last 60s, pauses, comes back later, presses play from a card → the book
> restarts from the beginning, rather than resuming the ~40s they had left.

**Driver's leaning, recorded verbatim: *"this would be very unlikely and rare, as they would
most likely just finish out the < 60 seconds of the end of a book first so we may just let the
user deal with that case manually."*** — i.e. ACCEPT the restart, do not special-case it.

Worth noting if that is revisited: the escape hatch already exists and needs no code. Resuming
from **the player screen, the floating player, the notification or Android Auto transport**
talks to TrackPlayer directly and simply resumes where they were — only the card press
restarts. So the user who genuinely wants those last 40 seconds already has four ways to get
them. Options if a real fix is ever wanted: (a) accept, as above; (b) suppress the restart when
the stored position is inside the lead window; (c) prompt.

#### OPEN DECISION 2 — track-local vs book-level lead

Pick one of: **(a)** book-level remaining (recommended — true 60s everywhere, deletes the clamp,
needs D4 reworded); **(b)** track-local + clamp (what was built and reverted); **(c)** track-local,
no clamp, mark at the start of any final track shorter than the lead (the driver's proposal
above).

#### OPEN DECISION 3 — does the mark need to survive being wrong?

Not raised yet, but it falls out of the above: an early mark on a mis-tagged file is cosmetic
and recoverable today only because §C5's restart lets the user replay. If OPEN DECISION 1 ever
moves to (b), that recovery path changes shape too. Decide 1 and 3 together.

---

#### Findings from the reverted attempt that stay true regardless of which way this goes

1. ⚠ **The `Finished` flag has THREE writers in `service.js`, not one:** the 1 Hz tick,
   `Event.PlaybackQueueEnded`, and `Event.RemoteNext`'s last-chapter branch. `updateBookProgress`
   rewrites `finished_at = new Date()` every time, so guarding only the tick leaves the
   timestamp being dragged forward to the true end by the other two. D5 is not a one-site fix.
2. ⚠ **Any "already marked" latch must be set AFTER the write lands, never before.** Latching
   first silences the per-tick path AND any true-end fallback that trusts the same latch, so a
   book whose `getBookById` missed would end up marked *never*.
3. ⚠ **A guard on the store's `bookProgressValue` alone is not enough.** The store only refreshes
   when the WatermelonDB observer fires, several ticks after the write, leaving a window of 2-3
   duplicate writes. Two-part guard (module latch + store value) or nothing.
4. ⚠ **`service.js` is untyped, so `tsc` cannot check what a pure helper promises it.** The
   helper declared `progressState` non-optional while the JS caller passed
   `books[bookId]?.bookProgressValue` from a lookup that can miss; `undefined` flowed in and
   jest stayed green because Babel strips types without checking them. **Any new seam consumed
   by `service.js` must assume every input can be `undefined`.**
5. `BookProgressState` had to move out of `handleBookPlay.ts` (which imports TrackPlayer and the
   DB) into a dependency-free module so a pure helper could import it and still be reachable
   from jest. That refactor is in the parked commit and is independently useful.
6. The 1 Hz handler already runs **two O(n) chapter scans per tick**
   (`calculateProgressWithinChapter` calls `findChapterIndexByPosition` internally, on top of
   the handler's own call), so the cost of any arithmetic added here is noise. The real cost of
   marking is the DB write: `book_progress_value` is in the store's `observeWithColumns` list,
   so one write fans out to a full-library diff. That is the thing to keep to once per book.
