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
