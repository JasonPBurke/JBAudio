# 01 — Repair the `rn` jest lane

**What to build:** A test run where all 74 suites actually start. Right now three
of them do not, and the run still reads as a success — so the automated coverage
under every React component in this repo is absent and invisible at the same
time.

**Blocked by:** None — can start immediately.

**Status:** resolved

## The problem

All three `*.rn.test.tsx` suites fail to start with
`Cannot find module 'expo-modules-core' from 'node_modules/jest-expo/src/preset/setup.js'`.

`npm ls expo-modules-core` reports it present at `expo@55.0.29 →
expo-modules-core@55.0.25`, but it is installed **nested** under
`node_modules/expo/`, not hoisted. `jest-expo`'s preset requires it by bare
name, so resolution from `node_modules/jest-expo/` walks up to a path that does
not exist.

Suspected cause, **unverified**: `5bcc2b2 "Chore: clear some of my npm install
warnings"`. Memory records 952 tests with this lane working on
`feat/library-back-ladder`. Confirm before asserting it.

## Why it gates ticket 09

Ticket 09 migrates twelve files, most of them React components. This lane is the
only automated thing in this repo that renders one. It is also the same
silent-green failure mode as trap 8 in `docs/testing/jest-projects-and-rn-tests.md`
— a suite that does not run, and a report that does not say so.

## Approach

Prefer `npm dedupe`, or declaring the dependency directly to force the hoist.
⚠ Do **not** reach for a `moduleNameMapper` entry — it papers over a resolution
bug that will also affect anything else `jest-expo` requires by bare name.

⚠ The bare test command also crashes in `fb-watchman` on this machine.
(⚠ **CORRECTION, 2026-08-26** — the "apt watchman 4.9.0" attribution written here
was WRONG: that watchman was replaced on 2026-07-27. The real cause is that
watchman refuses to start at nice > 0, and a background/agent job runs at nice 5.
A human's terminal is nice 0 and never sees it. See
`docs/testing/jest-projects-and-rn-tests.md` → **Running the suite**.)
That is **out of scope** and is not fixed with a
`.watchmanconfig` — that was never the fix. The working invocation disables
watchman, and every later ticket's gate is written that way.

## Acceptance criteria

- [ ] All 74 suites start; none fails to run
- [ ] Root cause confirmed or the `5bcc2b2` hypothesis explicitly refuted
- [ ] New baseline test count recorded below under `## Answer`, and it is the
      number every later ticket measures "unchanged" against
- [ ] No change to `.watchmanconfig`, and no `moduleNameMapper` shim

## Baseline before this ticket

```
Test Suites: 3 failed, 71 passed, 74 total
Tests:       914 passed, 914 total
tsc: 0    eslint: 0
```

## Answer

**Resolved 2026-08-26.** All 74 suites now start and pass. The lane was broken by
**two stacked regressions from the same commit**, the first of which completely
masked the second.

### Root cause — the `5bcc2b2` hypothesis is CONFIRMED, not refuted

`5bcc2b2` touched no `package.json`; it regenerated `package-lock.json` only. The
`expo` range is `~55`, so the regeneration walked `expo` **55.0.8 → 55.0.29**, and
that carried `expo-modules-core` **55.0.17 → 55.0.25**. Both failures follow from
that single version walk.

**Failure 1 — the nesting (`Cannot find module 'expo-modules-core'`).**
`expo-modules-core@55.0.25` added a peer dependency that `55.0.17` did not have:

```
"react-native-worklets": "^0.7.4 || ^0.8.0"   (optional)
```

The repo pinned `react-native-worklets` at an exact `0.7.2`, which does not satisfy
it. npm does not fail on an unsatisfiable optional peer — it **nests**. It installed
a satisfying `react-native-worklets@0.8.3` *and* `expo-modules-core@55.0.25` together
under `node_modules/expo/node_modules/`, which vacated the top-level
`node_modules/expo-modules-core` slot. `jest-expo/src/preset/setup.js:232` requires
`expo-modules-core` by bare name, resolution from `node_modules/jest-expo/` walks up
to a path that no longer exists, and all three suites die before they start.

Lockfile proof — the placement is recorded as the key itself:

```
5bcc2b2^ :  "node_modules/expo-modules-core"                 <- hoisted
HEAD     :  "node_modules/expo/node_modules/expo-modules-core" <- nested
```

**Failure 2 — jest 30 vs jest-expo 55 (`You are trying to 'import' a file outside
of the scope of the test code`).** Only visible once failure 1 was fixed.
`expo@55.0.29`'s `expo/src/winter/runtime.native.ts:24` installs
`__ExpoImportMetaRegistry` as a **lazy, enumerable** global whose getter `require`s
another module. `jest-expo` runs that file from its `setupFiles`, i.e. outside test
code. jest 30's runtime added a guard that jest 29's does not have:

```js
// jest-runtime/build/index.js  _execModule
if (this.isInsideTestCode === false && !supportsDynamicImport) { throw ... }
```

Counted directly: that string appears **4 times** in jest 30's `jest-runtime` and
**0 times** in jest 29's. `jest-expo@55` depends on `jest@^29.2.1` throughout and
shipped an entire nested jest 29 tree (63 lockfile entries) alongside the root
jest 30. `55.0.22` is the newest jest-expo for SDK 55; there is no jest-30-capable
version to move to.

This is why the lane worked at 952 tests on `feat/library-back-ladder`: that branch
was on `expo@55.0.8`, whose winter runtime did not yet install that global. jest 30
was never the problem until `expo` moved.

### The fix

Align the toolchain to the versions `jest-expo@55` and `expo@55.0.29` actually
depend on. `npx expo install --check` independently named every one of these.

| Package | Was | Now | Why |
| --- | --- | --- | --- |
| `react-native-worklets` | `0.7.2` | `0.7.4` | satisfies `expo-modules-core@55.0.25`'s peer, so nothing nests |
| `jest-expo` | `~55.0.21` | `~55.0.22` | newest for SDK 55 |
| `jest` | `^30.3.0` | `^29.7.0` | jest-expo 55 is a jest-29 package; jest 30's guard is the blocker |
| `jest-environment-jsdom` | `^30.3.0` | `^29.7.0` | must match jest |
| `@types/jest` | `30.0.0` | `29.5.14` | types a major ahead of the runtime is a silent-green hole of its own |

⚠ **The version bump alone was not sufficient** and this is the part that will bite
anyone repeating this. npm **reifies the lockfile's recorded placement** rather than
re-planning it, so `expo-modules-core` stayed nested even after a full
`rm -rf node_modules && npm install` with the peer satisfied. `npm dedupe` did not
fix it either — dedupe collapses *duplicates*, and a single nested package is not a
duplicate (it did correctly remove the duplicate worklets, and churned 485 packages
doing it). The stale placement had to be **deleted from `package-lock.json`
explicitly**, after which npm placed it at the root on the next install and `npm ci`
has reproduced that placement ever since.

Per the ticket's constraints: **no `moduleNameMapper` entry**, and `.watchmanconfig`
was not created, modified, or read. `jest.config.js` and `jest.rn-setup.js` are
untouched. The whole change is `package.json` (5 lines) + `package-lock.json`.

### ⚠ A new trap: this lane can report a FALSE GREEN from a warm cache

Partway through, `jest-expo@55.0.22` on top of the hoist produced a clean
**74 suites / 954 tests** run. It was an artifact of a warm jest transform cache.
`npm ci` followed by `--clearCache` put all three suites straight back to failing.
The number was right, reproducible twice, and completely wrong.

**Every gate in tickets 02–12 must therefore be measured from a clean tree and a
cold cache**, not from an incremental `npm install`. This is the same family as
trap 8 in `docs/testing/jest-projects-and-rn-tests.md` and is worth adding there.

### New baseline — this is the number tickets 02–12 measure against

```
Test Suites: 74 passed, 74 total
Tests:       954 passed, 954 total
tsc: 0    eslint: 0 errors (38 pre-existing warnings)
```

The gate command, with the flag that makes it work on this machine:

```
npx jest --watchman=false
```

Verified from a clean tree and a cold cache:

```
npm ci && npx jest --watchman=false --clearCache && npx jest --watchman=false
```

All 7 `patch-package` patches still apply cleanly, including the RNTP and
react-native ones.

### Consequences the later tickets inherit

1. **`react-native-worklets` 0.7.2 → 0.7.4 is a NATIVE module change.** A Metro
   reload will not pick it up — the next device pass (ticket 08's Remote-control
   pass) must be preceded by `npm run android`, not `npx expo start`.
2. **A real runtime landmine was removed, not just a test one.** Before this, the
   JS tree held **two** copies of `react-native-worklets` — `0.7.2` at the root and
   `0.8.3` nested under `expo/` — while autolinking builds the native half from the
   root copy. Reanimated 4 and `expo-modules-core` were resolving different worklets
   JS against one native runtime. Nothing had been attributed to this, but it was
   live on `main`'s lockfile.
3. **The nested jest 29 tree is gone**: `node_modules/jest-expo/node_modules/`
   dropped from 63 lockfile entries to 8, and there is now exactly one jest on disk.
   The large lockfile diff is that collapse, not new dependencies.
4. **A pre-existing ERESOLVE is still lurking**, unrelated and untouched. Resolving
   the tree from scratch with no lockfile fails on
   `reanimated-color-picker@4.3.0` vs `expo@55.0.30`. It never fires for
   `npm install`/`npm ci` against the committed lockfile, so it is out of scope
   here — but deleting `package-lock.json` will hit it.
5. **`expo` itself is now the only thing expo-doctor still flags** (`55.0.29` vs
   expected `~55.0.30`), left alone deliberately: bumping it is what started this.
