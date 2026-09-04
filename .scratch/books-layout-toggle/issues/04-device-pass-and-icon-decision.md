# 04 — Device pass: settle the icon pair and contract the shim

**What to build:** The decisions only a device can make, and the cleanup that follows them.

Two candidate icon pairs went into ticket 02 behind a swappable constant precisely so this
choice would be made by eye rather than by argument. This ticket makes it, deletes the
losing pair, and confirms the handful of behaviours that reasoning cannot settle.

⚠ **This ticket needs a physical device and a person's judgement.** It is not
agent-grabbable.

Read the spec's D9, D10 and D12 before starting.

**Blocked by:** 03 — Remember the layout choice.

**Status:** ready-for-human

### Settled — the icon decision (2026-09-03)

- [x] Both icon pairs compared on the dev build. Flipping between them was a single-line edit
      under Fast Refresh, because all four icons were already in the shim.
- [x] The three findings recorded against the chevron pair were carried into the comparison
      rather than assumed away. Their disposition:
      - the shared list motif (finding 1) and the density reversal at three columns
        (finding 2) are **accepted, not answered** — the chevrons carry the state and D8's
        announcement carries it in words, but a reader who takes the motif first can still
        read the grid's icon as "switch to list". Both are written into
        `BooksLayoutToggle`'s D9 docblock so a later reader does not take the file for a bug.
      - the size worry (finding 3) **did not land**: the chevrons read at the header's 24
        points, so the control is not visually heavier than its neighbour and `size={24}`
        stands.
- [x] **`chevrons` won.** The `shapes` pair's imports (`LayoutGrid`, `List`) are deleted,
      `ICON_PAIRS` has collapsed to a single `ICONS` constant, and the shim was regenerated a
      second time. Neither losing icon is imported anywhere else in `src/`, so the net
      production cost is exactly the two chevron icons D10 budgeted: 69 icons in the shim
      against 67 on `main`.
- [x] The shim's drift test is green after that second regeneration
      (`src/helpers/__tests__/lucideShim.test.ts`, both cases). `tsc --noEmit` is clean.

### Still open — needs a device and a person

These rows are not agent-grabbable and are why this ticket stays `ready-for-human`.

- [ ] On device: the control hides when scrolling down and returns when scrolling up, with
      the search bar, and cannot be pressed while hidden.
- [ ] On device: the chosen layout survives the app being killed from recents.
- [ ] On device: back performs its two-step on the list layout.
- [ ] The list layout's first row sits a few points lower than the grid's, because the two
      components reserve their top padding differently. Observe it and decide — fix it or
      accept it. **Do not fix it blind.**
- [ ] The control's upper hit-slop is partly clipped, and it needs a finger rather than an
      argument. It carries `hitSlop={15}` around a 24-point icon centred in the 38-point
      overlay row, so roughly the top 8 points of that slop fall outside the overlay — and
      the overlay's parent is `overflow: 'hidden'`, which on Android does not deliver
      touches outside a parent's bounds. The horizontal slop is bounded the same way by
      `screenPadding.horizontal`. This is the house style rather than a regression — the
      header's own controls are `hitSlop={15}` on the same icon size — so the question is
      whether the reachable target is comfortable at the edge of the screen, not whether
      the number matches. Raised by the ticket 02 spec review. **Do not enlarge the control
      with padding to fix it**: D6 pins the overlay's published height, which every list
      re-reserves as a spacer and the ladder resolves offsets against.
- [ ] Anything found here that changes what should ship is written back into the spec or a
      follow-up ticket, not left in this checklist.
