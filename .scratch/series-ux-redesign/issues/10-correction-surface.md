# 10 — Correction surface: where does fixing a series actually happen?

Type: prototype
Status: open
Blocked by: 08
Parent: [map.md](../map.md)

## Question

Detection now creates series without any gate, and [09](09-auto-generate-series-setting.md)
guaranteed that **every hand edit survives every rescan**. That guarantee is
only worth something if the edits are reachable. **Where do they live?**

## Why this exists

This was the map's longest-standing fog patch. It started life as a
*review-and-correction gate* — the redesign's original centre of gravity.
[02](02-detection-cascade.md) removed the gate (detection is accurate enough
that per-item confirmation is not worth its UI), and 09 replaced the last of it
with a settings toggle plus suppression-on-delete. What is left is genuinely an
**editing** surface, and it is now unblocked in every direction except layout.

## The decisions

1. **Does the existing series editor absorb all of it?** **Largely yes —
   settled during 08 (2026-08-03).** `src/app/series/edit/[id].tsx` already does
   rename, **add books** (:242), remove (`handleRemove`), reorder (`Sortable`)
   and delete — a complete single-series repair kit. Correction is therefore
   "that screen, reached from the right place", not a new surface. **But it is a
   strict subset of correction** — see 3 and the defect below. Note 05 kept the
   wizard as the app's only opaque full-screen push; this should not be a second.

2. **Entry points. Settled by 08.** Editing is reached **from the series detail
   screen's three-dot menu**, and nowhere else. 08 removed the `Pencil` from
   every browse row (`SeriesHome.tsx:279`) and deliberately did not replace it —
   putting it back would re-clutter the space the redesign cleared. Accepted
   cost: editing goes from 1 tap to 2. What remains for this ticket is only
   whether *correction-specific* actions need any entry beyond that menu.

3. ~~**Split and merge.**~~ **OUT OF SCOPE — driver, 2026-08-03.**
   *"Deleting and rebuilding is good enough for now, and if at a later date
   feedback leads me to needing to add this, we can revisit."* Design nothing
   for it here.

   Recorded because the reasoning matters if it ever returns: these are the only
   two corrections a single-series editor **structurally cannot express** — it
   operates on one id, while a false split ("these two are one") or false merge
   ("this one is two") spans two. The escape hatch is delete the wrong series
   and rebuild it in the wizard. That is now load-bearing, so **deletion and the
   wizard must stay capable enough to serve as the universal repair of last
   resort** — 09's `suppressed_series` + `Removed Series` restore path is part of
   why this is acceptable.

4. **Reassigning a mis-filed book.** Book-first or series-first? Overlaps the
   `titleDetails` fog item, which may want to merge into this ticket.

5. **07's canonical-number edit field.** 07 ruled the override must exist and
   flips `canonical_source` to `'user'`, but deliberately declined to site the
   UI. It lands here.

6. **07's deferred "Sort by number" action** — re-seeds `position` from
   canonical on demand. 07 considered and declined it purely because it had
   nowhere to live. It now has somewhere.

7. **Does a bulk "number sequentially from current order" action belong here?**
   It would number all 39 of the 2022 Discworld units in one tap, but on a
   gapped set it stamps 1,2,3,4 over 1,3,4,8 and destroys the distinction 07
   exists to draw.

## Defect this ticket inherits — found during 08, not yet fixed

**The existing editor predates 09 and will silently undo repairs on *detected*
series.** Schema is v32; `membership`, `name_source`, `origin` and
`suppressed_series` do not exist yet, so:

- `handleRemove` + `updateSeries` just rewrite the join rows. On a detected
  series **the next rescan re-adds the book the user removed** — exactly the
  failure 09 predicted ("removals need a tombstone or the repair for a wrong
  merge silently undoes itself").
- `updateSeries` **deletes the series when its last book is removed**
  (`seriesQueries.ts:81-83`), whereas 09 ruled that delete must **suppress** via
  `suppressed_series`, or detection simply recreates it.

So "correction = the edit screen" only becomes *true* once the edit screen is
made 09-aware. That is a correctness upgrade to an existing screen rather than a
design question, but this ticket owns noticing it — and it matters more now that
**delete-and-rebuild is the sanctioned escape hatch** for split/merge: that path
runs straight through the suppression behaviour above.

## Constraints already settled

- **09: renaming sets `series.name_source = 'user'`; removing a book sets
  `series_books.membership = 'excluded'`; adding one sets `'user'`.** All flips
  are **silent** — no lock icons (03: Jellyfin's visible locks are a documented
  mess). The surface must not invent a competing provenance UI.
- **09: `Removed Series` already has a home** in Library settings, rendering the
  `suppressed_series` table with `Restore` / `Restore All`. Do not duplicate it.
- **09: deleting a series is already solved** and its copy already written.
- **02: renaming is the highest-traffic repair** — grouping is 98.3% correct
  while naming is 94.2%, so the common action is a label fix, not a regrouping.
  Optimise the surface for rename above everything else.
- **06: a rename changes a series' identity**, not merely its label, since
  identity is `name` alone. Duplicate-name rules apply on edit.
- 07: `position` is the sole sort authority; `canonical_number` only seeds it.

## Notes

- 04's harness (`src/prototypes/`) takes a new variant by copying a file and
  adding one row.
- The existing implementation is a **resource, not a constraint** — the editor
  is device-verified and its delete copy is already correct.

## Answer

_(unresolved)_
