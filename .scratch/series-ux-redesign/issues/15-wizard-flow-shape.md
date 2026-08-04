# 15 — Wizard flow shape: does the 3-step funnel survive as the fallback?

Type: prototype
Status: open
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

The wizard was designed when manual creation was the **only** way to get a
series. The map's destination demotes it to a **fallback**, and three tickets
since have taken jobs away from it:

- [02](02-detection-cascade.md) put grouping at **98.3% purity**, so most series
  arrive without it.
- [09](09-auto-generate-series-setting.md) replaced the review queue with a
  settings toggle, so the wizard never became a confirmation surface.
- [10](10-correction-surface.md) made **the edit screen** the correction surface,
  so fixing a series does not route through the wizard either.

What is left for it is exactly two jobs, and it is worth asking whether
`Authors → Books → Order` is the right shape for **either**:

- **Hand-building a playlist.** The vocabulary entry says a series "doubles as a
  personal playlist"; a playlist is not author-scoped, and step 1 is
  *Authors*. Does an author filter help or obstruct here?
- **Rescuing the ~4% of books that are dark to every signal**, plus the
  delete-and-rebuild path that the map's Out of scope section made
  **the sanctioned repair of last resort** — which puts the wizard on a
  load-bearing route despite being a fallback.

Concretely:

1. **Do all three steps survive?** [07](07-sequence-numbering.md) already ruled
   the drag step survives "as pre-sorted rather than redundant" *when a canonical
   number seeded it* — but a hand-made playlist seeds **null** (07 verified this),
   so `Order` is doing full manual work in exactly the case this wizard now
   exists for. Meanwhile 10 put `Sort by number` in the editor. Is `Order` a
   step, or a thing you do afterwards in the editor?
2. **Is the funnel the right container at all** now that the editor
   (`series/edit/[id].tsx`) can do books + order + name + number in one screen?
   The honest alternative is *create-then-edit*: a name prompt, then land in the
   editor. That would delete three screens.
3. **Fix the three logged defects** from [05](05-wizard-presentation.md),
   whatever shape wins: the inactive `Next`/`Save` button renders with an
   **invisible label**, the wizard has **no app header**, and **every step has a
   large dead vertical region**.

## What is already settled and must not be reopened

- **Presentation is a full-screen opaque push.** 05 chose it deliberately — the
  driver wanted the "you have left the library" signal — and
  [13](13-detail-sheet-prototype.md) reaffirmed the reasoning while moving the
  *editor* to a `transparentModal` (a task flow with a Save/Cancel footer stays a
  push; only launching-over-a-live-sheet forced 13's change). The wizard is
  launched from the library, not from a sheet, so 13's finding does not touch it.
- **The clipped-row bug is out of scope**, including as an argument here.

## Constraints

- Files: `src/app/series/create/{authors,books,order}.tsx` (216 / 284 / 198
  lines), grouped under `src/app/series/_layout.tsx`, which
  [13](13-detail-sheet-prototype.md) established is a **bare `<Stack>`** — the
  group boundary owns no store lifetime, every `seriesDraftStore` reset lives on
  a screen. Deleting or merging steps therefore orphans nothing, but each screen's
  reset has to be accounted for.
- `books.tsx` is **shared with edit** (`isEdit` switches `Next`→`Done`), so a
  change to step 2 lands on the editor's `Add books` sub-flow too — the one leg
  13 left untested.
- Navigator `screenOptions` changes need a **full JS reload**, not fast refresh.
- Prototypes are disposable: no jest/tsc/eslint/tablet/font-scale bar.

## Definition of done

A flow shape chosen on device — three steps, fewer, or create-then-edit — with
the three 05 defects fixed in whatever survives, and an explicit statement of
what the wizard is *for* now that it is a fallback.
