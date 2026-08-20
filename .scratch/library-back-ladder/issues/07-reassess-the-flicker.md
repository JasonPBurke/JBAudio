# 07 — Reassess the parked flicker with fresh eyes

Type: prototype
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

**Does any flicker actually remain in the collapse path this feature needs, and
was the FastImage-fade attribution right?**

The `collapse-offscreen-sections-flicker` memory records the off-screen
auto-collapse work as **PARKED** on
`fix/collapse-offscreen-lists-onMomentumScrollEnd`, blocked by a device-observed
"reloading/flickering", attributed to `BookGridItem`'s artwork `FastImage`
carrying `transition={FastImage.transition.fade}`
(`src/components/BookGridItem.tsx:269`) replaying on recycled cells when a
collapse mutates the list.

**That attribution is now in doubt.** The driver built and ran that branch on
2026-08-18 and reports:

- Collapsing lists **below** the current view: **no flicker observed.**
- Collapsing a list **above** the current view: **"almost flawless".**
- The one real problem seen was the blank-screen defect — a different failure,
  tracked as ticket 08.

So the branch may have been closer to correct than was recorded, and the memory
topic may be describing a problem that no longer reproduces or was
mis-attributed.

## Deliver

1. **Reproduce or refute** the original flicker on the current branch build.
   State the device, the library size, and the exact interaction.
2. If it reproduces, run the confirm/deny test the memory names: comment out the
   single `transition` prop and re-test. Note the `source` object is also inline
   and un-memoized (~line 262) — a second candidate.
3. **Scope the answer to this feature's path specifically.** This map's sweep
   only ever fires at the top, where it can only collapse below-fold sections —
   the case reported clean. A flicker that only manifests in paths this feature
   never takes is a footnote in the spec's risk section, not a defect to fix.
4. **Correct the memory topic** either way. It currently reads as a confident
   root cause and should not.

## Answer

**Reproduces, but as small/expected behavior — not a blocking flicker. Closed as a
non-defect for this feature's path.**

Driver has been testing the combined 05/06 prototype (`proto/back-ladder-rung-ab`)
against a real library — the actual candidate mechanism this map designed (ticket
04's "collapse strictly after settle" sweep, ticket 06's animated jump), not just
the old parked branch. Direct observation (2026-08-20): the card reload after
auto-scroll/collapse is **small and expected behavior**.

This is stronger evidence than the ticket asked for: it exercises the real
implementation candidate, not a proxy. Combined with what was already known:

1. **Reproduce or refute** — reproduces, in the sense that a brief card reload is
   visible. It is not the "reloading/flickering" severity the old memory
   described as a blocker.
2. **Confirm/deny fade test** — not needed. There is no defect to root-cause; the
   `FastImage.transition.fade` mechanism the old memory names is almost certainly
   still what's producing the reload (recycled cells re-entering the pool replay
   their mount transition), but its severity was overstated, not its mechanism.
3. **Scope to this feature's path** — confirmed doubly now: the sweep can only
   ever collapse below-fold sections (ticket 04), and the driver's direct test of
   that exact path found the reload minor. Goes in the spec's risk section as a
   known, acceptable cosmetic, not a defect to fix.
4. **Memory correction** — done, see `collapse-offscreen-sections-flicker.md`.

## Not a blocker

Ruled explicitly: the spec is **not** gated on root-causing this. This ticket
informs the spec's risk section and tells the implementation effort what to watch
for. `BookGridItem` is used by **all** library lists, so any fade change there has
app-wide blast radius — another reason not to fix speculatively.
