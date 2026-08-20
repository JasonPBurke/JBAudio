# 10 — Draft `spec.md` and drive it to driver approval

Type: grilling
Status: open
Blocked by: 02, 03, 04, 05, 06, 07, 08, 09, 11
Parent: [map.md](../map.md)

## Question

**Write the spec this map exists to produce, and get it approved.**

This is the map's closing ticket. Decisions-so-far is an *index*, deliberately —
the spec is where the decisions are assembled into something an implementation
effort can execute against.

Must cover:

- The **ladder** per view: rung order, the predicate for each rung, and what
  happens at each end.
- The **arm predicate** — the concrete "at the top" definition from ticket 03,
  with its measured justification.
- The **collapse sweep**: trigger events, the visible-set sampling point, and the
  Recents outcome that follows from it.
- The **intermediate rung**: kept or killed, with the device evidence that
  decided it.
- The **jump style**, and whether it respects reduced motion.
- The **interception mechanism** and its Android 16 / RN 0.83 constraints.
- The **invariants** the design relies on — chiefly that the sweep can only ever
  collapse below-fold sections — stated as invariants so a future change cannot
  quietly break them.
- A **risk section** carrying whatever tickets 07 and 08 concluded.
- **Test strategy.** `computeRemainingOpen` already has green jest tests and the
  repo has a strong pure-helper-plus-tests pattern (see `relativeSeek.ts`,
  `chapterSkip.ts`, `collapseOffscreenSections.ts`). The ladder's rung selection
  should be a pure function with the same treatment; say so explicitly and name
  the cases.

Follow the repo convention: `.scratch/library-back-ladder/spec.md`, driver-approved,
amended in place rather than rewritten if it drifts.
