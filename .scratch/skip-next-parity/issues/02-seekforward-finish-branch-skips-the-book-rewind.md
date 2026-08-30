# 02 — `seekForward`'s finish branch never got the Book rewind (LIVE)

**What's wrong:** `relativeSeek.ts`'s `seekForward` finishes a Book with none of
the store/DB rewind — a fourth copy of the finish triple, and a narrow but real
regression of `.scratch/remote-noop-footprint/issues/02-*.md`, already fixed once
on the remote-next side.

⚠ **Scope shrank twice under review. Read `## Consequences` before trusting the
older prose here.** Two of the three defects first filed did not survive: the
"spurious footprint" does not exist, and the `finished_at` rewrite is harmless.
The `Finished` guard moved to ticket `01`. What remains is one self-healing UI
glitch and one off-by-one sleep-timer decrement, both on legacy single-file
Books only.

**Status:** ready-for-agent

**Found:** 2026-08-30, during the triage grilling of ticket `01` in this
directory. Ticket `01`'s acceptance criteria asked for `relativeSeek`'s finish
triple to be "reviewed in the same pass and either folded in or explicitly
justified as distinct". It was reviewed. It is neither — it is a **separate live
bug**, so it is filed here rather than absorbed.

## How this compares to ticket 01

Ticket `01`'s copy is unrendered. **This one is not** — `SeekForwardButton` is
rendered inside `PlayerControls`, which the player screen mounts. But see
`## Reproduction` below before assuming it is easy to hit: a first device
attempt on 2026-08-30 **failed to reproduce**, and the reason turned out to be
load-bearing.

⚠ **Correction to this ticket's first draft**, which claimed "any user who jumps
forward past the end of a Book hits this path today." That is **wrong** and was
written before the gates below were traced.

The accurate picture, after the device reproduction and the analysis in
`## Consequences`: this defect is **narrow and self-healing**. It is still more
reachable than `01`, whose copy is unrendered — but the gap is far smaller than
first claimed, and the case for doing it rests on removing the fourth copy of
the finish triple, not on user-visible harm.

## Reproduction — two gates, both easy to miss

### Gate 1: an unrelated path masks it on most books

`CLIPPED_CHAPTERS_SPIKE` is **on**, so a single-file Book with real chapter
markers loads as a **clipped chapter queue** — multi-item. On that path
`shape.index !== 0`, so `seekForward` calls `skip(0)`, which fires
`Event.PlaybackActiveTrackChanged`, whose multi-file branch calls
`setChapterIndex(bookId, 0)`. **Store and DB are zeroed correctly, by
accident** — a different handler happens to do the rewind this branch skips.

So the defect only lives on the **legacy single-file** path, reached only by a
Book that FAILS `shouldUseClippedChapters`:

- chapters are **auto-generated** (single MP3, no embedded markers) — easiest, or
- no valid chapter offsets (every `startMs` is 0), or
- it fails the heap gate (a very long Book; the 28.7 h case OOM'd on 256 MiB)

⚠ This also means **the fix must not regress the clipped/multi-file path**,
which is currently correct for the wrong reason. Whatever rewind is added here
has to be idempotent with the `ActiveTrackChanged` write, not a second
conflicting one.

### Gate 2: the stale value must exist before it can be exposed

`playbackIndex[bookId]` is written ONLY by the progress handler, driven by
`PlaybackProgressUpdated` — which fires during **playback**. A Book that was
scrubbed to near the end **while paused** never advanced its chapter index, so
there is no stale value and the highlight falls back to an equally unadvanced DB
row. This is what defeated the first device attempt.

### Steps that do reproduce

1. A **legacy single-file** Book per Gate 1 — a single MP3 with no embedded
   chapters is the easy case (chapter list shows evenly-spaced synthetic marks).
2. **Play** into the final chapter and let it run a few seconds. Do NOT scrub —
   the write only happens on a progress tick.
3. **Verify the setup:** the chapter list highlights the **last** chapter. If
   not, step 2 did not take; stop.
4. Return to the player, seek-forward past the end.
5. Book is marked Finished, playback resets to 0.
6. **Open the chapter list → the LAST chapter is still highlighted.**

⚠ **The highlight self-heals on the next play press** (the progress tick
rewrites the index to 0), which is a third reason this is easy to miss. The
sturdier symptom is consequence 2 below: press play after step 5 and a
**spurious `chapter_change` footprint** is written, because the chapter tracker
still points at the final chapter while the position is 0. Verify that in the DB
rather than the UI.

⚠ The `finished_at` rewrite is **not** worth reproducing — see the retraction in
`## Consequences`. The guard for it lives in ticket `01` now.

## What it does vs. what the fixed path does

`seekForward`'s `'finished'` branch performs the **player** half of finishing a
Book and none of the **persistence** half:

| Step | `seekForward` | `handleRemoteNextPress` finish |
| --- | --- | --- |
| Guard on already-`Finished` | ❌ **no guard** | ✅ guarded on the store |
| Mark the Book `Finished` | ✅ | ✅ |
| `skip(0)` when not at index 0 | ✅ | n/a — single-file only, one queue item |
| `seekTo(0)` + `pause()` | ✅ | ✅ |
| Store playback progress → 0 | ❌ | ✅ via `resetBookToStart` |
| Store + DB chapter index → 0 | ❌ | ✅ via `resetBookToStart` |
| Rewind the chapter-change tracker | ❌ | ✅ via `resetBookToStart` |
| Bookkeeping failure isolated from the press | ❌ | ✅ |

⚠ The two are **not** straightforwardly interchangeable, and this is the part
that needs thought rather than a copy-paste:

- `seekForward`'s `'finished'` can fire for **any** queue shape, which is why it
  carries a `skip(0)` that the remote-next finish branch does not need (that one
  only ever fires for a legacy single-file Book, which has exactly one queue
  item).
- `resetBookToStart` is currently only ever called on the single-file path — the
  `PlaybackQueueEnded` caller guards it behind `isSingleFile && chapters.length > 1`
  and takes a different branch for multi-file Books. Whether it is correct
  as-is for a multi-file Book finished by a forward jump has **not** been
  established and must not be assumed.

## Consequences

⚠ **These split into two populations, and the split is the whole scoping story.**
Consequences 1–2 are gated by Gate 1 (legacy single-file Books only) and are
transient. Consequences 3–4 are gated by **nothing**.

### Narrow and self-healing — legacy single-file Books only

1. **Stale chapter highlight.** The symptom of `remote-noop-footprint/02`: the
   chapter list resolves its highlight from the playback-index store and only
   falls back to the DB row when that selector is `undefined`, so a stale store
   entry beats a correct DB row. The Book is at 0; the UI says last chapter.
   **Self-heals on the next play press** — reproduced and confirmed on device
   2026-08-30 — because `handleBookPlay` writes index 0 on the way in.
2. **A chapter-mode sleep timer silently loses one chapter.** On the next play
   the tracker still points at the final chapter while the position is 0, so
   that tick reads as a chapter change and fires `sleepTimer.onChapterChanged()`.
   The count is `Math.max(0 - lastChapterIndex, 1)`, clamping to exactly one
   spurious decrement.

⚠ **Correction to this ticket's first draft**, which listed *"a spurious
`chapter_change` footprint"* here. **That does not happen.** The progress
handler records **no footprints at all** — every footprint call in the playback
service sits inside a `Remote*` event handler. The progress handler's
chapter-change detection drives the sleep timer and the lock-screen metadata,
nothing else. Do not go hunting for a phantom footprint bug.

### Queue-shape independent

3. **A DB failure costs the user the press** — a throw while marking Finished
   escapes before `seekTo(0)` and `pause()`. Nothing to do with queue shape, so
   Gate 1 does not mask it. Theoretical rather than observed.

### RETRACTED — the `finished_at` rewrite is harmless

⚠ **This ticket's first two drafts led with a `finished_at` corruption claim: a
jump inside the book-end lead window rewrites the timestamp that orders the
Finished tab. The rewrite is real; the harm is not. Do not reinstate it.**

`finished_at` has exactly one consumer — the Finished-tab sort in
`bookRecency.ts`. For the rewrite to reorder anything, another Book's
`finished_at` would have to land between the two writes. It cannot:

- `restoreLastActiveBook` restores a **single** last-active Book id, so a Book
  left parked in its credits is not what returns days later — the most recently
  played Book is.
- Playing a Finished Book from a card or titleDetails **restarts it at 0:00 and
  demotes it off `Finished`** (§C5's restart in `handleBookPlay`), which nulls
  `finished_at` outright.

So finishing another Book in between requires switching the Active Book, and
switching back destroys the precondition. The two writes are always seconds
apart within one uninterrupted stretch on one Book. **Net user-visible impact:
zero.**

**The 3-line guard was nevertheless kept, and moved to ticket `01`** (its
decision 5), justified purely by invariant consistency — three of the four sites
that mark a Book Finished already guard, and a lone unguarded fourth is how a
future reader concludes the guard is optional. It needs nothing from this
ticket, so it is not stranded here.

## Answer

Settled with the driver 2026-08-30, after the device reproduction.

### Does a forward jump that FINISHES a Book record a footprint?

**No. It records nothing, like every other 30-second jump.**

The question was raised because this branch destroys the position it ends at,
and the remote-next finish branch *does* record there — its own comment calls
that footprint "the most perishable footprint in the app". So the press type
said "no" and the outcome seemed to say "yes, urgently".

The outcome argument does not survive. It rested partly on consequence 2 as
first written — a spurious footprint that **does not exist** (see the correction
above). With that gone, `CONTEXT.md`'s **Footprint** rule applies unmodified:

> the press type decides, and both surfaces agree

A 30-second jump is a 30-second jump, whatever it happens to run into. The
remote-next finish records because a deliberate **next press** is a *skip*, and
skips always record. Jumps never do. Keeping that line clean is worth more than
a breadcrumb back to a spot 70 seconds from the end of a Book the user just
finished — the least valuable position in it.

⚠ **Consequence:** `PlaybackQueueEnded` needs no footprint either, and is out of
scope. The "three paths finish a Book, not two" worry raised in the first draft
is closed — finishing a Book is **not** its own press type.

### Scope

**~15 lines in one function. No new modules, no new decisions.**

- The `Finished` guard **moved to ticket `01`** (its decision 5). It is not part
  of this ticket, and its original justification was disproved — it survives on
  invariant consistency alone.
- The rewind is ~5 lines, but is **cheap only after ticket `01`** — until `01`
  extracts `rewindChapterTracking`, this file cannot reach the chapter-tracking
  singleton at all. That is the same blocker `01` exists to remove; do not solve
  it twice.
- The failure isolation is ~3 lines, reusing the swallow the remote path has.

**The considered smaller option, recorded so it is not re-litigated:** ship the
guard alone and drop the rewind, accepting the transient highlight and the
one-chapter sleep-timer slip on legacy single-file Books. Rejected — not because
the symptoms are severe, but because it leaves a **fourth copy of the finish
triple** alive, and copy-drift is exactly how this defect arrived. It remains a
legitimate fallback if `01` slips.

## Acceptance criteria

- [ ] The finish path records **no** footprint (see `## Answer`), and a test
      asserts that — this branch is the one place the jump/skip line is easy to
      cross by accident.
- [ ] A forward jump that finishes a Book leaves it in **the same state** as
      playing it to its true end: playback at 0, chapter index 0 in both store
      and DB, chapter-change tracker rewound.
- [ ] Bookkeeping failure cannot cost the user the skip, seek or pause.
- [ ] Behaviour is established for **both** queue shapes, not assumed from the
      single-file case — including whether the shared rewind is correct for a
      multi-file Book.
- [ ] The chapter list cannot highlight the last chapter of a Book that was just
      reset to 0, reached via this path.
- [ ] Tests cover the finish-by-forward-jump path on both queue shapes,
      including that the clipped/multi-file path — currently correct only
      because `ActiveTrackChanged` happens to zero the index — is not
      regressed or double-written.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green.

## Notes

- Depends on ticket `01` only for **vocabulary**, not for code: if `01` renames
  the shared executor and moves the tracking singleton, this ticket should
  consume the post-rename names. Sequence `01` first to avoid a collision in the
  same files.
- ⚠ Unlike `01`, this one **is** device-verifiable today, because the button is
  already on screen — but only with a Book that satisfies Gate 1 and a run that
  satisfies Gate 2. Budget for sourcing a qualifying Book (a chapterless MP3) as
  part of the work; a first attempt already failed on Gate 2 alone.
- The unit test is the cheaper and stricter gate here. `fakePlayer.ts` can hold
  a one-item queue, so the legacy single-file finish path is assertable without
  a device; the device pass is for the stale highlight, which is a UI symptom no
  unit test observes directly.

## Comments

> *This was generated by AI during triage.*

## Agent Brief

**Category:** bug
**Summary:** A forward jump that runs off the end of a Book skips the Book
rewind, leaving the stored chapter index pointing at the final chapter, and lets
a bookkeeping failure swallow the user's press.

⚠ **Sequence this AFTER ticket `01` in this directory.** It depends on the
chapter-tracking rewind that `01` extracts, and on `01`'s renames. Doing it
first means solving the same access problem twice.

**Read `## Answer` and `## Consequences` before starting.** Two claims in this
ticket's first draft were corrected after a device reproduction; both
corrections are marked ⚠ inline, and both change what you should go looking for.

**Current behavior:**
When a forward jump lands past the end of a Book, the seek helper marks the Book
Finished, moves the player to the start, and pauses. It performs only the player
half of finishing a Book and none of the persisted half, so the stored chapter
index and the chapter-change tracker are left pointing at the final chapter. And
a database failure while marking Finished escapes before the seek and the pause,
costing the user the press they made.

⚠ The already-`Finished` guard on that same mark is **ticket `01`'s** job, not
yours. Do not add it here, and do not remove it if `01` already did.

**Desired behavior:**
A Book finished by a forward jump ends in exactly the same state as one played
to its true end — playback at the start, chapter index zero in both the store
and the database, chapter-change tracker rewound. No bookkeeping failure can
cost the user the skip, seek or pause. The press records **no footprint**,
matching every other 30-second jump.

**Key interfaces:**
- The relative-seek helper's finish branch is the only site changing.
- It should reuse the **existing shared rewind** that the queue-ended path and
  the next-press finish branch already use, rather than open-coding a fourth
  copy. Removing that duplication is the point of the ticket.
- It reaches the chapter-tracking singleton through the narrowed rewind verb
  ticket `01` introduces — not by importing the playback service, which is a
  leaf module and must stay one.
- The already-Finished check reads the Book's progress value from the library
  store, the same way the next-press finish branch guards its mark.

**Acceptance criteria:** see `## Acceptance criteria` above — it is the
authoritative list and includes the regression guard for the clipped/multi-file
path.

**Out of scope:**
- **Do not make this branch record a footprint.** See `## Answer`.
- **Do not add a footprint to the queue-ended path.** Same reason.
- **Do not change the 30-second jump behaviour** in any other respect.
- **Do not restructure the relative-seek walker** or its landing-spot logic.
  Only the finish branch is in scope.
- Do not chase a spurious `chapter_change` footprint — it does not exist.
