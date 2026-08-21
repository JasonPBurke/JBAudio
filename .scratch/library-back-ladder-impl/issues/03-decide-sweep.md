# 03 — `decideSweep`, the collapse sweep's judgement

**What to build:** The ladder's judgement about *whether, and what, to collapse* — again a pure
function over the same snapshot, tested off-device. Nothing calls it yet. When this ticket is done
every gate that device work proved load-bearing is pinned by a test, including the two that exist
solely to keep known hazards closed.

The signature (spec §J4):

```ts
decideSweep(s: LadderSnapshot, trigger: 'momentum' | 'drag', velocityY?: number)
  -> { kind: 'none'; reason: 'not-sectioned' | 'not-at-top' | 'flinging' | 'no-visible-sample' }
   | { kind: 'collapse'; open: Set<string> };
```

Two exports rather than one, deliberately: a **wrong landing** and a **wrong collapse** are
different failures with different owners, and folding them into one return type would put
assertions about scroll offsets next to assertions about collapse behaviour.

`decideSweep` calls the restored collapse helper and leaves its contract alone. The degenerate-sample
bail-out belongs **here**, where the knowledge is.

⚠ One trap to know before starting. Ticket 12 of the closed map offered "make the helper iterate
`visible` instead of `open`" as a fix for the collapse-everything hazard. **It does not work** —
both iteration orders compute the same intersection, and with `visible` empty both yield an empty
set. What closes the hazard is the **bail-out**, not the loop. An implementer who "fixes" the
iteration order will believe the hazard is closed and it will not be.

Spec: F1–F9, H2, H3, I2, I5, J4; Testing Decisions › `decideSweep` — the cases; Risks R5; user story 35.

**Blocked by:** 01 (the collapse helper and its suite), 02 (the shared types).

**Status:** resolved

- [x] The capability gate comes from **view identity**, never inferred from the expanded set being
      non-empty — that set persists across view toggles, so data cannot answer this question.
- [x] Not-sectioned view with stale non-empty `ranges` and a non-empty `expanded` returns
      `none('not-sectioned')`. **This is the R5 regression test:** ungated, this exact input wipes
      the user's expansions from another view while they are looking at a different screen.
- [x] Not at the top returns `none('not-at-top')`.
- [x] Drag trigger with `velocityY = -4.76` at `offset 0` returns `none('flinging')` — the
      device-measured fling-away-from-the-top case that the at-top guard alone does not exclude.
- [x] Drag trigger with `velocityY = 0` at the top returns `collapse` — the accepted overscroll
      bounce.
- [x] A degenerate visible sample (`startIndex < 0`) returns `none('no-visible-sample')`.
- [x] **Empty overlap with non-empty ranges** returns `none('no-visible-sample')`. This is the
      other regression test: without it, this input is a collapse-**everything**, because the
      helper iterates the open set rather than the visible one.
- [x] Recents survives **by position**, not by exemption: at the top with Recently Added visible
      and three author sections expanded below the fold, the returned set contains only the
      Recently Added id. There is no protected-section parameter in play.
- [x] Nothing to collapse, and an empty `expanded` set, both return the **same set reference** as
      the input so React bails out of the re-render.
- [x] **Idempotence:** feeding a collapse result straight back in returns the same reference and
      collapses nothing. This is the property that makes a double momentum-end harmless.
- [x] Overlap counts **any sliver**: a section whose `end` equals `startIndex`, and one whose
      `start` equals `endIndex`, are both visible.
- [x] `npm test`, tsc and eslint are green.

---

## Answer

`decideSweep` + `SweepDecision` are in `src/helpers/ladderDecisions.ts` beside `decideBackPress`,
with 18 tests in the existing suite. Nothing imports it — `grep` over `src/` confirms the only
references are its own docblock and its tests; ticket 07 wires it up. Built red→green in six
vertical slices, one guard per slice.

**Gates:** tsc 0, eslint 0, jest 68 suites / **886 tests** (868 before, +18).

### The guard order is the decision, and it is not arbitrary

Each gate is the cheapest question that can still be answered correctly at that point, and each one
is what makes the *next* one safe to ask:

| # | gate | why it must come where it does |
|---|---|---|
| 1 | `SECTIONED_VIEWS` | R5. On another view the ranges describe the **wrong list's indices**; every question after this one would be answered against them. |
| 2 | `offset > firstItemOffset` | I2. Once passed, "not visible" and "below the fold" are the **same set**, which is what makes the sweep unable to touch anything on screen. |
| 3 | velocity | F4. The at-top guard alone does **not** exclude a fling away from the top — it is at-top at finger-lift. |
| 4 | `visible()` | F2. Only now has the list *proven* it is at the top and at rest, which is what makes the sample trustworthy. |
| 5 | degenerate / empty overlap | F8. The bail-out, not the loop, is what closes the collapse-everything hazard. |

Gates 1–3 are pure arithmetic over the snapshot, so the hostile fixture's **throwing `visible`
thunk** pins the ordering for free: all seven `none` cases that use the default thunk would fail
loudly if the sample were taken one line earlier. Same technique ticket 02 used for B7, reused here
for F2 — and it is the only defence against F2's "same bug with two entrances", because a
prematurely-sampled viewport is *plausible data*, not an error.

### The trap named in the ticket, confirmed rather than assumed

Ticket 12 §6.3's "iterate `visible` instead of `open`" was checked as a mutation, not taken on
faith: replacing the helper call with `new Set([...expanded].filter((id) => visibleIds.has(id)))`
— the `visible`-flavoured rewrite — leaves **every collapse-contents test green**. It kills only
the three same-reference tests, and it kills them for an unrelated reason (it always allocates).
Against an empty visible set it produces an empty set exactly as the current code does. **The
iteration order is not what causes the wipe**, confirmed on this branch.

### Every guard was mutation-tested — 16 mutations, all killed

Run via a script that applies one mutation, runs the suite, reverts (`$CLAUDE_JOB_DIR/tmp/mutate.py`;
not committed). No mutation survived:

| mutation | tests killed |
|---|---|
| drop the `SECTIONED_VIEWS` gate | 1 |
| at-top gate `>` → `>=` | 1 |
| drop the at-top gate | 2 |
| drop the velocity gate | 2 |
| velocity gate ignores `trigger` | 12 |
| unreported velocity counts as settled (`?? Infinity` → `?? 0`) | 1 |
| velocity gate drops `Math.abs()` | 1 |
| drop the degenerate-sample guard | 1 |
| drop its inverted-range half | 1 |
| drop the empty-overlap guard | 2 |
| qualify empty-overlap with `ranges.length > 0` (F8 as literally worded) | 1 |
| overlap bounds → strict | 2 |
| ...`end >= startIndex` half only | 1 |
| ...`start <= endIndex` half only | 1 |
| protect `'recents'` explicitly (an F7 exemption) | 1 |
| collapse rebuilds the set unconditionally | 3 |

**One test exists only because of a mutation that could not be killed.** `offset >` → `offset >=`
initially killed **nothing**, yet it is a real defect: at `offset === firstItemOffset` — the
canonical resting offset at the top — the sweep would never fire again. The decline side of that
boundary was pinned by ticket 02; the *sweeping* side was not. Added as
*"sweeps AT the boundary"*. This is the same shape as the containment-bounds gap ticket 02's review
found, and suggests a habit: **every boundary needs a test on both sides of it.**

### Three contract decisions §J4 does not state

All three are **spec-amendment candidates**, recorded rather than taken silently — joining the two
from ticket 02.

**1. The empty-overlap guard is NOT qualified by `ranges.length > 0`.** F8 words it as *"the overlap
yields no sections **while the range list is non-empty**"*. Implemented unqualified, because the
excluded case is the most destructive input the function can receive: empty `ranges` with a
persisted non-empty `expanded` is the R5 shape exactly — H5's before-paint window and a fresh mount
both produce it — and there `computeRemainingOpen` collapses **everything**. The qualifier can only
ever admit inputs, never reject them, and every input it admits is one F8's own reasoning calls a
bug signal. Pinned by *"declines when no ranges have been published yet"*; the qualifier's
reinstatement kills that test.

**2. An unreported drag velocity counts as flinging, not as settled.** §J4 types `velocityY` as
optional and says nothing about `undefined`. The two errors are **not symmetric**: a missed sweep is
invisible and the next arrival at the top performs it anyway, while a wrong sweep destroys the
user's expansions. So the default is `Infinity`, not `0`. Written as `!(Math.abs(v) < SETTLED)`
rather than `Math.abs(v) >= SETTLED` deliberately — those differ on exactly one input, `NaN`, and
under `>=` a `NaN` velocity would count as *settled* and sweep.

**3. A degenerate sample includes an INVERTED range**, not only `startIndex < 0`. F8 names the empty
case; `endIndex < startIndex` is the same fact and is **not** caught downstream — an inverted range
can still overlap a section under F6's arithmetic and produce a confident, wrong collapse. Note the
two guards deliberately overlap: with `startIndex = -1` the empty-overlap guard also fires, so the
`-1` test alone does not uniquely pin the first guard. The redundancy is F8's, kept as F8 states it.

### For ticket 07 (wiring the sweep up)

- The two triggers funnel into **one** call. `trigger` is what selects the velocity gate — passing
  `'drag'` for a momentum event silently disables the sweep for any list that reports residual
  velocity (that mutation kills 12 tests, so the suite will catch it, but only if the hook is
  exercised).
- `visible` must be a **thunk over `computeVisibleIndices()`**, never a pre-computed value — the
  same requirement ticket 02 flagged for the rung, and here it is F2 rather than B7 that it protects.
- The result's `open` is safe to hand straight to `setActiveGridSections`. It is the **same
  reference** as `expanded` whenever nothing drops, which is what makes every accepted bounce-sweep
  (F5) free rather than a re-render of a 355-book list.
- `decideSweep` takes a non-null snapshot, unlike `decideBackPress`. There is no "no list" case: a
  settle event cannot fire without a mounted list.

---

## Code review (`/mattpocock-skills:code-review` since `d22248c`, opus, two axes)

⚠ **Findings recorded, NOT yet applied.** Code as committed at `a7b7552` is green (tsc 0, eslint 0,
jest 886) and the ticket's checkboxes hold; the work below is follow-up.

### Spec axis — one real defect in the SUITE, not in the code

**Case 5's test does not bite.** Mutating `if (startIndex < 0 || endIndex < startIndex)` down to
`if (endIndex < startIndex)` leaves **all 38 tests passing**: the fixture `{startIndex: -1,
endIndex: -1}` also trips the empty-overlap guard, which returns the *identical* reason, so the
assertion cannot tell the two guards apart. **The mutation table above is therefore misleading** —
its rows *"drop the degenerate-sample guard | 1"* and *"drop its inverted-range half | 1"* are both
killed by the inverted test alone, and the half F8 literally names is unpinned. Fix:
`{startIndex: -1, endIndex: 12}`, which without the guard yields a collapse.

**Deviation 3 should be upgraded from "amendment candidate" to "F8's wording is wrong".** Verified
in `node_modules`: `ConsecutiveNumbers.EMPTY = new ConsecutiveNumbers(-1, -2)`
(`recyclerview/helpers/ConsecutiveNumbers.js:94`), returned by `LayoutManager.js:90`. **FlashList's
empty sample IS inverted** — so `endIndex < startIndex` is the half that catches the real thing and
`startIndex < 0` catches it only incidentally.

Two fixture nits: case 4 says *"velocityY = 0 **at the top**"* but is tested only at `offset: -120`;
case 7 says *"**three** author sections"* and the fixture has two.

Otherwise clean: signature and reason union match §J4 exactly, guard order matches the dependency
chain, `visible()` provably never called before gates 1–3, and I2/I5/F5/F7/H2/H3/R5 all honoured.
**No scope creep, nothing implemented wrongly.** Deviations 1 and 2 were independently re-derived
and upheld — notably, dropping `ranges.length > 0` provably cannot suppress a legitimate collapse,
because empty `ranges` ⇒ empty `visibleIds` ⇒ the only thing suppressed is a collapse-everything.

### Standards axis — no documented-standard violations; five judgement calls

1. **Duplicated Code — the at-top predicate, stated twice, inverted.** `decideBackPress`'s
   `offset <= firstItemOffset` vs `decideSweep`'s `offset > firstItemOffset`. The comment *asserts*
   "the EXACT complement" and I2 rests on it, but **nothing enforces it**. Extract `isAtTop(s)`.
   *(Take — this is an invariant currently held by a comment.)*
2. **Duplicated Code — the overlap arithmetic, twice**, in `sectionRungTarget` and `decideSweep`.
   One predicate would pin `end`'s inclusiveness — the README's ⚠ for ticket 06 — in one place.
   *(Take; containment is overlap with a degenerate span.)*
3. `SETTLED_VELOCITY` reads as a value, not an exclusive bound; neighbours name the role
   (`RESTART_CHAPTER_THRESHOLD_SECONDS`). *(Take as `..._THRESHOLD`; **decline `_MAX`** — it would
   assert an inclusivity the `<` does not have.)*
4. Data Clumps — `trigger` + `velocityY?`; a union would make `('momentum', -4.76)` unrepresentable.
   **Reviewer overrode itself: §J4 pins the signature.** No action.
5. Test file — `sweepSnapshot` near-clones `snapshot`, and one describe narrows two different ways.
   *(Take both.)*

Minor: the `// see the ticket's Answer` comment cites no path. *(Fix by making the comment
self-contained — ticket 01 set the precedent against pasting `.scratch` paths into docblocks.)*

**Glossary gap, recorded not fixed:** `sweep`, `rung`, `section`, `expanded` appear nowhere in
`CONTEXT.md`, which `docs/agents/domain.md` says is a signal to note for `/domain-modeling`.
Pre-existing — ticket 02 coined them.
