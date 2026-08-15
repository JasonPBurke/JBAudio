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
| ~~[24](issues/24-seriesdetail-uses-real-store.md)~~ | Finding 4 | **RESOLVED 2026-08-14** — no longer blocks ticket 18. Its scratch-checkout teardown turned up a *further* defect in 18's recipe; recorded there. |

Findings 6, 7 and 19–24 are confirmed and small but have no ticket yet — pick them up from
the catalogue below.

**Findings 6, 7, 19, 23 and 24 were all fixed in one pass on 2026-08-14** (no ticket; they are
small and independent, exactly as this section anticipated). jest **733 → 741**, tsc and eslint
clean.

**THE FRONTIER IS CLOSED. Findings 8–18 and 20–22 were all hand-traced on 2026-08-14** — every
one of them, one at a time, with the driver approving each disposition. jest **741 → 756**, 58 →
59 suites, tsc 0, eslint 0 errors (35 warnings = baseline). See the running record below.

**Result: 9 fixed, 4 closed as not-defects, 1 deferred.** ⚠ **Nearly a third of the PLAUSIBLE
catalogue did not survive tracing** — 12 and 13 are unreachable, 15 and 22 are outright refuted
(22 by reading the React Native source, where the CITED RULE turned out to be the bug), and 11's
supporting evidence was false even though its mechanism was real. **Every one of them was
convincing on a local read.** New tickets: **27** (four more reads outside their writer), **28**
(display name depends on root depth), **29** (lazy `rawTagsJson`).

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

## 6. A third of the split-book guard can never fire — CONFIRMED · **RESOLVED 2026-08-14**

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

**Fixed 2026-08-14** exactly as directed — `(\d+)` on the third alternative, `m[1] || m[3] || m[4]`.
Three tests in `seriesDetection.test.ts`' split-book guard block: `Disc N` and `CD N` deliveries
now suppress, and a **fourth** pins the other half of the rule — a disc suffix whose number
*disagrees* with the series number must still detect (`Discworld 4` / `Mort - Disc 1`), so the
added capture cannot over-suppress. The 354-unit corpus test is **unchanged**: no real corpus album
pairs a `Disc|CD` suffix with a bare-num Grouping, so the scan baseline 354→24/202 still holds.

---

## 7. Raw NUL bytes make `seriesQueries.ts` invisible to grep — CONFIRMED · **RESOLVED 2026-08-14**

**`src/db/seriesQueries.ts:718` and `:722`** (drifted to `:738`/`:742` by the time of the fix)

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

**Fixed 2026-08-14** with the `\0` escape, not `\x1f` — the escape denotes the same U+0000 in a
template literal, so the key encoding is **byte-identical** and no behaviour could shift; a
different delimiter would have been a real (if tiny) change for no extra benefit. Done as a
byte-level replacement asserting exactly 2 NULs present before and 0 after, since an editor cannot
reliably match a raw U+0000. `src/` now contains **zero** NUL bytes and `rg`/`grep` both read the
file as text. A comment at the site says to keep the escape and why, so the raw byte is not
reintroduced by a future edit.

---

## Catalogue — findings 8–24

**All PLAUSIBLE unless marked. Re-verify before acting.** These were reported with coherent
mechanisms but were not independently traced during this review.

Numbering: **Finding N** refers to a row in this document; **Ticket NN** refers to a file in
`issues/`. They are separate sequences — Finding 21 and Ticket 21 are different things.

| Finding | Location | Detail | Verdict |
| --- | --- | --- | --- |
| 8 | `src/app/seriesEditor.tsx:846` | `restoreRememberedNumbers` is handed `selectedBookKeys` as its addedKeys, but `beginPicker` seeds that from the **entire** existing `orderedBookKeys` — so every book already in the series is treated as "just added". A pre-existing row whose number the user deliberately cleared gets refilled from a tombstone. Should pass the diff of previous vs new. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 9 | `src/app/seriesEditor.tsx:761` | Failed Save is **silent** — the generic catch only `console.error`s. Save re-enables, screen stays open, no alert, no way to tell whether the write landed. Costly given finding 1 also writes tombstones on Save. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 10 | `src/helpers/handleBookPlay.ts:80` | `restartFromZero` is decided from a library-store snapshot while the Finished→Started demotion meant to consume it is fired **without `await`** and only `console.error`'d. A second play before the store re-emits restarts the book again and discards progress. The comment claims "flipping the flag here consumes it", but the flag is read from props and never re-read. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 11 | `src/db/seriesQueries.ts:720` | `applyPlan` fetches the rows it will destroy **outside** the writer, then destroys those stale instances inside it. An editor Save landing in the window bypasses the planner's `coalesceToUser(...) !== 'detected'` guard. Every other write path in the file reads inside its writer. | **CONFIRMED** (mechanism; the "every other write path" claim is FALSE) · **RESOLVED 2026-08-14** |
| 12 | `src/helpers/seriesDetection.ts:675` | `disambiguateNames` enforces uniqueness with **exact string equality** (`taken.has(p.name)`) while every other layer compares `normalizeSortName`. Two proposals differing only in case (`Audible` / `AUDIBLE`) both survive, and `applyPlan` — which skips `assertSeriesNameAvailable` — writes two series sharing one `sort_name`. Permanent `SeriesNameConflictError` on every later Save or join. | **NOT REACHABLE** · closed 2026-08-14, no code change (driver) |
| 13 | `src/db/seriesReconcile.ts:340` | Pass-2 continuity match is **greedy in proposal order**, so a proposal overlapping 3 of 5 rows can claim a renamed series ahead of one overlapping 5 of 5, leaving the better match to create a duplicate and pushing the unclaimed rows to `removeRows`. | **NOT REACHABLE** (proved) · closed 2026-08-14, comment only |
| 14 | `src/app/(settings)/library.tsx:331` | `runRestore` has a `finally` but **no `catch`**, and two of its three awaits can throw; the justifying comment only covers `runSeriesDetection`. Restore appears to silently do nothing. `handleRestoreAll` calls it as a bare `onPress`, so nothing upstream catches either. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 15 | `src/helpers/seriesDetection.ts:559` | `electDisplayNames` iterates `for (let d = 1; d < parts.length - 1; d++)`, so `parts[0]` is **never** a display-name candidate — for `Discworld/Reaper Man` the condition is `1 < 1`. The header at line 310 says "DEPTH IS NEVER CONSULTED" and documents removing this exact rule elsewhere. Excluding the *last* segment is clearly intended; skipping index 0 may not be. **Confirm intent before changing.** | **REFUTED by measurement** — the skip is the AUTHOR GUARD · closed 2026-08-14, comment + ticket 28 |
| 16 | `src/helpers/artworkIdentity.ts:104` | `artworkFilePath`'s containment check is a bare `startsWith` with no path normalisation, so `file://…/artwork/../books/cover.webp` passes the "inside artworkDir" guard. Not reachable through today's writers, but the comment claims a guarantee it does not provide — and finding 5 shows delete paths for this column are still being added. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 17 | `src/helpers/seriesNumbering.ts:126` | `rememberedNumbersFrom` compares the raw column (`row.membership !== 'excluded'`) instead of going through `resolveMembership`, which `seriesProvenance.ts` declares "the single site". No behavioural difference today; widening the tombstone encoding would silently reopen the blank-number bug. | **CONFIRMED** · **RESOLVED 2026-08-14** |
| 18 | `src/helpers/generalTags.ts:75` | `captureBookTags` JSON-stringifies the entire General track **per file**, but `groupChaptersIntoBooks` keeps only the first file's value. ~3,880 stringify calls of which ~350 persist, plus several MB held alive for the directory pass. Make `rawJson` lazy. Also: `serializeTrack` excludes only top-level `Cover_Data`, so cover bytes under `extra` would ride into the blob. | **CONFIRMED** (efficiency half) · second half **REJECTED** · **DEFERRED to ticket 29** |
| 19 | `src/db/seriesQueries.ts:97` | `sourceFor` is duplicated **verbatim** in `seriesQueries.ts` and `seriesEditorSave.ts`. `updateSeries`' header says "IO ONLY. IT MAKES NO DECISIONS", yet `createSeries` computes provenance through the local copy. Exactly the drift `seriesOrphanPrune.ts` / `seriesName.ts` were extracted to prevent (ADR 0001). Import one, delete the other. | **CONFIRMED** (reuse) · **RESOLVED 2026-08-14** |
| 20 | `src/db/seriesReconcile.ts:188` | `plannedMembers` re-implements `toMember`'s body field-for-field; it reduces to `seedOrder(candidates).map(toMember)`. | **CONFIRMED** (reuse) · **RESOLVED 2026-08-14** |
| 21 | `src/db/seriesReconcile.ts:212` | `suppressionsClearedByCreating` has **no production caller** — the write path uses `suppressionsMatching` via `prepareSuppressionClear`. Test-only second spelling of the same rule, cross-referenced in `seriesSuppression.ts:21` as if live. | **CONFIRMED** (dead code) · **RESOLVED 2026-08-14** |
| 22 | `src/components/SeriesEditorPanel.tsx:424` | `authorCellText` pairs `fontSize: 13` with a fixed `lineHeight: 16` on a `numberOfLines={2}` `<Text>` in a `minHeight: 42` box — the exact construct `seriesEditor.tsx:1226` forbids ("A fixed line height is in dp and does NOT follow the OS font scale"). The codebase currently asserts both. **⚠ Ticket 20's picker author grid passed a device check at fs 2.0 — confirm on device before changing.** | **REFUTED from the RN source** — the CITED RULE is the defect · closed 2026-08-14 |
| 23 | `src/helpers/seriesDetection.ts:87` | `roman()`'s typo-fold `.replace(/l{2,}/, …)` lacks the `g` flag, so only the **first** run of `l`s folds. `llxll` → `iixll` = 90. Very narrow; the regex reads as if it handles every run. | **CONFIRMED** (minor) · **RESOLVED 2026-08-14** |
| 24 | `src/helpers/seriesDetection.ts:111` | `m[1].startsWith('.')` in `normNumber` is **unreachable** — group 1 begins with `\d+`, so `'.5'` fails the match entirely and `'0.5'` backtracks `0*` to empty. Dead branch advertising a case the regex refuses; invites a future reader to loosen the pattern. | **CONFIRMED** (dead code) · **RESOLVED 2026-08-14** |

---

## Suggested order for a fresh session

1. **Ticket 21** — finding 1 (silent permanent data loss). Highest severity.
2. **Ticket 23** — finding 3. Same file and same rule as 21; **do it in the same pass.**
3. **Ticket 22** — finding 2, plus finding 5 (same function, one pass).
4. **Finding 4** — unblocks ticket 18. Small and self-contained; can land any time.
5. ~~**Findings 6, 7, 19, 23, 24**~~ — **DONE 2026-08-14**, one pass, jest 733 → 741.
6. ~~**Catalogue 8–18, 20–22**~~ — **DONE 2026-08-14**, one at a time, jest 741 → 756.
   9 fixed · 12, 13, 15, 22 closed as not-defects · 18 deferred to ticket 29.

**Nothing in this review is open.** What is open is the work it spawned: tickets **25**, **26**,
**27**, **28**, **29**, and ticket **18**, whose recipe is still incomplete.

### Frontier pass — running record (findings 8–18, 20–22)

Started 2026-08-14. Baseline **jest 741/741, 58 suites**, tsc 0, eslint 0. Each finding
hand-traced before any code moved; the trace is recorded even when it narrows the finding.

- **8 — CONFIRMED, FIXED.** jest 741→742. The mechanism is as reported, but the blast radius
  is **two guards narrower** than the row reads: `rememberedNumbersFrom` harvests only
  `membership === 'excluded'` rows, so a currently-visible book is never in the remembered map
  at all, and `restoreRememberedNumbers` skips any non-blank box. Reaching it needs **two
  picker passes in one session**: restore a tombstoned book (box correctly fills), clear the
  box by hand, then `+ Add books` again — the ref is loaded once per session and stays armed.
  ⚠ **One pass can never show it**, which is why nothing caught it; on the first pass the book
  really is new and filling it is correct.
  **The fix is structural, not a filter.** The append and the number-restore were two
  statements in `handleCommit` reading the "before" list separately — the same input-drift
  shape as ticket 22. They are now ONE store action, `commitPickerSelection(remembered)`, one
  `set` over one snapshot, so the union input and the diff input **cannot** disagree.
  `appendBookKeys` is GONE rather than left beside it: its only shipping caller was this line,
  and keeping it would have created finding 21's exact defect (a test-only second spelling).
  Red was staged the ticket-22 way — the new action was written **faithful to the shipping
  bug** first and watched to fail on the real symptom (`'3'` where `''` was expected).

- **9 — CONFIRMED, FIXED.** No test (a `.tsx` screen is unrenderable here — no RN preset), a
  two-line change verified by reading. ⚠ **The argument that carries it is the ASYMMETRY, not
  the missing alert**: `AddToSeriesPanel.tsx:88` — the join door, which per ticket 17 expresses
  a join AS an editor Save through `planEditorSave` — already alerts generically on the same
  write path. Two doors onto one DB layer, only one of them talking, and the quiet one is the
  one that also writes tombstones. Also worth keeping: `console.error`-only is CORRECT elsewhere
  in this same file (`revertCoverArt`, the remembered-numbers effect) because those are
  fire-and-forget with no gesture waiting; Save is the commit. **The success path's only signal
  is `router.back()`**, so before the fix "the sheet stayed open" meant both *error* and
  *nothing happened*.

- **10 — CONFIRMED, FIXED.** jest 742→747, and a NEW suite (`handleBookPlay.test.ts`, 59
  suites). ⚠ **The serious half is NOT the double-press race the row leads with.** That race is
  real but nearly harmless: `book_progress_value` IS in the library store's
  `observeWithColumns` list (`library.tsx:282`), so a *successful* demotion propagates back in
  milliseconds and almost no progress can accrue inside the window. **The permanent case is the
  one that matters** — the demotion has TWO silent failure paths (`getBookById` catches its own
  error and returns `null`, so a missing row arrives as an ordinary falsy value, not a throw;
  and `updateBookProgress` throwing was `console.error`-only), while the OTHER half of the
  restart — zeroing the stored position — is awaited and always lands. A failed demotion
  therefore parks the book at position 0 and STILL `Finished`: **armed to discard every later
  listen, forever**, because nothing else in the app moves a book off `Finished`.
  **The fix is `restartFromZero = wasFinished && demoted`** — don't fire a once-per-listen
  event you cannot mark as consumed. Declining the restart costs one manual seek; firing it
  unconsumed costs the whole listen, repeatedly.
  ⚠ **The ordering test needed a `setTimeout` to be worth anything**: with an
  instantly-resolving mock the unawaited original passes it too, because its microtasks drain
  during the next `await`. Mutation-checked both ways — the exact shipping shape
  (`void demoteToStarted(...)` + unconditional `restartFromZero`) fails 3 of the 5 tests.
  ⚠ **This is app-wide playback, not series code** — §C5 is a driver ruling and every play
  surface inherits it. The normal path is unchanged; only the failure path moved. Worth a
  device pass for the one added DB round-trip before playback starts.

- **11 — mechanism CONFIRMED, EVIDENCE REFUTED, FIXED.** jest 747→753. ⚠ **The row's
  justification — "Every other write path in the file reads inside its writer" — is FALSE, and
  checking it is the most valuable thing this finding produced.** Reading OUTSIDE was the file's
  dominant pattern for bulk work: only `updateSeries` and `deleteSeries` read inside;
  `addBookToSeries` (ticket 26), `restoreRemovedSeries`, `pruneOrphanedSeriesBooks` and
  `deleteEmptySeries` all read outside. Raised as **ticket 27** rather than silently widening
  scope. **Had the evidence been taken at face value it would have led to the cosmetic fix —
  "make it match the others" — when the others are mostly the same shape.**
  ⚠ **AND MOVING THE FETCH INSIDE THE WRITER DOES NOT, BY ITSELF, FIX THE STATED BUG.** That
  closes the fetch→write window; the removal DECISION is older still, taken in `reconcileSeries`
  against a separate read. So the fix is **compare-and-swap**: `PlannedRemoval` now carries
  `expectedMembership` — the provenance the planner saw — and the row is destroyed only if it
  still reads that way. This keeps `applyPlan`'s "IT MUST NOT MAKE DECISIONS" contract intact:
  the plan states a precondition, the IO layer verifies it, and the rule itself lives in the new
  pure `selectPlannedRemovals` where jest can watch it (6 tests) — the same extraction
  `selectOrphanedMemberships` got in ticket 22.
  ⚠ **Destroying a tombstone is the nastier half and does not look like data loss at the time**:
  the series merely FORGETS a removal, so the NEXT rescan puts the book back — the user's removal
  undone by a scan they never saw.
  Note `row.membership` already resolves through `seriesProvenance`'s single site via the model
  getter (`SeriesBook.ts:39`), so the CAS comparison cannot drift from the planner's reading.
  `seriesReconcile.ts`'s "imports nothing from `@/db`" header was amended for a type-only import
  of `SeriesMembership` — respelling the union inline would be the exact drift finding 19 fixed.

- **12 — code observation TRUE, predicted defect NOT REACHABLE. Closed by the driver with no
  code change.** ⚠ **Do not re-raise this on a reading of `disambiguateNames` alone** — the
  exact-equality `taken` set really is a second spelling of a comparison the codebase
  centralises, so it looks wrong every time somebody reads that function. The reason it is safe
  lives in a DIFFERENT FILE.
  **`normKey` (`seriesDetection.ts:67`) is fully case-insensitive** — every stage is either
  case-independent or carries the `i` flag, including `STOP = /^(the|a|an)\s+/i` — **and it also
  collapses inner whitespace.** That makes it strictly COARSER than `normalizeSortName`
  (`trim().toLowerCase()`) on exactly the two dimensions the latter ignores. So any two names
  that could collide under `sort_name` **already collided under `normKey` and were merged into
  one proposal** before `disambiguateNames` ran. The finding's `Audible`/`AUDIBLE` example is
  impossible. `splitOnNumberCollision` — the only way two proposals can carry an identical name —
  lowercases its sub-key too (`:656`), so it closes the same way.
  ⚠ **THE SAFETY IS ACCIDENTAL AND UNDOCUMENTED.** Nothing at the call site says "exact equality
  is fine because `normKey` already folded case". **Adding or removing one `i` flag in `normKey`
  would make this finding correct.** One residual was describable but not constructible: the
  parent-folder discriminator (`:696`) interpolates a RAW filesystem segment, so case-differing
  sibling directories would give `X (Books)` / `X (books)`. Legal on ext4; no full path to it
  found.
  **The rejected fix was one line** (key `taken` through `normalizeSortName`) — declined because
  detection is the most corpus-sensitive code here (baseline 354→24/202) and the change is
  behaviour-neutral only as long as the analysis above holds.

- **13 — NOT REACHABLE, and this one has a PROOF rather than a failed search.** Closed with a
  comment at `continuationOf`, no behaviour change. The greedy loop is sound because:
  **proposals PARTITION the books** (`assign` is `units.map(...)`, one assignment per unit, each
  landing in exactly one proposal by key), so all proposals' overlaps with a given series are
  disjoint subsets of its rows and sum to at most its row count — while the threshold demands
  `overlap * 2 > books.length`. Two proposals clearing it would need their overlaps to sum to
  MORE than the row count. **At most one proposal can ever qualify for a given series, so claim
  order cannot matter.** The finding's "3 of 5 vs 5 of 5" example needs 8 books of overlap inside
  a 5-row series. The mirror case (a proposal taking a series a later one needed) falls to the
  same inequality.
  ⚠ **LOOSEN THE THRESHOLD AND THE GREEDY SILENTLY BECOMES WRONG** — at one third, two proposals
  could qualify and order would start deciding. The header documented the threshold as a
  PRECISION control only; that it also does uniqueness duty is now written down.

- **14 — CONFIRMED, FIXED.** No test (`.tsx` screen). The comment's claim about
  `runSeriesDetection` is TRUE — verified at `seriesDetectionRun.ts:127`, it documents
  `NEVER THROWS`, wraps everything and returns `ran: false, reason: 'failed'`. ⚠ **It is just one
  of THREE awaits**; `restoreRemovedSeries` and `loadRemovedSeries` are ordinary DB calls that
  can throw. **The comment scoped itself to a function name while the code scoped itself to a
  block**, and two more awaits grew around it.
  ⚠ **`finally` without `catch` is its own trap** — it looks like error handling in review but
  only guarantees cleanup, and here it reset the card to "ready, nothing happened", the most
  misleading possible answer to a failed write. Both call sites invoke `runRestore` bare, so the
  rejection floated. **The `loadRemovedSeries` case is the nastier one: the restore has ALREADY
  landed, so the list ends up contradicting the database.**
  The clinching argument was 60 lines below in the SAME file — the auto-chapters handler is the
  identical shape done correctly, so `runRestore` was the outlier on its own card.
  ⚠ **Findings 9, 10 and 14 are ONE defect in three costumes: an operation whose only success
  signal is a UI event and which has no failure signal at all.** Worth a sweep of its own rather
  than finding-by-finding.

- **15 — REFUTED BY MEASUREMENT; the residual it uncovered points the OPPOSITE way.** Closed with
  a comment on `electDisplayNames`; the residual is **ticket 28**. The finding said "confirm
  intent before changing", so the change was RUN rather than reasoned about — three variants
  against the 73-test detection suite, decisive in under a minute:
  `d = 0` (either upper bound) **fails 2 tests**; `d = 1; d < parts.length` is corpus-neutral.
  ⚠ **`parts[0]` IS THE AUTHOR LEVEL — including it elects `Martha Wells` over
  `The Murderbot Diaries`.** The skip is the author guard, not an oversight.
  ⚠ **But the tension the finding spotted is real**: `folderClusters`' header says DEPTH IS NEVER
  CONSULTED and records this exact heuristic being removed there in favour of tag-based
  `isAuthorish`. Line 569 is where it survived. **The principled replacement was measured too and
  is NOT a drop-in** — it fixes the author case but then exposes a SECOND weakness: the candidate
  filter accepts anything with `key.includes(ck)`, so a one-character folder `A` qualifies for
  `The Expanse` and shortest-wins elects it. A real fix is two changes, not one.
  ⚠ **The residual, ticket 28**: `rel` is the book's DIRECTORY, not a file path, so at a
  root pointed one level deeper `rel` has two parts, `d = 1; d < 1` runs ZERO times, and no
  folder can contribute a name at all. **Same books, different root, different display name** —
  precisely the class the header says was fixed in clustering.
  ⚠ **Both "this is fine" and "this is a bug" would have been wrong summaries.** On code with a
  fixture this good, measuring is cheaper than arguing — and it was the failure MESSAGE that
  named the invariant nobody had written down.

- **16 — CONFIRMED, FIXED.** jest 753→755, mutation-checked. **A STRING PREFIX IS NOT
  CONTAINMENT**: `…/artwork/../books/cover.webp` passes `startsWith(\`${dir}/\`)` and resolves
  outside it, so `RNFS.unlink` would take a book's own cover. Not reachable through today's
  writers (every stored URI is built from `sanitizeForFilename`/`shortHash`, so `[A-Za-z0-9_.]`
  throughout) — **fixed because the doc comment PROMISED the guarantee**, calling the dangerous
  design "unrepresentable", and delete paths for this column are still being added (finding 5,
  and ticket 22's `deleteArtworkFiles`). ⚠ **Unreachable-but-wrong is cheap; unreachable-but-
  documented-as-safe is what future callers build on.** Refused rather than normalised — a
  traversal segment in an app-generated path is a bug or an attack, never a value to tidy. The
  percent-encoding angle stays closed by NOT decoding (RNFS won't either, so `%2e%2e` stays a
  literal directory name). ⚠ **Second bite of the same string-vs-semantics gap** — ticket 22's
  `Books`/`Books Backup` was the first, and its trailing-`/` fix being already present is what
  made this file look finished.
- **17 — CONFIRMED, FIXED.** jest 755→756. **Zero behavioural difference today, verified**:
  `resolveMembership` returns `'excluded'` iff the raw value is exactly `'excluded'`, so the old
  raw `!==` selected the same rows. ⚠ **The exactness is what makes it SAFE, not what makes it
  pointless** — a refactor toward a single site is affordable precisely while the two spellings
  still agree. What it protects is ticket 16's DEVICE-FOUND defect (re-adding a removed book came
  back with a blank box and `Save` wrote the blank over its number): widen the tombstone encoding
  and a raw comparison silently stops matching. Note `seriesNumbering.ts` had NO imports at all
  and advertises itself as PURE; the header now says why the `helpers/` → `db/` reach is worth it
  (`seriesProvenance` imports nothing, so purity and testability are untouched).
- **18 — efficiency half CONFIRMED, second half REJECTED, DEFERRED to ticket 29** (driver).
  Traced: `captureBookTags` stringifies per FILE, `groupChaptersIntoBooks:163` keeps the first
  file's only — **~3,530 of ~3,880 results computed, retained for the directory pass, discarded**.
  ⚠ **The defect is a gap between two files**: "first file wins" is stated at the CONSUMER while
  the cost is paid at the PRODUCER, which cannot see it.
  ⚠ **THE OBVIOUS FIX IS WORSE THAN THE BUG** — a thunk closing over `track` pins the whole
  General track INCLUDING `Cover_Data` base64 for the entire directory pass. Prune eagerly,
  defer only the stringify.
  ⚠ **The `extra` cover-bytes half is unsubstantiated and must NOT be built**: this codebase reads
  `general.Cover_Data` TOP-LEVEL (`mediainfo.ts:129`), no producer or fixture shows an `extra`
  variant, and `partNumber`'s own comment in that file forbids guessing at unseen shapes.

- **20 — CONFIRMED, FIXED.** Pure deduplication: `plannedMembers` is now
  `seedOrder(candidates).map(toMember)`. `map` supplies `(element, index)`, which IS `toMember`'s
  signature, so the only thing that differed between the two spellings — where `position` came
  from — was already the parameter. Worth doing because this is where the `'detected'` provenance
  values are written, and since finding 11 those are a compare-and-swap token: a drift would give
  rows created for a NEW series different provenance from rows inserted into an existing one.
- **21 — CONFIRMED, FIXED.** `suppressionsClearedByCreating` deleted; the four A13 tests now run
  against `suppressionsMatching`, which is what `prepareSuppressionClear` actually calls.
  ⚠ **The sharp part is not the dead function, it is that its TESTS looked like coverage.** All
  four A13 cases — including the load-bearing "every duplicate row is cleared", which pins G7's
  no-unique-constraints rule — were pinning a function that never ran, and would have stayed
  green while the live path broke. **Dead code with tests is stickier than dead code without: the
  tests read as proof of use, and coverage tools cannot tell you a function is unreachable from
  production.** ⚠ Both modules cited EACH OTHER as justification (`seriesSuppression.ts:21` named
  it as a live consumer) and neither cited a caller — **when two modules explain each other,
  check that a third one invokes them.**
- **22 — REFUTED FROM THE REACT NATIVE SOURCE, and the RULE IT CITED is the real defect.** Panel
  code untouched; the comment at `seriesEditor.tsx` and the project memory note were corrected.
  ⚠ **"A fixed line height is in dp and does NOT follow the OS font scale" IS FALSE ON THIS
  STACK.** `node_modules/react-native/.../views/text/TextAttributeProps.kt:36-45` converts
  `lineHeight` with **`toPixelFromSP`** whenever `allowFontScaling` is set, and it **defaults to
  true** (`maxFontSizeMultiplier` is NaN, so nothing caps it); `toPixelFromDIP` is the
  `allowFontScaling={false}` branch only. A fixed `lineHeight` scales WITH the glyphs.
  So `fontSize: 13 / lineHeight: 16` is correct, exactly as ticket 20's fs 2.0 device check
  found — **and the cells GROWING TALLER there is itself the proof**, since a fixed 16dp fits two
  lines inside `minHeight: 42` without growing.
  ⚠ **The finding was generated BY the codebase's own comment**, which is why it read as
  convincing: "the codebase asserts both" is true, and the natural conclusion is that the code
  lost rather than the assertion. **When a repo contradicts itself, check the claim against the
  platform first.** `node_modules` is primary source and was thirty seconds away; a device check
  would have cost a build cycle and shown only THAT it works, not why.
  ⚠ **A rule with a wrong reason and a harmless conclusion never fails, so nothing corrects it.**
  This one had reached a code comment, a memory entry carrying "look for this pattern elsewhere",
  and finally a review finding against working code.

### What the 6/7/19/23/24 pass is worth knowing for

- **Only finding 6 could change what a user sees.** 23 and 24 are latent-consistency fixes and 7
  and 19 are non-behavioural; do not go looking for a device symptom from four of the five.
- **Finding 23 is unreachable by any VALID roman numeral**, which the finding did not say. `L`
  never repeats in a well-formed numeral and `I`-runs never appear twice, so no two-run input
  exists outside garbage. The `g` was still added — it costs one character and makes the code
  match its own comment — but it is **not** a latent user-facing bug, and the test had to be
  written as an *equivalence* (`llxll` and `iixii` must agree) rather than pinning a magic value,
  because the value either spelling produces is meaningless.
- **Finding 24's test passes on the unfixed code, by design.** Removing dead code has no red
  phase; the test pins that `.5` is *refused* and `0.5` survives, which is what makes deleting the
  branch provably safe rather than merely plausible.
- **The rule finding 19 encodes:** a provenance column has a WRITE half and a READ half, and they
  belong in one file. `seriesProvenance.ts` owned only the readers, so the writer was free to be
  copied — twice — and each copy could drift on what null means with nothing failing.

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
