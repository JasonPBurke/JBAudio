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

**Status:** ready-for-agent

- [ ] The helper is on the working branch with its behaviour unchanged from the parked branch.
- [ ] Its five-case suite is restored and passes: drops non-visible open sections; returns the
      **same set reference** when nothing collapses; same reference when the open set is empty;
      retains a protected section when one is passed; defaults to protecting nothing.
- [ ] The same-reference cases are understood as load-bearing, not incidental — this feature
      relies on React bailing out of the re-render when a sweep collapses nothing.
- [ ] The helper's own contract is **unchanged** by this ticket. The degenerate-sample guard the
      feature needs (F8) belongs in the sweep's decision function, not here, precisely so these
      restored tests stay meaningful.
- [ ] The viewability plumbing that surrounds the helper on the parked branch is **not** brought
      across. It is replaced later (F6) by reading the visible range from the list's ref.
- [ ] `npm test`, tsc and eslint are green.
