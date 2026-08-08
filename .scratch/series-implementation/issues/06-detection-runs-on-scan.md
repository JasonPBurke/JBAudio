# 06 — Detection runs: scan the library, series appear

**Blocked by:** [01](01-schema-v33.md), [04](04-detection-units.md),
[05](05-reconcile-series-seam.md).

**Status:** resolved — **all twelve acceptance criteria met, 2026-08-08.** Desk work and the
**device run** are both complete (uncommitted on `feature/series-styling`). The six device
criteria closed in one run on a physical Pixel 7 Pro; record in
[`../DEVICE-CHECK-06.md`](../DEVICE-CHECK-06.md).
**[19](19-membership-survives-a-file-move.md)'s mirrored device criterion closed on the same
run and 19 is now resolved too.**

**Spec:** [§A9–A13](../../series-ux-redesign/spec.md), §G5, §Testing Decisions.

## What to build

**The moment the feature becomes real.** A user with a library full of series scans it, and
their Series shelf fills itself in — no wizard, no tapping, no review queue. An existing
tester who upgrades gets the same thing on their next scan: structure **added**, nothing
they already had changed.

This is the first end-to-end slice. It closes user stories 1–4 and 20.

## What it wires together

Units ([04](04-detection-units.md)) → proposals ([03](03-detect-series-seam.md)) →
a plan ([05](05-reconcile-series-seam.md)) → **the write**.

`seriesQueries.applyPlan(plan)` is the only new impure piece, and it is **IO only and
deliberately untested** — that is the whole point of putting two pure seams in front of it.
It must not make decisions. If a conditional shows up inside `applyPlan`, it belongs in
`reconcileSeries` instead.

## Acceptance criteria

- [x] Detection runs at the **end** of a scan, on the stable post-scan state — never
      mid-scan, and after the existing orphan prune and empty-series reaper, which already
      run in that position.
- [x] It respects the two settings columns from [01](01-schema-v33.md). Their getters land
      here; their UI is [07](07-series-detection-card.md).
- [x] **The detection getter reads `!== false` with `true` as the fallback.** The house
      idiom is `=== true`, which hard-codes default-OFF into both the null case and the
      no-record case, and every existing tester's row is null. Copy-pasting it here ships
      the feature switched off, silently.
- [x] Scanning the driver's real library produces **~19 series** at conservative fidelity,
      and spot-checks match the research listing.
- [x] **A second scan changes nothing** — no duplicate series, no churn, no reordering.
      This is the idempotence [05](05-reconcile-series-seam.md) proved, now observed on a
      device.
- [x] A hand-made series is **untouched** by a scan **in which no files moved**: same name,
      same members, same order. The qualifier is load-bearing and is **not** a narrowing of
      ambition — see [19](19-membership-survives-a-file-move.md). A scan that *does* see moved
      files destroys hand-made membership rows **before any code in this ticket runs**, because
      the orphan prune above is upstream of detection and does not consult provenance. That is
      not fixable here and must not be tested for here; without this qualifier the criterion
      reads as covering a case it silently does not.
      **Settled 2026-08-08 (19's triage): that destruction is INTENDED, ruled by the driver,
      and 19 is documentation only — it changes no behaviour and will not come back and
      change this.** Provenance-aware pruning and re-keying were both rejected. So this
      criterion is now permanent rather than provisional: test it with files that did not
      move, and read the qualifier as the boundary of a decided contract.
- [x] **19's deferred device criterion closes on this ticket's device run.** Move a book's
      folder on a device that has a detected series, rescan, and the series comes back
      **complete** — the moved book present at its new path, no duplicate series, nothing left
      behind. 19 cannot close it alone, because the re-adding is this ticket's code — so it
      was mirrored here at 19's triage. Report the result back to 19, which stays open on it.
- [x] Detection off → a scan creates no series and **leaves existing ones exactly as they
      are**. Preference changes never destroy data.
- [x] The upgrade path is **additive**: an existing tester with hand-made series scans and
      gains detected ones alongside, losing nothing.
- [x] The tier and `why` trail for each proposal are **emitted to the scan log** and
      persisted nowhere.
- [x] Scan time does not regress noticeably. Detection is a batch over ~350 units and ~28
      candidates; if it is slow, something is querying per book.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Watch for

- **A failed migration is silent** and this is the first ticket where real data flows
  through the new columns. If something reads wrong, check the coalesce before suspecting
  the cascade.
- The existing series screen renders whatever is in the DB, so detected series appear in
  today's UI. That is expected — [10](10-browse-row.md) restyles it later, and using the
  old view here is what makes this ticket independently demoable.

## Answer

Built **directly on `feature/series-styling`, no worktree** (driver's call). `tsc` 0 · eslint
0 errors (36 warnings, the pre-existing baseline — none in a touched file) · **jest 41 suites
/ 459 tests green**, up from 40/451.

Five files, and the new code is deliberately thin:

| File | What landed |
| --- | --- |
| `src/db/settingsQueries.ts` | `getSeriesDetectionEnabled` (**`!== false`**, fallback `true`) and `getSeriesFolderGroupingEnabled` (`=== true`, fallback `false`) |
| `src/db/seriesQueries.ts` | `loadExistingSeries`, `loadSuppressedSeriesNames`, **`applyPlan`** |
| `src/db/seriesDetectionRun.ts` | **new** — `runSeriesDetection()`, the orchestration + the scan log |
| `src/helpers/scanLibrary.ts` | the call, last in the scan; `detectMs` added as its own phase |
| `src/db/__tests__/seriesDetectionSettings.test.ts` | **new** — 8 tests on the two getters |

The pipeline, in one place, with the decision/IO split visible:

```
getSeriesDetectionEnabled()        gate — off returns before the first read
loadLibraryDetectionUnits()        the whole library as units        (04)
  -> detectSeries(units, {…})      units     -> proposals            (03, pure, tested)
  -> reconcileSeries(…)            proposals -> a plan               (05, pure, tested)
  -> applyPlan(plan)               the plan  -> rows                 (IO, untested)
```

### The one test that ships, and the proof it works

`seriesDetectionSettings.test.ts` covers **both** new getters in one file precisely because
the failure mode is "copy the one above": detection is default-**ON** and folder grouping is
default-**OFF**, and the last test reads both from the *same null row*. Proven to catch the
bug the ticket names — the house `=== true` / fallback-`false` idiom was pasted into the
detection getter and exactly **3 of 8 tests failed** (null, no-record, and the paired case),
then reverted.

### Seven things designed during the build, worth not re-deriving

- **`runSeriesDetection` NEVER THROWS.** It is the last thing a scan does, after every book
  is imported and every dead row cleaned up. An exception escaping it would skip
  `endScan()` and leave the progress spinner up forever over a library that is fine. It
  catches, `console.error`s, and reports `ran: false, reason: 'failed'`. The error message
  says *"the scan is unaffected"* rather than *"the library is unchanged"* — the write is
  one atomic batch, so a throw after it would still land in the same catch.
- **Detection structurally cannot mass-delete, and that is worth checking before believing
  any bug report that says it did.** `reconcileSeries` only removes rows from a series a
  proposal MATCHED. A run with no proposals — no roots configured, a failed read, the
  setting off — yields an *empty plan*, not an empty library. There is no "everything not
  proposed is stale" step anywhere and there must never be one.
- **`applyPlan` deliberately does NOT call `assertSeriesNameAvailable`.** A create only
  reaches it for a name that matched no existing series under `normalizeSortName` —
  reconcile's first pass claims or skips every name that did — so the check could only ever
  throw on a name detection is entitled to use, aborting the whole run. A15's
  disambiguation is what keeps detected names apart.
- **`applyPlan` deliberately does NOT run the empty-series reaper**, and this is stronger
  than "it already ran earlier in the scan": a plan *cannot* empty a series. Rows are only
  removed from a series a proposal matched, and a proposal carries ≥ 2 books (A5), so
  something is always inserted or already present.
- **`loadExistingSeries` hands reconcile the RAW provenance strings** (`originRaw`,
  `membershipRaw`, …), not the model's resolved getters. Reconcile does its own coalescing
  (G5) and its tests pin the null case, which is the state of every row on every device the
  moment v33 lands. Resolving twice would work but would hide which layer owns the rule.
- **One batch, one writer, and `prepareCreate` is what makes that possible** — it assigns
  the record id up front, so a new series and its membership rows go into the same
  `database.batch`. Otherwise 19 new series would need 19 transactions to learn 19 ids.
  `applyPlan` also opens **no writer at all** when the plan is empty, which is the common
  case on a rescan.
- **`detectMs` is its own scan phase, not part of `cleanup`.** It is the one phase that
  does not scale with `newFiles` — a batch over the whole library costs the same on a
  rescan that imports nothing — so folding it in would make an unchanged-library rescan
  look like a regression with no way to see why. The log line now ends
  `… · cleanup Nms · detect Nms`.

### The settings are read from the DB, not the store — and 07 still owes the store seed

`runSeriesDetection` calls the getters directly, matching how the scan already reads
`getAutoChapterInterval`. So **08's second trap does not bite here** — but it still bites
[07](07-series-detection-card.md): anything reading `useSettingsStore` before
`initializeSettings` resolves sees the store's own seed, and seeding `false` for a default-ON
switch renders it OFF for a frame. 07 must seed `seriesDetectionEnabled: true` and assert it
via zustand's `getInitialState()`, exactly as 08 did.

### Desk verification through a REAL database, and where the probe lives

The two pure seams cannot see the one risk this ticket actually carries: `applyPlan` writing
something `loadExistingSeries` does not read back the same way. Forget `origin = 'detected'`
and **both seams stay green while the feature freezes** — the next scan reads the series as
user-owned and skips it forever.

So the round trip was probed against a **real WatermelonDB (LokiJS adapter, schema v33)**,
using the real `applyPlan`, the real `loadExistingSeries`, the real `pruneOrphanedSeriesBooks`
and the real `createSeries`, over the checked-in 298-unit corpus. All four cases green:

| Probe case | Result |
| --- | --- |
| detect → reconcile → write → read back | 298 units → **19 series / 179 books**; provenance round-trips as `detected` / `detected` / `detected` / `detected`, `canonicalNumber: 1` |
| rescan | plan is `create 0 · insert 0 · remove 0 · skipped 0`; **fingerprint identical** (same keys at the same positions) |
| hand-made playlist sharing books with a detected series | `origin` and `membership` both read null → `'user'`; **untouched** — same name, same members, same order |
| a moved book | real prune drops `Discworld` 41 → 40, rescan plan inserts **exactly 1**, series back to 41 **in the same row**, one series of that name, no duplicate |
| a suppressed name | not recreated — 18 of 19 created |

Spot-checks match the research listing: `Discworld` 41 · `Discworld (2022)` 39 ·
`Dresden Files` 22 · `Demon Accords` 17 · `The Dark Tower` 8.

**The probe is kept, deliberately not as a test**, at
[`../probes/roundtrip-probe.test.ts.txt`](../probes/roundtrip-probe.test.ts.txt) with the
copy-run-delete recipe in its header. It cannot be committed into the suite: the LokiJS
adapter leaves something alive that stops jest exiting (measured by 08), which is why it
needs `--forceExit`.

**These are desk results on the research corpus — the real library's shape, not the real
library.** They do not close a device criterion; they make the device run a confirmation
rather than a discovery.

## What is still open

**NOTHING — all six closed on the device run of 2026-08-08.** See
[`../DEVICE-CHECK-06.md`](../DEVICE-CHECK-06.md) for the full record; the results are
summarised under *[Device run](#device-run)* below. The original instructions are kept
verbatim underneath because they are the reproduction recipe.

All six were **device** criteria and closed on one run. The build is a **dev build** — the
harness chip is `__DEV__`-gated — but nothing in this ticket needs the chip: a normal
`Scan Library` from the drawer now runs detection.

1. **~19 series on the real library**, spot-checked against the listing.
2. **A second scan changes nothing** — rescan and read `[series] … created 0 · inserted 0 ·
   removed 0`.
3. **A hand-made series is untouched** by a scan in which no files moved (desk-proven above
   through the real DB, still an observation to make).
4. **[19](19-membership-survives-a-file-move.md)'s mirrored criterion** — move a book's
   folder, rescan, the series comes back complete with no duplicate (desk-proven above
   through the real prune). **Report the result back to 19, which stays open on it.**
5. **The upgrade path is additive** — a tester whose rows predate v33 gains detected series
   and loses nothing.
6. **Scan time does not regress noticeably** — read `detect Nms` in the `[scan]` line. On
   the real library, 04 measured assembly at 47 ms; detection is a batch over ~350 units.

What to read in logcat (`adb logcat -s ReactNativeJS`):

```
[series] "Discworld"  41 books  (new)          ← one block per proposal, tier + why per book
[series] detection (conservative): 351 units → 19 series, 179 books placed ·
         created 19 (179 rows) · inserted 0 · removed 0 · skipped 0 · NNNms
[scan]   … · cleanup Nms · detect NNNms
```

A second scan must print the same first line with `(existing)` and a summary of
`created 0 · inserted 0 · removed 0`.

## Device run

**2026-08-08, physical Pixel 7 Pro, fresh install + empty library, dev build.** Full record and
raw logs: [`../DEVICE-CHECK-06.md`](../DEVICE-CHECK-06.md). All six device criteria closed in
one session; the library was left byte-identical to how it was found.

**The run was a live test of the getter, not just of detection.**
`series_detection_enabled` read **`NULL`** throughout and [07](07-series-detection-card.md) does
not exist, so there was **no way to switch detection on**. Every series below exists because the
`!== false` getter read a null column as ON.

| Criterion | Result |
| --- | --- |
| ~19 series, spot-checks match | **23 series / 200 books placed** — *identical* to 04's device measurement (`CONSERVATIVE — 23 series, 200 books placed`). "~19" is the **corpus** figure; 04 already recorded the device growth. Discworld 41 · Discworld (2022) 39 · Dresden 22 · Demon Accords 17 · Dark Tower 8; **Lockwood 4, losing #4 — the exact decrease 04 predicted** ✅ |
| second scan changes nothing | `created 0 · inserted 0 · removed 0`, all 23 blocks `(existing)`, **fingerprint identical** (`sha=7577aec2`), same series ids ✅ |
| hand-made series untouched | `Bedtime Test` (null provenance, wrong order 05/01/03) survives with **same name, members and order**; **never appears in the log at all** — detection does not propose hand-made names ✅ |
| **19's mirrored criterion** | folder moved → prune 4→3 → `inserted 1 · removed 0` → **4 members, same series row, no duplicate, zero rows on the old path**; re-added row landed at **position 1.0, back between books 1 and 3** ✅ |
| upgrade path additive | 23 detected series gained alongside the null-provenance hand-made one, nothing lost ✅ |
| scan time | cold **184,285 ms** vs the pre-06 baseline **186,525 ms** — 2.2 s *faster*; **detect 338 ms = 0.18%** of a cold scan, 160–260 ms on a rescan ✅ |

**Two corrections to assumptions this ticket carried in, recorded so they are not re-made:**

- **"~19 series" is the wrong yardstick for a device.** It is the corpus number. The device
  number was already established at **23/200** by 04, and matching it exactly is the stronger
  result — it shows the write agrees with the seam.
- **02's 243 ms rescan is NOT a baseline for this library.** It was measured on a **50-file**
  library. No pre-06 unchanged-rescan of the full 3,461-file library was ever timed, so there is
  no before/after for that total; detection's own cost is the measurable part.

**Also confirmed on real data:** four `series_books` rows carry `canonical_source = NULL` — books
with no number — which is G5's one non-coalescing column behaving as specified, and 352 books →
351 units with the drop **logged rather than silent** (the known book split).
