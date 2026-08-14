# 17 — A book knows what it is part of

**Blocked by:** [01](01-schema-v33.md), [06](06-detection-runs-on-scan.md).

**Status:** resolved

**Spec:** [§F](../../series-ux-redesign/spec.md), §K9, §I2.

## What to build

A line under a book's title saying which series it belongs to and its number —
`Book 8 of Discworld` — so the relationship finally exists in **both** directions. Plus an
`Add to series…` action, so joining a series is reachable from the book you are looking at.

Closes user stories 62–66.

## The line

**F1 — a static subheading directly under the book title.** It is part of the **title
block**, the way a printed cover does it. It beat three structurally different rivals, each
asserting a different answer to *what kind of thing is a series* (identity/byline · tag/chip
· metadata/card).

- **F2 — exactly ONE series is shown.** The largest **detected** series wins; if the book is
  in no detected series, the **first user-created** one wins.
  > **The asymmetry is the ruling, not an oversight.** Detected series have no meaningful
  > creation order — it is scan order — so size is the only available signal, and the bigger
  > series is almost always the canonical one with the sub-series as the specialist
  > grouping. User-created series *do* have meaningful order, so "first created" stands for
  > them.

  Verified against a book in **12 series**.
- **F3 — static, not tappable.** A subheading that reads as prose has nowhere to put an
  affordance cue without becoming a field again — which is the thing that made it win. The
  route is not lost, only un-duplicated.
- **F4 — no number, no problem.** A book with no canonical number renders
  `Part of <series>`, never a substituted position. **Blank beats misleading.**
- **F5 — zero series renders nothing at all**, per the app-wide convention that an
  inapplicable item is **absent, not disabled at reduced opacity**.

## The colour is the trap

**F6 — one colour, one string, and it is a fixed light-coloured token — NOT a theme token.**
This screen paints an artwork-derived mesh gradient that is **dark in both themes**; theme
text tokens measured **1.20:1** on it in light theme. The whole string uses the shared
light-coloured muted token (**1.20 → ~4.8:1**).

**K9 — NAMING TRAP: the `light*` colour tokens mean "light-COLOURED", NOT "for the light
theme".** They live in the **shared** token bag, which the theme hook spreads **over** the
per-scheme tokens, so they are **theme-invariant by construction** — which is exactly what a
component-painted surface needs. The book title already uses one for this reason. An
engineer reaching for "the light theme token" will pick these and be right by accident, or
avoid them and be wrong.

This is the governing rule for the whole family: *anything drawn on a surface the component
itself darkens must take its colour from that surface, not from the theme.*

## Acceptance criteria

- [x] The subheading renders directly under the title, static, one series, per F2's pick.
- [x] `Part of <series>` when there is no canonical number; nothing at all when there is no
      series.
- [x] The **whole string** uses the shared light-coloured muted token. This amends the
      two-tone `Book N of ` prefix — the hierarchy that bought is now bought by the token
      choice.
- [x] **F7 — the negative top margin is load-bearing. Do not "clean it up".** The info
      column sets a fixed gap between every child, which made the line read as its own
      block; the target was the gap that `Read by` has above the narrator's name, which is
      **no gap at all**. The gap **below** is deliberately kept — that is what keeps the line
      part of the title block rather than the author block. It is scale-invariant (the gap
      it cancels is fixed dp too), so it needs no font-scale re-check.
- [x] **F8 — `Add to series…` sits under `Edit Book Details`**, grouping the two items that
      act on what the book *is* above the two that act on how it *plays*. It is **always
      present** — any book can join another series, so it has no inapplicable state. It is
      **join-only: no `New series…` row.** Book-first stays austere.
- [x] **F9 — no book-first remove.** Removal changes a *series'* membership, and the
      tombstone is series-scoped.
- [x] **F10 already shipped and must SURVIVE:** series keeps the `Layers` glyph and
      auto-chapters moved to `TableOfContents`. `Layers` was doing double duty as the
      library's Series-view toggle *and* the `Remove Auto-Chapters` glyph, which would have
      put identical icons on adjacent rows. **It looks like harness fallout and is not — it
      is a driver ruling.**
- [x] Device-verified **in light theme specifically**. Every visual acceptance on this
      effort before 2026-08-05 was made from dark-theme screenshots, and this screen is
      where that bit.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Resolved 2026-08-13

Built and **device-verified in light theme** on a physical Pixel 7 Pro — see
[DEVICE-CHECK-17.md](../DEVICE-CHECK-17.md) for the full run, the contrast measurements and
the two defects it found.

**What shipped:**

- `src/helpers/seriesLine.ts` — §F2's pick and §F4's string, pure. `src/components/BookSeriesLine.tsx`
  renders it; `titleDetails.tsx` mounts it in the title block and the harness mounts are gone.
- `src/components/AddToSeriesPanel.tsx` — §F8's join-only picker. It is a second CONTENT for
  the overflow modal, never a second modal.
- `src/db/seriesJoin.ts` + `addBookToSeries` — a join is expressed as an editor `Save`, so
  A11's tombstone restore and the remembered number come for free rather than being
  re-implemented.
- `DerivedSeries` gained `origin` and `createdAt`. §F2 cannot be answered without both, and
  neither is recoverable downstream: the assembled list is sorted A–Z.

**Two device findings, both fixed in-run:** the picker painted its empty state as the last
thing before the success confirmation (fixed by freezing the list during the write), and a
restored tombstone was appended rather than put back where it was (fixed by splicing it in
after the rows that still precede it — the editor's re-add already behaved that way, and the
same action through two doors must land in the same place).

**One thing jest holds alone:** the largest-detected-wins arm. Two detected series over one
book is not constructible on the device — only the scanner writes `origin='detected'`.

## Test the pick, not the pixels

The one-series pick — largest detected, else first user-created — is **exactly the
asymmetry a unit test should pin**. Everything else here is device-verified.
