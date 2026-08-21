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
**Read `docs/testing/jest-projects-and-rn-tests.md` first** — it holds five traps that all fail
quietly.

Landed by `spike/rn-jest-testing` (`544ac8a`); merge that branch before starting if it has not
already landed. When this ticket was written, none of this existed and its acceptance criteria
assumed `tsc` plus a manual device check were the only tools available.

**Status:** ready-for-agent

- [ ] Back on the Series view and the grid view scrolls to the top, animated, from any scroll
      depth.
- [ ] At the top, a **single** back press backgrounds the app. Never two presses for no visible
      reason.
- [ ] A no-results search, and an empty tab, background the app immediately.
- [ ] The handler is installed **exactly once per focus**. Every mutable input reaches it through a
      mirror ref, so the effect's dependency array holds only stable ref objects. This is
      load-bearing: `BackHandler` dispatches strict LIFO **by registration time**, so a handler that
      re-registers while the drawer is open would sit above the drawer's own and scroll the list
      instead of closing the drawer.
- [ ] The hook mirrors every input into a ref **internally**, so callers pass ordinary values and
      the module itself guarantees the empty-dependency registration.
- [ ] The hook carries a drawer guard and declines while the drawer is open — but as
      defence-in-depth only. On device the drawer consumes back upstream in React Navigation and
      this handler is never reached; the same is true of the keyboard. Keep the guard; **do not
      describe it in review or comments as the thing that makes the drawer case work.**
- [ ] With the drawer open, back closes the drawer and leaves scroll position exactly where it was.
      With the keyboard up, back dismisses the keyboard only and the list does not move.
- [ ] With the player, the title-details sheet or any other modal route open, back closes that. No
      code is needed for this: modal routes are siblings of the drawer on the root stack, so
      pushing one blurs the library screen and the handler is removed on cleanup.
- [ ] A cancelled back gesture does nothing — it produces no event at all.
- [ ] The ladder reads offset **synchronously from the mounted list's ref** at the moment of the
      decision. It does **not** track a screen-held scroll offset: that would go stale across a
      view toggle (the new list mounts at offset 0 and no scroll event fires), and the first press
      would consume itself scrolling an already-at-top list to the top.
- [ ] The press-time call is `decideBackPress(list ? buildSnapshot(list) : null)` — the decision
      function takes `LadderSnapshot | null` (spec §J5, amended 2026-08-21) and the **absence of a
      snapshot IS the absence of a list**. Do not fabricate a snapshot for the no-list case.
- [ ] `buildSnapshot` passes `visible` as a **thunk over `computeVisibleIndices()`**, never a
      pre-computed value. Evaluating it eagerly reintroduces the throw B7 exists to avoid, and no
      test in the decision suite can catch it — that suite only ever sees the thunk it is handed.
- [ ] **Decide, in this ticket, whether the hook contains a throw from `computeVisibleIndices()`.**
      B7's ordering is a strong guard, not a proof (spec §B7, amended 2026-08-21: the "no layout
      manager" argument needs the *offset* to read 0 as well, and that half is reasoned rather than
      measured). The pure function deliberately does **not** catch — the IO boundary is here. If
      you do contain it, containment must **DECLINE the press** so back backgrounds the app as it
      would with no ladder; it must never fall through to a rung, which is the silent
      wrong-landing shape H5 and F8 exist to prevent. Record the choice either way.
- [ ] The offset predicate is evaluated **before** anything touches visibility, so the throwing
      visibility accessor is unreachable.
- [ ] The jump is `scrollToOffset({ offset, animated: true })`. The ladder does **not** consult
      `ReducedMotionConfig` — reduced motion is handled by the OS animator scale, for free.
- [ ] The back handler for the master rung is two statements: the scroll, then `return true`.
- [ ] Nothing is added to the per-frame scroll path.
- [ ] **Latch check, on device:** scroll, back, back, reopen the app, push a screen, back must pop.
      Five rounds in one process, alternating gesture and 3-button. The signature of failure is
      that back stops reaching JS at all.
- [ ] ⚠ **Import `LadderList` / `LadderListProps` from `src/types/ladderList.ts`; do NOT re-declare
      or re-export them from the hook.** Spec §H8 says the contract is "exported by the ladder
      hook", written when this hook was the only ladder module that would exist. Ticket 04 needed
      the contract *before* the hook did, so it lives in its own module — which also keeps
      `ladderDecisions.ts` free of React Native imports. Reading §H8 literally and re-declaring the
      type here would give the four lists and the hook two contracts that drift apart silently,
      which is the exact failure §H8 exists to prevent. (Raised by ticket 04's spec-axis review.)
- [ ] `npm test`, tsc and eslint are green.
- [ ] **The hook has an `rn`-lane suite** (`useBackToTopLadder.rn.test.tsx`). This is now the
      cheapest place to catch the wiring bugs the pure decision suite structurally cannot see:
      `decideBackPress` proves the *judgement*, and only an exercised hook proves the *gather* and
      *execute* halves around it. At minimum: a press at a scrolled offset calls `scrollToOffset`
      with the offset the decision returned; a press that declines does **not** call it and lets
      the press through; and the drawer guard is honoured.
      ⚠ Hand the hook a **fake listRef** — FlashList has no layout manager under jest and
      `computeVisibleIndices()` throws, which is §B7's own premise. Do not try to render a real list.
