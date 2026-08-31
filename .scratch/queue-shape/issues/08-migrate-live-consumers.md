# 08 — Migrate the live consumers

**Spec:** `.scratch/queue-shape/spec.md` — `## Solution`, decision 3.

**What to build:** The surfaces that ask the Player where it is — the player screen, the
playback service's progress handling, the skip-previous and skip-next presses, and the
sleep timer's chapter ceiling — stop branching on Queue shape. Each reads the Player once,
hands the numbers to the translator, and uses the coordinate it wants.

This is where the read cluster the brief identified finally collapses: seven places that
each assembled the same Player reads and reconstructed "where am I, in Book terms?" from
scratch.

⚠ **The player's progress bar must keep its current split.** It computes a chapter offset
**once per chapter change** and lets the animation worklet do the cheap subtraction on every
frame. The translator returns a fresh object per call, so calling it per frame would put
allocation pressure on the UI thread. Preserve the split; do not move the translator call
into the worklet.

⚠ The skip-next decision is already the pattern to copy — it takes the shape verdict as a
**parameter** and refuses to derive it, with a header explaining why. It sits one function
below a skip-previous that does the opposite. Both are in the file the skip-next parity
ticket held up as the already-extracted target shape.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] The player screen, playback service, both skip presses and the sleep-timer ceiling all
      use the translator
- [ ] None of them branches on Queue shape any more
- [ ] The progress bar still computes its chapter offset once per chapter change, not per
      frame, and no translator call happens inside a worklet
- [ ] Each migrated site reads the Player once and passes numbers down, rather than reading
      inside a helper
- [ ] Behaviour is unchanged except where a coordinate is now null and was previously a
      fabricated zero; every such site is listed on this ticket with what it now does
- [ ] `tsc` 0, eslint 0, full suite green
