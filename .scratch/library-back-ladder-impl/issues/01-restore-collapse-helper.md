# 01 — Restore the collapse helper and its jest suite

**What to build:** The pure collapse helper this feature's sweep will call, together with the jest
suite that proves it, brought back onto a working branch and green. Nothing calls the helper yet —
this ticket delivers a tested building block, not a user-visible change.

The helper and its suite live on the parked branch
`fix/collapse-offscreen-lists-onMomentumScrollEnd`. A branch name and a file location are named
here deliberately: this ticket is a cherry-pick, and a cherry-pick cannot be described without
them. Note that the prototype branch `proto/back-ladder-rung-ab` carries the helper **without** the
suite — do not take it from there.

Spec: Testing Decisions › "Restore the collapse helper's tests"; F6; F8.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The helper is on the working branch with its behaviour unchanged from the parked branch.
- [x] Its five-case suite is restored and passes: drops non-visible open sections; returns the
      **same set reference** when nothing collapses; same reference when the open set is empty;
      retains a protected section when one is passed; defaults to protecting nothing.
- [x] The same-reference cases are understood as load-bearing, not incidental — this feature
      relies on React bailing out of the re-render when a sweep collapses nothing.
- [x] The helper's own contract is **unchanged** by this ticket. The degenerate-sample guard the
      feature needs (F8) belongs in the sweep's decision function, not here, precisely so these
      restored tests stay meaningful.
- [x] The viewability plumbing that surrounds the helper on the parked branch is **not** brought
      across. It is replaced later (F6) by reading the visible range from the list's ref.
- [x] `npm test`, tsc and eslint are green.

---

## Answer

Done. `computeRemainingOpen` and its five-case suite are on `feat/library-back-ladder` (`20da088`),
both **byte-identical** to `fix/collapse-offscreen-lists-onMomentumScrollEnd` — verified by diffing
each file against `git show` on that branch, not by eyeballing. The helper is also byte-identical on
`proto/back-ladder-rung-ab`, so the "don't take it from there" warning is about the *missing suite*
only; there is no behavioural fork between the two branches to worry about.

**Gates:** tsc 0, eslint 0, jest 67 suites / 848 tests (843 before, +5 here). `/code-review low`
on the commit returned no findings.

### The same-reference cases are load-bearing — proved, not asserted

The third checkbox asks for these to be *understood* rather than merely passing, so they were
mutation-tested. Replacing the body with the obvious rewrite:

```ts
return new Set([...open].filter((id) => id === primary || visible.has(id)));
```

...produces identical set *contents* in all five cases and still passes 3 of them — but fails
exactly the two same-reference tests. That is the proof the suite pins the React bail-out and not
just the filtering logic. Restored to the original afterwards; the mutation never left the working
tree.

Why it matters downstream: the sweep will call this as
`setActiveGridSections(prev => computeRemainingOpen(prev, ...))`. Because the helper only allocates
when something actually drops, a no-op sweep hands React the same `Set` and React bails out of
re-rendering `BooksHome`. Every accepted bounce-sweep (F5) is a no-op sweep, so this is the property
that makes "bounce-sweeps accepted" cheap rather than a per-bounce re-render of a 355-book list.

### What was deliberately left behind

- **The viewability plumbing** (`onViewableItemsChanged` / `viewabilityConfig` and the ~96 lines of
  `BooksHome.tsx` around it on the parked branch). F6 replaces it by reading the visible range off
  the list ref. Not merely a simplification — FlashList's visible-range bounds count any sliver as
  visible, which is the semantics `itemVisiblePercentThreshold: 1` was chosen for, so the
  replacement is behaviour-preserving.
- **F8's degenerate-sample guard.** Belongs in the sweep's decision function (§J4), where the
  knowledge is. Keeping it out is what lets these five tests stay meaningful.

Net effect: nothing imports the helper yet (`grep` confirms the only references are its own docblock
and its test). Ticket 07 is where it gets wired up.

### One thing for whoever writes the sweep

The restored docblock's last line says `primary` is *"a section id for the lazy-single-open
variation (see the sibling spec)"*. That cross-reference points outside this effort and **F7 settles
it for us: this feature protects nothing and always passes `primary = null`.** The parameter is kept
because the ticket freezes the contract, not because the ladder uses it. Left verbatim rather than
edited — the spec's "modules are named; locations rot" rule argues against pasting a spec path into
a docblock — but don't read that line as an open design question. It isn't.
