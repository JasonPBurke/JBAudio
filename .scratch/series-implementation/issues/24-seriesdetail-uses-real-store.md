# 24 — The Series detail route must resolve through the real store

**Status:** ready-for-agent

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

- [ ] `src/app/seriesDetail.tsx` imports nothing from `@/prototypes/`.
- [ ] The sheet and the editor it launches resolve from the **same** source, so
      `Edit series` can never open an editor that finds nothing.
- [ ] The sheet no longer subscribes to the whole library books map.
- [ ] `rm -rf src/prototypes src/app/seriesCreateProto.tsx` leaves a **building** app —
      verify by actually running the deletion on a scratch checkout, or by grepping for every
      `@/prototypes/` importer and confirming `seriesDetail.tsx` was the last one in shipping
      code. **⚠ See the grep caveat below.**
- [ ] jest green (**711/711** at review time) · `tsc` 0 errors · eslint 0 errors.

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
