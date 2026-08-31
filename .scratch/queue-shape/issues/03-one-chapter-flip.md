# 03 — The one-chapter flip

**Spec:** `.scratch/queue-shape/spec.md` — decision 2.

**What to build:** The two queue builders and the playback service's remaining shape sites
move onto the verdict from `01`. This is where the corrected threshold stops being latent
and becomes real.

**This ticket carries the only behavioural delta in stage 1.** A Book with exactly one
chapter — a single audio file with no chapter metadata, which is a shape the corpus
actually contains — is today claimed by two contradictory predicates at once. After this
ticket it is unambiguously a one-item Queue, which changes what the service does when that
Book reaches its end: it seeks back to the start rather than skipping to the first item.
Both land the listener at 0:00; the seek is the honest call on a Queue that has one item.

⚠ That end-of-queue branch is **not** guarded by a chapter-count check, unlike almost every
other consumer of this predicate. It is the one place the flip is observable, which is why
it gets its own ticket and its own test rather than riding along in `02`.

**Blocked by:** 02 — not a logical gate; both touch the playback service and would conflict
if run in parallel.

**Status:** resolved

- [x] Both queue builders ask the verdict rather than deriving shape themselves
- [x] The playback service's remaining shape sites ask the verdict
- [x] A one-chapter Book reaching the end of its Queue seeks to the start instead of
      skipping, and a test against the fake-player harness pins that
- [x] The fake-player harness is used rather than a new one — it already simulates the
      native seek clamp and is the recorded starting point for queue-position work
- [x] Every other consumer of the flipped predicate is confirmed unaffected, either because
      it guards on chapter count or because both readings coincide for a one-chapter Book;
      the confirmation is recorded on this ticket
- [x] `tsc` 0, eslint 0, full suite green

---

## Answer

Five call sites migrated across four files; `treatAsSingleFile` now has **zero callers** and
`isSingleFileBook` has two, both of which are `04`'s. `tsc` 0, eslint 0 errors, full suite
green (93 suites / 1162 tests, both projects, cold cache).

### The five sites

| Site | Was | Now |
| ---- | --- | --- |
| `helpers/handleBookPlay.ts:176` | `isSingleFileBook(book.chapters)` | verdict |
| `helpers/restoreLastActiveBook.ts:53` | `isSingleFileBook(chapters)` | verdict |
| `setup/service.ts:250` `handleProgressUpdated` | `treatAsSingleFile(book)` | verdict |
| `setup/service.ts:573` `PlaybackQueueEnded` | `treatAsSingleFile(book)` | verdict |
| `setup/service.ts:633` `PlaybackState` | `treatAsSingleFile(book)` | verdict |

Both builders now lead with the verdict and ask the memory gate second, as **which**
multi-item Queue rather than **whether** — a Book that clips is already `'multi-item'`, so
the gate no longer decides shape anywhere in a builder. In `handleBookPlay`'s same-Book arm
the clipped and multi-file branches were byte-identical (`skip` + `seekTo`) and collapsed
into one.

### The behavioural delta, and where it actually lives

⚠ **The ticket's framing needs one correction, and it moves the delta rather than removing
it.** The end-of-queue branch reads `treatAsSingleFile`, which composes the **persisted**
`book.isSingleFile` — and that flag is written at scan time as `chapters.length > 0 && all
one url`, i.e. already the `> 0` threshold. So for a one-chapter Book with a current flag,
`service.ts:609` **already** seeked. The contradiction the spec names is real, but at this
site it was `treatAsSingleFile` that was right and the two `> 1` predicates that were wrong.

The delta therefore lands in **two** places, neither of which is quite the ticket's sentence:

1. **The builders — this is the one-chapter flip.** A one-chapter Book used to fall through
   to the MULTI-FILE arm, because the builders asked `isSingleFileBook` (`> 1`). It now
   takes the one-item arm. The Queue is one item either way — which is why nobody noticed
   — but the arm that builds it changes the track's label: the one-item arm shows chapter
   metadata only when `hasValidChapterData` is true, and a single chapter is not that. So
   the notification is labelled with the **Book title** rather than the chapter's, and the
   track's `duration` hint is dropped so the Player resolves the file's own. Both were
   foreseen in `01`'s findings, both are correct for an item spanning the whole Book, and
   both are pinned by `handleBookPlay.test.ts`'s new describe. The arm change also drops an
   unconditional `skip(0)`: the multi-file arm skipped to the chapter index whether or not
   there was anywhere to go, and on a one-item Queue there is not. Two of the describe's
   three cases fail against the pre-change builder; the third, the resume position, passes
   against **both** — the `startMs: 0` coincidence again, and the reason this shape could
   stay miscategorised for so long without a bug report.
2. **The service — a stale-flag fix, not a one-chapter one.** `is_single_file` was added by
   migration v23 as an optional column with **no backfill**, and `store/library.tsx:90`
   reads it `?? false`. A Book scanned before v23 and never rescanned therefore reads
   `false` today, so all three service sites treated a genuine legacy single-file Book as
   multi-item — including the unguarded end-of-queue branch, which called `skip(0)` on a
   one-item Queue. Deriving the verdict from the Book's own chapters cannot go stale that
   way. Reachability is low (every rescan since v23 rewrites the flag) but it is the only
   structural divergence between the old predicate and the new verdict, and it is in the
   direction the ticket describes. Recorded rather than claimed as observed.

### The end-of-queue branch, and why it became a helper

`Event.PlaybackQueueEnded`'s tail — `seekTo(0)` for one item, `skip(0)` otherwise — moved to
**`helpers/rewindPlayerToBookStart.ts`**, taking the verdict as a **parameter**
(`resolveNextPress`'s shape, the spec's rung 3). Not a tidiness preference: `setup/service.ts`
imports `react-native-shake` and `expo-haptics`, so it can only be reached from the `rn`
lane, and `fakePlayer` — which this ticket requires — runs in the `helpers` lane. Extraction
is the smallest change that makes the required test possible. It also names the pair the
codebase already half had: `resetBookToStart` is the **state** half of finishing a Book (store,
DB, chapter tracker) and this is the **transport** half; only the transport is shape-dependent.

⚠ `player.at()` **cannot** tell the two arms apart on a one-item Queue — both land at 0:00,
as the ticket says. The distinguishing assertion is which transport was called; the landing
spot diverges only on a multi-item Queue, where a seek would restart the last chapter and
leave the Book unrewound. `rewindPlayerToBookStart.test.ts` asserts both, and drives the last
two cases through `queueShapeOf` on real fixtures so the flip itself is pinned, not just the
transport.

### Every other consumer of the flipped predicates — the confirmation

**`treatAsSingleFile`** had exactly three consumers, all migrated above:

| Consumer | Unaffected because |
| -------- | ------------------ |
| `service.ts:250` progress tick | guards on `book.chapters.length > 1`, so a one-chapter Book routes to the else arm exactly as before — the guard, not the predicate, is what excludes it |
| `service.ts:633` `PlaybackState` | same `length > 1` guard, same reasoning |
| `service.ts:573` `PlaybackQueueEnded` | its two bookkeeping branches keep their `length > 1` guards, so a one-chapter Book takes the same arm as before; the unguarded tail is the delta itself. ⚠ **Not unchanged in the stale-flag case** — see below |

⚠ **One correction to an earlier draft of this table, found by the spec review.** It said
`PlaybackQueueEnded`'s two branches were "unchanged". That is true for a Book whose
`is_single_file` is current, which is the only case the one-chapter framing covers — but in
the stale-flag case §2 raises, the change reaches **state writes, not just the transport**:

- A legacy single-file Book with a stale `false` flag used to take the
  `setChapterIndex(bookId, track)` arm and now takes `rewindChapterTracking`.
- A one-chapter Book with a stale `false` flag used to take that same arm and now falls
  through to the `setPlaybackProgress(bookId, 0)` arm.

Both new arms are the right ones for the shape — a Book that has just played to its end
should have its chapter tracking rewound, which is what the un-stale path already did — so
this is the stale-flag fix reaching further than the tail, not a second defect. It is
recorded here because the confirmation bullet asks for the audit, and an audit that says
"unchanged" where writes changed is worth less than no audit.

`service.ts:261`'s `let queueShape: BookEndInput['queueShape']` was deliberately **left
alone**. It is not a tenth mechanism — it is assigned by whichever branch ran, which is the
spec's rung 3 — and a one-chapter Book still reaches `evaluateBookEnd` as `'multi-item'`, as
it did before. Making it follow the verdict would be a second behavioural delta in a
Finished-marking path, which this stage does not take.

**`isSingleFileBook`** keeps two callers, both `04`'s and both untouched here:

- `clippedChapters.ts:79`, inside `shouldUseClippedChapters` — where `02`'s audit established
  its `> 1` is load-bearing **together** with `hasValidChapterData`'s. Flipping either alone
  changes nothing; both would make a one-chapter Book clippable. Neither was touched, so the
  gate's answer for every Book is bit-identical, and `queueShapeOf` composes its own
  `length > 0` above it.
- `chapterPlayback.ts:43`, inside `usesChapterQueue` — which has had **zero callers** since
  `02`.

### The grep

```
$ grep -rn "treatAsSingleFile" src --include=*.ts --include=*.tsx | grep -v __tests__
src/helpers/clippedChapters.ts:116   its own definition — zero callers
src/helpers/queueShape.ts:76         prose
src/helpers/chapterSkip.ts:169       prose

$ grep -rn "isSingleFileBook(" src --include=*.ts --include=*.tsx | grep -v __tests__
src/helpers/clippedChapters.ts:79    inside the gate, unchanged
src/helpers/singleFileBook.ts:8      its own definition
src/helpers/chapterPlayback.ts:43    inside usesChapterQueue, zero callers

$ grep -rn "queue.length === 1" src --include=*.ts --include=*.tsx | grep -v __tests__
(one hit, prose in a comment — no live mechanism)
```

No playback code reads `book.isSingleFile` any more except `treatAsSingleFile` itself, which
is now dead. The DB column and its scan-time writers are untouched, per the spec.

### What `04` inherits

`treatAsSingleFile` and `usesChapterQueue` are both callerless and can be deleted outright,
which frees `isSingleFileBook` down to its one honest use inside the memory gate. The two
prose mentions above (`queueShape.ts:76`, `chapterSkip.ts:169`) name the deleted functions
and will need rewording, not just the identifiers removing — `04`'s grep bullet will trip on
them.

### Review

Reviewed on both axes (`mattpocock-skills:code-review`, Standards + Spec). The spec axis
verified the central claim above independently and agreed: the ticket's sentence was wrong
about *where*, and the delta is in the builders.

Acted on:

- **Queue-shape vocabulary in every comment this diff touches** (Standards, hard). CONTEXT.md's
  **Queue shape** entry lists "single-file" under _Avoid_, and the migrated branches were
  left labelled "Single-file book with chapters" / "Multi-file book" above conditions that
  now read `'one-item'`. Reworded to one item / one item per Chapter across `service.ts`,
  `handleBookPlay.ts` and `restoreLastActiveBook.ts`. Two older instances outside this
  diff's hunks (`service.ts:65`, and `PlaybackActiveTrackChanged`'s, which is `02`'s) are
  left for `04`'s sweep.
- **The duplicated builder rationale** (Standards, Duplicated Code). The paragraph explaining
  why a builder needs a verdict was copied into both builders — and `queueShapeOf`'s own
  header already holds it, so it was a third and fourth copy. Both trimmed to
  cross-references.
- **The three service verdict reads are marked as stage-1 tenants** (Standards, ADR 0004
  tension). Ruling 1 demotes the verdict to three callers and hands read consumers a
  translator; nothing in the diff said these three were what `07` absorbs. Now noted at the
  first of them.
- **The fake-player pin used the wrong one-item fixture** (Spec). `oneItemChapters([0])` is
  an AUTO-GENERATED chapter, so it reaches `'one-item'` through the auto-chapter exclusion —
  the right answer for the other fixture's reason. Added `oneChapterBookChapters()` to
  `support/queueShapeFixtures.ts`, which reaches it the way shape C does (the gate
  short-circuits on `isSingleFileBook`'s `length > 1`), and both new test files now use it.
- **The confirmation table's "unchanged" overclaim** (Spec) — corrected above.

Declined, with reasons:

- **Naming the `&& book.chapters.length > 1` guard that recurs three times in `service.ts`**
  (Standards, Repeated Switches). That guard *is* the `> 1` off-by-one the spec's decision 2
  exists to cure. Giving it a shared name would bless it as a predicate at the moment the
  spec is deleting predicates — a tenth mechanism in everything but origin — and stage 2
  dissolves the branch it guards. It was already three copies before this diff and this diff
  adds none.
- **`oneItemQueue` as a boolean rather than a `QueueShape`** (Standards, Primitive Obsession).
  This is `02`'s own review ruling, which renamed `resolveNextPress`'s parameter to
  `oneItemQueue: boolean` for the same vocabulary reason. Where the value is a condition it
  stays a boolean; where it is passed onward (`PlaybackQueueEnded` → the transport helper) it
  keeps the type.
- **Deleting the now-callerless `treatAsSingleFile`** (Standards, dead code). Explicitly
  `04`'s first bullet, and `04` is blocked by this ticket. Doing it here would take its work
  and its grep.
