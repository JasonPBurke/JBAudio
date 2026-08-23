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

**Status:** ready-for-agent

- [ ] `main` contains **no** prototype ladder hook, probe/logging helper, or on-screen debug chips.
- [ ] The patches directory on `main` contains **no** diagnostic FlashList patch. Check this
      explicitly rather than by memory — it is the artifact with real user impact.
- [ ] The rung's landing arithmetic and the anchor-suppression call are present in the shipped
      implementation, each with its explanatory comment intact.
- [ ] The prototype branch is deleted — **confirm with the driver first**, since its evidence is
      referenced throughout the spec and deletion is not something to do unasked.
- [ ] **`spike/rn-jest-testing` is accounted for** — unlike the two branches above it is **not**
      throwaway: it carries the jest `rn` project, its setup file, the testing doc and the eslint
      override. If tickets 05-07 were implemented against it, it is already merged and there is
      nothing to do; confirm rather than assume, since those tickets' test suites silently move to
      the `helpers` lane and fail on the first `react-native` import if the config did not come
      with them.
- [ ] The parked collapse branch's fate is decided the same way: its helper and tests have been
      brought across, and its **narrower** trigger semantics were deliberately not resumed
      wholesale, so nothing else on it is owed to this feature.
- [ ] **Ticket 08's device-pass instrumentation is gone** — `src/helpers/ladderInstrumentation.ts`,
      its suite, the five bracketed call sites in `src/hooks/useBackToTopLadder.ts` (restore the bare
      `list.prepareForLayoutAnimationRender()`), and the `ticket 08 instrumentation` describe in the
      hook's `rn` suite. ⚠ **This is now the teardown item with real user impact**, in the FlashList
      patch's old role: the module is ON in any non-`test` build, and in its default `alternate` mode
      it deliberately WITHHOLDS the MVCP anchor fix on every other sweep. Shipped, that is exactly
      the drift §G1 exists to prevent — reaching users on every other deep back jump.
- [ ] `npm test`, tsc and eslint are green on `main`.
