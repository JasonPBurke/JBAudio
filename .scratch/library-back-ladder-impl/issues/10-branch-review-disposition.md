# 10 — Whole-branch review: disposition and fixes

Status: `ready-for-agent`
Type: `task`
Blocked by: none — but **land this before 08**, see *Why before 08* below.

**What to build:** The fixes arising from the first review of `feat/library-back-ladder` as a
*whole branch* rather than ticket by ticket. Tickets 01–07 were each reviewed on two axes at the
moment they resolved; this pass re-read the assembled feature against `main` (`6f75a97`, which is
also the merge-base) and found things only a whole-feature reading can see.

**Three reviewers, run independently:**

- **Standards axis** (mattpocock two-axis, opus) — does the diff follow this repo's documented
  standards, plus a Fowler smell baseline.
- **Spec axis** (mattpocock two-axis, opus) — does the diff faithfully implement `spec.md` as
  amended.
- **Correctness pass** (the built-in `/code-review`, opus) — bug hunt over the same diff, run as a
  separate background agent at the driver's request.

**Gates at review time, all green:** `npx tsc --noEmit` 0 errors · `npx eslint .` 0 errors
(38 warnings, none in this feature's files) · `npx jest --watchman=false` **935/935**, 72 suites
(helpers 69/898 + rn 3/37).

⚠ **Use `npx jest --watchman=false`.** `npm test` still crashes on this machine when watchman runs
at low priority — a Node fatal with no test output at all. Unchanged from ticket 06.

## Why before 08

Two items below change what a device build *measures*, not just what it does:

- **F-11** — leftover MVCP instrumentation in `node_modules` logs on every correction attempt. Any
  build made on this machine right now carries it; a build made after `npm ci` does not. That is
  ticket 08's §E5 smear measurement being taken against two different binaries.
- **F-1** — the flaky test. Ticket 08 will run the suite repeatedly around device builds. A test
  that fails ~10% of the time under load will be read as "the device work broke something."

Everything else could follow 08. These two should not.

---

## The convergence worth reading first

**All three reviewers independently landed on `useBackToTopLadder.ts:325`** — the sweep's
`setExpanded(decision.open)`. They reached it from three different directions:

- Standards: *"this docblock describes a caller that doesn't exist"* (`collapseOffscreenSections.ts:8`).
- Spec: *"the code doesn't do what its own helper's docblock prescribes"* (§E4 idempotence).
- Correctness: *"an absolute write can clobber a queued functional update"* (`BooksHome.tsx:216`).

One line, three framings, no shared context between the reviewers. That is the strongest signal in
the review and it is **F-6** below.

---

## Findings

Grouped by who owns the decision, not by severity. Each carries the evidence that was actually run,
because several of these are the kind that read convincingly and dissolve under tracing — this
effort has already seen ~1/3 of PLAUSIBLE findings not survive (see
[[series-code-review-d2195ed]] in the project memory).

### A. Apply — mechanical, evidence already gathered

#### F-1 · The flake is closed. It is this branch's test, and the hook is fine. 🔴

`src/hooks/__tests__/useResetScrollOnTabChange.rn.test.tsx:82` —
*"cancels the pending frame on unmount rather than scrolling a dead list"*.

**This is the flake ticket 05 and ticket 06 both recorded and could not attribute.** Ticket 05 saw
`1 failed, 902 passed`; ticket 06 saw `1 failed, 922 passed`; neither captured the test name. They
are the same bug, and **ticket 05's guess was correct** — it wrote *"the more likely candidates are
the pre-existing `rn` suite's `requestAnimationFrame` round-trip under load"*.

**Mechanism.** The test does:

```ts
await rerender({ tab: CustomTabs.Started });   // schedules the rAF
await unmount();                                // cleanup cancels it
await flushFrame();
expect(scrollToOffset).not.toHaveBeenCalled();
```

Under the RN preset `requestAnimationFrame` is `setTimeout(fn, 0)` — the file's own trap note says
so. The assertion holds only if that timer is **still pending** when `unmount()` runs. Nothing
enforces it: `await rerender(...)` yields to the event loop, and under CPU contention the
already-elapsed 0 ms timer fires *inside* that await. The frame runs, calls `scrollToOffset`, and
the later `cancelAnimationFrame` is a no-op on an already-fired frame.

**Evidence run:**

| Condition | Result |
| --- | --- |
| Full suite, default order | **0 failures / 25 runs** |
| Full suite, `--randomize` | **~10%** — failures on runs 1, 6 of one sweep; run 4 of another |
| `rn` lane alone, `--randomize`, 40 runs | **0 failures / 40** |
| Captured failure | `Expected 0 calls, Received 1: {"animated": false, "offset": 0}` |
| Captured seed | `-529419720` |

The 0/40-in-isolation vs ~10%-in-company split **is** the proof: isolation removes the worker
contention that lets the timer win the race. `--randomize` does not cause the bug, it reshuffles
which suites share a worker.

`Received: 1 call` proves the frame fired. The only alternative — `cancelAnimationFrame` being
broken — would fail every run, not one in ten.

**Fix:** replace the real rAF in this suite with a manual frame queue, so the pending frame runs
only when the test says. Assert that after `unmount()`, draining the queue produces no call. That
pins cancellation *directly* instead of by absence, and removes the timing assumption entirely.

⚠ **This is NOT `jest.useFakeTimers()`** — trap 2 in `docs/testing/jest-projects-and-rn-tests.md`
forbids that, correctly, because it breaks RNTL 14's async render. Stub `global.requestAnimationFrame`
/ `cancelAnimationFrame` in this one file via `beforeEach`/`afterEach` and leave timers real.

⚠ **Verify the fix the way the bug was found:** a green single run proves nothing here. Run the
**full** suite with `--randomize` at least 30× and require 0 failures.

#### F-2 · `ladderViewFor`'s fall-through defaults into the one dangerous view 🟠

`src/app/(drawer)/(library)/index.tsx:57`

```ts
const ladderViewFor = (toggleView: number): LadderView =>
  toggleView === 1 ? 'seriesHome' : toggleView === 2 ? 'booksGrid' : 'booksHome';
```

`ladderDecisions.ts:59` is `SECTIONED_VIEWS = new Set<LadderView>(['booksHome'])` — verified, one
member. So **every unrecognised ordinal falls through to the only view that arms both the section
rung and the collapse sweep.** There is no `'booksList'` case at all, and §H7 advertises reviving
`BooksList` as a *"zero-diff change"*.

Concrete failure: someone adds `toggleView === 3` rendering `<BooksList/>`. `ladderViewFor(3)`
returns `'booksHome'`, so back resolves the rung against `sectionRangesRef`'s stale `BooksHome`
indices, and the sweep collapses the reader's expansions while they are looking at a different
list. That is §R5 exactly — which the spec says the identity gate is the only thing that disarms.
It compiles, and it is silent.

**Fix:** invert so an unmapped ordinal degrades to a two-rung view:

```ts
toggleView === 0 ? 'booksHome' : toggleView === 1 ? 'seriesHome' : 'booksGrid';
```

Add a test pinning that an out-of-range ordinal is not a sectioned view.

#### F-3 · `jest.config.js` — a test file that runs in neither project 🟠

`jest.config.js:59` — the `rn` project matches `**/__tests__/**/*.rn.test.[jt]s?(x)`, while
`helpers` ignores `\.rn\.test\.[jt]sx?$` **anywhere** in the path.

A colocated `src/hooks/useFoo.rn.test.tsx` — a common convention — is therefore claimed by neither
and **never runs**, with `npm test` reporting green. This is precisely the "fails quietly" class
`docs/testing/jest-projects-and-rn-tests.md` exists to catalogue, and it is not in the seven.

**Fix:** widen `rn`'s `testMatch` to `**/*.rn.test.[jt]s?(x)` (the default
`testPathIgnorePatterns` still excludes `node_modules`), **and** add this as the eighth trap in the
testing doc. Do both — the config fix stops it happening, the doc entry stops someone narrowing the
glob again.

#### F-4 · Comment accuracy — the effort's own repeat defect class

Three sites. Ticket 07 already fixed two instances of this class; these are the ones a per-ticket
review could not see.

1. **`src/helpers/collapseOffscreenSections.ts:8`** — verified dead, and **the live rationale is
   unwritten**, which is the worse half. The docblock justifies the same-reference return as
   *"callers using `setActiveGridSections(prev => computeRemainingOpen(prev, ...))` get React's
   bail-out"*. Grep confirms the sole call site is `ladderDecisions.ts:271`, passing values. But
   the same-reference property is now **more** load-bearing, not less: ticket 07 gates the MVCP
   anchor fix on `decision.open !== inputs.expanded`, so identity is what decides whether the
   anchor flag is armed. Rewrite the docblock to state *that*. ⚠ Ticket 01's mutation-tested
   "React bail-out" cases are really pinning the anchor guard now — say so in the suite too, or the
   next reader deletes them as obsolete.
2. **`src/helpers/collapseOffscreenSections.ts:12`** — *"(see the sibling spec)"* resolves to
   nothing. `.scratch/` holds six feature dirs (`book-end-detection`, `library-back-ladder`,
   `library-back-ladder-impl`, `series-implementation`, `series-ux-redesign`, `sleep-timer-freeze`)
   and none is a collapse spec. Either point at the real document or drop the parenthetical.
3. **`src/app/(drawer)/(library)/index.tsx:114`** — *"the back-to-top ladder from ticket 05"*.
   **Downgraded from the Standards axis's "hard" to a judgement call:** the sentence is presently
   true, the ladder *is* installed 40 lines below. The real problem is a ticket number in shipped
   source that stops meaning anything after merge. Reword to describe the thing, not the ticket.

#### F-5 · Smaller Standards items

- **`useResetScrollOnTabChange.ts:3-6`** hand-declares `ScrollableRef`, a second private copy of the
  list surface `ladderList.ts` now owns. ⚠ **This one was probed, because it looked like it should
  fail.** Ticket 04 records that a structural subset cannot be passed as a `ref` — but that applies
  to React's `ref` prop, not a plain parameter, where property covariance allows it.
  `type ScrollableRef = RefObject<Pick<LadderList, 'scrollToOffset'> | null>` **compiles: `tsc` 0
  errors.** Adopt it.
- **`index.tsx:47`** — `const NO_RANGES: SectionRange[] = []` is a shared mutable module array handed
  into a ref. `readonly SectionRange[]` matches the stated intent.
- **`eslint.config.js:12-19` is over-broad.** Measured by deleting the block: only `jest` in
  `jest.rn-setup.js` actually errors. `require`/`module` are already globals and `jest.config.js`
  needs nothing, so the `files` entry and 2 of 3 globals are inert. Narrow it.
- **Duplicated prose.** The §R5 *"never emptied on a view toggle … identity gate is the only thing
  that disarms them"* paragraph appears 4× (`useBackToTopLadder.ts:70`, `index.tsx:126`, and the
  test at `:425` and `:698`); the MVCP *"cleared by a COMMIT, not by time"* argument 3×
  (`useBackToTopLadder.ts:299`, test `:616`, `:691`); the *"list ref belongs to the LIBRARY SCREEN"*
  comment verbatim in all four lists. One canonical site each, pointers elsewhere — the pattern
  ticket 06's review already applied twice. ⚠ The branch forbids exactly this in its own words at
  `BooksHome.tsx:196`: *"do not restate it here"*.

### B. Decide — design-level, do not apply mechanically

#### F-6 · `setExpanded` writes a value where the contract says updater 🟠

`src/hooks/useBackToTopLadder.ts:325` — **the three-axis convergence.**

`inputs.setExpanded(decision.open)` writes an absolute value derived from `inputsRef.current.expanded`,
i.e. the last *committed* set. Two consequences, and the reviewers weighted them differently:

1. **Clobbering (correctness pass).** `BooksHome.tsx:216`'s `handleSectionPress` uses a *functional*
   update. If any `activeGridSections` update is queued but uncommitted when a settle event fires,
   the sweep's absolute write discards it — a tap opens a section that immediately shuts, with no
   error. The reviewer could not construct a high-probability ordering and called it **latent**.
2. **Lost idempotence (spec axis).** §E4: *"The sweep fires AT LEAST ONCE per arrival and must be
   idempotent."* Two settle events in one React batch re-derive from the same stale mirror and build
   a *fresh* `Set`, so `decision.open !== inputs.expanded` is true a second time.

⚠ **The spec axis framed consequence 2 as re-arming the anchor flag — reaching ticket 07's leak from
the other side. I traced it and do not think it leaks.** The second `setExpanded` passes a
*different* reference, so React cannot bail out, a commit follows, and `onCommitEffect` clears the
flag. What you actually get is a **redundant full re-render of a 355-book list** — precisely the
cost the same-reference bail-out exists to avoid. The correctness pass reached the same conclusion
independently. Treat it as a performance and contract defect, not a flag leak.

**Why this is not a mechanical fix.** The updater form needs the computation deferred into React's
state callback, but `decideSweep` is a **pure** function that already returns a computed set. Moving
to an updater changes the §J4 seam — the thing the spec says exists so *"a wrong landing and a wrong
collapse are different failures with different owners"*.

**Sketch, if adopted:** have `decideSweep` return the `visibleIds` alongside `open`, then

```ts
if (decision.open !== inputs.expanded) list.prepareForLayoutAnimationRender();
inputs.setExpanded(prev => computeRemainingOpen(prev, decision.visibleIds));
```

The arm decision still uses the pre-computed `open` (cheap, and it is the committed-state answer);
the write becomes stale-proof. Cost: one redundant `computeRemainingOpen` per sweep over a set of
at most a few dozen ids. ⚠ Whoever does this must re-run **ticket 07's 12 mutations** — the
anchor-fix guard is what they pin.

**Recommendation:** adopt, but as its own ticket with its own mutation pass. Not folded into the
mechanical batch above.

#### F-7 · The at-top gate is a 38 px band, not a point 🟡

`src/helpers/ladderDecisions.ts:224` — the sweep's at-top gate is `offset <= firstItemOffset`.

A deliberate slow drag **down into** the list that stops inside that band and is released at ~0
velocity passes both the at-top gate and the velocity gate, and sweeps — collapsing every below-fold
expansion at the moment the reader starts browsing downward.

This is **not** the bounce §F5 ruled on (that is a drag in the opposite direction, off the top), and
§F5's recorded reversible lever — *"require the drag to have begun below the top"* — does **not**
cover it, because this drag begins at the top. §I2 is not violated (nothing above the fold is
touched), so the failure is invisible until the reader scrolls down and finds their sections shut.

**Recommendation:** do not code anything yet. Add it to **ticket 08's observation list** and let the
device decide whether it is reachable by a human hand. A ruling of "accepted, unreachable in
practice" is a fine outcome — but it should be a ruling, not an omission.

### C. Driver — needs sign-off, not an edit

#### F-8 · An eighth spec amendment: the spec's test-environment claim is wrong twice over 🟠

`spec.md:903`:

> *"This is not stylistic. The jest environment here is **jsdom with no React Native preset**, and
> `@testing-library/react-native` is not installed — anything that imports React Native, a native
> module or a screen **cannot be tested at all** today. That constraint is why §J4 exists in the
> shape it does."*

Repeated at `spec.md:996`: *"jsdom has no native renderer, so a layout measurement returns nothing
meaningful."*

**Both halves are false.** The lane was **node**, never jsdom — the project memory records the old
jsdom notes as wrong — and the constraint is now gone entirely: `spike/rn-jest-testing` (`544ac8a`)
added the `rn` lane, and three suites in this very branch import React Native and run.

⚠ **This is the same defect class ticket 07 just fixed.** Ticket 07 corrected exactly this sentence
in `ladderDecisions.ts` (*"jest in this repo is jsdom"* — wrong twice over, it was node). The
*spec*, which §J4's whole rationale rests on, still asserts it.

This also **resolves the Spec axis's scope-creep item**: it flagged the `rn` lane (+83 in
`jest.config.js`, `jest.rn-setup.js`, three suites, ~966 lines) as behaviour the spec did not ask
for, correctly quoting the constraint above. It is not really creep — it is an **unrecorded
amendment**. Recording it converts a deviation into a decision.

⚠ **Do not amend `spec.md` unilaterally.** Every prior amendment was driver-settled in a batch, and
this effort's established route is to raise the candidate. Amendments 1 and 2 were also factual
corrections, so there is precedent for adopting it — but the driver adopts it, not the implementer.

⚠ §J4's extraction is **not** made obsolete by the correction. Its stated reason — a wrong landing
and a wrong collapse are different failures with different owners — stands on its own, as the
README already records. The amendment corrects the *environment claim*, not the *seam*.

#### F-9 · The spec is still `Approval: PENDING driver sign-off`

`spec.md` header:

> *"**Approval: PENDING driver sign-off.** Three open forks were put to the driver on 2026-08-20 and
> answered … The document as a whole still needs the driver's read."*

Seven amendments have landed since that line was written, and an eighth is proposed above. Ticket 08
is the device pass — the last point at which a spec disagreement is cheap to fix. Put F-8 and the
sign-off to the driver together.

### D. Operational — a decision, deliberately not taken here

#### F-10 · The publish-gap guard is two legs, not three

The README says ticket 06's "nothing proves `BooksHome` CALLS the publisher" hole is *"guarded
instead by the required prop, an eslint warning, and ticket 08."*

The required prop is real (`TS2741`, probed twice). **The eslint warning is not a guard**:
`npx eslint .` exits **0** with 38 standing warnings, so a new unused-import warning from deleting
that call would land in existing noise and fail nothing. Unless CI runs `--max-warnings=0`, that leg
does not bear load.

**Fix:** either add `--max-warnings=0` to the lint script (which would first need the 38 standing
warnings triaged — a separate job), or correct the README to claim two guards. Do not leave the
claim standing as three.

#### F-11 · ⚠ Leftover prototype instrumentation in `node_modules` — read before any device build 🔴

`node_modules/@shopify/flash-list/dist/recyclerview/hooks/useRecyclerViewController.js` still carries
the prototype's MVCP instrumentation — **verified present**, lines ~121–128 and ~175–180:

```js
// [DT] THROWAWAY PROBE -- wayfinder map .scratch/library-back-ladder/,
(__dt || ((e, d) => console.log("[DT] " + e + " " + JSON.stringify(d))))("mvcp", …
// [DT] ticket 12: anchor key no longer resolves to an index --
(__dt2 || ((e, d) => console.log("[DT] " + e + " " + JSON.stringify(d))))("mvcp:lost", …
```

**`patches/` is clean** — seven patches, none for FlashList (verified), so **nothing ships** and
ticket 09's headline hazard is already satisfied. But `npm run android` and an EAS preview build
bundle from the local `node_modules`, so **any build made on this machine right now** does a
`console.log` + `JSON.stringify` on every MVCP correction attempt, and a build made after a fresh
`npm ci` behaves differently.

⚠ **Deliberately not removed by this review.** It is genuinely useful for ticket 08's §G1–G4 A/B —
that is precisely what it was written for — so deleting it could destroy a tool ticket 08 wants.
**This is the driver's call**, and it must be made *before* the §E5 smear measurement, not
discovered mid-run.

Whichever way it goes, record which state the measurements were taken in. Restoring the pristine
file without a full `npm ci`: `npm pack @shopify/flash-list@<version>` into a temp dir and copy the
single file back.

---

## Declined — do not re-raise without new evidence

All three reviewers were given the README's pre-registered re-proposals. The Standards axis
explicitly declined to re-raise them, *"finding no new evidence against the README's
counter-arguments"*. Recorded here so the next reviewer does not spend the round trip:

| Item | Why it stands |
| --- | --- |
| `LadderList = FlashListRef<any>` | Both tighter shapes fail `TS2322`; four lists, four item types. The `any` is load-bearing. |
| Fold `ranges` into `LadderInputs` | `LadderInputs` is the render-time mirror; ranges are the one input that must not be captured at render time. |
| Fold `setExpanded` OUT of `LadderInputs` | §J2's mirror is one effect with no dep array, so a later input cannot be forgotten. |
| `computeRemainingOpen`'s `primary = null` param | Standards flagged it as Speculative Generality — the only caller passes two args. **Left alone deliberately:** it serves the parked lazy-single-open variation and was cherry-picked byte-identical in ticket 01. Removing it is a product decision, not a tidy-up. |
| `headerY <= 0` as a "special case" | Spec axis nit, **already adjudicated by ticket 02**: index-0 degenerates via a *strictly-between* predicate, and `0 < headerY` is that predicate's lower bound. The code is right; the spec's wording invites the misreading. Fold into F-8's batch if the driver wants the wording sharpened. |
| `Sentry.captureException` in the back handler | Spec axis flagged as unasked-for. Ticket 05 took this decision explicitly and argued it in place: containment must not be concealment. |

---

## Acceptance criteria

- [ ] **F-1** fixed with a manual frame queue, not fake timers; **full suite `--randomize` × 30, 0 failures.**
- [ ] **F-2** `ladderViewFor` inverted; a test pins that an unmapped ordinal is not a sectioned view.
- [ ] **F-3** `rn` `testMatch` widened **and** the trap added to `docs/testing/jest-projects-and-rn-tests.md` as the eighth.
- [ ] **F-4** three comment sites corrected; the anchor-guard rationale written where the dead one was.
- [ ] **F-5** `Pick<LadderList,'scrollToOffset'>` adopted (probe says `tsc` 0), `NO_RANGES` readonly, eslint block narrowed, duplicated prose reduced to one canonical site each.
- [ ] **F-6** ruled on: adopted as its own ticket with ticket 07's 12 mutations re-run, or declined in writing.
- [ ] **F-7** added to ticket 08's observation list.
- [ ] **F-8 / F-9** put to the driver together with the pending sign-off.
- [ ] **F-10** README corrected to two guards, or `--max-warnings=0` adopted.
- [ ] **F-11** driver has decided keep-or-remove, and the decision is recorded in ticket 08 *before* the §E5 measurement.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green, and the test count moves only by the cases this ticket adds.

## Comments

Raised 2026-08-21 by a whole-branch review at the driver's request, before entering ticket 08.
Reviewers: mattpocock two-axis (Standards + Spec, opus, parallel) plus the built-in `/code-review`
correctness pass (opus) run as a separate background agent. Nothing in this ticket was applied — the
working tree was clean at review end, and the one `Pick<…>` probe was reverted after `tsc` confirmed
it compiles.
