# 11 — Series detail screen: what does it hold?

Type: prototype
Status: open
Blocked by: 08
Parent: [map.md](../map.md)

## Question

[08](08-browse-presentation.md) settled that a series detail screen **exists**
and what its **job** is. It deliberately did not decide its **contents**.
What goes on it?

## Why its job got bigger than expected

08 chose a browse row that does not expand. That makes this screen the **only**
route to:

- a series' books at all (browse shows a static peek plus `+N`);
- a series' **full name** (browse caps at 2 lines and truncates);
- a series' **provenance** (the origin chip was removed from browse entirely);
- **editing** a series — 08 dropped the `Pencil` that
  `SeriesHome.tsx:279` puts on every browse row, and did not replace it.

So this is not a "nice to have" screen. Every affordance the browse redesign
shed has to land here or be lost.

## Already decided — do not re-open

08 built and device-verified a first pass
(`src/prototypes/ProtoSeriesDetail.tsx`). These carry over:

- **Hero**: fanned cover cluster + name + meta line + origin chip + completion
  bar + a `Start`/`Continue`/`Restart` button.
- **Name capped at 4 lines**, tappable to expand when it overflows, with **no
  `Show full name` label** — the ellipsis is the affordance. The title is a
  control *only* when it overflows (not `disabled`: TalkBack reads that as
  dimmed). Overflow is **measured** with an off-screen uncapped copy, because a
  capped `<Text>` cannot distinguish "exactly 4 lines" from "clipped at 4".
  4 lines ≈ 104dp ≈ the cover cluster's height.
- **Book list**: one row per book, `#canonical` or `–` when unknown (07: blank
  when unknown, never invented), cover, title, author, finished check.
- **Row covers sit in a fixed-width box** so a wide cover can never shove that
  row's title right and ragged the column. Covers still take their true shape.
- The `Fix this series` row in the prototype was a **placeholder with no defined
  behaviour**. It is not part of the answer — see *Editing*, below.

## The decisions

1. **Series artwork.** Driver-confirmed (2026-08-03): art derives from the
   **first book** and **follows** a reorder rather than pinning. It can also be
   **overridden**, two ways, both wanted: an online lookup (parallel to
   `/coverArtSearch`, which `editTitleDetails.tsx:78` already routes to) **and**
   picking one of the member books' covers. Open: whether an override needs its
   own column or rides 09's per-aspect ownership pattern, and whether the
   online path inherits the known **orphaned-artwork leak** for a new object
   type — nothing in `src/` cleans up cover files today, so adding a second
   producer of them needs care. Picking a member book's cover is free by
   comparison: no new file, nothing to orphan.

2. **Series description.** Driver-confirmed: it exists, and it is **protected
   from rescan the way `name` is** — so it needs a `*_source` companion under
   09's per-aspect model. Open: where it renders, how long, whether it collapses.

3. **The three-dot menu.** Driver's proposal, mirroring `titleDetails.tsx:296`
   (`EllipsisVertical` → `Modal` menu). Confirmed to hold **Edit series**,
   **Change artwork**, **Delete**. Open: what else. Note **Delete carries extra
   weight now** — with split/merge ruled out of scope, delete-and-rebuild is the
   sanctioned repair of last resort, so this menu is on that path.

4. **Editing is detail-only.** Driver-confirmed: the `Pencil` does **not** come
   back to browse — it would re-clutter the space the redesign cleared. Accepted
   cost: editing goes from 1 tap to 2. This screen owns the entry point.

5. **Transition.** The prototype used a `Modal`, so push-vs-sheet is **untested
   by construction**. 05 chose push for the wizard on a "you have left the
   library" argument that may not transfer — a detail screen is not a modal task
   flow. Decide deliberately; do not inherit.

6. **07's deferred "Sort by number" action** — re-seeds `position` from
   canonical on demand. 07 declined it purely for having nowhere to live. This
   screen or 10's, whichever fits.

## Constraints

- **06: identity is `name` alone.** Renaming changes identity; duplicate-name
  rules apply.
- **07: `position` is the sole sort authority**; canonical only seeds it, and
  the badge is blank when unknown.
- **05: the wizard is the app's only opaque full-screen push.** Whatever this
  is, think hard before making it a second.
- **A book cell can only render a book in the library store** — or render from
  the `Book` objects `DerivedSeries.books` already carries, which is what the
  prototype does.

## Notes

04's harness takes a new variant by copying a file and adding one row;
`ProtoSeriesDetail.tsx` is already shared by three variants.

## Answer

_(unresolved)_
