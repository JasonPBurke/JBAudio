# 09 — Prototype teardown

**What to build:** Nothing. This ticket removes things, and it exists because one of them is a
live hazard rather than clutter.

The prototype branch answered three questions no amount of source reading could — does the
intermediate rung earn its place, is animated better than instant, and what actually causes the
drift. It is **throwaway**, expected to be deleted rather than merged, and it was treated as
evidence rather than as a starting point.

⚠ **Four artifacts on that branch must never reach `main`:** the prototype ladder hook, the
probe/logging helper it uses, the on-screen debug chips, and a **FlashList patch** added purely to
instrument the anchor behaviour. The patch is the one that matters: the patches directory is
shipped code, so a diagnostic patch left there would be applied on every install.

Two pieces of the prototype were worth copying almost verbatim and should by now be in the
implementation: the rung's landing arithmetic with its comment, and the anchor-suppression call
with its comment. Confirm both survived before the branch goes.

Spec: Further Notes › "The prototype, and what must die with it"; user story 39.

**Blocked by:** 08.

**Status:** ready-for-human

- [x] `main` contains **no** prototype ladder hook, probe/logging helper, or on-screen debug chips.
- [x] The patches directory on `main` contains **no** diagnostic FlashList patch. Check this
      explicitly rather than by memory — it is the artifact with real user impact.
- [x] The rung's landing arithmetic and the anchor-suppression call are present in the shipped
      implementation, each with its explanatory comment intact.
- [ ] The prototype branch is deleted — **confirm with the driver first**, since its evidence is
      referenced throughout the spec and deletion is not something to do unasked.
- [x] **`spike/rn-jest-testing` is accounted for** — unlike the two branches above it is **not**
      throwaway: it carries the jest `rn` project, its setup file, the testing doc and the eslint
      override. If tickets 05-07 were implemented against it, it is already merged and there is
      nothing to do; confirm rather than assume, since those tickets' test suites silently move to
      the `helpers` lane and fail on the first `react-native` import if the config did not come
      with them.
- [x] The parked collapse branch's fate is decided the same way: its helper and tests have been
      brought across, and its **narrower** trigger semantics were deliberately not resumed
      wholesale, so nothing else on it is owed to this feature.
- [x] **Ticket 08's device-pass instrumentation is gone** — `src/helpers/ladderInstrumentation.ts`,
      its suite, the five bracketed call sites in `src/hooks/useBackToTopLadder.ts` (restore the bare
      `list.prepareForLayoutAnimationRender()`), and the `ticket 08 instrumentation` describe in the
      hook's `rn` suite. ⚠ **This is now the teardown item with real user impact**, in the FlashList
      patch's old role: the module is ON in any non-`test` build, and in its default `alternate` mode
      it deliberately WITHHOLDS the MVCP anchor fix on every other sweep. Shipped, that is exactly
      the drift §G1 exists to prevent — reaching users on every other deep back jump.
- [x] `npm test`, tsc and eslint are green on `main`.

---

## Disposition

Ran on `feat/library-back-ladder` (40 commits ahead of `main`, not yet merged). The checklist says
"`main` contains no…"; the branch **is** the shipping line, so each item was checked against the
working tree AND against `main` itself. `main` was independently confirmed clean of every artifact:
no `ladderInstrumentation`, no diagnostic FlashList patch. (`git ls-tree main` matches
`ladderInstrumentation` nowhere; the three `.scratch` hits for "proto" belong to the **series**
effort's own harness tickets, not this one.)

### Removed

- `src/helpers/ladderInstrumentation.ts` and `src/helpers/__tests__/ladderInstrumentation.test.ts`,
  deleted outright.
- Five bracketed call sites in `src/hooks/useBackToTopLadder.ts`: the import block, the
  `probeFirstItemOffset` mount effect (and with it the now-unused `useEffect` import),
  `logLadderPress`, `logLadderSettle`, and the `armAnchorFix` / `sampleDriftAfterSweep` pair.
- The `useBackToTopLadder — ticket 08 instrumentation` describe and its
  `__configureLadderInstrumentation` import from the hook's `rn` suite.
- The `[DT]` MVCP probe in `node_modules/@shopify/flash-list/dist/recyclerview/hooks/
  useRecyclerViewController.js` — the F-11 "keep it live for the drift A/B" ruling expired with
  ticket 08. Restored by diffing the installed tree against a freshly packed `@shopify/flash-list@2.3.2`
  tarball: the **only** delta was the two probe blocks, and after the copy `diff -rq` against the
  published package is empty. That is the check that the revert removed the probe and nothing else.

**Baseline check.** `src/hooks/useBackToTopLadder.ts` and `useBackToTopLadder.rn.test.tsx` are now
**byte-identical to `1050b47`**, the commit immediately before ticket 08's instrumentation landed
(`git diff 1050b47 -- <file>` is empty for both). Two locals the log calls had needed — hoisting
`buildSnapshot(...)` out of the `decideBackPress`/`decideSweep` arguments — were unhoisted with
them, so the file returns to its ticket-10-reviewed shape rather than to a near-miss of it. That
diff, not a grep, is the evidence that nothing from ticket 08 leaked through.

### Deliberately NOT removed

`if (decision.open !== inputs.expanded)` still guards the restored bare
`list.prepareForLayoutAnimationRender()`. The instrumentation wrapper sat *inside* that condition,
not around it — the guard is §G1's own leak-prevention (the flag is cleared by a COMMIT, and a
no-drop sweep produces no commit), so stripping it with the instrumentation would have reintroduced
the leak this ticket exists to prevent.

### Confirmed present, unchanged

- §D2's landing arithmetic in `src/helpers/ladderDecisions.ts` with the full comment — including the
  "no conversion term" derivation and the note that landing at `y_h + firstItemOffset` puts the
  header under the search-bar overlay.
- The §G1/§G2 anchor-suppression comment above the restored bare call in the hook.

### Branch accounting

- **`spike/rn-jest-testing`** — accounted for, nothing owed. It is an **ancestor** of
  `feat/library-back-ladder` (`git branch --merged` lists it), so its whole payload rides along:
  `jest.config.js`'s two projects, `jest.rn-setup.js`, `docs/testing/jest-projects-and-rn-tests.md`,
  and the `files: ['jest.rn-setup.js']` eslint override. The failure mode this item warns about —
  suites silently falling into the `helpers` lane — cannot occur here; the `rn` suite runs and
  passes.
- **`fix/collapse-offscreen-lists-onMomentumScrollEnd`** — nothing owed. Our
  `collapseOffscreenSections.ts` is a *superset* of the branch's (+33/−5) and its suite is too
  (+10), from ticket 01. The only remaining delta on that branch is `BooksHome.tsx`, which is
  exactly the narrower trigger semantics that were deliberately not resumed.
- **`proto/back-ladder-rung-ab`** — **left standing, pending the driver.** Deleting it is the one
  item this ticket says not to do unasked, and its evidence is cited throughout `spec.md`. Nothing
  on it can reach a build any more: the source artifacts are gone from the shipping line and the
  `node_modules` probe is reverted. So this is a housekeeping decision with no residual hazard, not
  a blocker.

### Verification

`npx tsc --noEmit` → 0 errors. `npx eslint .` → 0 errors (38 pre-existing warnings, none in the
touched files). `npx jest` → **73 suites, 952 tests, all passing.**
