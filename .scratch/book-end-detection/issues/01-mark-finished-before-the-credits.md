# 01 — Mark a book finished before its credits, and stop truncating playback

**Status:** in-review — SECOND implementation built 2026-08-17 against decision 2(a), `tsc` 0 /
eslint 0 / jest 825. ⚠ **DEVICE VERIFICATION OUTSTANDING** — see the 2026-08-17 build note at the
bottom of `## Comments` for the three things only a device can answer. The agent brief remains the
contract. The body below is still accurate EXCEPT for its two-way file-shape model, corrected by
"CORRECTION 1" in `## Comments`.

**Raised by:** the driver, 2026-08-10, during implementation ticket 11's §C5 discussion
(`.scratch/series-implementation/issues/11-series-detail-sheet.md`). **Separate from that
ticket on purpose** — this is playback-service behaviour, not a Series surface — but the two
compose, and this one only became worth doing once §C5 landed.

## The problem

Most audiobooks end with several minutes of non-book audio: credits, an ad for the next
title, a narrator sign-off. The app only marks a book `Finished` when playback reaches the
**true end of the media**, so **the user has to sit through or skip past material that is not
the book in order to get the ✓**. The book is over; the app disagrees. This also effects non-series books switching into the 'Finished' tab on the main authors library screen.

Under §C5 this now costs twice, because a book that never gets marked finished also never
gets the restart-from-zero treatment on its next play.

## What to build

**D1 — Mark the book `Finished` when playback passes within a lead time of the end**,
defaulting to **60 seconds**. Not at the true end.

**D2 — Marking must NEVER stop, pause or rewind playback.** Driver, verbatim: _"playback
should always continue without user interaction… continue playback but mark the book as
finished while playback is occurring"_, and _"if a user plays through the end, they should
hear all of it."_

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
end should play _all_ of it; the queue-ending path already marks the book finished and resets
the position, so the early stop is not load-bearing. Removing it is a real behaviour change
and needs its own device check (below).

**D4 — Multi-file books need a NEW check; they have none.** The per-tick end detection today
lives only in the single-file branch. A multi-file book is finished by
`Event.PlaybackQueueEnded` — i.e. only at the true end. The tick handler already receives
`track`, `position` and `duration` in its event payload, and reads the book from the library
store.

> ⚠ **REWORDED 2026-08-17 by OPEN DECISION 2's ruling (option a).** This originally read
> "the condition is _last track_ **and** _within the lead of that track's end_" — i.e.
> track-local. That is no longer the rule. **The condition is now: _within the lead of the
> BOOK's end_**, measured as remaining audio across the whole queue:
>
> ```
> remaining = (duration - position) + Σ chapterDuration of every LATER queue item
> mark when remaining <= FINISH_LEAD_SECONDS
> ```
>
> On a one-item queue the sum is empty and this reduces to the exact absolute check. The
> "last track only" gate is GONE — a book with a 30s final chapter is now correctly marked
> 30s into its second-to-last chapter.

**D5 — Guard against re-marking.** Once marked, the 1 Hz tick keeps firing for the rest of
the lead time — that is ~60 writes, and **each one rewrites `finished_at = new Date()**`,
because the model's `updateBookProgress`sets it for`Finished` and clears it otherwise.
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
  _only_ marking, an early mark is cosmetic and recoverable rather than a truncation.
- ~~**A last track shorter than the lead time marks the book finished the moment it starts.**
  For a 45-second credits track that is exactly the desired behaviour; for a genuinely short
  final chapter it is early. Decide whether to clamp (e.g. `min(lead, trackDuration × k)`) or
  accept it, and say which.~~ **DISSOLVED 2026-08-17 by decision 2(a).** This risk only exists
  for a track-local lead. Measuring remaining audio across the whole book means a short final
  track is not a special case at all — the window simply opens earlier, inside the preceding
  track. No clamp, in either direction.
- **The lead time should be one named constant**, tunable in one place, since 60 is a first
  guess and the right value is a listening judgement.

## How it composes with §C5 (already shipped)

Well, and it closes the loop the driver described. A book marked finished at T−60 keeps
playing its credits; the user stops whenever. Pressing play on it later from any card
restarts it at 0:00 and flips it back to `Started`, regardless of how it came to be marked.
**Driver, verbatim: _"if the user pauses within the 60secs, a play press starts the book from
the beginning."_** That falls out of §C5 with no extra code — but it is a criterion here,
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
- [ ] **D4** (reworded 2026-08-17) — the mark fires within the lead of the **book's** end, on
      every queue shape. A book sitting near the end of chapter 3 of 12 is **not** marked,
      because ~9 chapters of audio remain. A book 30s into a 60s second-to-last chapter
      followed by a 30s final chapter **is** marked.
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

| #   | Authoring shape                                                    | `shouldUseClippedChapters` | Queue built                                                 | Service branch                                      |
| --- | ------------------------------------------------------------------ | -------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| A   | **Multi-file** — N files, one chapter each                         | false (not single-file)    | **N items**, one per file                                   | `else`                                              |
| B   | **Single file + REAL chapter markers**, sample table fits the heap | **true**                   | **N items**, one per chapter, all same URL, clipped windows | `else`                                              |
| C   | **Single file + REAL chapter markers**, sample table too big       | false (heap gate)          | **ONE item**, whole book                                    | single-file                                         |
| D   | **Single file + AUTO-generated chapters** (no built-in markers)    | false (auto excluded)      | **ONE item**, whole book                                    | single-file                                         |
| E   | **Single file, ONE chapter**, possibly hours long                  | false (needs >1 chapter)   | **ONE item**                                                | `else` (branch also requires `chapters.length > 1`) |

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

| Final track | Window opened | Actual lead              |
| ----------- | ------------- | ------------------------ |
| 8 min       | 420s in       | 60s (full)               |
| 120s        | 60s in        | 60s (the exact boundary) |
| 90s         | 45s in        | 45s                      |
| 45s         | 22.5s in      | 22.5s                    |
| **30s**     | **15s in**    | **15s**                  |
| 10s         | 5s in         | 5s                       |

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

> _"if a final chapter <= 60 seconds, then just mark it finished"_

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

**Driver's leaning, recorded verbatim: _"this would be very unlikely and rare, as they would
most likely just finish out the < 60 seconds of the end of a book first so we may just let the
user deal with that case manually."_** — i.e. ACCEPT the restart, do not special-case it.

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
   book whose `getBookById` missed would end up marked _never_.
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

---

### 2026-08-17 — triage: all three open decisions RULED. Status → `ready-for-agent`.

> *This was generated by AI during triage.*

**Category:** `enhancement`. Nothing is broken against spec — the app marks finished at the true
end of the media, exactly as designed. This ticket changes what "finished" is allowed to mean.

**Verification performed before ruling** (the body's claims were re-checked against the working
tree at `1d8df4b`, not taken on trust):

| Claim in the body                                          | Result                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| One constant does four jobs                                 | ✅ `service.js:213-233` — marks finished, zeroes chapter progress + index, `seekTo(0)`, `pause()` |
| The `else` branch has no end detection                      | ✅ `service.js:234-241` — progress save only                                        |
| Three `Finished` writers in `service.js`                    | ✅ lines 218 (tick), 400 (`RemoteNext`), 502 (`PlaybackQueueEnded`)                  |
| Revert is complete, nothing leaked into the tree            | ✅ no `FINISH_LEAD` anywhere in `src/`; tree clean                                   |
| Code preserved at `96b10f3`                                 | ✅ branch `parked/book-end-detection-01`, commit message matches this ticket's account |

**Redundancy check** (searched by domain concept — `updateBookProgress`,
`BookProgressState.Finished`, `PlaybackQueueEnded`, `END_THRESHOLD` — not by the ticket's
wording): there IS an existing end-detection path, but it is the 0.2s one this ticket exists to
replace, and it covers only one of the two runtime queue shapes. Not already implemented.
**Prior-rejection check:** no `.out-of-scope/` directory exists in this repo.

#### The rulings

- **OPEN DECISION 1 → (a) ACCEPT.** A play press from a card on an early-marked book restarts
  it from 0:00, same as any other finished book. No special case, no code. The driver's
  recorded leaning stands: a user inside the last 60s will almost always just play it out, and
  the four non-card resume surfaces (player screen, floating player, notification, Android
  Auto) already resume in place for anyone who wants those last seconds.
- **OPEN DECISION 3 → COLLAPSES INTO 1, no separate work.** It only became a question if 1 went
  to (b). With 1 = (a), §C5's restart IS the recovery path for a wrong early mark, so an early
  mark stays cosmetic and self-healing.
- **OPEN DECISION 2 → (a) BOOK-LEVEL REMAINING.** The clamp is deleted, D4 is reworded (done,
  in place, above). Rationale: a true `FINISH_LEAD_SECONDS` on every shape, and it subsumes the
  driver's own proposal (c) — with a 30s final track, book-level marks 30s into the
  second-to-last chapter, which is strictly closer to this ticket's intent than marking at the
  track boundary, and it does it without needing to special-case short tracks at all.

---

#### ⚠ CORRECTION 3 — "later tracks" cannot be ordered by any field on the chapter row

Decision 2(a) is defined as `Σ chapterDuration of every LATER track`, so it lives or dies on the
word **later**. The body already warns that `startMs` is `0` on every multi-file chapter row
(`scanLibrary.ts:520`, and `:539` for the error-placeholder row). Triage found that warning is
only half the story, and the missing half is a silent-failure trap:

1. **The store SORTS on that all-zero field.** `library.tsx:61` ends
   `convertBookModelToBook`'s chapter mapping with
   `.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))`. For a multi-file book every key is
   `0`, the comparator returns `0` for every pair, and the sort is a **no-op** that leaves the
   raw `chapters.fetch()` order untouched. It is not ordering anything; it only looks like it is.
2. **`chapterNumber` is NOT a safe fallback.** For a multi-file book it comes from
   `metadata.trackPosition || 1` (`scanLibrary.ts:518`) — the file's track tag. On an untagged
   or badly-tagged rip that `|| 1` fires for *every* file, so the whole book collapses to
   `chapterNumber === 1`. Ordering by it would produce a wrong sum on exactly the messy books
   this feature is aimed at, and would do so without erroring.
3. **Array position is the only usable ordering**, and both queue builders preserve it:
   `handleBookPlay.ts:188` maps `book.chapters` for shape A, and `buildClippedChapterTracks`
   (`clippedChapters.ts:96`) is `chapters.map((ch, i) => …)` with no filter and no sort for
   shape B. So "every later track" is `chapters.slice(currentIndex + 1)` and nothing more.

⚠ **But "the array" is not one array.** There are **two independent producers** of a book's
chapter array, and they are near-duplicates of each other:

| Producer                                                     | Feeds                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| `convertBookModelToBook` (`library.tsx:50-61`)                 | the Zustand store — **what the 1 Hz tick handler reads**   |
| `getBookWithChaptersForRestoration` (`bookQueries.ts:50-61`)   | `restoreLastActiveBook` (**cold start**) + `remotePlayBook` — **what the queue gets built from on those paths** |

Both run `.query(Q.where('book_id', bookId)).fetch()` with **no `Q.sortBy`**, then apply the
same `.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))`. On shape A that sort is a no-op in
both, so each array is raw fetch order from a separate unordered query. They will agree in
practice — same simple scan, rowid order — but **nothing enforces it**, and the comment at
`bookQueries.ts:49` already scopes its own correctness claim to single-file books
(_"Sort by startMs to ensure consistent ordering for single-file books"_).

⚠ **Shape B is self-validating; shape A is not.** `buildClippedChapterTracks` derives
`clipStartMs`/`clipEndMs` from `ch.startMs` and `chapters[i + 1]?.startMs`, so a misordered
array on shape B produces audibly wrong clip windows and gets caught. **A misordered multi-file
array has no other consumer whatsoever** — the book-level sum would be its first and only
detector, and it would be wrong silently.

**Rule for the implementation — reworded to survive the two-producer problem:**

1. Derive "later" from **ARRAY POSITION**. Never from `startMs` (all-zero on shape A, and the
   sort on it is a silent no-op), never from `chapterNumber` (it is `metadata.trackPosition || 1`,
   so untagged rips collapse to `1`).
2. **Take the current index and the sum from ONE array, in one read.** That makes the arithmetic
   self-consistent even if the queue disagrees with the store.
3. ⚠ **If you index the store array with the event payload's `track`** — which is what the
   parked commit did, reasoning "queue index == chapter index, so no `getQueue` round-trip" —
   **you are relying on the two producers agreeing**, and on the cold-start restore path the
   queue was demonstrably built from the *other* one. That reliance is probably fine, but it is
   currently undefended and untested. Either avoid it, or assert it and cover it.

---

## Agent Brief

> *This was generated by AI during triage.*

**Category:** enhancement
**Summary:** Mark a book `Finished` once the audio remaining in the whole book falls within a
named lead time (default 60s), without ever stopping, pausing or seeking playback — and delete
the 0.2s stop-and-rewind that currently conflates those two jobs.

**Start from the parked work.** `git show 96b10f3` (branch `parked/book-end-detection-01`) is a
complete, reviewed, `tsc`/eslint/jest-green implementation of an EARLIER ruling. It was reverted
for one reason only: its lead was track-local with a `/2` clamp, which decision 2(a) has now
overturned. Its structure — the pure seam, the decision/effect split, the `BookProgressState`
extraction — is the intended shape and should be reused rather than reinvented. Cherry-pick it
and change the rule, or rebuild it with the same seams; either is fine.

✅ **Verified 2026-08-17: the cherry-pick is clean on every code file.** `96b10f3`'s parent is
`1d8df4b`; the only things that landed on the branch since are tickets 31/32, entirely inside
`src/db/` and `src/helpers/series*`. None of the five code files the parked commit touches
(`bookEndDetection.ts`, its test, `bookProgressState.ts`, `handleBookPlay.ts`, `service.js`)
has been modified since. **`git cherry-pick 96b10f3` will conflict on exactly one file — THIS
ticket — and the resolution is to keep the current version** (it carries the rulings the parked
commit predates).

**Current behavior:**
A book is marked `Finished` only when playback reaches the true end of the media. On a one-item
queue that happens in the 1 Hz progress tick, where a single `END_THRESHOLD = 0.2` constant
guards a block that does four different things at once: marks the book finished, zeroes the
stored chapter progress and index, seeks to 0, and pauses. At 0.2s those are indistinguishable.
On a multi-item queue there is no per-tick check at all — the book is finished only by the
queue-ended event. So the user must sit through or skip past credits, an ad for the next title
and a narrator sign-off to earn the ✓, and under series §C5 a book that never gets marked also
never gets its restart-from-zero on the next play.

**Desired behavior:**
On every progress tick, compute the audio remaining **in the book**:

```
remaining = (duration - position) + Σ chapterDuration of every later queue item
```

and mark the book `Finished` when `remaining <= FINISH_LEAD_SECONDS`. Marking sets the flag and
does nothing else — it must never pause, stop, seek or rewind. Playback continues through the
credits and the user stops whenever they like; playing through to the true end plays all of it.
On a one-item queue the sum is empty and this reduces to a plain absolute check against the
whole book's duration. There is no "last track only" gate and no short-track clamp.

**Key interfaces:**

- A **pure, dependency-free helper module** owns the decision. It must be importable from jest,
  which means it may not import TrackPlayer or the database — the playback service itself is
  unreachable from jest for exactly that reason. The parked commit's `evaluateBookEnd()`
  returning a `'mark' | 'none' | 'clear'` verdict is a good shape: a return type that
  *cannot express a transport call* is what structurally guarantees D2.
- `FINISH_LEAD_SECONDS` — one exported named constant, with a comment saying it is a listening
  judgement rather than a measurement.
- The service-side applier does the DB write and nothing else.
- `BookProgressState` must live in a module free of TrackPlayer/DB imports so the pure helper
  can reference it (already done in the parked commit; independently useful).
- The helper's inputs are `position` and `duration` **from the tick's event payload** — do not
  add a `getProgress()` round-trip — plus the book's chapter array, current index, and current
  progress state.

**Ordering contract (read CORRECTION 3 above IN FULL before writing the sum — this is the part
most likely to be got wrong, and it fails silently):**

- "Later items" means **array positions after the current index**. Do **not** order by `startMs`
  (it is `0` on every multi-file row, and the sort on it is a silent no-op) or by `chapterNumber`
  (it is the file's track tag and collapses to `1` for every file on an untagged rip).
- Take the current index and the sum **from one array in one read**, so the arithmetic is
  internally consistent.
- ⚠ There are **two** chapter-array producers — the store's converter and
  `getBookWithChaptersForRestoration` — and the cold-start restore path builds the queue from the
  latter while the tick handler reads the former. Using the event payload's `track` as an index
  into the store array assumes the two agree. They almost certainly do; nothing enforces it and
  no test covers it. Make that assumption explicit wherever you take it.

**Guarding the write (D5) — three things the reverted attempt proved, all still true:**

1. The `Finished` flag has **three** writers in the playback service — the 1 Hz tick, the
   queue-ended handler, and the remote-next last-chapter branch. `updateBookProgress` rewrites
   `finished_at = new Date()` on every call, so guarding only the tick leaves the timestamp
   being dragged forward to the true end by the other two. This is not a one-site fix.
2. An "already marked" latch must be set **after** the write lands, never before. Latching first
   silences both the per-tick path and any true-end fallback trusting the same latch, so a book
   whose model lookup missed would end up marked *never*.
3. A guard on the store's progress value alone is insufficient — the store only refreshes when
   the WatermelonDB observer fires, several ticks after the write, leaving 2–3 duplicate writes.
   Use a module-level latch **and** the store value, not one or the other.

**Typing hazard:** the playback service is untyped JS, so `tsc` cannot check what it passes into
a typed helper — the reverted attempt declared an input non-optional while the caller passed a
value from a lookup that can miss, and jest stayed green because Babel strips types without
checking them. **Assume every input to the new seam can be `undefined`** and handle it.

**Acceptance criteria:**

- [ ] A book is marked `Finished` once book-level remaining audio falls within
      `FINISH_LEAD_SECONDS`, on both one-item and multi-item queues.
- [ ] Marking never pauses, stops or seeks. Verified by letting a book run past the mark and
      hearing the remaining audio play uninterrupted.
- [ ] The 0.2s stop-and-rewind is gone; playing to the true end plays all of it, and the
      queue-ended path still resets position and index.
- [ ] A book near the end of chapter 3 of 12 is **not** marked. A book 30s into a 60s
      second-to-last chapter followed by a 30s final chapter **is** marked.
- [ ] The remaining-audio sum is derived from array position, not `startMs` or `chapterNumber`.
      A unit test covers a multi-file book whose rows all carry `startMs: 0` and
      `chapterNumber: 1` — this is the regression that CORRECTION 3 exists to prevent, and the
      one that cannot be caught on device because nothing else consumes that ordering.
- [ ] The cold-start restore path is exercised at least once on device: kill the app while a
      multi-item book is playing near its end, relaunch, and confirm the mark still fires
      correctly. This is the path where the queue and the store come from different producers.
- [ ] Marking happens once per listen: no repeated writes across the lead window, and
      `finished_at` holds the time of the FIRST mark even after the queue-ended and remote-next
      paths have run.
- [ ] `FINISH_LEAD_SECONDS` is a single named constant with the "listening judgement" comment.
- [ ] Pausing inside the lead window and pressing play from a card starts the book from the
      beginning (§C5 behaviour, asserted here because it is this ticket's motivation).
- [ ] Unit tests cover the pure helper directly, including `undefined` inputs.
- [ ] Device-verified on a real multi-item book **and** a real one-item book — they take
      different code paths and only one has any end detection today.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

**Out of scope:**

- **Any special-casing of a play press after an early mark.** OPEN DECISION 1 ruled (a) accept:
  the card press restarts from 0:00 like any other finished book. Do not add a
  "resume instead of restart when inside the lead window" branch, and do not add a prompt.
- Changing what the other four resume surfaces (player screen, floating player, notification,
  Android Auto transport) do — they resume in place, and that asymmetry is correct and
  deliberate.
- Retuning the clipped-chapters heap gate, the `CLIPPED_CHAPTERS_SPIKE` flag, or anything that
  decides which queue shape a book loads as. This ticket must work on whatever shape it is
  handed.
- Auto-chapter generation and its remainder-sized final chapter row. The book-level rule reads
  the queue, so it is immune by construction — do not "fix" the generator here.
- Picking a different default than 60s. It is a first guess by design and tunable in one place.

---

### 2026-08-17 — BUILT against decision 2(a). Device verification is the only thing left.

> *This was generated by AI during implementation.*

`tsc` 0 · eslint 0 · **jest 825** (was 803, +22 in `src/helpers/__tests__/bookEndDetection.test.ts`).

**What landed** — five files, the same seams the parked commit chose, with the rule replaced:

| File                                | What it is                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `src/helpers/bookProgressState.ts`  | new — the enum, in a module free of TrackPlayer/DB imports (finding 5)      |
| `src/helpers/handleBookPlay.ts`     | re-exports it; no call site changed                                        |
| `src/helpers/bookEndDetection.ts`   | new — `FINISH_LEAD_SECONDS` + `evaluateBookEnd()`, the whole rule           |
| `src/helpers/__tests__/…`           | new — 22 tests, the seam the ticket asked for                              |
| `src/setup/service.js`              | the applier, the D3 deletion, and the guards at all three `Finished` writers |

**The clamp is gone and so is the last-track gate.** `evaluateBookEnd` computes
`remaining = (duration - position) + Σ chapterDuration of every LATER queue item` and marks at
`remaining <= FINISH_LEAD_SECONDS`.

#### Three decisions taken inside the brief that are worth recording

1. ⚠ **The queue shape is passed in EXPLICITLY (`queueShape: 'one-item' | 'multi-item'`), not
   inferred from whether a chapter array was supplied.** Inferring it is a live trap: the tick's
   `else` branch passes `book?.chapters`, and that lookup misses whenever the store has not
   hydrated. "No array" would then read as "one item spanning the book" and mark a multi-file book
   finished at the end of **every track**. Anything that is not exactly `'one-item'` is treated as
   multi-item, which then *requires* a usable array and index — so a forgotten field leaves a book
   unmarked rather than marked sixty times.
2. ⚠ **An undecidable tick returns `'none'`, never `'clear'`.** `'clear'` releases the D5 latch. A
   momentary store miss mid-window returning `'clear'` would let the very next tick mark the book a
   second time and rewrite `finished_at` — and the store-value half of the guard cannot catch it,
   because it lags the write by 2–3 ticks (finding 3). **`'clear'` now means "I know we are outside
   the window", never "I could not tell".**
3. **CORRECTION 3's undefended assumption is now ASSERTED, one-sidedly.** The helper compares the
   playing item's `url` against the row at the index it was handed:
   - url sits at that index → the two producers agree, proceed;
   - url sits at a **different** index → they demonstrably disagree, refuse to guess, never mark;
   - url is **nowhere** in the array → inconclusive (the player may hand back a normalised url),
     so proceed. This is the assumption being taken, in the open.

   The url reaches the tick for free: `progressTrackCache` already caches the track fetched on a
   cache miss, so it now carries `url` alongside `bookId` — **no new bridge call**. On a clipped
   single-file book every item carries the same url, so the check is inert there, which is right:
   that shape already validates its own ordering through the clip windows it derives.

#### One judgement call inside the sum

A chapter row whose metadata extraction failed is stored with `duration: 0`
(`scanLibrary.ts`'s `makeErrorChapter`), so **0 is a real value, not a bug**. Such a row makes the
sum understate and the mark land early. Taken deliberately: the ticket rules an early mark cosmetic
and self-healing through §C5, which beats never marking the book at all. Only `undefined`/`NaN`/
negative durations are skipped.

#### ⚠ What only a device can answer — none of this is covered by the 22 tests

1. **D3, on a ONE-ITEM book.** The 0.2s block used to `pause()` the player ~0.2s before the true
   end, which means `PlaybackQueueEnded` may never have fired for that shape in practice. It is now
   the *only* thing that resets position/index and stops playback there. If it does not fire, a
   one-item book plays to its end and never resets. **Verify: play a one-item book to its true end,
   confirm all the audio plays, then confirm the book sits at 0:00 afterwards.**
2. **The cold-start restore path** (the brief's own criterion): kill the app while a multi-item
   book plays near its end, relaunch, confirm the mark still fires. This is the one path where the
   queue and the store come from different producers — and where the new url assertion could, if
   the producers really do disagree, silently suppress the mark instead of firing it wrongly.
3. **`finished_at` holds the FIRST mark.** Let a book run from inside the window through to the
   true end and confirm the timestamp did not move when `PlaybackQueueEnded` ran.

#### Code review, same day — 6 findings, 5 fixed in code, 1 folded into device verification

Reviewed on both axes against the branch diff. jest 825 → **828**.

**1. MEDIUM, valid, FIXED — a `chapterDuration` of 0 emptied the "still to come" sum.**
`scanLibrary`'s `makeErrorChapter` stores `duration: 0` for a file whose metadata extraction
failed, and the single-chapter path falls back to `0` whenever the duration tag is missing. On a
20-file book with files 6–20 unreadable the sum was empty, so the book was marked Finished at the
end of **chapter 5**. ⚠ **The build note above got this wrong and the wrong reasoning is worth
keeping:** it called an early mark "cosmetic and self-healing via §C5". It is not — §C5's recovery
is a **restart from 0:00**, so recovering costs the user their position. A row with no usable
duration now voids the whole measurement (fail closed, like everything else in the module); such a
book simply loses its early mark and is still marked at the true end.
*(The review also claimed the mark then repeats for every remaining chapter. It does not: after the
first write the store reads `Finished`, so every later end-of-chapter returns `'none'`. One bad
write, not fifteen — the finding stands on the first write alone.)*

**2. MEDIUM, valid, FIXED — a stale latch could disarm the true-end fallback and lose the ✓
entirely.** `finishMarkedBookId` is process-lifetime state released *only* by a tick that can
positively measure itself outside the window. On a listen where the helper refuses to decide, it
keeps whatever an earlier listen left in it — and `PlaybackQueueEnded` was consulting it, so the
last-chance mark was skipped. **This was a NEW way to lose the ✓, in exactly the case the url
assertion exists to protect.** ⚠ **Rule now written into the code: the latch is for the 1 Hz tick
and nothing else.** Both fallbacks (`PlaybackQueueEnded`, `RemoteNext`) guard on the STORE alone,
which cannot go stale across listens and has had the whole lead window to refresh. The brief's
"not a one-site fix" still holds — all three writers are still guarded, just not all by the latch.

**3. LOW, valid, FIXED** — `applyBookEndDecision` had no `try/catch`. `updateBookProgress` is a raw
WatermelonDB writer that throws if the row was destroyed underneath it (a concurrent scan's
`removeMissingFiles`), and the progress tick is driven by an un-awaited IIFE with a `finally` but
no `catch`: the rejection would be unhandled *and* would skip the sleep-timer tick after it.
`demoteToStarted` guards the identical call the same way.

**4. LOW, valid, FIXED — the `'one-item'` claim was taken on trust.** The caller re-derives the
shape from the store's CURRENT chapter rows while the queue was built from an earlier snapshot, and
a rescan can flip `shouldUseClippedChapters` between the two; believing a contradicted claim reads
a chapter-relative `duration` as the whole book's. **A one-item queue can only ever tick at index
0**, so the helper now checks that and refuses otherwise. (The opposite divergence was already
safe: the sum overstates and nothing is marked.)

**5. LOW, valid, FIXED — but NOT the way the review proposed.** A book whose whole runtime is
inside the lead was Finished from its first tick and could never be seen as Started: a play press
demotes it, the next tick promotes it straight back, two full-library writes per press. Reachable
with a stray intro file scanned as its own book. ⚠ **The review suggested
`Math.min(leadSeconds, duration * fraction)` — that is the `/2` clamp decision 2(a) deleted, and it
was not reintroduced.** Instead: a book with less total audio than the lead is left to the true-end
path, exactly as before this ticket. The rule is about the credits at the end of a real book.

**6. LOW, valid, NOT a code change — folded into device verification.** Single-file books now end
via `PlaybackQueueEnded`'s `TrackPlayer.stop()` where the deleted block ended them with
`seekTo(0); pause()`. `stop()` tears down the session and dismisses the notification; `pause()` left
it live and resumable. That block also pre-empted `PlaybackQueueEnded` for these books most of the
time, so its `isSingleFile` branch was only intermittently reached before and is now the sole path.
**Added to device check (1) below: watch what the notification does the moment a single-file book
ends — that is now different for every `.m4b` in the library.**
