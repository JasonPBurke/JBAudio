# 03 — Remember the layout choice

**What to build:** The layout a reader picks is theirs from then on. It survives navigating
away, backgrounding the app, and the app being killed from recents. A reader who has never
touched the control sees the cover grid, exactly as they did before the feature existed —
an update must never rearrange someone's shelf without their asking.

Read the spec's D4 and D5 before starting. D4 carries three traps that have each already
cost this repo something.

**Blocked by:** 02 — The layout toggle switches the Books shelf.

**Status:** ready-for-agent

- [ ] A new settings column answers the question *which layout?* — a string, with the two
      values the shelf has. Schema goes to v36.
- [ ] The column is optional. Column additions cannot backfill, so every existing row lands
      the null value regardless of any default declared on the migration step. That step's
      default is **inert**, and the step is annotated saying so — this file already carries
      corrections against two earlier steps for exactly this, and a fourth misleading
      comment must not be added to it.
- [ ] A resolver owns the default: the list layout only on an exact match, the grid layout
      for null, empty string, and anything unrecognised. It is pure, lives where the fast
      test lane can reach it without a database or React, and is pinned there for all five
      cases.
- [ ] Nothing reads the column raw. Every read goes through the resolver, following the
      precedent already set by the sleep timer's mode column.
- [ ] The settings store gains the field, seeded to the grid layout, and its setter, in the
      store's existing optimistic-set-then-persist shape.
- [ ] The settings-queries mock in the store's own suite gains the new getter. That mock is
      an explicit object with no automatic fallback, and initialisation calls every getter
      inside one combined promise — omitting it calls an undefined value and takes every
      test in that file down at once. This is part of the change, not tidying.
- [ ] The store suite asserts that the grid layout is read before initialisation resolves,
      following the precedent set for the series-backgrounds default.
- [ ] The library screen reads the layout from the store instead of from screen state.
- [ ] Do **not** add a gate against a hydration flash. Settings hydrate during launch and the
      shelf always starts on the sectioned home, so the Books shelf cannot be on screen
      before hydration resolves. The seeded value is never rendered.
- [ ] Number of Columns is untouched — not hidden, disabled, relabelled, or cross-wired. It
      keeps driving the grid and the sectioned home's rows.
- [ ] There is no second entry point. The layout does not appear in Settings.
- [ ] `tsc` and eslint clean, both lanes green.
