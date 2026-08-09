# 09 — Deleting a series makes it stay deleted, and `Removed Series` brings it back

**Blocked by:** [06](06-detection-runs-on-scan.md), [07](07-series-detection-card.md).

**Status:** resolved — **all nine acceptance criteria met, and the device run closed both device
criteria on 2026-08-09** on a physical Pixel 7 Pro against the driver's real 3,461-file library.
Record: `../DEVICE-CHECK-09.md`. **The surface changed during the device run on the driver's
call** — the dedicated screen became an inline expansion and restore now runs detection
immediately; see `## Answer` and `## What the device run changed`.

**Spec:** [§A12, A13, A14](../../series-ux-redesign/spec.md), §G7, §Out of Scope.

## What to build

A user rejects a grouping the app made. It **stays rejected** — the next scan does not
quietly recreate it. And a user who deleted one by mistake finds it in a `Removed Series`
list and restores it.

Closes user stories 17–19.

## Why this is load-bearing, not a polish item

Cross-series **split and merge do not ship**. That makes *delete and rebuild by hand* the
**only expressible repair for a wrong merge**, which puts three things on a load-bearing
route: deletion, this suppression/restore path, and the create/edit surface. None of them
may be treated as nice-to-have.

## Acceptance criteria

- [x] Deleting a **detected** series writes its name to `suppressed_series`, so detection
      will not recreate it.
- [x] Deleting a **hand-made** series writes nothing — nothing would recreate it.
- [x] Deleting a series **never touches the user's books**. Removing a grouping is not a
      destructive act.
- [x] `Removed Series (N)` opens a browsable list offering `Restore` and `Restore All`.
      Restore deletes the suppression row; the next scan recreates the series.
- [x] Hand-creating a series whose name is suppressed **clears that row** — otherwise the
      user's own new series is shadowed by an invisible veto.
- [x] **The suppression name is de-duplicated in JS on write.** There is **no
      unique-constraint support anywhere in the DB library** — `isIndexed` emits a plain
      index. Without the JS check a double-delete writes two rows and the
      `Removed Series (N)` count is wrong.
- [x] End-to-end on a device: delete a detected series → rescan → **it stays gone** →
      restore → rescan → **it comes back**. **CLOSED 2026-08-09.** `Discworld` (41 books)
      deleted → `skipped 1` on the retroactive button AND on a real `Rescan Library` →
      restored → `created 1 (41 rows)`. Two further lossless round trips back to the exact
      baseline followed.
- [x] The list gets a light-theme look. **CLOSED 2026-08-09** in both themes. Every theme
      token resolves (body/label `#4B5563` on `#FFFFFF`, **7.56:1**) and nothing renders
      dark-in-light.
- [x] `tsc` 0 errors · eslint 0 errors (35 warnings — baseline was 36; see below) · **jest 43 suites / 490
      tests green** (was 42/469).

## Two rejected designs — do not reintroduce

- **A checkbox on the delete dialog** ("also stop detecting this"). Rejected: **a modifier
  asking for foresight fails exactly when foresight is absent.** The whole point of
  recovery is that it works for a user who did not anticipate needing it.
- **`Restore All` as a bulk destroy.** It is not one — it is creative, which is precisely
  why it is allowed under A14. No bulk destroy ships anywhere on this feature.

## Answer

Built **directly on `feature/series-styling`, no worktree** (driver's call), **UNCOMMITTED**.
**DEVICE-VERIFIED 2026-08-09** — see `## What the device run changed` below, because the surface
described here is the second one: the dedicated screen was built, tested, and then replaced on
the driver's call.

| File | What |
| --- | --- |
| `src/db/seriesSuppression.ts` | **NEW, pure.** `suppressionsMatching` + `groupRemovedSeries` — G7's rule, once |
| `src/db/__tests__/seriesSuppression.test.ts` | **NEW.** 13 tests |
| `src/db/seriesQueries.ts` | `deleteSeries` suppresses · `createSeries`/`updateSeries` clear · `loadRemovedSeries` · `restoreRemovedSeries` |
| `src/helpers/seriesName.ts` | **NEW `isSameSeriesName`** — the one spelling of the A15 comparison |
| `src/helpers/seriesDetectionSummary.ts` | **NEW `summarizeSeriesRestore`** — the restore report, 8 tests |
| `src/db/seriesReconcile.ts` | `suppressionsClearedByCreating` now asks `isSameSeriesName` |
| `src/app/(settings)/library.tsx` | the row 07 left un-pressable now **expands in place**, with the list, both restores and the animated height |
| `probes/suppression-probe.test.ts.txt` | **NEW, kept.** The real-DB round trip, 5 cases |

### G7 has TWO halves, and the ticket only names one

The ticket says a double-delete writes two rows and the count goes wrong. True, and there is a
third failure it does not name, which is the worst of them because it is silent: **restore must
delete EVERY row for a name.** Clearing one of two leaves the veto standing, and the series
simply never comes back — no error, no wrong number, nothing to notice.

So the de-duplication is one rule asked in three places (write, count, restore), which is why it
is a pure module rather than three `filter`s: three spellings is how the two prune sites drifted
apart in [19](19-membership-survives-a-file-move.md). The comparison itself is now **`isSameSeriesName` in `seriesName.ts`** —
`isDuplicateSeriesName`, `suppressionsClearedByCreating` and the suppression table were all
asking the same question in their own words.

### A13 is load-bearing in a way the spec sentence understates

The spec says a leftover suppression row would shadow the user's new series. It is stronger than
that: **`reconcileSeries` consults `suppressed_series` in its FIRST pass, before it tries to
match a proposal to an existing series** (`seriesReconcile.ts`, pass 1). A leftover row does not
merely block a re-create — every scan skips the user's own series *without ever looking at it*,
so it silently stops gaining new books forever. Proven in the probe by the **skip reason flipping
from `suppressed` to `user-owned`**: those two words are the difference between "never looked"
and "saw it and left it alone".

**Extended beyond the literal criterion, deliberately: `updateSeries` clears too.** Renaming a
series onto a suppressed name is the other way a user claims one — nothing blocks it, since
`assertSeriesNameAvailable` checks live series, not the suppression table — and the veto that
lands on it is identical. Three shared lines. **Flagged here so [16](16-editor-detection-aware-save-and-delete.md) does not re-do it.**

### KNOWN BOUNDARY: suppression is keyed by the CURRENT name

Delete a detected series the user has **renamed** and detection can still re-propose it under its
original machine name. This is **not fixable from here**: `name_source = 'user'` records that the
name changed, not what it was, and recovering it would need a column to hold it. The user's
repair is to delete the re-created series, which suppresses that name too. Commented at
`deleteSeries`.

### The desk proof, and it is stronger than the unit tests

`probes/suppression-probe.test.ts.txt`, run against a **real WatermelonDB** on the 298-unit
corpus (**19 series / 179 books**, target `Discworld` at 41 — identical to 06's figures). All
five cases green:

- delete `Discworld` → **1** suppression row → rescan **skips it as `suppressed`** and does not
  recreate it;
- `Removed Series` lists it **once** → restore → the very next rescan brings it back **with the
  same 41 books**;
- deleting a **hand-made** series writes nothing (`origin` is null → `'user'`);
- a delete of an **already-suppressed** name leaves **one** row, not two;
- the `books` table is unchanged across a delete.

**Mutation-proven, three ways** — each mutation was applied and the probe re-run:
`if (true)` for the G7 guard fails **3 of 5**; `if (true)` for the `origin === 'detected'` check
fails 1; and stubbing `prepareSuppressionClear` to `[]` fails 1. The probe is not decoration.

**This is the risk the pure seams cannot see** (the same argument that bought 06's probe): a
suppression row written but not read back the same way lands, makes the count go up, and lets the
next scan recreate the series anyway.

### The `Removed Series` surface — an inline expansion, not a screen

The spec never designed this surface; it says only "a browsable list offering `Restore` and
`Restore All`". A **dedicated route was built first, device-tested, and then replaced** on the
driver's call — see `## What the device run changed`. What ships is the row expanding in place
inside the Series Detection card, which is where §A9's sketch puts it anyway.

- **`Restore` runs detection immediately** (143ms measured for one series). The alternative —
  lift the veto and wait for a scan — hides the two cases where the series never returns at all.
- **`Restore All` confirms; `Restore` does not.** Not destructiveness — **reversibility**. One
  tap to do, N confirmed deletes to undo. The confirm button is not styled `destructive`,
  because this creates.
- **`Restore All` is a right-aligned pill, not a third full-width accent button.** 07 already
  logged that this card's button reads as identical to `Apply to Existing Books`; a third would
  compound it. It is a list utility, so it wears the list's control. Shown only above one entry.
- **The row expands at zero and sits OUTSIDE the `seriesDetectionEnabled` block.** Turning
  detection off does not un-delete anything. The hairline above it is suppressed in that state,
  or `Enable Series Detection`'s own divider doubles up — verified on device.
- **The expansion animates on CollapsibleSettingsSection's exact pattern**, so it and
  `Library Folders` two inches below roll out identically. One addition: `pointerEvents` is
  gated on the expanded state, because a clipped-but-live `Restore` writes to the database.
- **Light theme:** every colour is a theme token; measured 7.56:1 on device. The restore controls
  use the **accent tint** idiom 07 verified, never `danger` — restore creates.
- Nothing has a fixed height, so the app's open font-scale clipping shape is not reproduced.

### Smaller things worth not re-deriving

- **The count on the card and the length of the list now come from the same function.** 07 had
  its own `new Set(names.map(normalizeSortName)).size`; that is one more spelling of the rule and
  it is gone.
- **`loadSuppressedSeriesNames` is kept as well as `loadRemovedSeries`.** The detector only ever
  asks "is this name vetoed?" and wants the raw list; a person needs distinct names to read and
  stable ids to act on. Two callers, two shapes, one table.
- **`restoreRemovedSeries` takes row ids, not a name.** G7's duplicates make "delete the row for
  this name" ambiguous and "delete these rows" exact, and the ids are already computed by the
  grouping that drew the list.
- **Removing the last book from a series already suppresses**, free: `updateSeries([])` delegates
  to `deleteSeries`. That closes one of 16's criteria without 16 doing anything.
- ⚠ **A `CompactSettingsRow` that ENDS a `SettingsCard` is 12dp off-centre**, and it is a
  general trap, not a 09 one: the row's own `paddingVertical: 12` stacks with the card content's
  `paddingBottom: 16`. Measured on device at 74px above the label and 116px below. Fixed with
  `marginBottom: -16` on the block — which is exactly the geometry `Library Folders` already has,
  since CollapsibleSettingsSection's content carries no bottom padding.
- ⚠ **A new route needs `.expo/types/router.d.ts` regenerated** or `tsc` rejects the `href`;
  `.expo/` is gitignored, so this bites every fresh clone that adds a screen. It cost a Metro
  boot here before the route was deleted again — noted because the next ticket that adds a
  screen will hit it.
- ⚠ **The settings Stack's `animation: 'slide_from_right'` contradicts the group's
  `slide_from_left`** and has been **dead config** until now: every settings screen is the FIRST
  screen of that stack, pushed from the drawer, so the group's animation is what plays. The
  deleted `Removed Series` route was the app's first push *within* the settings stack and the
  first thing ever to expose it. Still live for whatever pushes there next.

## What the device run changed

Three driver calls made mid-run, all in the shipped build and all re-verified on device:

1. **`Restore All` gained a confirmation.** This ticket's original reasoning — "every destroy is
   confirmed and every create is not" — was **too strong**, and `Apply Auto-Chapters` disproves
   it: a bulk create that prompts. A14 forbids bulk *destroys*; it does not require creates to be
   silent.
2. **The dedicated screen became an inline expansion** and the route was deleted. A
   `CollapsibleSettingsSection` (its own card) was considered and **rejected — it contradicts
   §A9's approved sketch**, which places this row inside the Series Detection card.
3. **Restore runs detection immediately.** Driver: *"this seems the action the user is wanting."*
   Right, and stronger than convenience — see `summarizeSeriesRestore`. Verified live with
   detection off: `Restored — Bromeliad is off the removed list. Series Detection is turned off,
   so it can't be rebuilt until you turn it back on.`

**A contrast reading was taken and WITHDRAWN.** The accent-tint buttons measure 1.66:1 in the
driver's amber — but the accent is **user-settable to any colour**, so that number is about the
user's choice, not the design. Same shape as 17's PILLAR ruling. Do not re-raise it as a defect;
the accent-independent tokens measure 7.56:1 and pass.
