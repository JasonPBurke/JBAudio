# 18 — Delete the prototype harness

**Blocked by:** [10](10-browse-row.md), [11](11-series-detail-sheet.md),
[12](12-editor-one-root-route.md), [13](13-editor-picker-panel.md),
[14](14-editor-numbers-and-ordering.md), [15](15-editor-series-artwork.md),
[17](17-titledetails-series-line.md) — every ticket that replaces something a prototype
stood in for — and ~~[24](24-seriesdetail-uses-real-store.md)~~, which removed the one
harness import that lived in **shipping** code. **24 is RESOLVED (2026-08-14) and no longer
blocks this ticket** — but read its comment below first, the recipe here is still incomplete.

**Status:** resolved

**Spec:** [§Further Notes](../../series-ux-redesign/spec.md). The authoritative recipe is
`src/prototypes/README.md`.

## What to build

Nothing. **Remove** the throwaway harness that judged fourteen browse variants, seven
create-flow shapes and four placements of the series line — and leave the app running on
real components with no trace of it.

Everything in `src/prototypes/` is throwaway by construction: it holds the repo's
tsc/eslint line and **nothing else** — no jest, no tablet pass, no font-scale pass. Its job
was to be judged on a device and deleted.

## Acceptance criteria

- [ ] Follow **`src/prototypes/README.md`**, which is authoritative. It is longer than the
      "three commented lines" the spec-writing ticket predicted, because tickets 13, 14 and
      15 each added routes of their own. In outline:
      the prototypes directory and both throwaway routes are removed; the throwaway mounts
      and imports come out of the book-details screen; both throwaway `<Stack.Screen>`
      entries come out of the root layout; the harness pill comes off the library screen.
- [ ] The library screen's **three `THROWAWAY` sites** are restored to the real series hook
      and the real series home component.
- [ ] **The shipping series home component was never modified**, so there is nothing to
      revert there. Confirm rather than assume.
- [ ] No import, route, mount or dead file referencing the harness remains. Grep for it.
- [ ] The app builds and runs on a device with every Series surface served by real
      components.
- [ ] `tsc` **0 errors** · eslint **0 errors** (~40 warnings are the pre-existing baseline)
      · jest **green** (484 at the time the spec was written — this ticket adds none and
      must lose none).

## ⚠ Two things that look like harness fallout and are NOT

1. **DO NOT revert the `TableOfContents` icon on `Remove Auto-Chapters`.** It is F10, a
   driver ruling, and it **ships**. It was made during the prototype work only because that
   is when the glyph collision was noticed.
2. **Two pieces of real code were built and shipped ahead of the spec, deliberately**,
   because neither is a Series change: the shared settings row's `description` +
   `onInfoPress` props, and the timer screen's retirement of its `How it works` row as their
   first call site. **Both stay.**

## Never run a formatter over this repo

There is **no config file**. A formatter pass would rewrite unrelated files and bury this
diff.

## What the prototypes bought, for the record

Recorded in the spec's Further Notes with the surviving screenshots — the wizard
push-vs-sheet comparison, the fourteen browse variants, the editor grown by artwork and
numbering, the detail sheet on a real route (including the reproduced white-sheet delete
exit), four placements of the series line, the seven create-flow shapes, the geometry rules
on three widths, and the light-theme pass with its measuring script. **The assets are not
deleted by this ticket — only the code is.**

## Comments

### 2026-08-13 — code review: the teardown command as written breaks the build

From [Code review `d2195ed..HEAD`](../CODE-REVIEW-d2195ed.md), Finding 4 — CONFIRMED.

`src/app/seriesDetail.tsx:32` is **shipping code** importing `@/prototypes/useSeriesSource`.
The recipe in this ticket names the library screen's _three_ `THROWAWAY` sites; this is an
undocumented **fourth**, and the only one outside throwaway code. Running
`rm -rf src/prototypes src/app/seriesCreateProto.tsx` as written leaves that import dangling
and the Series detail route fails to resolve at bundle time.

Split out as [24](24-seriesdetail-uses-real-store.md) and added to this ticket's
**Blocked by**, because it is a shipping-code behaviour fix (it also closes a dataset split
and a re-render storm) and this ticket is a deletion. Land 24 first.

**⚠ The "Grep for it" acceptance criterion is not trustworthy as written.**
`src/db/seriesQueries.ts` contains two raw `U+0000` bytes (Finding 7), which makes it binary
to `grep`/`rg` — a plain `grep -n` returns **nothing** for that file. Use `rg --text`, or fix
Finding 7 first.

**⚠ `src/app/seriesDetail.tsx` must NOT be deleted by this ticket.** It is the shipping
detail sheet (spec §C1/§C2), deliberately a root-level `formSheet` sibling outside the
`series` group.

Also note the jest figure in the acceptance criteria (**484**) is stale — the baseline at
review time was **711/711, 57 suites**.

### 2026-08-14 — ticket 24 is done, and the recipe still does not compile as written

[24](24-seriesdetail-uses-real-store.md) is **resolved** (jest 731/731, tsc 0, eslint 0). The
`Blocked by` entry for it is cleared. `src/app/seriesDetail.tsx` no longer touches the
harness, and `src/prototypes/README.md` has been corrected in four places — read it again
rather than working from memory of it.

**The library screen is now the only IMPORT footprint.** The `titleDetails.tsx` entry in the
recipe (four `THROWAWAY` mounts + one import) was already removed by ticket 17 and had never
been struck; there is nothing to do there. Verified by byte-aware sweep.

⚠ **But "footprint" is two axes, not one, and only imports are testable.**
`src/app/_layout.tsx:355` still registers the `seriesCreateProto` route with a
`THROWAWAY`-marked `<Stack.Screen>`. Expo Router resolves routes from the filesystem, so that
registration is a **name string with no import behind it** — `harnessBoundary.test.ts`
structurally cannot see it, and neither can any import sweep. **Remove it by hand**, as the
recipe above already says. A leftover `<Stack.Screen>` pointing at a deleted route file is not
a bundle error, so nothing else will catch it either: `typedRoutes` (`app.json:115`) only
notices once `.expo/types/router.d.ts` is regenerated, which `tsc` alone does not do.

The boundary test covers the half it can — once `src/app/seriesCreateProto.tsx` is gone,
nothing may still name that route.

⚠ **New finding: "put both back at their use sites" does not typecheck.** This was found by
actually running the teardown on a scratch checkout, and it is a real extra step:

```
rm -rf src/prototypes src/app/seriesCreateProto.tsx      → tsc 3 errors (the 3 library imports)
+ restore SeriesHome / useDerivedSeries at their sites   → tsc 1 error  ← this one
+ delete the activeSeriesSections state                  → tsc 0 errors
```

`SeriesProtoSlot` takes `Omit<VariantProps, 'onEditPress'>` and forwards it as
`<SeriesHome {...props} />`. **TypeScript does not excess-property-check a spread** — only
literal JSX attributes — so the slot has been silently swallowing
`activeGridSections`/`setActiveGridSections`, two props `src/components/SeriesHome.tsx` has
never declared. The library screen carries an `activeSeriesSections` `useState`
(`index.tsx:87`) that exists _only_ to feed them.

So the swap `<SeriesProtoSlot …>` → `<SeriesHome …>` fails with TS2322 until those two
attributes **and** the `useState` behind them are deleted. Note `activeGridSections` at
`index.tsx:302` is a **different** consumer (`BooksGrid`) and must stay.

This does not contradict the existing criterion _"the shipping series home component was
never modified"_ — it wasn't. The drift is entirely on the library screen's side, hidden by
the spread for the whole prototype effort.

⚠ **`src/prototypes/__tests__/harnessBoundary.test.ts` goes with the directory.** It is
deleted by the `rm -rf` in the command above, which is deliberate — it guards the boundary
this ticket dissolves. Expect jest to drop by 2 (731 → 729) and do not treat that as a
regression. It is the one file under `src/prototypes/` that jest runs; see ticket 24.
