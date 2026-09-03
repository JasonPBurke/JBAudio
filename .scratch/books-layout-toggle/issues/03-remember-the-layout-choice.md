# 03 — Remember the layout choice

**What to build:** The layout a reader picks is theirs from then on. It survives navigating
away, backgrounding the app, and the app being killed from recents. A reader who has never
touched the control sees the cover grid, exactly as they did before the feature existed —
an update must never rearrange someone's shelf without their asking.

Read the spec's D4 and D5 before starting. D4 carries three traps that have each already
cost this repo something.

**Blocked by:** 02 — The layout toggle switches the Books shelf.

**Status:** resolved

- [x] A new settings column answers the question *which layout?* — a string, with the two
      values the shelf has. Schema goes to v36.
- [x] The column is optional. Column additions cannot backfill, so every existing row lands
      the null value regardless of any default declared on the migration step. That step's
      default is **inert**, and the step is annotated saying so — this file already carries
      corrections against two earlier steps for exactly this, and a fourth misleading
      comment must not be added to it.
- [x] A resolver owns the default: the list layout only on an exact match, the grid layout
      for null, empty string, and anything unrecognised. It is pure, lives where the fast
      test lane can reach it without a database or React, and is pinned there for all five
      cases.
- [x] Nothing reads the column raw. Every read goes through the resolver, following the
      precedent already set by the sleep timer's mode column.
- [x] The settings store gains the field, seeded to the grid layout, and its setter, in the
      store's existing optimistic-set-then-persist shape.
- [x] The settings-queries mock in the store's own suite gains the new getter. That mock is
      an explicit object with no automatic fallback, and initialisation calls every getter
      inside one combined promise — omitting it calls an undefined value and takes every
      test in that file down at once. This is part of the change, not tidying.
- [x] The store suite asserts that the grid layout is read before initialisation resolves,
      following the precedent set for the series-backgrounds default.
- [x] The library screen reads the layout from the store instead of from screen state.
- [x] Do **not** add a gate against a hydration flash. Settings hydrate during launch and the
      shelf always starts on the sectioned home, so the Books shelf cannot be on screen
      before hydration resolves. The seeded value is never rendered.
- [x] Number of Columns is untouched — not hidden, disabled, relabelled, or cross-wired. It
      keeps driving the grid and the sectioned home's rows.
- [x] There is no second entry point. The layout does not appear in Settings.
- [x] `tsc` and eslint clean, both lanes green.

## Comments

Resolved on `add-bookList-toggle`. `tsc` 0 errors; `eslint` 0 errors on every touched file;
`jest` **103 suites / 1286 tests** green across both lanes, up from the 1276 ticket 02 left
(+5 resolver, +3 store, +2 screen).

**Schema v36 adds one column, `settings.books_layout`,** a nullable string. The migration
step declares NO `defaultValue` and says why: `addColumns` destructures only
`{ table, columns, unsafeSql }`, so one would be silently dropped and every existing row
would take `nullValue()` regardless. The two corrections this file already carries are both
in the **v3** entry at the bottom, one per `addColumns` call -- not v34/v35, which state the
"cannot backfill" rule without being wrong about a default. No fourth misleading comment was
added, and no SQL backfill: null already means what it needs to mean.

**`helpers/resolveBooksLayout.ts` owns the default** and is the only reader of the column.
`getBooksLayout` routes both the null column AND the no-record case through it, so "what
does a reader who has never chosen see" has exactly one answer. Five cases pinned in the
fast lane, no database, no React: null, `''`, an unrecognised string, exact `list`, exact
`grid` -- everything but an exact `list` is the grid.

**The store gained the field seeded `grid`, and its setter,** in the existing
optimistic-set-then-persist shape. The settings-queries mock gained `getBooksLayout` and
`setBooksLayout`; without the getter, `initializeSettings` calls `undefined()` inside its
single `Promise.all` and every test in that file fails at once. Three assertions: the grid
is read before initialisation resolves (the series-backgrounds precedent), the stored value
wins once settings load, and the setter sets before it persists.

**No hydration gate**, as D4 requires. The seed and the resolver's default agree, so there
is nothing for a gate to hide even if the Books shelf could be on screen that early -- and
it cannot, because the shelf starts at the sectioned home.

**The screen reads the store instead of `useState`.** Two new screen assertions, both at the
existing seam: a store already holding `list` mounts `BooksList` with no flip, and a flip
survives an unmount and remount -- which is the half screen-local state cannot do.

⚠ **`screen.unmount()` returns a promise in RNTL 14** and must be awaited. Dropping the
await does not fail in the test that dropped it; it interleaves act scopes and the NEXT test
in the file reads its captured props as `null`, which looks like a broken mock. This suite's
own header comment names that failure mode for `render`/`fireEvent`; `unmount` is on the same
list. Cost one debugging pass here.

Number of Columns is untouched, and the layout has no Settings entry point. Ticket 04's
device pass is unaffected by any of this: the transient four-icon lucide shim is still on the
branch and still must not ship.
