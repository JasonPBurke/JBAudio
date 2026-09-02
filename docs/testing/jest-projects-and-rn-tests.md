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
| `jest-expo` | `~55.0.22` | ⚠ `latest` is the **57** line, which is SDK 57. Match the Expo SDK, not `latest`. |
| `jest` | `^29.7.0` | ⚠ **Pinned to the 29 line deliberately. Do not "upgrade jest".** See below. |
| `jest-environment-jsdom` | `^29.7.0` | Must track the jest major. |
| `@types/jest` | `29.5.14` | Must track it too — types a major ahead of the runtime is its own silent-green hole. |
| `@testing-library/react-native` | `14.0.1` | RNTL. Peers: react ≥19, RN ≥0.78. |
| `test-renderer` | `1.2.0` | **Not** `react-test-renderer`. RNTL 14 moved to this standalone package, which is the supported replacement for the renderer React 19 deprecated. |

The `android` preset rather than `jest-expo/universal`: this app ships Android only, and the
universal preset runs every suite once per platform.

⚠ **Why jest is held at 29.** `jest-expo@55` is a jest-29 package. On jest 30 the entire `rn` lane
dies with *"You are trying to 'import' a file outside of the scope of the test code"*, which names
neither jest nor the version. `expo@55`'s `winter/runtime.native.ts` installs
`__ExpoImportMetaRegistry` as a **lazy, enumerable** global whose getter `require`s another module;
`jest-expo` loads that file from `setupFiles`, i.e. outside test code, and jest 30 added a runtime
guard that jest 29 does not have. Established 2026-08-26 while repairing this lane (`325a75f`),
which also had to re-hoist a nested `expo-modules-core` and take `react-native-worklets` to `0.7.4`
to satisfy its optional peer. Revisit only when the Expo SDK itself moves to a jest-30 `jest-expo`.

## Running the suite

```
npx jest --watchman=false
```

**Use `--watchman=false` in any script, CI step, or agent/background invocation.** Nothing about
this project needs watchman: it is only a crawler for the haste map, the full suite is ~4 s either
way, and jest's `--watch` still works without it.

⚠ **Bare `npx jest` can die before a single test runs, with a stack trace that blames
`fb-watchman`.** The real message is above the trace and easy to scroll past:

```
Watchman is running at a lower than normal priority.
(nice_value=5, min_acceptable_nice_value=0) ... Watchman is refusing to start.
```

That is watchman **refusing on purpose**, not crashing. It aborts whenever its nice value is above
zero. A normal interactive terminal is nice 0 and is unaffected; anything running at reduced
priority — a background agent job, a `nice`d script, some CI runners — inherits a positive nice
value and trips it. **It has nothing to do with inotify limits or the watchman version**, both of
which were already fixed on this machine on 2026-07-27 (official prebuilt `20260727`, limits at
`524288`/`512`). Raising the limits again will not help, because the failure happens before any
watching begins. Diagnose with `nice` — if it prints anything but `0`, this is your problem.

> **ACTION — needs a normal terminal, and root for the optional half.**
>
> 1. Confirm the machine is actually fine, from your own terminal (not an agent):
>    `nice` → expect `0`, then `npx jest` → expect it to pass. If so, nothing here is broken and
>    `--watchman=false` is only ever needed for reduced-priority callers.
> 2. *Optional*, only if you want watchman to work from agent/background contexts too — this
>    disables a guard watchman added for a reason, so skip it unless the noise is costing you:
>    ```
>    printf '{"min_acceptable_nice_value": 20}\n' | sudo tee /etc/watchman.json
>    watchman shutdown-server
>    nice -n 5 watchman version    # should now succeed instead of refusing
>    ```
>    `min_acceptable_nice_value` is a real watchman config key and `/etc/watchman.json` is the
>    global config path, but **this exact fix is untested** — it was written from the binary's
>    strings, because the session that diagnosed this could neither reach nice 0 nor write `/etc`.
>    If step 2 does not work, keep `--watchman=false` and move on; it costs nothing.

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

**2. `render`, `renderHook`, `rerender`, `unmount` AND `fireEvent` are all ASYNC in RNTL 14.** A
missing `await` does not throw — the assertion just runs before the render it meant to observe.

⚠ **`render` and `fireEvent` are easy to miss**, because the DOM Testing Library everyone has muscle
memory for returns neither as a promise. Check `dist/render.d.ts` if in doubt: it returns
`Promise<{...}>`, and `fireEvent.press` returns `Promise<void>`. Skipping the `await` interleaves act
scopes, and React reports it as *"You seem to have overlapping act() calls"* from inside
`react.development.js`, naming **no line in your test**. The visible symptom is captured props
reading `null` — which looks like a broken mock and sends you to rewrite the wrong thing. Found
2026-09-02 while writing `librarySearchAndSearchBar.rn.test.tsx`.

**3. Reanimated needs the `/mock` entry point, not `setUpTests()`.** On reanimated 4.2.1 /
worklets 0.7.2, merely *importing* `react-native-reanimated` pulls in `react-native-worklets`, whose
native half throws *"Native part of Worklets doesn't seem to be initialized"* — before `setUpTests()`
can run. `jest.rn-setup.js` does `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`,
which replaces the module wholesale and never reaches worklets.

⚠ **And that shared mock does NOT actually work — nothing had tested it.** A `jest.mock` factory is
lazy: it runs only when a suite really imports the module. Until 2026-08-30 no suite imported
reanimated, so the factory above had never been evaluated. The first suite that did
(`components/__tests__/PlayerControls.rn.test.tsx`) died inside it: on the installed versions,
`react-native-reanimated/mock` itself re-enters the real `react-native-reanimated/src/index`, which
imports `initializers`, which imports `react-native-worklets` — the exact native half the mock was
supposed to avoid. The trace names `mock.ts` as the *caller*, which reads like your test's fault.

Until someone repairs the shared mock, **a suite that imports reanimated must carry its own stub**,
in-file, ahead of the import. Keep it to the APIs that suite touches — `PlayerControls.rn.test.tsx`
stubs `default` (`View` + `createAnimatedComponent`), `useSharedValue`, `useAnimatedStyle`,
`withTiming` and `withSequence` in about ten lines. This is a deliberate exception to the "every
mock lives in `jest.rn-setup.js`" habit, and it stays an exception: the setup file's job is native
modules with no JS implementation, not routing around a broken vendor mock.

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

**There is a third option, and it is cheap: mock the lists at their MODULE boundary.** A
`jest.mock('@/components/BooksHome', ...)` is applied before the module is resolved, so FlashList is
never reached and the cascade never starts. That buys a screen mounted for real — its state, its
effects, its wiring — with a stub apiece for the parts that cannot render.
`src/app/(drawer)/(library)/__tests__/librarySearchAndSearchBar.rn.test.tsx` does this for
`LibraryScreen`: the three lists, the header and the search bar are stubs that record the props they
were handed, while `useScrollDirection` and both search filters run for real. Use it when the thing
under test is the SCREEN'S OWN wiring — state that has to survive a swap, a value threaded from a
hook into a child — which is precisely what a hook-level seam cannot reach.

**8. A COLOCATED `*.rn.test.tsx` used to run in neither project, and the run still said green.**
The `rn` lane originally matched `**/__tests__/**/*.rn.test.[jt]s?(x)` — suffix *and* directory —
while `helpers` ignores the suffix **anywhere** in the path. So `src/hooks/useFoo.rn.test.tsx`, the
colocated convention, was rejected by one project and ignored by the other: never collected, never
run, no error. Widened to `**/*.rn.test.[jt]s?(x)` on 2026-08-22; jest's default
`testPathIgnorePatterns` still excludes `node_modules`. **Do not re-narrow it to a directory.** If
you are ever unsure a file is being collected, `npx jest --listTests` answers it in a second — and
that is the only cheap check, because a suite that never runs looks exactly like a suite that
passed.

**9. A WARM TRANSFORM CACHE CAN REPORT A FULLY CONVINCING FALSE GREEN.** This is the worst one in
the list, because it does not merely fail to warn you — it hands you the number you were hoping for.
While repairing this lane on 2026-08-26, a **half-fixed** tree produced a clean
`74 suites / 954 tests`: the correct totals, reproducible twice. `npm ci` followed by `--clearCache`
put all three `rn` suites straight back to failing to start. The cache still held transformed output
from before the breakage, so the suites never re-resolved the module that was actually broken.

Consequence: **any run that is establishing a baseline, gating a ticket, or proving the `rn` lane is
alive must come from a clean tree and a cold cache.**

```
npm ci && npx jest --watchman=false --clearCache && npx jest --watchman=false
```

An incremental `npm install` followed by `npx jest` is not a gate. Day-to-day iteration on a warm
cache is fine — the rule is about the runs you are going to *believe*.

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

Not yet mocked here, because nothing has needed them *globally* yet: the `NativeMediaInfo`
turbomodule (`specs/`), `SafCueReaderModule`, TrackPlayer, FastImage, WatermelonDB. Two suites now
mock TrackPlayer in-file — `trackPlayer.rn.test.tsx` at `react-native-track-player` (the hooks are
named exports the `fakePlayer` default-export fake cannot reach) and `PlayerControls.rn.test.tsx`
at `@/player/trackPlayer` (the adapter, which is all a component may import — ADR 0003). For WatermelonDB, prefer `LokiJSAdapter`
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
