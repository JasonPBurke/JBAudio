# Jest: two projects, and how to test components and hooks

Added 2026-08-21 by the `spike/rn-jest-testing` branch.

Before this, jest here ran on near-defaults: no preset, `testEnvironment: node`, and jest's stock
`transformIgnorePatterns` of `['/node_modules/']`. React Native and Expo ship untranspiled, so the
moment a test imported `react-native` it died in the parser. **Nothing that imported a component,
a hook using RN, or a native module could be tested at all.** That was a hole, not a design
decision — the giveaway is that `@testing-library/react` (the *DOM* one), `@testing-library/jest-dom`,
`jest-environment-jsdom` and `ts-jest` were all installed and none of them were wired into anything.

## The two lanes

`jest.config.js` defines two projects. Pick a lane by **file name**.

| Lane | Matches | Environment | What it is for |
|---|---|---|---|
| `helpers` | everything else | node, no preset, no `node_modules` transform | Pure TypeScript. ~890 tests in **~2 s**. |
| `rn` | `*.rn.test.tsx` | `jest-expo/android` | Components and hooks that touch React Native. |

**Why two and not one.** `jest-expo` replaces the environment, the transform,
`transformIgnorePatterns` and the module mapper wholesale. Putting the existing suite under it would
slow the fast lane down and couple a suite that has nothing to do with React to a preset upgrade.
The split keeps each failure mode in its own lane, and keeps the two-second feedback loop that makes
extracting pure decision units worthwhile in the first place.

`npm test` runs both. `npx jest --selectProjects helpers` (or `rn`) runs one.

The `rn` lane is opt-in **by suffix**, not by extension. Inferring from `.tsx` would silently move a
pure test into the slow lane the day someone added JSX to it.

## Versions, and why these ones

| Package | Version | Note |
|---|---|---|
| `jest-expo` | `~55.0.21` | ⚠ `latest` is the **57** line, which is SDK 57. Match the Expo SDK, not `latest`. |
| `@testing-library/react-native` | `14.0.1` | RNTL. Peers: react ≥19, RN ≥0.78. |
| `test-renderer` | `1.2.0` | **Not** `react-test-renderer`. RNTL 14 moved to this standalone package, which is the supported replacement for the renderer React 19 deprecated. |

The `android` preset rather than `jest-expo/universal`: this app ships Android only, and the
universal preset runs every suite once per platform.

## Traps — all of these fail quietly

**1. `jest.useFakeTimers()` breaks RNTL 14's async render.** `rerender()` returns, but the effect
never re-runs. A test asserting "was called" then fails with zero calls, and — worse — a test
asserting "was *not* called" **passes for the wrong reason**. Use real timers:

```ts
const flushFrame = () =>
  act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
```

Under the RN preset `requestAnimationFrame` is `setTimeout(fn, 0)`, so a real zero-delay await
drives it. Verified by probe, not assumed.

⚠ **The corollary bit once, so read it before writing a "the frame was cancelled" test.** Because
that timer is `0 ms`, a deferred frame is **already due** the instant it is scheduled and will fire
inside whichever `await` comes next — including the `await rerender(...)` that scheduled it. A test
that needs the frame *still pending* (asserting an unmount cancelled it) is therefore racing the
event loop, and it lost about one full-suite run in ten: only ever in company with other suites,
because worker contention is what let the timer win, and never in the `rn` lane alone (0/40).
The fix is **not** fake timers — that is what this trap forbids. Swap `requestAnimationFrame` /
`cancelAnimationFrame` for a manual queue in that one file via `beforeEach`/`afterEach`, leave
timers real, and assert on the queue's contents. See `useResetScrollOnTabChange.rn.test.tsx`:
that turns "no call happened" (which a race can satisfy for the wrong reason) into "one frame in,
zero frames out", which nothing but real cancellation can satisfy.

**2. `renderHook`, `rerender` and `unmount` are all ASYNC in RNTL 14.** A missing `await` does not
throw — the assertion just runs before the render it meant to observe.

**3. Reanimated needs the `/mock` entry point, not `setUpTests()`.** On reanimated 4.2.1 /
worklets 0.7.2, merely *importing* `react-native-reanimated` pulls in `react-native-worklets`, whose
native half throws *"Native part of Worklets doesn't seem to be initialized"* — before `setUpTests()`
can run. `jest.rn-setup.js` does `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`,
which replaces the module wholesale and never reaches worklets.

**4. The React Compiler runs in your tests.** `babel.config.js` applies `babel-plugin-react-compiler`
unconditionally, so components under test are memoized. **Do not write render-count assertions.**
The `'use no memo'` directive on `BookDurationRow` is the precedent for when a component genuinely
must opt out — it is deliberate, not a bug.

**5. A hook that calls a navigation hook needs a navigation tree, or a mock.**
`useFocusEffect`, `useDrawerStatus` and friends read React Navigation context and throw outside a
navigator. `useBackToTopLadder.rn.test.tsx` mocks both and models focus as mount/unmount, which is
enough to assert what a focus-scoped handler *does* — but **not** that it is scoped to focus rather
than to mount. Know which of those your test is actually proving.

**6. FlashList has no layout manager under jest, so `computeVisibleIndices()` THROWS.** This is not
a preset problem and it will not be fixed by more setup: it is the same fact the back-ladder spec's
§B7 is built on. **You cannot test list-interaction logic against a real FlashList here.** Hand the
unit a fake ref instead — which is exactly what `src/helpers/ladderDecisions.ts` is shaped for.

**7. A component that imports `@shopify/flash-list` cannot be rendered here at all.** The
`jest-expo` preset's `transformIgnorePatterns` allowlist covers `react-native*`, `expo*`,
`@react-navigation*`, `@sentry/react-native` and `native-base` — and nothing else. FlashList ships
untranspiled, so the suite dies with *"Jest encountered an unexpected token"* pointing at the
`import` line rather than at the config that caused it.

Adding `@shopify` to the allowlist works, and then the SAME error reappears from the next
untranspiled package the component pulls in (`pressto`, by way of `BookGridItem`), and so on. Every
library list in this app is therefore behind a **cascade**, not behind one config entry. Measured
while trying to add a single assertion to `BooksHome`; the attempt was backed out rather than widen
the shared lane's transform for one test. Know that cost before promising a component test that
renders a list — and prefer a hook-level seam, which is what the back ladder does throughout.

**8. A COLOCATED `*.rn.test.tsx` used to run in neither project, and the run still said green.**
The `rn` lane originally matched `**/__tests__/**/*.rn.test.[jt]s?(x)` — suffix *and* directory —
while `helpers` ignores the suffix **anywhere** in the path. So `src/hooks/useFoo.rn.test.tsx`, the
colocated convention, was rejected by one project and ignored by the other: never collected, never
run, no error. Widened to `**/*.rn.test.[jt]s?(x)` on 2026-08-22; jest's default
`testPathIgnorePatterns` still excludes `node_modules`. **Do not re-narrow it to a directory.** If
you are ever unsure a file is being collected, `npx jest --listTests` answers it in a second — and
that is the only cheap check, because a suite that never runs looks exactly like a suite that
passed.

## `jest.rn-setup.js`

Kept deliberately small, and it should stay that way. Every mock in it is a native module with no JS
implementation under jest, **added because a real test failed without it** — never speculatively. A
mock written ahead of the test that needs it is a mock nobody has checked against the real module,
and it rots silently.

When a suite hits `undefined is not a function` from a native module, add the smallest stand-in that
lets the component mount and say which suite forced it. Anything that must model real *behaviour*
belongs in the test as an injected fake instead.

⚠ **`@sentry/react-native` is mocked here, and the reason is not "it's native".** Importing the
real module leaves an **open handle**: jest prints *"did not exit one second after the test run"*
and the process hangs. Locally that is a warning you can ignore; on CI it is a timeout with **no
failing test to point at**. Five modules under `src/` import Sentry, so any suite that touches one
of them trips it. A suite that wants to assert on a report reads the mock through `jest.mocked`.

Not yet mocked, because nothing has needed them yet: the `NativeMediaInfo` turbomodule (`specs/`),
`SafCueReaderModule`, TrackPlayer, FastImage, WatermelonDB. For WatermelonDB, prefer `LokiJSAdapter`
— a real in-memory database — over a mock.

## Worked example

`src/hooks/__tests__/useResetScrollOnTabChange.rn.test.tsx` is the reference. It pins back-ladder
spec **§I3** (`animated: false` on the tab-change scroll reset), an invariant that until now was held
only by a code comment: an *animated* programmatic scroll emits `onMomentumScrollEnd`, which is the
ladder's collapse-sweep trigger, so "polishing" that one word would start collapsing every off-screen
section on each tab change.

All three guards in that hook were mutation-tested and all three mutations were killed:

| mutation | tests killed |
|---|---|
| `animated: false` → `true` | 1 |
| drop the first-render guard | 3 |
| drop the `cancelAnimationFrame` cleanup | 1 |
