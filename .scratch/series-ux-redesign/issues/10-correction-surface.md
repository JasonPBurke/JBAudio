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

1. **Does the existing series editor absorb all of it?**
   `src/app/series/edit/[id].tsx` already does rename, reorder and delete. The
   question is whether correction is "that screen, reached from more places" or
   a different surface entirely. Note 05 kept the wizard as the app's only
   opaque full-screen push — whatever this is, it should probably not be a
   second one.

2. **Entry points.** A bad grouping is *noticed* on the browse screen, not in
   settings. How does the user get from "that's wrong" to the fix — long-press,
   overflow menu, swipe, a detail screen? Depends on 08's browse decision,
   which is why this is blocked on it.

3. **Split and merge.** The only two corrections with no home at all. 02's
   number-collision check already splits editions automatically, so the
   residual need is unmeasured — establish whether it exists before designing
   for it.

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
