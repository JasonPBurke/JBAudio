# 24 — The Series detail route must resolve through the real store

**Status:** resolved — jest 733/733 (58 suites, +4 new, none lost), tsc 0, eslint 0 errors /
37 warnings (under the ~40 baseline). NOT device-verified — see
[What device checking would add](#what-device-checking-would-add).

**Source:** [Code review `d2195ed..HEAD`](../CODE-REVIEW-d2195ed.md), Finding 4 — CONFIRMED.

**Blocks:** [18](18-delete-the-prototype-harness.md). Do this **before** 18, not as part of
it — it is a shipping-code fix, and 18 is a deletion.

## The defect

`src/app/seriesDetail.tsx` is **shipping code** and it imports the throwaway harness:

```ts
// src/app/seriesDetail.tsx:32
import { useSeriesSource } from '@/prototypes/useSeriesSource';
```

`src/app/_layout.tsx:355` documents teardown as
`rm -rf src/prototypes src/app/seriesCreateProto.tsx`. Running that command as written leaves
this import dangling and **the Series detail route fails to resolve at bundle time.**

**Ticket 18 does not cover this.** Its recipe names the library screen's *three* `THROWAWAY`
sites. `seriesDetail.tsx` is an undocumented **fourth** — and the only one in shipping code.

## Two further problems ride along in the same import

1. **Dataset split.** `seriesDetail.tsx:36` resolves through `useSeriesSource()` (synthetic
   when a preset is selected) while `src/app/seriesEditor.tsx` resolves through
   `useDerivedSeries()`. With a preset on, the sheet renders a *synthetic* series and
   `Edit series` opens an editor that finds nothing and seeds an empty create.
2. **Perf.** `useSeriesSource` calls `useLibraryStore((s) => s.books)` **unconditionally** —
   the `__DEV__` guard sits inside the `useMemo` body, not around the subscription. With the
   sheet open during playback, `src/store/library.tsx`'s `observeWithColumns` (17 book
   columns) emits on every progress write, `s.books` gets a new identity, and the whole sheet
   — hero fan, completion bar, and the FlashList of rows — re-renders at progress-tick rate.
   `useDerivedSeries()` alone would not do this.

## What to build

Point `src/app/seriesDetail.tsx` at `useDerivedSeries()` from `@/store/seriesStore`, and drop
the prototype import and its `THROWAWAY` comment.

One change resolves all three problems: the build break, the dataset split, and the
re-render storm.

## Acceptance criteria

- [x] `src/app/seriesDetail.tsx` imports nothing from `@/prototypes/`.
- [x] The sheet and the editor it launches resolve from the **same** source, so
      `Edit series` can never open an editor that finds nothing.
- [x] The sheet no longer subscribes to the whole library books map.
- [x] `rm -rf src/prototypes src/app/seriesCreateProto.tsx` leaves a **building** app —
      verify by actually running the deletion on a scratch checkout, or by grepping for every
      `@/prototypes/` importer and confirming `seriesDetail.tsx` was the last one in shipping
      code. **⚠ See the grep caveat below.** — done the strong way, on a scratch checkout.
- [x] jest green (**711/711** at review time) · `tsc` 0 errors · eslint 0 errors.
      Landed at **731/731**; the baseline had moved to 729 by tickets 21–23.

## ⚠ The grep caveat

`src/db/seriesQueries.ts` contains two raw `U+0000` bytes (Finding 7), which makes it
**binary to `grep` and `rg`** — a plain `grep -n` returns nothing for that file. Ticket 18's
*"No import, route, mount or dead file referencing the harness remains. Grep for it"*
criterion is therefore not trustworthy until those bytes are fixed. Use a byte-aware sweep,
or fix Finding 7 first:

```bash
rg -n --text '@/prototypes/' src/
```

## ⚠ Do not

- Do not delete `src/app/seriesDetail.tsx`. It is the **shipping** detail sheet (spec
  §C1/§C2), a root-level `formSheet` sibling deliberately placed outside the `series` group.
  An earlier reading of ticket 18's deletion command would have removed it.
- Never run a formatter over this repo — there is no config file.

## Comments

### 2026-08-14 — resolved

**The fix is two lines**, exactly as the ticket specified: `src/app/seriesDetail.tsx` now
imports `useDerivedSeries` from `@/store/seriesStore` and calls it where `useSeriesSource()`
was called. The `THROWAWAY` comment is gone. `src/components/SeriesDetailSheet.tsx` never
referenced the harness and was not touched.

The doc block on the route gained the reason, because none of it is visible from the call
site: the sheet must read **the same source the editor reads**, since `Edit series` hands the
editor an id and the editor looks it up itself.

### The boundary rule is now a test, not a grep

`src/prototypes/__tests__/harnessBoundary.test.ts` (+2 tests) walks `src/`, skips
`src/prototypes/`, and fails if any file outside the harness imports `@/prototypes/` except
the two ticket 18 deletes or restores. It was written **first and seen to fail**, naming
`src/app/seriesDetail.tsx` as the single leak.

Three deliberate choices in it, all recorded in the file:

1. **`readFileSync`, not a shell grep.** This is the ticket's grep caveat made structural.
   `grep`/`rg` skip `src/db/seriesQueries.ts` as binary (Finding 7's two `U+0000` bytes) and
   a sweep that reports nothing looks identical to one that found nothing. Node's reader has
   no binary heuristic.
2. **It lives in `src/prototypes/`**, against that directory's "no jest" rule (the README now
   records the exception). It tests the boundary *around* the harness, not the harness, and
   living inside means `rm -rf src/prototypes` removes the rule and its subject together —
   no dead test pointing at a directory that no longer exists.
3. **A subset check, not set equality.** An allowlisted file that has *stopped* importing the
   harness is ticket 18 in progress, not a defect. The test must not fire mid-teardown.

⚠ **It uses `require()`, not `import`, and that is not a style choice.** `tsconfig.json`
pins `"types": ["jest"]`, which deliberately keeps `@types/node` out of a React Native app's
type space, so `import fs from 'fs'` does not resolve. Adding `"node"` to that list was
measured — it does reach 0 errors — but it changes how `setTimeout` and friends type across
**every** app file to buy one test its imports. `require` is already typed here (RN declares
it for asset imports), so the two calls are typed locally instead, at zero blast radius. The
two `eslint-disable-next-line` directives are load-bearing: without them the warning count
goes 37 → 39.

### Acceptance criterion 4 was verified the strong way

Not by grepping — by running the deletion. A scratch checkout (rsync, `node_modules`
symlinked) had `rm -rf src/prototypes src/app/seriesCreateProto.tsx` run against it:

| state of the scratch checkout | `tsc` errors |
| --- | --- |
| after the teardown command alone | **3** — all three in `src/app/(drawer)/(library)/index.tsx`, every one a documented ticket 18 restore site. **`seriesDetail.tsx` is not among them.** |
| \+ ticket 18's documented restore (2 imports, 2 use sites, the pill) | **1** — see below |
| \+ dropping the harness-only `activeSeriesSections` state | **0** |

That last row is a **new finding for ticket 18**, recorded there as a comment: the recipe as
written does not compile. `SeriesProtoSlot` forwards props with `<SeriesHome {...props} />`,
and TypeScript does not excess-property-check a **spread** — only literal attributes. So the
slot silently swallowed `activeGridSections`/`setActiveGridSections`, two props `SeriesHome`
has never declared, and the library screen grew an `activeSeriesSections` `useState` that
exists only to feed them. The drift is invisible until the moment `<SeriesProtoSlot …>`
becomes `<SeriesHome …>` and those attributes stop being a spread.

**The harness slot was a type-checking blind spot for the whole prototype effort.** That is
the same shape as this ticket's own defect — the harness quietly absorbing a difference
between prototype and shipping code — and it is why the scratch-checkout verification was
worth doing over a grep.

### One capability is deliberately gone

With a synthetic preset selected, tapping a synthetic row no longer opens the real sheet — the
id is not in the real store, so the route renders `MissingSeries`. That is the dataset split
closing, and the README advertised it as a feature ("the fastest way to put the 95-character
name … in front of the shipping screen at font scale 2.0"), so that paragraph was corrected
rather than left to mislead. Use real data for that pass now. The harness's `Rows`/`Pinned`
knobs were already dead for the same section.

### The recipe document was corrected, since this ticket exists because it was wrong

`src/prototypes/README.md` is authoritative for ticket 18. Four edits:

- The `seriesDetail.tsx` footprint and its "one line restored" instruction — **now nothing to
  restore.** Leaving that in would have re-armed the exact trap.
- The `titleDetails.tsx` footprint (four mounts + one import) — **already gone**, removed by
  ticket 17 and never struck from the recipe. Verified by sweep: no `@/prototypes/` import
  and no `THROWAWAY` mount in that file.
- The ticket-13 section's present-tense claim that the route resolves through
  `useSeriesSource()`.
- The "no jest" rule, which now records its one exception and why.

The library screen is the entire footprint now.

## What device checking would add

Little, and it is not blocking. There is no visual change and no new state: the route resolves
one id from a different array of the same type. What a device pass *would* confirm is the perf
half — that the sheet no longer re-renders at progress-tick rate with playback running — which
is a profiler observation, not something a screenshot shows. The dataset-split half is
unreachable on a release build, where `__DEV__` is false and `useSeriesSource` already returned
the real store.

Worth folding into the next Series device pass rather than staging its own.

### 2026-08-14 — code review round, 5 findings, all valid and all fixed

Two of them were defects **this ticket introduced into the very document it exists to
correct**, which is worth recording plainly.

**1 + 2. "The library screen is the whole footprint" was FALSE, and it was paired with a
promise the test cannot keep.** `src/app/_layout.tsx:355` registers the harness's
`seriesCreateProto` route with a `THROWAWAY`-marked `<Stack.Screen>`. Expo Router resolves
routes from the filesystem, so that registration is a **name string with no import behind
it** — structurally invisible to any import sweep, this test included. Both the README and
the ticket 18 comment now say "the only IMPORT footprint", name `_layout.tsx` as the second
axis, and state that it must be removed by hand.

⚠ **This is the same failure mode as the ticket's own defect**: an emphatic, newer sentence
in the authoritative recipe, contradicting the correct instruction ~25 lines below it. The
next agent trusts the summary, not the checklist. **Two axes exist — imports and route
registrations — and only the first is testable.**

**3 + 5. The matcher was wrong in both directions at once**, from the same root cause:
substring-searching whole file contents.

- Too narrow: it keyed on the literal `@/prototypes/`, so `../prototypes/useSeriesSource` —
  which resolves *identically* — would have reintroduced the ticket 24 defect with the guard
  still green. It also walked only `src/`, so an importer in `index.js` or a root config was
  invisible.
- Too broad: any comment or string literal naming the alias counted as an import. A doc block
  explaining this very rule would have been reported as a leak.

Now it extracts module **specifiers** (`from`, `require`, `jest.mock`, dynamic `import()`,
side-effect `import`) and matches `/(^|\/)prototypes(\/|$)/`, and the walk is rooted at the
repo with a skip list. **The matcher is itself tested against a fixture** — it has to be,
because once ticket 18 lands the sweep finds nothing and the suite would otherwise pass by
testing nothing at all.

**4. `SOURCE_ROOT = 'src'` resolved against `process.cwd()`.** Jest does not chdir, so running
from any subdirectory threw ENOENT *in the describe body* — before a single assertion, so even
the vacuity guard never ran and the boundary result read as a broken test. Anchored to
`__dirname` now, verified by running the suite from `src/db/`.

**6, not from the review.** The file had no `import`/`export`, so TypeScript treated it as a
**script** and `const fs`, `const path` and `type DirEntry` were declared in the GLOBAL scope
— a latent collision with any future test declaring the same names. `export {}` at the foot
makes it a module.

**Mutation-checked rather than assumed.** Each claim was verified by introducing the defect
and watching the suite fail:

| mutation | old test | hardened test |
| --- | --- | --- |
| relative `../prototypes/…` import in `src/app/` | passes ✗ | **fails** ✓ |
| `require('@/prototypes/…')` at the repo root | invisible ✗ | **fails** ✓ |
| prose naming the alias in a comment | fails ✗ | **passes** ✓ |
| run from `src/db/` | ENOENT ✗ | **passes** ✓ |

4 tests now, not 2. jest **733/733**.
