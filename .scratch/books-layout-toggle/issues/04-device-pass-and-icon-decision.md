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

- [ ] Both icon pairs compared on the dev build. Flipping between them is a single-line edit
      under Fast Refresh, because all four icons are already in the shim.
- [ ] The three findings recorded against the chevron pair are checked rather than assumed:
      that both its glyphs contain the same list motif, so the control shows a list while in
      the grid layout; that its density claim reverses at three columns, where the grid is
      measurably more compact than the list; and that its chevrons may need a larger size
      than the header's icons to read at all.
- [ ] A pair is chosen. The losing pair's imports are deleted and the icon shim is
      regenerated a second time, so exactly two icons are added to what ships.
- [ ] The shim's drift test is green after that second regeneration. It fails in both
      directions — after an import is added and after one is removed — so a stale shim is
      caught here rather than as an undefined component at render time.
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
