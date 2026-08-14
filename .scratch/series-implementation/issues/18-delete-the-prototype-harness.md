# 18 — Delete the prototype harness

**Blocked by:** [10](10-browse-row.md), [11](11-series-detail-sheet.md),
[12](12-editor-one-root-route.md), [13](13-editor-picker-panel.md),
[14](14-editor-numbers-and-ordering.md), [15](15-editor-series-artwork.md),
[17](17-titledetails-series-line.md) — every ticket that replaces something a prototype
stood in for — and [24](24-seriesdetail-uses-real-store.md), which removes the one harness
import that lives in **shipping** code.

**Status:** ready-for-agent

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
The recipe in this ticket names the library screen's *three* `THROWAWAY` sites; this is an
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
