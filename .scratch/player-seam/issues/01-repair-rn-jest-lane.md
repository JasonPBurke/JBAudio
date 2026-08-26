# 01 — Repair the `rn` jest lane

**What to build:** A test run where all 74 suites actually start. Right now three
of them do not, and the run still reads as a success — so the automated coverage
under every React component in this repo is absent and invisible at the same
time.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

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

⚠ The bare test command also crashes in `fb-watchman` on this machine (apt
watchman 4.9.0). That is **out of scope** and is not fixed with a
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
