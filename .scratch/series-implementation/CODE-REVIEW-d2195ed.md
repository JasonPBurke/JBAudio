# Code review — `d2195ed..HEAD` (series implementation)

**Date:** 2026-08-13
**Branch:** `feature/series-styling`
**Base:** `d2195ed` — *"Series: 18 implementation tickets, and three spec amendments"*
**Scope:** 120 files, ~25,514 insertions / 1,756 deletions under `src/`
**Baseline at review time:** jest **711/711 green, 57 suites**. Every finding below is
**latent** — nothing here is a currently-failing test.

**Why this review happened when it did:** ticket
[18](issues/18-delete-the-prototype-harness.md) deletes `src/prototypes/`, which is the only
side-by-side reference for comparing the shipped Series surfaces against the prototypes they
replaced. This review was run while that reference still existed.

## How to read this

Findings are ordered by importance, not by file. Each carries a **verdict**:

- **CONFIRMED** — the mechanism was traced through the actual code during the review, and
  the evidence is quoted in the finding. Act on these directly.
- **PLAUSIBLE** — reported by a review pass with a coherent mechanism, but *not*
  independently verified. **Re-verify before changing code.**

Findings 1–3 are the agreed must-fix set. Finding 4 blocks ticket 18. Findings 5–7 are
confirmed and small. Findings 8–24 are a catalogue.

Open tickets raised by this review, all `ready-for-agent`:

| Ticket | Covers | Note |
| --- | --- | --- |
| [21](issues/21-editor-save-tombstones-dangling-rows.md) | Finding 1 | **Pair with 23** — same function, same rule |
| [22](issues/22-remove-folder-prune-key-mismatch.md) | Findings 2 + 5 | Same function, one pass |
| [23](issues/23-tombstone-restore-slot-stale.md) | Finding 3 | **Pair with 21** |
| [24](issues/24-seriesdetail-uses-real-store.md) | Finding 4 | **Blocks ticket 18** |

Findings 6, 7 and 19–24 are confirmed and small but have no ticket yet — pick them up from
the catalogue below.

---

## 1. Editor Save permanently tombstones dangling membership rows — CONFIRMED

**`src/db/seriesEditorSave.ts:108`** (`nextMembership`) · ticket
[21](issues/21-editor-save-tombstones-dangling-rows.md)

Silent, permanent data loss. Any editor Save writes an `'excluded'` tombstone over every
membership row whose `bookKey` did not resolve against the live library — and detection will
never put the book back.

**The chain, all six links verified:**

1. `src/helpers/scanLibrary.ts:1000` documents dangling rows as a **deliberate, expected**
   state. The prune is gated on `orphanedBooks.length > 0` and the comment reads: *"A
   dangling row is harmless in the meantime — `assembleDerivedSeries` skips keys it cannot
   resolve — and this is deliberate... Do not 'fix' it by pruning unconditionally."*
2. `src/helpers/seriesAssembly.ts:96` — *"Membership keys that don't resolve against the
   live library are silently skipped (graceful skip)."*
3. `src/app/seriesEditor.tsx:440` seeds `orderedBookKeys` from `series.books`, i.e. the
   **post-skip resolved list**. The dangling book is not in it.
4. `src/db/seriesQueries.ts:178` passes **all** `series_books` rows for the series as
   `existing`, unfiltered — dangling rows included.
5. `nextMembership(row, desired)` returns `'excluded'` for any existing row not in
   `desired`. The dangling row is not in `desired`, so it is tombstoned.
6. `src/db/seriesReconcile.ts:353` builds `settledKeys` from `match.books` — **tombstones
   included** — and filters candidates with `!settledKeys.has(...)`. Detection never
   re-inserts.

**Net effect:** one Save while a book's file is temporarily unresolvable removes it from
that series forever, silently, and no rescan restores it.

**The two doors disagree.** `planSeriesJoin` reads rows straight from the DB and does *not*
have this bug. The same user intent through the other door behaves differently.

**Fix direction (design work, not yet done).** The planner cannot currently distinguish *"the
user removed this"* from *"the user could never see this."* It needs the **visible universe**
as an input, not just the desired list — e.g. a third argument naming the keys the editor was
actually able to render, with `nextMembership` leaving any row outside that set untouched
(`undefined`). The rule to encode: **you may only remove what you could see.** Note the DB
layer has no access to the library book map, so filtering inside `updateSeries` would be the
wrong layer.

---

## 2. `removeLibraryFolder`'s prune inversion is destructive on a key mismatch — CONFIRMED

**`src/db/settingsQueries.ts:286`** · ticket
[22](issues/22-remove-folder-prune-key-mismatch.md)

Removing an unrelated library folder can destroy a **surviving** book's membership row, and
cascade into deleting the entire series — name, ordering and pinned-artwork column.

**What changed.** The diff flipped an allowlist into a blocklist:

```ts
// before — allowlist. Only keys collected from deleted books were destroyed.
if (removedKeys.has(sb.bookKey)) { ... }

// after — blocklist. Anything not in liveKeys is destroyed.
selectOrphanedMemberships(allSeriesBooks, liveKeys)   // rows.filter(r => !liveKeys.has(r.bookKey))
```

Under the allowlist an unmatched key was **harmless** (the row simply survived). Under the
blocklist every gap in `liveKeys` is destructive.

**Why there are gaps.** `liveKeys` is built from `chapters[0].url` of a raw
`await book.chapters.fetch()`, whose order WatermelonDB does not guarantee. But the canonical
key is the **startMs-sorted** first chapter:

- `src/store/library.tsx:61` — `.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))`
- `src/db/detectionQueries.ts:70` spells it out: *"`bookStructuralKey` takes
  `chapters[0].url` **after the library store sorts** chapters by `startMs ?? 0` with a
  STABLE sort."*

Any surviving book whose rowid order differs from startMs order contributes the wrong key,
its row is classed as an orphan, and `selectEmptySeriesIds` then reaps the series.

**The two prune sites flatly disagree** — despite the new comment asserting both *"delegate
to `seriesOrphanPrune`, which is authoritative"*:

| Site | `liveKeys` contains | Character |
| --- | --- | --- |
| `scanLibrary.ts:1013` | **every** surviving chapter url | forgiving superset |
| `settingsQueries.ts:286` | one `chapters[0].url` per book | destructive subset |

Extracting the *decision* into `seriesOrphanPrune` did not stop the *inputs* from drifting.

**Fix direction.** Match the sibling: feed every surviving chapter url into `liveKeys`. That
is safe (a removed book's chapters are all deleted, so its urls never enter the set) and
still achieves the pruning goal. Consider a shared helper so the two sites cannot drift again
— that is the root cause, not the symptom.

---

## 3. Tombstone restore lands in the wrong slot once two books have been removed — CONFIRMED

**`src/db/seriesJoin.ts:82`** · ticket
[23](issues/23-tombstone-restore-slot-stale.md)

The ticket-17 device fix is **incomplete**. It handles one tombstone and reopens the original
bug with two.

`planEditorSave` compacts **visible** rows to `0..n-1` but never repositions tombstones, so
tombstone positions decay into a stale coordinate space.

**Hand-simulated, both cases:**

```
ONE removal — correct
  A,B,C,D,E → remove D
  visible A,B,C,E compact to 0,1,2,3 ; D tombstone keeps 3
  re-join D: visible.filter(pos < 3) = A,B,C = 3 → slot 3 → A,B,C,D,E   ✓

TWO removals — wrong
  ...then remove B
  visible A,C,E compact to 0,1,2 ; B tombstone 1, D tombstone STILL 3
  re-join D: visible.filter(pos < 3) counts all three → slot 3 → A,C,E,D  ✗
                                                        expected  A,C,D,E
```

`seriesJoin.ts:48` records the device finding this code was written to fix — *"Appending
unconditionally left a 1,2,3,5 series reading 1,2,3,5,4"*. Two tombstones reintroduce exactly
that.

**⚠ Why the device check missed it.** The repro needs **two** removals. Repeating a single
remove→re-join — which is what was checked on device — cannot surface it. This matches the
existing note that the book must have sat somewhere other than the end.

**Fix direction.** Keep tombstone positions in the same coordinate space as the compacted
visible list: when `planEditorSave` tombstones a row at position `q`, decrement the stored
position of every existing tombstone whose position is `> q`. The invariant to encode:
**a tombstone's position always means "index into the current visible list where I belong."**

**⚠ Coupling:** findings 1 and 3 both live in `planEditorSave` and touch the same rule about
what "removed" means. Fix them together, in one pass, with one set of tests. Do **not**
split them across parallel agents.

---

## 4. Ticket 18's teardown command breaks the build — CONFIRMED

**`src/app/seriesDetail.tsx:32`** · ticket
[24](issues/24-seriesdetail-uses-real-store.md), which now **blocks** ticket
[18](issues/18-delete-the-prototype-harness.md)

`src/app/seriesDetail.tsx` is **shipping code** and it imports the throwaway harness:

```ts
import { useSeriesSource } from '@/prototypes/useSeriesSource';
```

`src/app/_layout.tsx:355` documents teardown as
`rm -rf src/prototypes src/app/seriesCreateProto.tsx`. Running it leaves that import dangling
and the Series detail route fails to resolve at bundle time.

**Ticket 18 does not cover this.** Its recipe names the library screen's *three* `THROWAWAY`
sites; `seriesDetail.tsx` is an undocumented **fourth**, and the only one in shipping code.
Its acceptance criterion *"No import, route, mount or dead file referencing the harness
remains. Grep for it"* is the criterion that catches this — see finding 7 for why a grep
alone would have missed the neighbouring file.

**Two further problems ride along in the same import:**

- **Dataset split.** `seriesDetail.tsx:36` resolves through `useSeriesSource()` (synthetic
  when a preset is on) while `seriesEditor.tsx` resolves through `useDerivedSeries()`. With a
  preset selected the sheet renders a synthetic series and `Edit series` opens an editor that
  finds nothing and seeds an empty create.
- **Perf.** `useSeriesSource` calls `useLibraryStore((s) => s.books)` **unconditionally** —
  the `__DEV__` guard sits inside the `useMemo` body, not around the subscription. With the
  sheet open during playback, `library.tsx`'s `observeWithColumns` emits on every progress
  write and the whole sheet re-renders at progress-tick rate. `useDerivedSeries()` alone
  would not do this.

**Fix direction.** Point `seriesDetail.tsx` at `useDerivedSeries()`. That resolves the build
break, the dataset split and the perf issue at once, and can land **before** ticket 18.

---

## 5. Third series-delete path never releases pinned artwork — CONFIRMED

**`src/db/settingsQueries.ts:346`**

The empty-series reaper inlined into `removeLibraryFolder` pushes
`s.prepareDestroyPermanently()` and **nothing else**. `seriesQueries.deleteSeries` and
`deleteEmptySeries` both call `deleteArtworkFile(...)` for exactly this case (§K8).

A series with a pinned cover (`series.artwork = file://…/artwork/series_<hash>.webp`) that
loses its last member to a folder removal orphans the `.webp` on disk with no row referencing
it and no cleanup path in the app. Compounds the existing open issue that orphaned artwork is
never swept.

Same function as finding 2 — **fix both in one pass.**

---

## 6. A third of the split-book guard can never fire — CONFIRMED

**`src/helpers/seriesDetection.ts:503`** (`isSplitBookPart`)

```ts
const SPLIT_RE = /\((\d+)\s*of\s*(\d+)\)|\bPart\s+(\d+)\s*(?:of\s*\d+)?\s*$|\b(?:Disc|CD)\s*\d+\s*$/i;
const part = m[1] || m[3];
```

Alternative 1 owns groups 1–2, alternative 2 owns group 3, **alternative 3 owns none.** An
album titled `Warbreaker 1 - Disc 1` (or any `… CD 2` suffix) matches via alternative 3, so
`m[1]` and `m[3]` are both `undefined`, `part` is `undefined`, and
`String(s.num) === String(undefined)` is false for every signal.

The unit is never suppressed, so **one book split across two files is proposed as a two-book
series** — the exact outcome the guard exists to prevent, for one of the three shapes it
claims to cover.

**Fix:** add a capture group to the `Disc|CD` alternative and include it in the `part` pick.

---

## 7. Raw NUL bytes make `seriesQueries.ts` invisible to grep — CONFIRMED

**`src/db/seriesQueries.ts:718` and `:722`**

The file contains two raw `U+0000` bytes inside template literals used as composite-key
delimiters:

```ts
`${r.seriesId}<NUL>${r.bookKey}`
`${(row._raw as any).series_id}<NUL>${row.bookKey}`
```

`rg` reports *"binary file matches (found \0 byte around offset 28827)"* and plain `grep -n`
returns **nothing at all** for this file. A byte scan confirms it is the only file in `src/`
affected (2 NULs, both in this pair).

**Runtime behaviour is correct today** — they are a matched build/lookup pair and a literal
NUL is legal in a JS template literal. The hazard is tooling: a 33 KB module is silently
skipped by any grep-based sweep, which is how it can be missed by review passes, linters,
patch tools and by ticket 18's *"Grep for it"* criterion.

**Fix:** replace both with the two-character escape `\0` (or a printable delimiter such as
`\x1f`). Behaviour is unchanged and the file becomes greppable.

---

## Catalogue — findings 8–24

**All PLAUSIBLE unless marked. Re-verify before acting.** These were reported with coherent
mechanisms but were not independently traced during this review.

Numbering: **Finding N** refers to a row in this document; **Ticket NN** refers to a file in
`issues/`. They are separate sequences — Finding 21 and Ticket 21 are different things.

| Finding | Location | Detail | Verdict |
| --- | --- | --- | --- |
| 8 | `src/app/seriesEditor.tsx:846` | `restoreRememberedNumbers` is handed `selectedBookKeys` as its addedKeys, but `beginPicker` seeds that from the **entire** existing `orderedBookKeys` — so every book already in the series is treated as "just added". A pre-existing row whose number the user deliberately cleared gets refilled from a tombstone. Should pass the diff of previous vs new. | PLAUSIBLE |
| 9 | `src/app/seriesEditor.tsx:761` | Failed Save is **silent** — the generic catch only `console.error`s. Save re-enables, screen stays open, no alert, no way to tell whether the write landed. Costly given finding 1 also writes tombstones on Save. | PLAUSIBLE |
| 10 | `src/helpers/handleBookPlay.ts:80` | `restartFromZero` is decided from a library-store snapshot while the Finished→Started demotion meant to consume it is fired **without `await`** and only `console.error`'d. A second play before the store re-emits restarts the book again and discards progress. The comment claims "flipping the flag here consumes it", but the flag is read from props and never re-read. | PLAUSIBLE |
| 11 | `src/db/seriesQueries.ts:720` | `applyPlan` fetches the rows it will destroy **outside** the writer, then destroys those stale instances inside it. An editor Save landing in the window bypasses the planner's `coalesceToUser(...) !== 'detected'` guard. Every other write path in the file reads inside its writer. | PLAUSIBLE |
| 12 | `src/helpers/seriesDetection.ts:675` | `disambiguateNames` enforces uniqueness with **exact string equality** (`taken.has(p.name)`) while every other layer compares `normalizeSortName`. Two proposals differing only in case (`Audible` / `AUDIBLE`) both survive, and `applyPlan` — which skips `assertSeriesNameAvailable` — writes two series sharing one `sort_name`. Permanent `SeriesNameConflictError` on every later Save or join. | PLAUSIBLE |
| 13 | `src/db/seriesReconcile.ts:340` | Pass-2 continuity match is **greedy in proposal order**, so a proposal overlapping 3 of 5 rows can claim a renamed series ahead of one overlapping 5 of 5, leaving the better match to create a duplicate and pushing the unclaimed rows to `removeRows`. | PLAUSIBLE |
| 14 | `src/app/(settings)/library.tsx:331` | `runRestore` has a `finally` but **no `catch`**, and two of its three awaits can throw; the justifying comment only covers `runSeriesDetection`. Restore appears to silently do nothing. `handleRestoreAll` calls it as a bare `onPress`, so nothing upstream catches either. | PLAUSIBLE |
| 15 | `src/helpers/seriesDetection.ts:559` | `electDisplayNames` iterates `for (let d = 1; d < parts.length - 1; d++)`, so `parts[0]` is **never** a display-name candidate — for `Discworld/Reaper Man` the condition is `1 < 1`. The header at line 310 says "DEPTH IS NEVER CONSULTED" and documents removing this exact rule elsewhere. Excluding the *last* segment is clearly intended; skipping index 0 may not be. **Confirm intent before changing.** | PLAUSIBLE |
| 16 | `src/helpers/artworkIdentity.ts:104` | `artworkFilePath`'s containment check is a bare `startsWith` with no path normalisation, so `file://…/artwork/../books/cover.webp` passes the "inside artworkDir" guard. Not reachable through today's writers, but the comment claims a guarantee it does not provide — and finding 5 shows delete paths for this column are still being added. | PLAUSIBLE |
| 17 | `src/helpers/seriesNumbering.ts:126` | `rememberedNumbersFrom` compares the raw column (`row.membership !== 'excluded'`) instead of going through `resolveMembership`, which `seriesProvenance.ts` declares "the single site". No behavioural difference today; widening the tombstone encoding would silently reopen the blank-number bug. | PLAUSIBLE |
| 18 | `src/helpers/generalTags.ts:75` | `captureBookTags` JSON-stringifies the entire General track **per file**, but `groupChaptersIntoBooks` keeps only the first file's value. ~3,880 stringify calls of which ~350 persist, plus several MB held alive for the directory pass. Make `rawJson` lazy. Also: `serializeTrack` excludes only top-level `Cover_Data`, so cover bytes under `extra` would ride into the blob. | PLAUSIBLE (efficiency) |
| 19 | `src/db/seriesQueries.ts:97` | `sourceFor` is duplicated **verbatim** in `seriesQueries.ts` and `seriesEditorSave.ts`. `updateSeries`' header says "IO ONLY. IT MAKES NO DECISIONS", yet `createSeries` computes provenance through the local copy. Exactly the drift `seriesOrphanPrune.ts` / `seriesName.ts` were extracted to prevent (ADR 0001). Import one, delete the other. | **CONFIRMED** (reuse) |
| 20 | `src/db/seriesReconcile.ts:188` | `plannedMembers` re-implements `toMember`'s body field-for-field; it reduces to `seedOrder(candidates).map(toMember)`. | PLAUSIBLE (reuse) |
| 21 | `src/db/seriesReconcile.ts:212` | `suppressionsClearedByCreating` has **no production caller** — the write path uses `suppressionsMatching` via `prepareSuppressionClear`. Test-only second spelling of the same rule, cross-referenced in `seriesSuppression.ts:21` as if live. | PLAUSIBLE (dead code) |
| 22 | `src/components/SeriesEditorPanel.tsx:424` | `authorCellText` pairs `fontSize: 13` with a fixed `lineHeight: 16` on a `numberOfLines={2}` `<Text>` in a `minHeight: 42` box — the exact construct `seriesEditor.tsx:1226` forbids ("A fixed line height is in dp and does NOT follow the OS font scale"). The codebase currently asserts both. **⚠ Ticket 20's picker author grid passed a device check at fs 2.0 — confirm on device before changing.** | PLAUSIBLE |
| 23 | `src/helpers/seriesDetection.ts:87` | `roman()`'s typo-fold `.replace(/l{2,}/, …)` lacks the `g` flag, so only the **first** run of `l`s folds. `llxll` → `iixll` = 90. Very narrow; the regex reads as if it handles every run. | **CONFIRMED** (minor) |
| 24 | `src/helpers/seriesDetection.ts:111` | `m[1].startsWith('.')` in `normNumber` is **unreachable** — group 1 begins with `\d+`, so `'.5'` fails the match entirely and `'0.5'` backtracks `0*` to empty. Dead branch advertising a case the regex refuses; invites a future reader to loosen the pattern. | **CONFIRMED** (dead code) |

---

## Suggested order for a fresh session

1. **Ticket 21** — finding 1 (silent permanent data loss). Highest severity.
2. **Ticket 23** — finding 3. Same file and same rule as 21; **do it in the same pass.**
3. **Ticket 22** — finding 2, plus finding 5 (same function, one pass).
4. **Finding 4** — unblocks ticket 18. Small and self-contained; can land any time.
5. **Findings 6, 7, 19, 23, 24** — confirmed, small, independent.
6. **Catalogue 8–18, 20–22** — re-verify each before acting.

## Method notes, for whoever picks this up

- Two independent finder passes ran; their outputs **overlapped but did not agree on
  coverage**. The merged set is what is recorded here. Disagreement between passes is itself
  a signal — do not assume a single pass is exhaustive.
- Finding 7 (NUL bytes) is a plausible partial explanation for the coverage gaps: any
  grep-based sweep silently skips `seriesQueries.ts`.
- Findings 1–7 were re-verified by hand against the code before being recorded. Findings
  8–24 were not.
- Findings 1 and 2 are the **same failure shape from opposite directions**: a set difference
  where one side was computed with a different definition of identity than the other. In both
  the old code was an allowlist ("destroy exactly what I collected") and the new code is a
  blocklist ("destroy anything not in my live set"). That inversion is what turns a benign key
  mismatch into data loss — a blocklist is only safe when the live set is provably complete
  **under the same key definition as the rows it filters.**
