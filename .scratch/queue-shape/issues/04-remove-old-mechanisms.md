# 04 — Remove the old mechanisms

**Spec:** `.scratch/queue-shape/spec.md` — `## Problem statement`, decision 7.

**What to build:** The contract half of expand–contract. With every call site migrated, the
predicates they used to call are deleted, and the app is left with exactly one answer to
"what shape is this Book's Queue?".

Also drops the persisted scan-time flag from every playback decision. The database column
**stays** — the feature flag's own header notes that Books still carry it — but no playback
code reads it. It bought nothing: the library store hydrates a Book's chapters in the same
conversion that reads the flag, so there was never a case where the flag was available and
the chapters were not.

After this ticket, **stage 1 is complete and shippable on its own.** Every consumer still
branches on shape; what changed is that they all branch on the *same* answer.

⚠ **No lint rule is added, deliberately** — see the spec's decision 7 for the reasoning and
for what to reconsider if stage 2 ever gets separated from stage 1 by more than a few days.
Do not add one as a bonus.

**Blocked by:** 02, 03

**Status:** resolved

- [x] The two shared shape predicates and the derived single-file check are deleted
      — ⚠ with one qualification: the derived single-file check was **de-exported into the
      gate**, not deleted. See the Answer's section on it; deleting it outright would have
      moved the memory gate's answer for every Book
- [x] The two inline copies migrated in `02` are gone, not merely bypassed
- [x] A grep over non-test sources proves no mechanism from the spec's inventory table
      survives, and the grep is recorded on this ticket
- [x] No playback code reads the persisted scan-time flag; the database column is untouched
- [x] No lint rule is added
- [x] `tsc` 0, eslint 0, full suite green

---

## Answer

Stage 1 is complete. `queueShapeOf` is the app's only answer to "what shape is this Book's
Queue?", and the nine mechanisms the spec inventoried are gone as callable mechanisms —
one of them by de-exporting rather than by deletion, for a reason below. `tsc` 0, eslint 0
errors, full suite green (93 suites / 1160 tests, both projects, cold cache).

### The inventory table, mechanism by mechanism

| # | Mechanism | Disposition |
| - | --------- | ----------- |
| 1 | `isSingleFileBook()` | **De-exported**, inlined into the gate as private `multipleChaptersInOneFile` — see below |
| 2 | `book.isSingleFile` in playback | Gone with `treatAsSingleFile`; column, model, scan writers and store hydration untouched |
| 3 | `shouldUseClippedChapters()` | **Kept, and it is not a shape mechanism** — see below |
| 4 | `usesChapterQueue()` | Deleted (`chapterPlayback.ts`) |
| 5 | `treatAsSingleFile()` | Deleted (`clippedChapters.ts`) |
| 6 | `queue.length === 1` | Zero hits in `src/`, prose included |
| 7 | inline copy in `bookProgressUtils` | Gone — the site asks the verdict, no residue |
| 8 | `PlayerProgressBar`'s `isChapterRelative` | The predicate is gone; the identifier survives as a LOCAL holding the verdict's consequence, which is what the branch below it needs. `07` dissolves the branch entirely |
| 9 | `readQueueShape()` | Renamed `readSeekFrame` (`relativeSeek.ts`) — `02` handed this rename here |

`getChapterEndPosition` (zero callers, `singleFileBook.ts`) was already gone before this
ticket.

### Why `isSingleFileBook` was de-exported rather than deleted

Deleting it outright would have changed the memory gate's answer for every Book, which
stage 1 does not do. `02`'s audit established that its `chapters.length > 1` is load-bearing
**only together with** `hasValidChapterData`'s — flipping either alone moves no verdict,
flipping both makes a one-chapter Book clippable. So the arithmetic stays bit-identical and
what changes is *reachability*: it is now a private function inside
`shouldUseClippedChapters`, unexported and unreachable, and its header says it must stay
that way and why. A mechanism nothing can call is not a mechanism.

The rename to `multipleChaptersInOneFile` is not cosmetic. `isSingleFileBook` named the
Book on disk while every caller was asking about the Queue — the exact confusion CONTEXT.md's
**Queue shape** entry lists "single-file" under _Avoid_ for.

### Why `shouldUseClippedChapters` stays, and why it is not a tenth mechanism

It is on the inventory table because sites *used* to call it to decide shape. It answers a
different question — *can this device afford clipping?* — which the spec's decision 5 keeps
deliberately out of the glossary as a **cause**, not a thing. Its three surviving callers ask
it as an input, never as a verdict:

- `queueShape.ts:93` — folds it into the one verdict.
- `handleBookPlay.ts:182`, `restoreLastActiveBook.ts:130` — `03` made both lead with the
  verdict and ask the gate second, as **which** multi-item Queue to build rather than
  **whether** the Queue is multi-item.

### The persisted flag

No playback code reads `book.isSingleFile`. What survives is scan and persistence only, and
the column is untouched exactly as the spec's `## Out of scope` requires:

```
src/db/models/Book.ts:57            the column
src/db/schema.ts:101, migrations.ts:415   schema + v23 migration
src/types/Book.ts:35                the field
src/helpers/scannedBookGrouping.ts:181    the scan-time writer
src/hooks/usePopulateDatabase.tsx   four write sites
src/store/library.tsx:90            hydration into the Book object
```

`constants/featureFlags.ts`'s header claimed *"the `isSingleFile` branches in
src/setup/service.ts are bypassed for playback"*. Those branches no longer exist on either
setting of the flag, so the sentence was describing a bypass of nothing. Reworded to state
what is now true — the flag is an input to `queueShapeOf` and nothing branches on it
directly — while keeping the note the ticket asks for, that Books still carry the column.
⚠ A `must stay compile-time constant` warning was added there, because the flag going
runtime-variable is one of the two facts `queueShapeOf`'s memo silently depends on, and the
flag's own file is where someone would make that change.

### The grep

Over non-test sources, `src/**/*.ts{,x}`:

```
$ grep -rn 'isSingleFileBook\|usesChapterQueue\|treatAsSingleFile' src ... | grep -v __tests__
src/helpers/clippedChapters.ts:23   prose in the private predicate's header, naming what it
                                    used to be

$ grep -rn 'queue.length === 1' src ... | grep -v __tests__
(no hits — not even prose)

$ grep -rn 'readQueueShape\|getChapterEndPosition' src ... | grep -v __tests__
src/helpers/relativeSeek.ts:126     prose, recording the old name

$ grep -rn 'isSingleFile' src ... | grep -v __tests__
(scan / schema / store hydration only — the eleven lines listed above, plus two prose
 mentions in featureFlags.ts and queueShape.ts)

$ grep -rn 'shouldUseClippedChapters' src ... | grep -v __tests__
(the definition, the verdict, the two builders, and three prose mentions)

$ grep -rn 'queueShapeOf' src ... | grep -v __tests__ | wc -l
47
```

### The vocabulary sweep `03` handed over

Comments naming a deleted predicate cannot merely have the identifier removed — the sentence
around them is about a function that no longer exists. Reworded, no logic touched:

- `queueShape.ts:71` — the `length > 0` rationale named both deleted predicates. It now
  describes the off-by-one without naming callables, so it stays true as prose.
- `chapterSkip.ts:169` — `resolveNextPress`'s `oneItemQueue` header explained the rename away
  from `treatAsSingleFile`; now phrased as "a since-deleted predicate".
- `chapterPlayback.ts` — the module header's "chapter-queue mode / legacy single-file mode"
  became multi-item / one-item, and its private `ChapterLike` was replaced by
  `queueShape.ts`'s `ShapeChapter`, which is the same four fields. That is `02`'s
  `footprintQueries` ruling applied to the last copy of that projection.
- `setup/service.ts:65` and the `PlaybackActiveTrackChanged` comment — the two instances
  `03` explicitly left for this sweep.
- `relativeSeek.ts` — beyond the rename, its finish-branch comment called a one-item Queue
  "legacy single-file Books" and its multi-item sibling "the multi-file branch".

`readSeekFrame`'s new header states outright that it **resolves no shape**, because the old
name is why the spec had to carve it out of scope in the first place.

### Tests

- `chapterPlayback.test.ts` — the `usesChapterQueue` describe and its two assertions inside
  the spike-off describe were deleted with the function.
- ⚠ **The spike-off coverage they carried was not dropped, it moved.** `queueShape.test.ts`
  gained a `CLIPPED_CHAPTERS_SPIKE off` describe pinning both shapes, because the verdict is
  now where that question lives. Without this the flag's only remaining consumer would have
  been untested on its `false` setting.
- One test added to `chapterPlayback.test.ts`: `resolveCurrentChapterIndex` derives the
  Chapter from the position on a one-item Queue **with the spike on**, the case the deleted
  `usesChapterQueue(autoChapters) === false` test used to stand in for.

⚠ **A fixture trap found while writing that test, worth recording next to the one `02`
found.** The file's `noOffsetChapters` — two rows, one url, both `startMs: 0` — reads as a
one-item Queue but is useless for any position-derives-the-Chapter assertion:
`findChapterIndexByPosition` walks BACKWARDS for the last row whose `startMs <= position`,
so with every row tied at `0` it answers the LAST index for every position, index `1` at
position `0` included. Replaced with an auto-generated copy of the clipped fixture, which
reaches one-item through the gate's auto-chapter exclusion and keeps real offsets. A
shape-correct fixture is not automatically a position-correct one.

### No lint rule

None added, per the ticket and the spec's decision 7.

### Review

Reviewed on both axes (`mattpocock-skills:code-review`, Standards + Spec). The Spec axis
verified independently that the gate is bit-identical (the body is character-for-character
the old one, at the same position in the same `||` chain), that no lint rule was added
(`eslint.config.js` untouched by the diff), and that no playback code reads the persisted
flag. It found no behavioural delta — every source change is the deletion of a callerless
function, a private-scope move, a rename, or prose.

Acted on:

- **The checkbox overstated "are deleted"** (Spec). The derived single-file check exists,
  it is only unreachable. Qualified in the bullet above rather than left to the Answer.
- **One deleted test was genuinely lost, not relocated** (Spec, the one that mattered). The
  Answer claimed only the spike-off coverage moved. The deleted `usesChapterQueue`
  describe also pinned a spike-ON case with **no successor**: several chapters, one file,
  every `startMs: 0` — one-item because `hasValidChapterData` is false, which is a
  different exclusion from the heap gate and from the auto-chapter rule, and the four-shapes
  block reaches neither. `queueShape.test.ts` gained it. Without it, that gate exclusion had
  no test at all.
- **`featureFlags.ts`'s new header stated something false** (Standards, hard). It said
  "nothing branches on it directly" — `shouldUseClippedChapters` branches on it directly;
  `queueShapeOf` never reads it. Reworded to name the gate as the flag's only reader.
- **The vocabulary sweep stopped at the test boundary** (Spec) and at hunks the diff did not
  touch in files it did (Standards). Both are the Answer's own rule — a comment naming a
  deleted predicate cannot merely have the identifier removed — applied where the
  `grep -v __tests__` could not look. Swept `queueShapeFixtures.ts`, `handleBookPlay.test.ts`,
  and the Queue-describing "single-file"/"multi-file" wording in `chapterSkip.ts`,
  `relativeSeek.ts`, `service.ts` and `clippedChapters.ts`. ⚠ Only where the word describes
  the **Queue**: "one file", "single-file in the DB" and the scan-time flag are the Book on
  disk and are the correct words for it.
- **`readSeekFrame` renamed `readSeekInputs`, and its return type named** (Standards,
  Mysterious Name + Data Clumps). "Frame" names nothing in this domain and collides with
  video frames. The `{ durations, index, position }` clump it returns is exactly
  `RelativeSeekInput` minus the jump, so it is now `SeekInputs = Omit<RelativeSeekInput,
  'delta'>` — the type was already there, unnamed.

Declined, with reasons:

- **The URL-equality `.every()` now existing twice** (Standards, Duplicated Code). The two
  differ in the threshold that this whole spec exists to correct: the gate's `> 1` is
  load-bearing with `hasValidChapterData`'s, and the verdict's `> 0` is the fix. Sharing one
  helper between them would re-couple exactly the two thresholds decision 2 separated, and
  it is what an audit of them would have to un-do. Both headers say so.
- **The spike-off remock harness copied into a second test file** (Standards, Duplicated
  Code). `jest.resetModules()` + `doMock` + `require` has to run in the requiring file's own
  module registry; extracting it would hide a documented trap behind a helper. Twelve lines
  of a jest idiom is the cheaper copy.
- **`ShapeChapter = GateChapter` as a two-named projection** (Standards, Middle Man). `01`'s
  ruling, and its header states the intent: the two types are ONE type precisely so a second
  drifting copy cannot appear. Collapsing the alias would make `queueShape` import from the
  gate's namespace at every consumer.
- **`featureFlags.ts` restating decision 6's compile-time obligation** (Spec, minor scope).
  `queueShape.ts`'s header carries it in full, but the flag's own file is where someone
  would make it runtime-variable, and that person has no reason to open `queueShape.ts`. A
  warning is worth having at the site of the change it warns about.

### What stage 2 inherits

Stage 1 is complete and shippable on its own. Every consumer still branches on shape; they
all branch on the same answer. `07` opens by absorbing that branching into the translator —
starting with the three verdict reads `03` marked as stage-1 tenants in `setup/service.ts`,
`PlayerProgressBar`'s `isChapterRelative` local, and `chapterPlayback.ts`'s two functions.
