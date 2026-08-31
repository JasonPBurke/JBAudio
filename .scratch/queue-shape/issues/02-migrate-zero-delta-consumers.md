# 02 — Migrate the zero-delta consumers

**Spec:** `.scratch/queue-shape/spec.md` — `## Problem statement`, decision 2.

**What to build:** Every site that decides Queue shape for itself asks the verdict from
`01` instead. Each site keeps its own branching — this ticket moves *where the answer comes
from*, not what anyone does with it.

Three of these sites currently answer by asking the Player how many items are in the Queue.
That is the wrong question in a subtle way: it answers about *whichever Book happens to be
loaded*, which disagrees with the Book being asked about for the length of every Book
switch. Those three sites shed their Queue reads entirely — a Queue read marshals the whole
track list across the bridge, so on a clipped Book with hundreds of chapters this is a
saving, not a cost.

Two of the sites migrated here were on **no list** in the brief or its addenda — an inlined
copy of the "treat as single file" predicate in the library-row progress helper, and a
predicate in the player's progress bar that names the clipped-chapters gate as though it
answered "is Position chapter-relative?".

⚠ **This ticket has no behavioural delta on any Book that works today.** The progress bar's
predicate change looks like a fix but is inert: checked against all four authoring shapes,
the old and new answers agree on three, and diverge only on the shape that is already broken
in the queue builder for an unrelated reason. If a device difference appears here, something
is wrong — stop and investigate rather than accepting it.

**Blocked by:** 01

**Status:** resolved

- [x] All three Player-reading shape sites now ask the verdict, and no longer read the Queue
      to do it
- [x] The two previously unlisted variants — the inlined predicate in the library-row
      progress helper, and the progress bar's `isChapterRelative` — both ask the verdict
- [x] The remaining consumers of the two shared shape predicates ask the verdict —
      `usesChapterQueue` has none left at all; `treatAsSingleFile` keeps exactly three, all
      in `setup/service.ts`, which are `03`'s bullet and not this one's
- [x] Queue reads that survive are only the honest ones: *is anything loaded?*, *am I at the
      last item?*, and *what is in it?* — none of them asking about shape
- [x] No consumer's branching logic changes; only the source of the verdict
- [x] Existing tests pass unmodified wherever behaviour is genuinely unchanged; any test that
      needed editing is called out on this ticket with the reason
- [x] `tsc` 0, eslint 0, full suite green

---

## Answer

Eleven call sites across nine files now ask `queueShapeOf`. `usesChapterQueue` has **zero
callers left** and `treatAsSingleFile` has exactly three, all in `setup/service.ts` — which
is `03`'s scope. `tsc` 0, eslint 0 errors, full suite green (92 suites / 1154 tests, both
projects, cold cache).

### The eleven sites

| Site | Was | Now |
| ---- | --- | --- |
| `helpers/chapterSkip.ts:51` `skipToPreviousChapter` | `queue.length === 1` | verdict, no Queue read |
| `setup/service.ts:686` `PlaybackActiveTrackChanged` | `queue.length === 1` | verdict, no Queue read |
| `helpers/remainingChapterCount.ts` | `queue.length === 1` **and** `queue.length` arithmetic | verdict + `chapters.length`, no Queue read |
| `helpers/bookProgressUtils.ts:66` | inlined `book.isSingleFile && !shouldUseClippedChapters(...)` | verdict |
| `components/PlayerProgressBar.tsx:82` `isChapterRelative` | `shouldUseClippedChapters(...)` | verdict |
| `helpers/chapterPlayback.ts:52` `resolveCurrentChapterIndex` | `usesChapterQueue` | verdict |
| `helpers/chapterPlayback.ts:73` `calculateRemainingBookTime` | `usesChapterQueue` | verdict |
| `db/footprintQueries.ts:75` `getCurrentChapterInfo` | `usesChapterQueue` | verdict |
| `db/footprintQueries.ts:158` `recordSeekFootprint` | `usesChapterQueue` | verdict |
| `hooks/useCurrentChapterStable.ts:68` | `usesChapterQueue` in a `useMemo` | verdict, `useMemo` dropped |
| `helpers/nextPress.ts:176` `pressNext` | `treatAsSingleFile(book)` | verdict |

No consumer's branching changed. `useCurrentChapterStable`'s `useMemo` went because
`queueShapeOf` memoises on the chapters array reference itself, so the wrapper cached the
same answer twice. `footprintQueries`' local `ChapterData` now aliases the verdict's own
`ShapeChapter` projection rather than restating its four fields.

### Surviving Queue reads — the grep

```
$ grep -rn "getQueue()" src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v player/trackPlayer.ts
src/helpers/restoreLastActiveBook.ts:48    is anything loaded?
src/setup/service.ts:548                   is anything loaded?
src/helpers/chapterSkip.ts:184             am I at the last item?  (resolveNextPress)
src/helpers/relativeSeek.ts:136            what is in it?          (per-item durations)

$ grep -rn "queue.length === 1" src --include=*.ts --include=*.tsx
(three hits, all prose in comments — no live mechanism)
```

Exactly the four the spec's decision 7 names as innocent, and no others.

`relativeSeek.ts`'s `readQueueShape` (the spec's mechanism 9) was checked and left alone: it
reads per-item durations to compute a landing spot and resolves no shape at all, so it is
the `relativeSeek:144` "what is in it?" read wearing a misleading name. **`04` inherits the
rename** — its grep-over-the-inventory-table bullet will trip on the identifier otherwise.

### Behavioural delta — none on any Book that works today

The `PlayerProgressBar` predicate change was re-checked against all four authoring shapes,
and the ticket's phrasing needs one correction: **the shapes agree on the VALUE, not on the
verdict.**

| Shape | old `shouldUseClippedChapters` | new `=== 'multi-item'` | `start` |
| ----- | ------------------------------ | ---------------------- | ------- |
| A. multi-file | `false` | **`true`** | `0` either way — every row's `startMs` is `0` |
| B. clipped | `true` | `true` | `0` |
| B. legacy | `false` | `false` | `startMs` |
| C. one chapter | `false` | `false` | `startMs`, which is `0` |
| D. multi-file, embedded chapters | `false` | **`true`** | **diverges** |

On shape A the predicate FLIPS, and is inert only because a multi-file Book's every `startMs`
is `0`, so the subtraction is of zero. That is the same `startMs: 0` coincidence `01`'s
Finding 2 recorded as load-bearing-but-unenforced across its seven sites — this is an eighth
place resting on it, and it is worth `07`'s attention when the translator removes the
subtraction entirely. Shape D genuinely diverges, and is already broken in the queue builder
for an unrelated reason.

Four residuals, all in states the Player cannot actually be in, recorded rather than
hidden:

1. **`remainingChapterCount`, active item with no `bookId`** — was `0`, now `null`. Both
   queue builders set `bookId` on every track, so this needs a queue item the app does not
   build. `null` is also what the function's own header reserves for "no Book loaded".
2. **`remainingChapterCount`, multi-item Book absent from the library store** — was
   `queue.length - 1 - index`, now `0`. The sibling branch already answered `0` for "an
   Active Book with no usable chapter list", and the store hydrates every Book at start.
3. **`service.ts` `PlaybackActiveTrackChanged`, Book absent from the store on a one-item
   Queue** — was an early return, now falls through to `setChapterIndex(bookId, 0)` and
   `sleepTimer.onChapterChanged()`. The index it writes is the one already there; only the
   redundant `onChapterChanged` is new, and the handler's own `getBookFromStore` companions
   at `:249`/`:572` show the store is populated on this path.
4. **`chapterSkip.ts` `skipToPreviousChapter`, Book absent from the store or with an empty
   chapter list** — was always `seekTo(0)` + `'restart'` via the one-item branch; the verdict
   now fails closed to `'multi-item'`, whose two arms must therefore BOTH land at 0 for this
   to be zero-delta. Past the threshold they do outright. Under it, the arm that could
   diverge (`skipToPrevious()` + a `'previous'` footprint for a press that moves nothing) is
   unreachable, because a Queue with one item has its active index at 0 and the
   first-queue-item check restarts. **Pinned by a test rather than left as an argument** —
   `chapterSkip.test.ts`'s "restarts UNDER the threshold too". Found by the spec review; the
   first version of this answer missed it, and tested only the arm that was already
   identical.

Where the multi-item arithmetic swapped `queue.length` for `chapters.length`, the two are
the same number by construction: both queue builders map chapters in order and neither
filters nor sorts.

### Tests edited, and why

Two files, for **one shared reason, and it is a finding rather than a chore**: both used
`queue.length` as the shape signal, so their chapter rows only ever needed `startMs` and
were never checked for being the shape their describe block named. Asking the verdict makes
the fixture's own rows load-bearing — and rows with **no `url` and no `chapterDuration`
accidentally SATISFY the clipped-chapters gate**: every `url` is `undefined` so they read as
one file, and a missing `chapterDuration` estimates a zero-byte sample table that fits under
any heap budget. Both files' "legacy single-file book" fixtures therefore answered
`'multi-item'`.

- **`helpers/__tests__/chapterSkip.test.ts`** — fixtures gained `url`, `chapterDuration` and
  `isAutoGenerated`; the one-item fixture is now one auto-chaptered file (the auto-chapter
  exclusion is what keeps it off the clipped path) and the multi-item fixture is one file
  per chapter. `getQueue`/`queueOf` scaffolding removed. The two no-chapter-data cases moved
  to their own describe, because with no rows to read the verdict fails closed to
  `'multi-item'` — they still land at `seekTo(0)`, by the other branch. **No assertion
  changed.**
- **`helpers/__tests__/remainingChapterCount.test.ts`** — same fixture correction, plus each
  test now seeds the store with the Book it is about (the count is taken from the chapter
  list, not the queue). Assertions changed only for residuals 1 and 2 above. One test added:
  the Queue is never read.

Both files' fixtures now come from **`helpers/__tests__/support/queueShapeFixtures.ts`**, so
the finding above is recorded once rather than copied into two headers — and its helpers are
named `oneItemChapters` / `multiItemChapters`, after the Queue shape, because CONTEXT.md's
**Queue shape** entry lists "single-file" under _Avoid_.

`chapterSkip.queuePosition.test.ts` needed no edit — it mocks the store as empty, so the
verdict fails closed to `'multi-item'`, which is the shape those tests are about.

### What `03` and `04` inherit

- **`03`**: `setup/service.ts`'s three `treatAsSingleFile` sites are the only shape
  mechanisms left in the service, and `PlaybackActiveTrackChanged` is already migrated —
  so the end-of-queue `seekTo(0)`-vs-`skip(0)` delta is the only one left to land.
- **`04`**: `usesChapterQueue` now has zero callers and can be deleted outright; add the
  `readQueueShape` rename to its grep bullet.
- **`07`**: the shape-A row in the progress-bar table above is an eighth site resting on the
  `startMs: 0` coincidence.

### Review

Reviewed on both axes (`mattpocock-skills:code-review`, Standards + Spec). Four findings
acted on:

- **`resolveNextPress`'s `treatAsSingleFile` parameter renamed `oneItemQueue`** (Standards,
  hard violation). CONTEXT.md's **Queue shape** entry lists "single-file" under _Avoid_
  because it describes the Book on disk, not the Queue — and this parameter now carries a
  Queue-shape verdict it no longer derives. Renamed through `nextPress.ts`, `chapterSkip.ts`
  and `nextPress.test.ts`; no logic changed.
- **`footprintQueries`' `ChapterData` reduced to `ShapeChapter`** (both axes). `Chapter`'s
  `startMs` and `url` are already non-optional, so the intersection restated two of the four
  fields it claimed to stop restating.
- **The duplicated fixtures and their warning extracted to `support/queueShapeFixtures.ts`**
  (Standards, Duplicated Code).
- **Residual 4 above, and the test that pins it** (Spec).

Declined: renaming `useCurrentChapterStable`'s local `chapterQueue` (Standards, judgement
call). "Chapter queue" is `chapterPlayback.ts`'s established wording for this branch, is on
no _Avoid_ list, and the distinction dissolves entirely at `07`; renaming it here is churn
the ticket's "no consumer's branching logic changes" bullet does not buy.
