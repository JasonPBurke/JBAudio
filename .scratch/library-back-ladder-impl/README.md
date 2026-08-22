# Library Back Ladder — implementation

Implementation tickets for [`../library-back-ladder/spec.md`](../library-back-ladder/spec.md).

The research effort next door is **closed** (12/12 resolved) and its `issues/` directory holds the
wayfinder tickets the spec links to by number. Implementation is a separate effort with its own
numbering, so those cross-references stay valid.

Read the spec before starting any ticket here. Each ticket names the spec sections it implements;
the spec is the authority, these files are the slicing.

## Progress

The research effort's convention is a `map.md` with a Decisions-so-far list. This effort has no
map — it is slicing, not argument — so ticket outcomes are rolled up here instead. One line per
resolved ticket; the reasoning lives in that ticket's `## Answer`.

Branch: **`feat/library-back-ladder`**, off `main` at `104bd34`.

- **01 — restore the collapse helper** · `resolved` (`20da088`) — `computeRemainingOpen` + its
  five-case suite cherry-picked byte-identical from the parked branch. Its two same-reference cases
  were mutation-tested and shown to be load-bearing: an equivalent `filter()` rewrite passes the
  other three and fails exactly those two, so the suite really does pin React's bail-out. Nothing
  imports the helper yet; ticket 07 wires it up. jest 843 → 848.
- **02 — shared types + `decideBackPress`** · `resolved` (`354413c`) — pure decision module
  `src/helpers/ladderDecisions.ts`, all 17 spec cases under 18 tests, nothing imports it yet.
  Every guard mutation-checked (see the ticket's Answer for the table). **Two contract decisions
  taken here that §J4 does not state:** the parameter is `LadderSnapshot | null` because
  `decline('no-list')` is otherwise unreachable, and the index-0 header degenerates to master via a
  *strictly-between* predicate rather than any special case. Both are spec-amendment candidates — **SETTLED, both adopted**; see *Spec amendments* below.
  Also added the missing `npm test` script (`82ca506`) — it never existed.
  Reviewed (`05e65ea`): the containment bounds had **no** coverage — mutating both to strict left
  the suite green — so `end`'s inclusiveness is now pinned by two boundary tests. ⚠ **Ticket 06's
  range producer must emit an INCLUSIVE `end`**; an exclusive one lands the rung on the previous
  section's header and passes every obvious sanity check. jest 848 → 868.
- **03 — `decideSweep`** · `resolved` — the sweep's five gates in `ladderDecisions.ts`, 18 tests,
  nothing imports it yet. All 11 spec cases plus one the spec did not ask for: the at-top boundary
  had a test on the DECLINING side only, so `>` → `>=` killed nothing while silently meaning the
  sweep never fires at the canonical resting offset. **16 mutations run, all killed.** Ticket 12
  §6.3's "iterate `visible`" was confirmed inert by mutation, not assumed. ⚠ **Three more
  spec-amendment candidates** — **SETTLED, all three adopted**; see *Spec amendments* below (details in the ticket's Answer): the empty-overlap guard is
  deliberately NOT qualified by `ranges.length > 0` (F8's wording would admit the R5 input); an
  unreported drag velocity counts as **flinging**, not settled; a degenerate sample includes an
  **inverted** range, not just `startIndex < 0`. jest 868 → 886.
  Reviewed (two axes, opus): no documented-standard violations and nothing implemented wrongly, but
  the Spec axis found **case 5's test did not bite** — a `{-1,-1}` sample trips the empty-overlap
  guard too, which returns the identical reason, so F8's `startIndex < 0` half was unpinned and the
  mutation table hid it. Split into two tests, one of which uses FlashList's **actual** empty value:
  ⚠ `ConsecutiveNumbers.EMPTY` is `(-1, -2)` — **INVERTED**, so F8's wording describes something
  FlashList never emits. Also extracted `isAtTop` and `overlapsSpan`, now shared with
  `decideBackPress`: I2's exact-complement claim and `end`'s inclusiveness each live in one place.
  jest 886 → 888.

- **04 — one shared list contract** · `resolved` (`7040429` + review commit) — the prefactor. New
  module exporting `LadderList` / `LadderListProps`; the library screen owns the ONE ref and the
  two inert settle handlers; all four lists intersect the contract and every internal fallback ref
  is deleted; `BooksList` mounts unconditionally, so its empty component is live code. **No
  user-visible change on the three mountable views.** jest 888, unchanged — this ticket adds no
  pure code, and **the compiler is the test**: deleting a required prop errors `TS2741` on all
  four lists, `BooksList` included. Verified by probe, not assumed.
  ⚠ **`LadderList = FlashListRef<any>` and the `any` is LOAD-BEARING — do not "fix" it.** Both
  tighter shapes fail `TS2322`: a structural subset interface naming only the methods the ladder
  calls (a ref is checked through its *mutable* `current`, so a subset cannot be passed as a `ref`)
  and any narrower item type including `unknown` (`FlashListRef<T>` is invariant in `T`). Four
  lists, four item types; `any` is the only thing one shared ref can hold.
  Reviewed (two axes, opus): **Spec axis found nothing** — faithful, no scope creep. Standards axis
  found 0 documented violations and 5 judgement calls; 3 adopted (the optional member now states
  why it is optional, four duplicated comments unified, the no-ops moved to module scope), 2
  declined with reasons in the ticket's Answer. ⚠ The notable decline: **do not fold `onScroll`
  into the contract** — §H9 forbids it by name and `LadderListProps` *is* the contract §H9 names.
  It reads as an obvious tidy-up and the spec pre-registers it as forbidden.
  ⚠ **The manual/device check is NOT done** (the one box left unticked) — no device this session.
  The two real behaviour changes both land on `BooksList`, which nothing mounts, so they are
  unreachable by that check anyway; ticket 08 is the device pass.

- **05 — the two-rung ladder, live** · `resolved` — `src/hooks/useBackToTopLadder.ts`, installed by
  the library screen. Back now scrolls the list to the top from any depth on all three mountable
  views and backgrounds the app with ONE further press at the top. 11-test `rn`-lane suite,
  **10 mutations run, all killed**. jest 892 → **903**.
  ⚠ **The ladder is live on `booksHome` too, as a two-rung ladder** — no ranges are published yet,
  so every armed press falls through to master top. Ticket 06 adds the third rung with no change to
  the hook's shape.
  **The throw-containment decision (the one this ticket was told to make): YES, the hook contains
  it, and containment DECLINES** — an uncaught throw in a `BackHandler` callback is a crash on a
  back press, and §B7's ordering is a strong guard whose offset half is reasoned, not measured. It
  reports to Sentry so containment is not concealment.
  ⚠ **Two tests passed for the wrong reason until mutated**: an inlined `{ current }` ref object
  re-registers the handler on every render (a real §A6 violation — the harness now models the
  screen's `useRef`), and the `catch` masked the no-list path until the suite asserted on
  `captureException` NOT being called. A defensive catch collapses two failures into one
  observable; the side channel is what separates them.
  Also: `jest.rn-setup.js` now mocks `@sentry/react-native` — the real module leaves an **open
  handle** and jest never exits, which on CI is a timeout with no failing test to point at.
  ⚠ Four boxes stay unticked, all device-only: drawer/keyboard, modal routes (§A8), a cancelled
  gesture, and **the latch check**. The lane mocks `useFocusEffect`, so it cannot prove the effect
  is scoped to focus rather than mount. Ticket 08.
  Reviewed (two axes, opus): **Spec axis faithful** — nothing missing, no 06/07 leakage. Of its
  three "looks wrong" findings, 1 adopted (the input mirror is a `useLayoutEffect` now, closing a
  frame-wide stale window), 1 accepted as an observation, and **1 declined on a checked premise**:
  the `try` may span the scroll, because FlashList's `scrollToOffset` dispatches `scrollTo` as its
  LAST statement, so a call that throws has not scrolled — the alternative turns any throw there
  into a crash on a back press. Standards axis: 2 hard violations (a speculative `Sentry.wrap` mock
  member; ticket 05's own "five traps" banner missed by its own rename — the `c6b76ed` defect class
  again), both fixed; 3 judgement calls, 2 adopted, 1 declined.
  ⚠ **The typed-fake finding bit immediately**: `listRef as never` meant the fake was unchecked, and
  typing it `Pick<LadderList, …>` rejected its own `getLayout` stub — the real signature returns
  `RVLayout` (`x`/`y`/`width`/`height`), not the bare `{ y }` it was returning. **Ticket 06 reads
  exactly that `y`.**
  Declined and recorded as a candidate: `toggleView` is now the subject of a FOURTH ordinal cascade;
  holding `LadderView` in state and deriving the ordinal for `Header` would collapse all four. Real,
  but a refactor with its own risk in a ticket whose device check is still outstanding.

- **06 — the third rung, fed by ranges published before paint** · `resolved` (`f9e9c13`) —
  `computeSectionRanges` (pure, `helpers` lane), `useSectionRanges` (layout-effect publication,
  `rn` lane), `BooksHome` publishing, the screen owning a `sectionRangesRef`, and the hook taking
  `expanded`. **`booksHome` is a THREE-rung ladder now.** jest 903 → **923**. 6 mutations run, 5
  killed, 1 provably equivalent.
  ⚠ **Ticket 05's rung was already correct and STARVED** — the snapshot was built with an empty
  range list at module scope. This ticket connects supply lines; it does not build judgement.
  **Three decisions the spec does not state**, all in the ticket's Answer: runs are derived from
  **`sectionId` changing**, never from matching the `'sectionHeader'` type string (a rename there
  would emit zero ranges with no error); the ranges reach the hook as a **REF**, the one deliberate
  exception to §J2, because the publication path exists so it does NOT re-render the screen and a
  mirrored value would refresh only on some later render that may never come; and
  `onSectionRangesChange` is **narrowed to REQUIRED** on `BooksHome` (probe: omitting it is
  `TS2741`).
  ⚠ **§H5 is executable now, not a comment** — mutating the layout effect to a passive one fails a
  probe that records the publication against React's own layout-then-passive ordering.
  ⚠ **One gap, open on purpose: nothing proves `BooksHome` CALLS the publisher.** Deleting that line
  leaves all 923 tests green. A render test was attempted and backed out —
  `@shopify/flash-list` is outside `jest-expo`'s transform allowlist, and allowing it just moved the
  parser error to `pressto` and onward. Guarded instead by two things, not three: the required prop,
  and ticket 08. *(Corrected 2026-08-22 — [impl 10](issues/10-branch-review-disposition.md) F-10:
  the eslint warning was never a real guard. `npx eslint .` exits 0 with 38 standing warnings, so a
  new unused-import warning from deleting the publisher call would land in that noise and fail
  nothing, absent `--max-warnings=0`.)*
  Reviewed (two axes, opus, vs `b7c09cf`): **Spec axis found 0 wrong implementations and 0 scope
  creep** — it re-derived every warned failure mode independently, including that the before-paint
  probe *"can only hold if phase, not registration order, decides"*. Standards axis: 2 hard
  violations, 4 judgement calls; **6 of 7 findings adopted, 1 declined**.
  ⚠ **The axes DISAGREED on §J2** — Standards read the ranges-as-a-ref as an unrecorded deviation,
  Spec read it as sanctioned by §J1's own signature. Spec is right on substance (the spec contains
  both sentences; the specific one governs), Standards is right that the tension must not live only
  in code comments. Resolved procedurally: **two spec-amendment candidates** raised for the driver
  (§J2 vs §J1, and §J1's parameter names) rather than amending `spec.md` unilaterally.
  ⚠ **The notable adoption:** narrowing `onSectionRangesChange` to required by **re-stating its
  signature** was the exact drift §H8 forbids — the intent survived review, the mechanism did not.
  It is `Omit<…> & Required<Pick<…>>` now, re-probed as `TS2741`.
  ⚠ **The notable decline — expect it to be re-proposed:** do NOT fold `ranges` into `LadderInputs`
  to tidy `buildSnapshot`'s three arguments. `LadderInputs` is the RENDER-TIME mirror and the ranges
  are the one input that must not be captured at render time; the reason is now in the code.
  Also renamed `useSectionRanges` → **`usePublishSectionRanges`**, and ticket 07 now carries a
  handoff note fixing the hook's parameter names before they diverge.
  ⚠ **`npm test` crashes on this machine when watchman runs at low priority** (Node fatal, no test
  output). Use `npx jest --watchman=false`. It is NOT the flake above — that one produced a real
  `1 failed, 922 passed`.
  ✅ **The flake is CLOSED** — see ticket
  [10](issues/10-branch-review-disposition.md) F-1. It was
  `useResetScrollOnTabChange.rn.test.tsx`, racing `setTimeout(0)` against `await rerender()`; the
  hook is correct and the test is not. Both this sighting and ticket 05's are the same bug, and
  **ticket 05's guess named it** ("the `rn` suite's `requestAnimationFrame` round-trip under load").

- **07 — the collapse sweep, and the MVCP anchor fix** · `resolved` (`0e02400` + review commit) —
  the reset gesture is LIVE. Arriving at the top of `booksHome` collapses every expanded section
  that is not on screen; whatever fills the viewport is left exactly as it is. The hook returns the
  two settle handlers, the screen threads them into **all three** lists (a per-view `undefined`
  would be a second, weaker copy of the identity gate), and `decideSweep` is wired, not re-derived.
  jest 923 → **935**. **12 mutations run, all killed.**
  **Three decisions the spec does not state**, all in the ticket's Answer: no `try/catch` on the
  sweep — unlike the back press, the TRIGGER ITSELF proves the list has a layout manager; the
  anchor fix is armed only when a mutation is actually coming; and `velocityY` is passed through
  with **no `?? 0`**, which would reverse §F5's amendment from the one place `decideSweep` cannot
  see it.
  ⚠ **THE ANCHOR FIX LEAKS IF ARMED UNCONDITIONALLY, and the spec's §G2 quietly assumes it cannot.**
  `prepareForLayoutAnimationRender()` sets a flag cleared in `onCommitEffect` — by a **COMMIT**, not
  by time. On every no-drop sweep (an accepted bounce, or the ordinary arrival with only Recents
  open — the common case) the set comes back same-reference, React bails out, no commit happens, and
  the flag stays armed to swallow the MVCP correction of some later, unrelated commit. It is now
  guarded by `decision.open !== inputs.expanded`, safe because nothing dropped means the data is
  unchanged and `diff` is 0. **Both review axes found this independently.**
  ⚠ **Correction to this effort's own notes: in FlashList 2.3.2 that flag guards ONLY the offset
  correction — it does NOT disable recycling.** The prototype's stated cost was wrong; the fix was
  not.
  Reviewed (two axes, opus, vs `5fa5b7a`): **Spec axis 0 missing, 0 partial, 0 scope creep**, one
  wrong implementation (the leak). Standards axis: 0 violations of the seven testing traps, 1
  comment-accuracy violation (the same finding from the other side), 3 judgement calls — 2 adopted,
  1 declined.
  ⚠ **The declined one will be re-proposed: `setExpanded` IS mirrored into `LadderInputs` like every
  other input.** A `useState` setter is referentially stable, so the mirror looks like it buys
  nothing — but §J2's mirror is one effect with no dependency array so that a later input cannot be
  forgotten, and an inline-wrapper setter at some future call site would otherwise re-register the
  handler and break §A6's LIFO ordering.
  Also fixed two stale comments this feature owns: `ladderList.ts` said ticket 05 *"will"* consume
  its types, and `ladderDecisions.ts` said *"jest in this repo is jsdom"* — wrong twice over, it was
  **node**, and the `rn` lane exists now.
  ⚠ Two boxes stay unticked, both device-only (animator scale 0, and the overscroll bounce) —
  ticket 08.

- **10 — whole-branch review disposition** · `ready-for-agent` — the first review of the feature as
  an assembled whole rather than ticket by ticket, run before entering 08. **Three independent
  reviewers**: the two-axis pair (Standards + Spec, opus) plus the built-in `/code-review`
  correctness pass (opus) as a separate background agent. **11 findings; nothing applied** — the
  tree was clean at review end. Gates at review time: tsc 0, eslint 0 errors, jest **935/935**.
  ⚠ **THE FLAKE IS CLOSED.** Tickets 05 and 06 each recorded an unattributable
  `1 failed, N passed`; they are the same bug —
  `useResetScrollOnTabChange.rn.test.tsx:82` races `setTimeout(0)` against `await rerender()`.
  **0 failures in 25 default-order runs, ~10% under `--randomize`, 0/40 on the `rn` lane in
  isolation** — the isolation split is the proof, because it removes the worker contention that
  lets the timer win. Test defect, not a hook defect.
  ⚠ **All three reviewers landed independently on `useBackToTopLadder.ts:325`** (the sweep's
  absolute `setExpanded`) from three different directions. That convergence is the review's
  strongest signal — F-6, and it changes the §J4 seam, so it is a decision, not a tidy-up.
  ⚠ **Read F-11 before ANY device build.** Leftover `[DT]` MVCP instrumentation is still live in
  `node_modules/@shopify/flash-list` — `patches/` is clean so nothing ships, but builds from this
  machine carry it and builds after `npm ci` do not. That is ticket 08's §E5 measurement taken
  against two different binaries. **Deliberately not removed** — it is the right tool for 08's
  §G1–G4 A/B, so keep-or-remove is the driver's call.
  ⚠ **An eighth spec-amendment candidate** (F-8) and the spec's still-`PENDING` sign-off (F-9) go
  to the driver together; see below.

## Spec amendments — SETTLED 2026-08-21, before ticket 04

The five spec-amendment candidates raised by tickets 02 and 03 were reviewed together and **all
five adopted**; a sixth was surfaced during the review. `spec.md` on the effort next door is
amended in place, each edit marked at the decision it touches, and its header carries the log.
**No code changed** — every amendment describes what tickets 02/03 already built, verified line by
line against `ladderDecisions.ts`; tsc 0, eslint 0, jest 888 unchanged.

| # | Spec | Kind | Ruling |
|---|---|---|---|
| 1 | §B7 | factual correction | The "no layout manager ⇒ `0 > 0`" argument named only the `firstItemOffset` half; the **offset** must read `0` too, and that half is reasoned, not measured. Ordering is a strong guard, not a proof. |
| 2 | §F8 | factual correction | FlashList's empty sample is `ConsecutiveNumbers.EMPTY = (-1, -2)` — **INVERTED**. The originally-worded `startIndex < 0` half catches the real value only incidentally. Both halves kept. |
| 3 | §F8 | adopt the safer default | The `while the range list is non-empty` qualifier is **removed**. It can only admit inputs, and every input it admits is the R5 collapse-everything shape. |
| 4 | §F5 | adopt the safer default | An **unreported** drag velocity counts as flinging, not settled — the errors are asymmetric. Also pins `!(abs(v) < T)` over `>=` for `NaN`. |
| 5 | §J4→J5 | signature widening | `decideBackPress(s: LadderSnapshot \| null)`. Without it `decline('no-list')` is unreachable. Consequence recorded: drawer-open-and-no-list now reports `'no-list'`, not `'drawer'` — unreachable in practice, both decline. |
| 6 | §H4 | contract sharpened | **New.** The range producer owes an INCLUSIVE `end` and NON-OVERLAPPING ranges. Ordering is not required; non-overlap is what makes the rung's first-match containment lookup deterministic. |

**Three handoff holes closed at the same time** — in each case the knowledge existed but not in the
file the implementer opens:

- **Ticket 05** now owns the throw-containment decision explicitly. Ticket 02 declined `try/catch`
  in the pure function and named ticket 05 as the boundary, but nothing in ticket 05 said so. The
  constraint is now written down: if the hook contains the throw, containment must **decline the
  press**, never fall through to a rung.
- **Ticket 06** now carries the INCLUSIVE-`end` trap. It was flagged in this README and in the spec
  but was absent from the ticket itself — the one file that ticket's implementer is guaranteed to
  read.
- **Ticket 08** now checks the **overscroll bounce actually sweeps**. Amendment 4 makes an
  unreported velocity a fling, so if the platform reports nothing for a bounce, F5's accepted
  bounce-sweep silently never happens. This is the only observable that distinguishes the two, and
  nothing was verifying it. A failure there is expected-and-harmless — record it, do not weaken the
  gate.

**A seventh amendment landed 2026-08-21, after ticket 04's review:** **§H8**'s module home. It
read "exported by the ladder hook", written when that hook was assumed to be the only ladder
module. The contract is needed by the four lists *before* the hook exists, and siting it in the
hook would drag React Native imports into `ladderDecisions.ts`'s reach. It now has a module of its
own and the hook imports it. ⚠ **Ticket 05 must import, never re-declare** — the warning is in
ticket 05's own file, not only here.

**⚠ An EIGHTH candidate is OPEN, raised 2026-08-21 by the whole-branch review — not yet settled.**
`spec.md:903` still says *"the jest environment here is **jsdom with no React Native preset**, and
`@testing-library/react-native` is not installed — anything that imports React Native … **cannot be
tested at all** today. That constraint is why §J4 exists in the shape it does"*, repeated at
`spec.md:996`. **Both halves are false**: the lane was **node**, never jsdom, and the constraint is
gone — `spike/rn-jest-testing` (`544ac8a`) added the `rn` lane and three suites on this branch import
React Native and run. This is **the same defect class ticket 07 fixed in `ladderDecisions.ts`**, left
standing in the one document §J4's rationale rests on. It also resolves the Spec axis's scope-creep
finding: the `rn` lane is not creep, it is an **unrecorded amendment**. ⚠ §J4's extraction is NOT
made obsolete — its stated reason stands on its own; the amendment corrects the *environment claim*,
not the *seam*. Details and the wording nit on §D2's `headerY <= 0` are in ticket
[10](issues/10-branch-review-disposition.md) F-8. **The driver adopts it, not the implementer** —
and `spec.md` still carries `Approval: PENDING driver sign-off` (F-9), so put both in one pass.

**Ticket 04 was never blocked by any of this.** It implements §H6–H9/I1/I3 — the shared list
contract — and none of the six touches those. The amendments land on tickets 05 (1, 5), 06 (2, 6)
and 07 (2, 3, 4).

## Testing infrastructure — changed mid-effort, 2026-08-21

Tickets 01-04 were written and resolved under a jest that **could not test a component or a hook at
all**: no preset, node environment, stock `transformIgnorePatterns`, so any test importing
`react-native` died in the parser. That constraint shaped this effort — spec §J4's extraction of
`decideBackPress`/`decideSweep` into pure functions is partly a response to it, and ticket 04's
acceptance criteria lean on `tsc` plus a manual device check because nothing else was available.

`spike/rn-jest-testing` (`544ac8a`) removes the constraint. Jest now runs **two projects**: the
original fast `helpers` lane (~890 pure tests, ~2 s) and an `rn` lane
(`jest-expo/android` + `@testing-library/react-native`) that a test opts into by being named
`*.rn.test.tsx`. See `docs/testing/jest-projects-and-rn-tests.md` — it holds seven traps that all
fail quietly.

**What this changes for the remaining tickets** (each carries a banner and new checkboxes):

- **05** — the hook gets a real suite. `decideBackPress` proves the *judgement*; only an exercised
  hook proves the *gather* and *execute* halves around it.
- **06** — the range producer's two contract properties (inclusive `end`, non-overlap) become
  assertable on real produced output rather than checkable only by reading.
- **07** — closes a gap this ticket already named: *"that mutation kills 12 tests, but only if the
  hook is exercised."* It can now be exercised.
- **08** — explicitly **not** shrunk. FlashList has no layout manager under jest, so nothing about
  visible ranges, offsets or drift can be pre-checked off-device.
- **09** — the spike branch is not throwaway and must be accounted for, unlike the prototype branch.

⚠ **§J4's extraction is not made obsolete by this.** Its stated reason — a wrong landing and a wrong
collapse are different failures with different owners — stands on its own. The pure units test
judgement fast; the `rn` lane tests wiring. Two layers, not a replacement.
