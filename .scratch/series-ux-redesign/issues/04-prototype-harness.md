# 04 — Stand up the prototype harness

Type: task
Status: open
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

_(unresolved)_
