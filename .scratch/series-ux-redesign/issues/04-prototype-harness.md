# 04 — Stand up the prototype harness

Type: task
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

Nothing to decide here — this is the manual work that unblocks every prototype
ticket. **Build a dev-only rig that can show several Series UI variants live on
`Pixel_7_Pro`, over data rich enough to judge them by.**

## Why it is needed

The corpus is 8 books forming roughly one natural series. A *browse* screen is
precisely the surface that needs many series, long names, big series and mixed
progress states before you can tell whether a layout works. Judging a series list
against one series would be judging nothing.

## Deliverable

**1. Variant switcher.** A `__DEV__`-only control that cycles between Series
browse implementations live, with no rebuild — Metro fast-refresh only. Variants
live in a clearly throwaway location (e.g. `src/components/__proto__/`) so
deleting the lot at the end is trivial. Options for the control: a hidden row in
settings, or a long-press on the `Layers` toggle in `Header.tsx`. Pick whichever
is least invasive to real code — the switcher must not leak into production
paths.

**2. Synthetic stress-data injector.** A `__DEV__` action that fabricates series
over the *real* books, so covers stay real while the shape gets pathological.
Must be able to produce at least:

- a 20+ book series (scroll and density behaviour)
- a 1-book series (degenerate case)
- a 60+ character series name (truncation)
- ~15 series at once (the actual list problem)
- one series each of all-unplayed / mixed / all-finished (tab filtering + progress
  display)
- two series sharing books (membership is many-to-many by design)
- a series with gaps in canonical numbering (Dresden 1, 3, 4, 8)

Injection should be reversible — a "clear synthetic series" action — so the real
DB state is recoverable without a wipe.

## Constraints

- Prototype code is **throwaway**: no jest coverage, no tablet pass, no font-scale
  pass required. Do not let it accrete quality it does not need.
- Do **not** modify the real `SeriesHome` — variants sit beside it.
- Schema is **v32** on this branch. Injecting series rows is enough; no migration.
- Emulator is `emulator-5554`; ABI needs
  `ORG_GRADLE_PROJECT_jbAbiFilters=arm64-v8a,x86_64` for a native build, though
  this task should be JS-only.

## Answer

**Built and device-verified on `Pixel_7_Pro` (`emulator-5554`), 2026-08-01.** Lives in
`src/prototypes/` (see its `README.md`). JS-only — no rebuild was needed. tsc 0 errors,
eslint 0, jest 242/242.

### What exists

- **Two orthogonal knobs**, both `__DEV__`-only, in one floating panel: **Variant**
  (which browse implementation renders) and **Data** (`Real DB` / `Stress ×15` /
  `Calm ×3`). Independent on purpose — a layout that only works under stress is as wrong
  as one that only works when calm, and you cannot see that unless you can hold one knob
  still while turning the other.
- **Two variants** to make the switcher worth having: `Baseline` (the shipping Series
  view) and `Numbered` (baseline + cover number badges + the collapsed `#1, 3-4, 8`
  range). Adding a third for ticket 08 is: copy a file, add one row to `VARIANTS`,
  fast-refresh.
- **`Stress ×15`** covers every shape this ticket listed, plus three that ticket 03's
  research turned up as real. Verified on device, series by series:

  | Requirement | Series | Verified |
  | --- | --- | --- |
  | 20+ book series | Discworld, 22 books | `#1-22`, scrolls |
  | 1-book series | Bobiverse | `#1` |
  | 60+ char name | The Chronicles of Amber… (95 chars) | truncates with ellipsis, range + chevron hold position |
  | ~15 series at once | all 15 | `All (15)`, 93 slots |
  | all-unplayed / mixed / all-finished | Wheel of Time / Expanse / Foundation | tabs read `Unplayed 4 · Playing 8 · Finished 3` |
  | two series sharing books | Discworld / City Watch / Death (three) | same books, different numbers each |
  | gaps in canonical numbering | The Dresden Files | header `#1, 3-4, 8`, badges `1 3 4 8` |
  | *bonus* — decimal number | The Murderbot Diaries | `#1-4, 4.5, 5-8` |
  | *bonus* — numbering not starting at 1 | Mistborn: Era Two | `#4-7` |
  | *bonus* — no numbering at all | Rivers of London | no range rendered (abstention) |

- Search and tab filtering run over synthetic rows **through the real pipeline** — typing
  "Dresden" took `All` from 15 to 12 and recomputed every tab count. That is because the
  injection sits *above* the library screen's `filterSeriesBySearch` /
  `countSeriesByState` / tab filter, so none of them needed a branch.
- Both knobs **persist across a full app relaunch** (AsyncStorage), verified. Navigator
  work forces full reloads and losing your place mid-A/B is the exact friction this
  removes. A loud badge marks synthetic data so a persisted "on" cannot be mistaken for
  the real library.

### The two constraints that shaped it — read before editing

1. **Synthetic series may reference only REAL book ids.** `SeriesHome` passes a bare
   `bookId` to `BookGridItem`, which re-resolves it from `useLibraryStore`; an invented id
   renders as a size-accurate **blank** cell (`BookGridItem.tsx:265`). So a 22-book series
   over an 8-book emulator is built by **repeating** real books, never by cloning them
   with fake ids. Every cover, title, duration and progress ring therefore stays real and
   nothing is written to the library store. The repeats are why
   `variants/BaselineSeriesHome.tsx` is a *copy* — the shipping keyExtractor
   `${seriesId}-${bookId}` collides on a repeat. (The collapsed horizontal row needed no
   fix: `BooksHorizontal` passes no keyExtractor and FlashList falls back to the index,
   `RecyclerViewManager.js:270`.)
2. **Nothing is written to the database** — a deliberate deviation from this ticket's
   "injecting series rows is enough". Schema v32 has no column for a canonical published
   number and `DerivedSeries` has no field for one, so a DB-backed injector **could not
   express the Dresden-gaps dataset this ticket asked for** — it is precisely what ticket
   07 has yet to decide. In-memory rows sidestep the schema *and* make "clear synthetic
   series" a true restore rather than a best-effort cleanup. Verified: clearing returned
   the device to exactly its 3 real series.

### Other deviations, and why

- **`src/prototypes/`, not `src/components/__proto__/`.** `__proto__` is a hazardous path
  segment — the classic prototype-pollution footgun in any resolver that keys object maps
  by path segment. The ticket offered it as an example ("e.g."), so this costs nothing.
- **The switcher is a self-contained floating pill, not a settings row or a long-press on
  the `Layers` toggle.** The ticket asked for whichever is least invasive; both offered
  options require editing a shipping component, and a dev-only gesture on `Header.tsx`
  leaks dev concerns into a component every view renders. The pill lives entirely inside
  `src/prototypes/` and touches neither.
- **The repo's tsc/eslint-zero-errors line is held** even though this ticket waives
  quality bars. Breaking it costs every other session time; it was free here.

### Real-code footprint

Three sites, all in `src/app/(drawer)/(library)/index.tsx`, all commented `THROWAWAY`:
`useDerivedSeries()` → `useSeriesSource()`, `<SeriesHome>` → `<SeriesProtoSlot>`, and their
two imports. `src/components/SeriesHome.tsx` is **untouched**. In production `__DEV__` is
false, both resolve to the real thing, and no variant or panel module is reached; the one
cost is a single Zustand selector over a store that never changes. Deletion is
`rm -rf src/prototypes` plus reverting those three sites.

### Two findings worth carrying forward

- **`pidof` does not prove the app is foregrounded.** A stray back press dropped the app
  to the Android launcher while `pidof` still returned a pid, and the next scripted swipes
  scrolled the launcher. Use `adb shell dumpsys window | grep mCurrentFocus` instead —
  it names the focused activity unambiguously.
- **`console.table` does not forward to the Metro log.** It silently dropped the entire
  per-series legend from `Log dataset`, leaving only the summary line. Fixed with a
  formatted plain-text `console.log`.

### One correction made mid-verification

`collapseNumberRange` initially spelled two-long runs out (`#1, 3, 4, 8`) on the theory
that a two-item range reads worse. That contradicted ticket 03's recorded finding, which
fixes the canonical rendering of this exact case as `#1, 3-4, 8`. Changed to collapse
two-long runs, re-verified on device.

### Not done

`Numbered`'s badges appear only in the **expanded grid**, not on the collapsed horizontal
row — badging there would need a copy of `BooksHorizontal` too. The collapsed state
carries the range in its header instead, which is what ticket 03 found apps actually do.
If ticket 08 wants per-cover badges in the collapsed row, that copy is the work.
