# 16 — The editor stops fighting detection: save, remove, delete

**Blocked by:** [12](12-editor-one-root-route.md),
[09](09-delete-suppresses-and-restores.md).

**Status:** resolved — DEVICE-VERIFIED 2026-08-13 on a physical Pixel 7 Pro, all criteria
closed (`../DEVICE-CHECK-16.md`). Three defects and two driver rulings came out of the run.

**Spec:** [§D8, D9](../../series-ux-redesign/spec.md), §A11, §A12, §K7, §K5, §I7.

## What to build

The two correctness defects the editor carries today, fixed — so that a user's edit
**survives the next scan**, and deleting a series does not strand them on a blank white
screen.

Closes user stories 12–16 and 51, and it is the last piece of the promise that makes the
whole feature trustworthy.

## Defect 1 — the editor is not detection-aware

Its save path **rewrites join rows**. Two consequences, both trust-destroying:

- A book the user **removed** comes back on the next rescan. Removal must instead write the
  `membership = 'excluded'` tombstone that blocks re-derivation (A11).
- Removing the **last** book **deletes** the series, where A12 requires **suppression**.

The reconcile contract already exists and is tested ([05](05-reconcile-series-seam.md));
this ticket makes the editor's writes agree with it. Ownership is **per aspect** — renaming
must not cost automatic membership, and reordering must not disown the name.

## Defect 2 — the delete exit

**K7 — deleting a series currently pops onto the sheet of the series it just deleted.**
Reproduced, and **worse than predicted**: the route resolves nothing, renders nothing,
and — per K5 — shows **full-screen white**, with no grab handle, so the only escape is
system back.

**It needs BOTH fixes: pop *past* the sheet, and give the route a themed background.**

This is a **blocker, not a polish item**: because split and merge do not ship,
delete-and-rebuild is the sanctioned repair of last resort, which puts deletion on a
load-bearing route.

## Acceptance criteria

- [x] Removing a book from a series writes the `'excluded'` tombstone; the book **stays
      removed across rescans**. Written by `planEditorSave`; the survival is asserted by
      composing that plan with `reconcileSeries` (`seriesEditorSurvivesRescan.test.ts`).
- [x] ~~Removing the last book **suppresses** rather than deletes, per A12.~~
      **SUPERSEDED BY A DRIVER RULING ON DEVICE, 2026-08-13.** It was built and verified
      working first — emptying a series deleted it and wrote the suppression row — and then
      ruled out of existence: `Save` may never delete a series, because that made a button
      labelled `Save` perform an unconfirmed destroy with a lasting side effect. The book
      requirement is now unconditional and the message names the escape hatch. See the
      ruling below.
- [x] A rename persists forever — the next scan does not put the machine's name back — and
      **new books keep being added** to the renamed series. `name_source = 'user'` is
      written, `origin` is untouched, and both halves are asserted through a rescan.
      **Both halves also DEVICE-VERIFIED with a real file arrival (driver, 2026-08-13):**
      series renamed to `Bob`, book 05 copied into the library path, rescan → it landed at
      `pos 4 · #5`. ⚠ The row's provenance is what proves it: `membership=detected` is a
      value only `applyPlan` writes, so reconcile inserted it into a series it can no longer
      find by name.
- [x] A hand-ordered series keeps its order across every rescan.
- [x] A hand-made series (`origin = 'user'`) is **never touched** by detection. `createSeries`
      now writes `origin`/`name_source`/`membership` explicitly instead of relying on G5's
      null coalescing.
- [x] `Delete Series` lives in the editor and reuses the **existing origin-blind dialog**,
      whose copy is already correct: *"Delete series? This removes the series. Your books
      are not affected."* (unchanged by this ticket).
- [x] Deletion writes the suppression row per A12 — `deleteSeries`, unchanged, from
      ticket 09.
- [x] **The delete exit pops past the detail sheet AND the route carries a themed
      background.** The pop count is read off the navigation stack
      (`popCountAfterSeriesDelete`) rather than hardcoded, because a create has no sheet
      under it and §F's `titleDetails` series line will put another one there. The themed
      background landed with ticket 12. **Device-verified frame by frame in both themes:
      one `pop(2)` animating both screens out, ~200ms of sheet dismissal, never a landing.
      Max luminance 0.192 across 655 dark frames; zero light frames above 0.90.**
- [x] `Save` and `Cancel` exits are correct — ⚠ **AND SAVE'S WAS NOT, DEVICE-FOUND.**
      An emptying save was itself a deletion, so it landed on exactly the dead sheet K7
      describes. Fixed twice: first by giving it the same pop-past exit, then properly by
      the driver's ruling that `Save` may not delete at all — which removed the second
      path rather than patching it.
- [x] **I7 — `Delete Series` uses the shared `danger` token, which measures 2.59:1 on the
      light background.** Measured, confirmed at **2.59:1**, and **fixed** the way ticket 08
      fixed `success`: a per-scheme `dangerText` token — dark keeps `#FF5F56` (5.70:1)
      unchanged, light gets `#B3261E` (**5.67:1**). Deliberately not pushed to
      `successText`'s 6.83:1, because K15 established that excess legibility is its own
      failure mode; it sits just under the light theme's muted body text (6.56:1).
      **The shared bag itself is untouched** — the other `danger` call sites (the library
      settings screen) are a shipping-palette matter and out of this ticket's scope.
- [x] Device-verified end to end on a physical Pixel 7 Pro against the real library:
      remove a book → rescan → still removed (row read out of the live DB, not inferred
      from the screen); delete a series → suppression row written → rescan → still gone;
      `Restore All` → rescan → **back, with a new id and detection's own name**, which is
      what proves a suppression is a veto rather than a copy. 1120 logcat lines, zero
      errors. Full run in `../DEVICE-CHECK-16.md`.
- [x] `tsc` 0 errors · eslint 0 errors (35 warnings, none in a file this ticket touched) ·
      jest **55 suites / 690 tests**, up from 646.

## Do not extend the existing diff helper

The membership-diff helper is **unchanged** — it serves the editor's save path in its
current form, and this effort's reconcile lives in its own seam. Assert that its tests
still pass rather than folding new behaviour into it.

## Answer — what was built

### The save path is now a planner plus a copier

`src/db/seriesEditorSave.ts` — `planEditorSave()` — is the new pure seam, and
`seriesQueries.updateSeries` writes its plan verbatim. Same split as
`reconcileSeries`/`applyPlan`, for the same reason: the decisions this ticket is about are
the ones no test could reach while they lived inside a WatermelonDB writer.

The plan has **no verb that removes a row**. That is the fix, stated structurally: a
departing book becomes `membership = 'excluded'`, and there is nothing in the shape for a
destroy to be spelled with.

**The membership diff is NOT extended**, per the ticket. It still answers "which keys
arrived, left or moved" and its tests are untouched. What the planner adds is a second,
independent pass over the existing rows — which is also what catches the case a diff-driven
implementation misses: **re-adding a removed book whose position happens to be unchanged.**
The diff proposes nothing for that row, so a book the user just put back would have stayed
invisible.

**Ownership is per aspect,** and each aspect is one line:

| aspect | written when | never |
| --- | --- | --- |
| `name_source = 'user'` | the trimmed name actually changed | on a reorder, or a re-save |
| `position` | the drag order moved the row | on a rename |
| `canonical_number` + `canonical_source` | the number changed | on a reorder alone |
| `membership` | the book left, or came back | otherwise |
| `origin` | **never, by this path** | — |

`origin` staying `'detected'` is what keeps A10a's second pass reachable, which is what
makes "new books keep being added to the renamed series" true.

### The tombstone had no display filter, and now does

Nothing in the app had ever WRITTEN an `'excluded'` row before this ticket — `reconcileSeries`
only ever read them — so nothing filtered them out either. `assembleDerivedSeries` is where
that filter lives, because every Series surface resolves its books through it. Two matching
changes: `observeSeriesData` passes `membership` through, and **observes the column**, or
removing the last book in the list (which moves no other row) would not re-emit at all.

⚠ `loadExistingSeries` deliberately does NOT filter — reconcile needs the tombstones, and
`deleteEmptySeries` must keep counting them (K16).

### The delete exit reads the stack

`popCountAfterSeriesDelete` (`src/helpers/seriesNavigation.ts`) counts the editor plus any
detail sheets directly under it that were showing the series just deleted, and never pops
the last route. Not `back(); back();` and not `dismissAll()`: a create has no sheet under
it, and §F's `titleDetails` series line will put a book's sheet under the series one, which
is not this delete's to throw away.

### Three findings worth keeping

1. **`createSeries` never wrote a provenance column.** It worked only because G5 coalesces
   null to `'user'` — the acceptance criterion "a hand-made series is never touched" was
   true by accident. It is now true by data.
2. **I7's reading is exactly as specified: `danger` = 2.59:1 on light.** The fix has a
   precedent inside this same effort — ticket 08's `successText` — so it is a per-scheme
   `dangerText` rather than a local literal or a deferral. This is *not* the accent case
   that was deferred to the colour branch: `primary` is user-settable and cover-derived,
   `danger` is not.
3. **The empty-save path was already correct on the suppression half.** `deleteSeries` has
   written A12's row since ticket 09; what D9.1 called out is that `updateSeries` must route
   into it rather than destroying the series itself. It does, and the planner now says so in
   a place jest can see.

## Two driver rulings from the device run

### `Save` may never delete a series (2026-08-13)

The book requirement in `seriesEditorIssues` is now **unconditional**. An emptying save used
to fall through to `deleteSeries`, which meant `Save` destroyed a series *and* wrote A12's
suppression row with no confirmation — and detection would not recreate the name until the
user found it in `Removed Series`. Every other destroy in this app confirms first, and the
one that does, `Delete Series`, is one tap below `+ Add books` on the same screen.

It is also **less code**: the plan's union collapses, `updateSeries` loses its delegation
and its return value, `handleSave` loses its second exit, and there is one path into the K7
exit instead of two — the path that had been silently broken. `planEditorSave` now has **no
destructive verb at all**, for a row or for a series.

Copy: *"Add at least one book, or use Delete Series to remove it."* — edit mode only; the
create pass has no `Delete Series` to name. Emptying-as-rebuild (K16) is unaffected: the
replacements go in before the save. The greyed `Save` follows for free from
`commitActive = issues.length === 0`, and stays pressable so pressing it names the problem.

**Amends:** §K16's parenthetical about the editor's delete-on-empty, §D9.1's framing of the
same, and `seriesValidation.ts`'s asymmetry comment.

### The tombstone remembers the canonical number (2026-08-13)

Re-adding a removed book returned it with a blank number box, and `Save` wrote that blank
over the stored number. The tombstone had held it the whole time; the editor seeds from the
visible rows. Fixed **in the box, not in the DB** — `loadRememberedNumbers` +
`restoreRememberedNumbers` — so `Save` still writes exactly what is on screen. Keeping the
number on the row while showing a blank box was considered and rejected: the sheet would
badge `#5` over an editor showing nothing.

## Correction owed to the spec

**K7's "with no grab handle, so the only escape is system back" is overstated** — the driver
reports the blank sheet always had its handle. The rest of K7 was reproduced and is fixed.
