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
- [ ] The parked collapse branch's fate is decided the same way: its helper and tests have been
      brought across, and its **narrower** trigger semantics were deliberately not resumed
      wholesale, so nothing else on it is owed to this feature.
- [ ] `npm test`, tsc and eslint are green on `main`.
