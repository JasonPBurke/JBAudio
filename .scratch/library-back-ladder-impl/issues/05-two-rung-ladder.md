# 05 — The two-rung ladder, live on the Series and grid views

**What to build:** The first demoable slice of the feature. On the library screen's non-sectioned
views, a back press scrolls the list to the top with a real animated scroll; a second press
backgrounds the app exactly as it does today. Search text, selected tab and view toggle are
untouched — scroll position is the only thing back moves. On every other screen in the app, back
means exactly what it means today.

There is no toast, no haptic and no "press back again to exit". That convention exists for apps
where the first press does nothing visible; here the first press is visibly a scroll, and that
*is* the feedback.

This ticket builds the screen-installed hook as **IO only — gather → decide → execute**. It gathers
a snapshot from the mounted list's ref at press time, calls the already-tested decision, and
executes. It adds no judgement of its own and no state between presses: no counter, no timer, no
"which rung was last" memory. Every press re-derives its answer from the live scroll offset and the
live layout, which is what makes the ladder self-healing when the user scrolls by hand between
presses, switches views, or lets the library rescan under them.

The capability set stays closed for now, so the intermediate rung is simply absent:

```ts
const SECTIONED_VIEWS = new Set<LadderView>(['booksHome']);
```

Interception is `BackHandler.addEventListener('hardwareBackPress', …)` inside React Navigation's
`useFocusEffect`. Not expo-router, not native. This is the app's first conditional back handler.
Returning `true` consumes the press; returning `false` declines it and lets Android background the
app through the existing activity override. No native patch and no RN/Expo upgrade is required —
recorded so it is not re-litigated.

Spec: A1–A8, B1–B7, C1–C4, E1–E6, H1, H2, I1, I4, I6, J1–J3; user stories 8, 12, 13, 16–24, 26,
28–34.

**Blocked by:** 02 (the decision), 04 (the contract).

## ⚠ Testing changed under this ticket — read before starting

Hooks and components are **now testable**. Jest runs two projects: pure TypeScript stays in the
fast `helpers` lane, and anything importing React Native goes in an `rn` lane
(`jest-expo/android` + `@testing-library/react-native`) by being named `*.rn.test.tsx`.
**Read `docs/testing/jest-projects-and-rn-tests.md` first** — it holds seven traps that all fail
quietly.

Landed by `spike/rn-jest-testing` (`544ac8a`); merge that branch before starting if it has not
already landed. When this ticket was written, none of this existed and its acceptance criteria
assumed `tsc` plus a manual device check were the only tools available.

**Status:** resolved

- [x] Back on the Series view and the grid view scrolls to the top, animated, from any scroll
      depth.
- [x] At the top, a **single** back press backgrounds the app. Never two presses for no visible
      reason.
- [x] A no-results search, and an empty tab, background the app immediately.
- [x] The handler is installed **exactly once per focus**. Every mutable input reaches it through a
      mirror ref, so the effect's dependency array holds only stable ref objects. This is
      load-bearing: `BackHandler` dispatches strict LIFO **by registration time**, so a handler that
      re-registers while the drawer is open would sit above the drawer's own and scroll the list
      instead of closing the drawer.
- [x] The hook mirrors every input into a ref **internally**, so callers pass ordinary values and
      the module itself guarantees the empty-dependency registration.
- [x] The hook carries a drawer guard and declines while the drawer is open — but as
      defence-in-depth only. On device the drawer consumes back upstream in React Navigation and
      this handler is never reached; the same is true of the keyboard. Keep the guard; **do not
      describe it in review or comments as the thing that makes the drawer case work.**
- [ ] With the drawer open, back closes the drawer and leaves scroll position exactly where it was.
      With the keyboard up, back dismisses the keyboard only and the list does not move.
- [ ] With the player, the title-details sheet or any other modal route open, back closes that. No
      code is needed for this: modal routes are siblings of the drawer on the root stack, so
      pushing one blurs the library screen and the handler is removed on cleanup.
- [ ] A cancelled back gesture does nothing — it produces no event at all.
- [x] The ladder reads offset **synchronously from the mounted list's ref** at the moment of the
      decision. It does **not** track a screen-held scroll offset: that would go stale across a
      view toggle (the new list mounts at offset 0 and no scroll event fires), and the first press
      would consume itself scrolling an already-at-top list to the top.
- [x] The press-time call is `decideBackPress(list ? buildSnapshot(list) : null)` — the decision
      function takes `LadderSnapshot | null` (spec §J5, amended 2026-08-21) and the **absence of a
      snapshot IS the absence of a list**. Do not fabricate a snapshot for the no-list case.
- [x] `buildSnapshot` passes `visible` as a **thunk over `computeVisibleIndices()`**, never a
      pre-computed value. Evaluating it eagerly reintroduces the throw B7 exists to avoid, and no
      test in the decision suite can catch it — that suite only ever sees the thunk it is handed.
- [x] **Decide, in this ticket, whether the hook contains a throw from `computeVisibleIndices()`.**
      B7's ordering is a strong guard, not a proof (spec §B7, amended 2026-08-21: the "no layout
      manager" argument needs the *offset* to read 0 as well, and that half is reasoned rather than
      measured). The pure function deliberately does **not** catch — the IO boundary is here. If
      you do contain it, containment must **DECLINE the press** so back backgrounds the app as it
      would with no ladder; it must never fall through to a rung, which is the silent
      wrong-landing shape H5 and F8 exist to prevent. Record the choice either way.
- [x] The offset predicate is evaluated **before** anything touches visibility, so the throwing
      visibility accessor is unreachable.
- [x] The jump is `scrollToOffset({ offset, animated: true })`. The ladder does **not** consult
      `ReducedMotionConfig` — reduced motion is handled by the OS animator scale, for free.
- [x] The back handler for the master rung is two statements: the scroll, then `return true`.
- [x] Nothing is added to the per-frame scroll path.
- [ ] **Latch check, on device:** scroll, back, back, reopen the app, push a screen, back must pop.
      Five rounds in one process, alternating gesture and 3-button. The signature of failure is
      that back stops reaching JS at all.
- [x] ⚠ **Import `LadderList` / `LadderListProps` from `src/types/ladderList.ts`; do NOT re-declare
      or re-export them from the hook.** Spec §H8 says the contract is "exported by the ladder
      hook", written when this hook was the only ladder module that would exist. Ticket 04 needed
      the contract *before* the hook did, so it lives in its own module — which also keeps
      `ladderDecisions.ts` free of React Native imports. Reading §H8 literally and re-declaring the
      type here would give the four lists and the hook two contracts that drift apart silently,
      which is the exact failure §H8 exists to prevent. (Raised by ticket 04's spec-axis review.)
- [x] `npm test`, tsc and eslint are green.
- [x] **The hook has an `rn`-lane suite** (`useBackToTopLadder.rn.test.tsx`). This is now the
      cheapest place to catch the wiring bugs the pure decision suite structurally cannot see:
      `decideBackPress` proves the *judgement*, and only an exercised hook proves the *gather* and
      *execute* halves around it. At minimum: a press at a scrolled offset calls `scrollToOffset`
      with the offset the decision returned; a press that declines does **not** call it and lets
      the press through; and the drawer guard is honoured.
      ⚠ Hand the hook a **fake listRef** — FlashList has no layout manager under jest and
      `computeVisibleIndices()` throws, which is §B7's own premise. Do not try to render a real list.

---

## Answer

The ladder is live. `src/hooks/useBackToTopLadder.ts` is a screen-installed hook of exactly the
shape §J1 asks for — **gather → decide → execute**, no judgement, no state — and the library
screen installs it. On all three mountable views a back press taken from any scroll depth scrolls
the list to the top with an animated scroll and consumes the press; a further press at the top
declines and Android backgrounds the app, as it always did. `npm test` **903** (892 → 903), tsc 0,
eslint 0 errors.

**The ladder is live on `booksHome` too, as a TWO-rung ladder.** That is not scope creep and not an
oversight. `SECTIONED_VIEWS` already contains `booksHome`, but the hook publishes no section ranges
yet, so `decideBackPress` finds no section containing the viewport top and every armed press falls
through to master top — which is precisely the two-rung ladder. Ticket 06 supplies the ranges and
the third rung appears with no change to this hook's shape. Gating `booksHome` out of the ladder
until 06 would have meant writing a gate whose only purpose is to be deleted.

### The decision this ticket was told to make: **yes, the hook contains the throw**

Containment is a single `try`/`catch` around gather-decide-execute, and it **DECLINES** — `return
false`, back backgrounds the app exactly as it does with no ladder. It never falls through to a
rung.

The argument for containing it at all: §B7's ordering keeps `computeVisibleIndices()` unreachable
only if a list with no layout manager reads `offset` as `0` as well as `firstItemOffset`, and the
spec's own 2026-08-21 amendment marks that half **reasoned, not measured**. What sits on the other
side of that gap is not a wrong scroll — an uncaught throw inside a `BackHandler` callback is a
**crash on a back press**, in the one place in the app where a press is guaranteed to arrive. A
strong guard is the right reason to expect the catch never to fire; it is not a reason to omit it.

The argument for declining rather than recovering is §B7's own: a swallowed throw that lands on
master top is the silent wrong-landing shape §H5 and §F8 exist to prevent. Declining is the only
containment that is indistinguishable from "this feature is not installed".

**One addition the ticket did not ask for, stated so it can be argued with:** the catch calls
`Sentry.captureException`. Containment must not be the same thing as concealment — the user gets
the pre-feature behaviour, and telemetry still gets the throw. Five modules under `src/` already
import Sentry, so this introduces no dependency. It is also the observable that makes the no-list
test bite (below).

### The `rn`-lane suite, and the two tests that did not bite until probed

`src/hooks/__tests__/useBackToTopLadder.rn.test.tsx`, 11 tests. `decideBackPress` already proves
the *judgement* in 18 pure tests; this suite proves only the *gather* and *execute* halves around
it, which is the part that suite structurally cannot see — it only ever receives a snapshot
someone else built.

**Ten mutations run, ten killed.**

| mutation | tests killed |
|---|---|
| containment returns `true` instead of declining | 1 |
| containment falls through to master top (the silent wrong landing) | 1 |
| `visible` evaluated EAGERLY instead of passed as a thunk | 1 |
| drawer guard dropped | 2 |
| `animated: true` → `false` | 2 |
| no-list case fabricates a snapshot instead of passing `null` | 1 |
| mirror ref bypassed — inputs read from the render closure | 1 |
| handler re-created when inputs change (the §A6 violation) | 1 |
| cleanup does not remove the handler | 1 |

⚠ **Two of these passed for the wrong reason first time round, and both are worth carrying
forward.**

1. **The harness built a fresh `{ current }` ref object on every render.** The "does not
   re-register" test failed — correctly. A ref identity that changes per render *is* an §A6
   violation, because `useCallback([listRef])` then rebuilds the handler and `BackHandler`
   dispatches strict LIFO **by registration time**. Production is safe because the screen owns a
   `useRef`; the harness now models that by creating the ref once and mutating `.current`. **Any
   future caller that inlines the ref object re-introduces the bug, and this test is what catches
   it.**
2. **The `catch` masked the no-list path.** Mutating the call to fabricate a snapshot for a null
   list made the fabricated read throw, containment caught it, and back declined — the same
   `false` the correct code returns. The test could not tell the two apart. This is the general
   hazard of a defensive `catch`: it collapses two different failures into one observable. Killed
   by asserting on the side channel — `expect(Sentry.captureException).not.toHaveBeenCalled()` —
   because "no list" is a **normal state the decision handles**, not an error containment mops up.

### One change outside this ticket's files: `jest.rn-setup.js` mocks Sentry

Importing the real `@sentry/react-native` under jest leaves an **open handle**: jest prints *"did
not exit one second after the test run"* and the process hangs, which on CI is a timeout with no
failing test to point at. Mocked in the shared setup rather than in this suite, per that file's own
rule (added because a real test failed without it, and named for the suite that forced it): five
modules under `src/` import Sentry, so any future suite touching one of them trips the same wire.
The mock is two members and a suite that wants to assert can still read it through
`jest.mocked`.

### What the `rn` lane cannot reach, and is therefore still ticket 08's

Both `useFocusEffect` and `useDrawerStatus` need a live navigation tree, so the suite mocks them —
focus is modelled as mount/unmount. That is enough for everything asserted here (what the handler
*does*, that it is installed once, that cleanup removes it), but it means **the lane cannot prove
the effect is scoped to focus rather than to mount**, and therefore cannot prove §A8 (modal routes
disarming the ladder for free). The four unticked boxes are all of this kind:

- drawer open / keyboard up — the guard is defence-in-depth; the real behaviour is upstream in
  React Navigation and only a device shows it,
- modal routes closing on back — §A8's blur-and-cleanup path,
- a cancelled back gesture producing no event — a platform fact, not a code path,
- ⚠ **the latch check** — five rounds in one process alternating gesture and 3-button. This is the
  one that matters, because its failure signature is that back stops reaching JS **at all**, and
  nothing off-device can see it.

No device this session. Ticket 08 is the device pass.

### ⚠ One unreproduced flake, recorded rather than buried

Two full-suite runs during this session reported **`Tests: 1 failed, 902 passed`** and the failing
test's name was not captured before the next run went green. **51 consecutive full-suite runs
since — including 20 `rn`-lane-only runs and 3 with a cleared jest cache — are clean**, so it could
not be reproduced and could not be attributed.

It is recorded here because "I saw it twice and then it stopped" is exactly the observation that
gets dropped and then costs a day later. What is known: it is a single test case, not a suite-level
error; the new suite is timer-free (`act` only), so the more likely candidates are the pre-existing
`rn` suite's `requestAnimationFrame` round-trip under load, or a date-boundary test in the
`helpers` lane — **neither of which this ticket touched**. If it resurfaces, capture the run's full
output before re-running; that is the step that was missed here.

### Review — two axes (mattpocock code-review, opus), fixed point `058c9b5`

**Spec axis: faithful.** Nothing the ticket owed is missing; no ticket 06 or 07 behaviour leaked
in (`NO_RANGES`/`NO_EXPANDED` are inert constants, not a range producer or a sweep); the two
undertakings the ticket did not ask for — the Sentry report and the shared Sentry mock — were both
examined and accepted. Three findings under "implemented but looks wrong":

| # | Finding | Disposition |
|---|---|---|
| 1 | The `try` spans **execute**, not just gather → decide. A `scrollToOffset` that throws *after the list has begun moving* would both scroll and background — not §B7's "exactly as it does with no ladder". | **Declined, on a checked premise.** The finding's scenario cannot occur in this list: FlashList's `scrollToOffset` (`useRecyclerViewController.js:208-231`) does pure arithmetic and then dispatches `scrollTo` as its **last** statement, with nothing after it. A call that throws has therefore **not scrolled**, so declining afterwards *is* the pre-feature behaviour. The proposed alternative — leaving the scroll outside the guard — converts any throw there into a **crash on a back press**, which is the failure the block exists to prevent. The reason is now in the code comment, so the next reader gets the evidence rather than the assumption. |
| 2 | Enabling `booksHome` now means every armed press there **reaches** §B7's throwing accessor (`sectionRungTarget` calls `s.visible()` before it consults `ranges`), for no rung, until 06 lands. | **Accepted as an observation; no change.** It is behaviourally correct, and it is precisely the case containment was built for — the accessor is *exercised*, not merely guarded, which is a better state to be in than the reverse. Recorded so it is not mistaken for a regression when 06 changes it. |
| 3 | The input mirror is written in a **passive** `useEffect`, so between commit and paint the handler reads a stale `view`/`drawerOpen`. | **Adopted.** Now a `useLayoutEffect`. The window is about a frame wide and a back press can land in it; closing it costs nothing. |

**Standards axis: 2 hard violations, 3 judgement calls.**

| # | Finding | Disposition |
|---|---|---|
| 1 | `jest.rn-setup.js` mocked `Sentry.wrap` as well as `captureException`, but **no suite forced `wrap`** — that file's own rule is "added because a real test failed without it, never speculatively". | **Adopted.** `wrap` removed, and its absence is now stated in the comment so the next person does not add it back "for completeness". |
| 2 | Ticket 05's **own banner** still said "five traps" while the same commit renumbered `06`, `07`, the README and `CLAUDE.md` to six. | **Adopted.** Fixed. ⚠ Same defect class the preceding commit (`c6b76ed`) existed to close — a global rename that skips the file being edited. |
| 3 | *Repeated Switches / Primitive Obsession:* `ladderViewFor` is the **fourth** cascade on the `toggleView` ordinal. `LadderView` is the type that concept wanted; holding it in `useState` and deriving the ordinal for `Header` would collapse all four. | **Declined for this ticket, recorded as a candidate.** The reviewer notes it is not a violation, since §H1 blesses the mount-site seam. Converting the screen's `toggleView` state would touch `Header` and three render branches for no behaviour change — a refactor with its own risk, in a ticket whose device check is still outstanding. Worth doing; not here. |
| 4 | *Duplicated Code:* the screen's `§H1` comment restated `LadderView`'s docblock almost verbatim, and the two had **already drifted** in wording. | **Adopted.** The screen now points at the docblock instead of restating it. |
| 5 | The test's `listRef as never` meant the fake was never checked against `LadderList` at all. | **Adopted, and it bit immediately.** The fake is now typed `Pick<LadderList, …>`, which rejected its own `getLayout` stub: the real signature returns `RVLayout` (`x`/`y`/`width`/`height`), not the bare `{ y }` the fake was handing back. ⚠ **Ticket 06 reads exactly that `y`** — a test written against a return value FlashList cannot produce is the kind of green that costs a day. |

Re-verified after the review edits: **all 8 mutations still killed**, jest 903, tsc 0, eslint 0.
