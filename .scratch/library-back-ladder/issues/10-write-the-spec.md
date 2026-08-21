# 10 — Draft `spec.md` and drive it to driver approval

Type: grilling
Status: resolved
Blocked by: 02, 03, 04, 05, 06, 07, 08, 09, 11, 12
Resolved: 2026-08-20 — [`spec.md`](../spec.md) written, `ready-for-agent`. See Answer.
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

## Answer

**Resolved 2026-08-20.** The spec is [`spec.md`](../spec.md), labelled `ready-for-agent`.
Driver sign-off on the document as a whole is still pending; the header records that.

### Every "must cover" bullet, and where it landed

| Required | Section |
|---|---|
| the ladder per view — rung order, predicate, both ends | **§C**, with the three-rung table and the two-rung gate |
| the arm predicate with its measured justification | **§B** — and ⚠ **B5 restates it**, because DT-9's refutation killed ticket 03's headline argument |
| the collapse sweep — triggers, sampling point, Recents outcome | **§F** (F3 triggers, F6 sampling, F7 Recents-by-position) |
| the intermediate rung, kept or killed, with device evidence | **§D** — kept; D2 carries the landing arithmetic verbatim |
| the jump style, and reduced motion | **§E** — animated; E6 says the ladder must **not** consult `ReducedMotionConfig` |
| the interception mechanism and its Android 16 / RN 0.83 constraints | **§A** |
| the invariants, stated as invariants | **§I** — six of them, incl. I2 (the sweep can only collapse below-fold sections) |
| a risk section carrying tickets 07 and 08 | **§Risks** — R1 (cosmetic, accepted) and R2 (unreachable by construction), plus R3–R7 |
| test strategy: pure function, cases named | **§Testing Decisions** — 17 `decideBackPress` cases, 11 `decideSweep` cases, and the device checks that cannot be jest |

### Three forks the tickets left to the spec, put to the driver and decided

1. **The test seam.** One pure helper module exporting **two** decisions — `decideBackPress`
   and `decideSweep` — over a snapshot of plain numbers, with visibility passed as a **thunk**
   so ticket 03 §6's "offset predicate first" ordering lives inside the tested unit. The hook
   becomes gather → decide → execute. Two exports rather than one because a wrong landing and a
   wrong collapse are different failures. (§J4)
2. **Ticket 11 F-A — the overscroll bounce sweeps.** **Accepted**, not suppressed: the outcome
   equals a back press's, and the sweep can only touch below-fold sections. The
   `onScrollBeginDrag` mitigation is recorded as a reversible lever. (§F5)
3. **TalkBack.** **Out of scope**, as a named follow-up rather than an implicit gap — nothing
   was ever run with a screen reader. The reduced-motion half of that map item is *not* open:
   it is decided, and the decision is to do nothing. (§Out of Scope, R7)

### One decision taken on technical grounds, flagged rather than asked

Ticket 12 §6.3 offered a fork — gate the sweep on `offset >= 0`, or make `computeRemainingOpen`
iterate `visible`. **Neither, as stated.** §F8 instead makes a *degenerate visible sample* a
no-op: an empty visible range, or an overlap that yields no sections while ranges are non-empty.
That is sign-agnostic (it covers the negative-drift case without asserting anything about
offsets), it leaves the helper's contract and its five existing tests untouched, and at the top
of a list with data an empty visible set is **always** a bug signal because the ranges tile the
list. Two named jest cases pin it.

### One thing found while writing that the map did not record

⚠ **`computeRemainingOpen`'s jest tests are NOT green — they do not exist on the prototype
branch.** The helper was cherry-picked onto `proto/back-ladder-rung-ab` without its five-case
suite, which still lives only on `fix/collapse-offscreen-lists-onMomentumScrollEnd` (`0365b39`).
This ticket's own text says the tests are already green; they are, but only on a branch the
implementation is not starting from. The spec says **restore them**.
