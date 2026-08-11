# 20 — The picker's author step becomes a two-column grid

**Blocked by:** [13](13-editor-picker-panel.md).

**Status:** ready-for-agent

**Spec:** [§E14](../../series-ux-redesign/spec.md) (the whole ticket), §E9, §E10, §H7.

## What to build

The picker's **authors** step renders as a **two-column grid** — 13px names, ~50dp pitch,
a 14px corner check — instead of the full-width rows it ships today.

Nothing else about the picker changes. The **books** step, the sticky head, the staged
selection and the ordered list above are all untouched.

## Why this ticket exists — read this before assuming it is a restyle request

The grid is not a new idea. It is a **driver decision from 2026-08-04** that this
implementation effort never received, because it was dropped in transit:

1. [redesign 15](../../series-ux-redesign/issues/15-wizard-flow-shape.md), Variant E,
   driver's decision **5 of 5**, verified on device against a 100-author corpus.
2. It survived the 2026-08-05 ruling that chose E over F — which confirmed on inspection
   that *"E needs no change under the playlist reading."*
3. **The spec's §E carried E's flow and dropped its cell geometry.** So it reached no
   ticket, and 13's acceptance criteria are entirely behavioural.
4. [12](12-editor-one-root-route.md) lifted the author row **verbatim** from the
   pre-redesign `series/create/authors.tsx` when it built the panel — correctly, since 12's
   job was route consolidation, not restyling. That styling is what is on screen now.

The spec is amended: **§E14** now carries the decision and §E9 lists it as closed. This
ticket is the last link.

**Nobody did anything wrong here.** Every link in the chain was individually correct, which
is exactly why a coverage check against the spec could never have found it.

## Where it is now vs where it goes

| | now (from the deleted create screen) | §E14 |
| --- | --- | --- |
| Columns | 1 | **2** |
| Name type | `fontSize.base` = 20 | **13px** |
| Pitch | ~66dp | **~50dp** |
| Check | 26dp bubble, centre-right | **14px corner check** |
| Authors/screen | ~7–8 | **~18–20** |

The current metric is, almost exactly, **variant F's** (20px name / ~60dp pitch / 7 per
screen) — and F is closed by §E10. That is a coincidence of provenance, not a decision.

## The seam: pair at the data level, do not touch the list config

**Emit the pairs from `pickerRows()`** — a new `authorPair` row carrying a left and an
optional right author — and render one paired cell component in the panel. The helper is
already pure and already has tests, so the layout arrives testable.

**Do not reach for `numColumns` + `overrideItemLayout`.** FlashList 2.3.2 does support it
(`span: 2` on head/heading/book/empty, 1 on authors), and in a greenfield picker it would
be the idiomatic choice. It is the wrong choice **here**:

- The picker is **one list serving both steps**. Column behaviour would become a property
  of the list rather than of the step, and every non-author row would need a span override
  to opt back out.
- 13 device-verified this exact list configuration — sticky head at index 0,
  `initialScrollIndex`, `MVCP_OFF`, ordered list as `ListHeaderComponent` — and measured
  **917→480 views, flat at 108 rows**, on the real 355-book library. Changing `numColumns`
  perturbs the thing that measurement was taken of.
- Sticky-header-plus-grid is untested in this repo, and this repo has already paid for
  FlashList 2.3.2's layout defaults once — see the MVCP fallout.

Data-level pairing leaves all of that **provably unchanged**: same row count for the books
step, same index 0, same header component.

## Acceptance criteria

- [ ] The authors step renders **two columns**; 13px name; ~50dp pitch.
- [ ] Selected state is **primary border + 12% tint + a 14px corner check**. The 26dp
      centre-right bubble is gone from the author cell.
- [ ] An **odd** author count leaves the last cell half-width and correctly aligned — it
      does not stretch to fill the row.
- [ ] The pairing happens in `seriesPickerRows.ts` and is covered by its unit tests,
      including the odd-count and empty-library cases.
- [ ] `PICKER_HEAD_INDEX` is still `0`, the head is still sticky, and the books step's row
      sequence is **byte-identical** to what 13 shipped. (A `pickerRows` test asserting the
      books step is unchanged is the cheapest way to hold this.)
- [ ] The **books** step, staged selection, `X` semantics and the ordered list are visibly
      unchanged.
- [ ] Device-verified: scan a ~100-author library, confirm ~18–20 authors per screen,
      select across ten authors, in **both themes**.
- [ ] **Device-verified at font scale 2.0 — this is the risk, not a formality.** See below.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## The one genuine unknown: font scale 2.0

§E14 carries this as a known risk. The grid was verified at ~100 authors but **never at 2×**
— redesign [16](../../series-ux-redesign/issues/16-geometry-stress-tablet-fontscale.md)
explicitly scoped the wizard out of its geometry pass, and §H7 exempts this surface from the
geometry rules that would otherwise govern it.

13px inside a ~48.5%-wide cell at 2× is the shape that clips, and this repo already tracks
two live font-scale clipping defects on the book screens.

**If it clips, do not silently fall back to one column** — that is variant F and it is
closed. Bring the measurement back and let the driver rule. Allowing the *cell* to grow
taller while the grid stays two-wide is the first thing to try, since §H7 means no width cap
applies here.

## Closed — do not re-offer

- **A single-column author list.** That is F's shape (§E10).
- **§H8 as an argument against the grid.** H8 closes multi-column for the **browse row**,
  which needs phone-parity width per column for a cover plus text. §H7 exempts this surface
  from all of §H, H8 included. This misreading is pre-empted in §E14 because it is the
  obvious wrong turn.
- **Token-ising the 13.** The scale is `xs: 12 · sm: 16 · base: 20 · lg: 24`, so nothing
  below 16 exists. A similar literal was "corrected" upward once and the driver reverted it.
- **Dropping the check and relying on the border.** Colour-only state; ruled in decision 5.
- **Filter or search over the authors.** §E10, and the reasoning is in §E3.
