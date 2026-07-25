# Series Styling Pass — Design

**Date:** 2026-07-25
**Branch:** `feature/series-styling` (off `feature/series`)
**Status:** Approved, ready for planning

The Series feature is functionally complete and device-verified (see
`2026-07-24-series-feature-design.md`). This pass covers the remaining visual and
interaction polish, plus one layout bug and one missing validation rule.

The work lands on a separate branch so the new chrome can be A/B compared
against `feature/series` on-device before either is merged to `main`.

## Scope

1. Clipped collapsed-row bug (investigation-first)
2. "Create Series" moves from a sticky list-header button to a floating action button
3. "Edit series" moves from a full-width bar to an icon in the section header
4. Empty-state messages distinguish "no series exist" from "none on this tab"
5. Tab changes reset the list to the top, in all three library views
6. Row spacing on the select-books wizard screen
7. Next/Save buttons explain themselves on press instead of being dead
8. Duplicate series names are disallowed

---

## 1. Clipped collapsed row (bug)

### Symptoms

Collapsed `horizontalRow`s sometimes render at roughly a quarter height with
covers cropped, inconsistently — some series render fully while others clip on
the same screen, occasionally with a reserved empty gap below the clipped row.
It reproduces on the very first series created with no scrolling, so it is an
initial-layout failure, not only a recycling artifact.

### Correction to the previously planned fix

The earlier plan was "give the row an explicit fixed height so no runtime
measurement is needed." That is not available:

- `BooksHorizontal`'s container **already** has `height: 220`.
- FlashList v2's `overrideItemLayout` exposes **only** `span` — there is no
  `size` field (`node_modules/@shopify/flash-list/dist/FlashListProps.d.ts:198`).
  v2 always measures cells itself and cannot be told a height.

The only remaining lever is making the child's **first** layout deterministic.

### Approach: probe before fixing

Every change in this pass is JS-only, so a single build covers the probe and all
the styling work, and fix iteration runs over Metro reload.

Add a temporary `__DEV__`-gated `onLayout` to:

- `SeriesHome`'s `horizontalRowContainer` view
- `BooksHorizontal`'s `listContainer` view

Each logs its series id and measured height. Correlating a screenshot of a
visibly clipped row against the log separates the two possibilities:

- **Outer cell measured short** → FlashList masonry recorded a bad height.
- **Inner content rendered short** → a style/constraint problem inside the row.

The probes are removed before the branch is considered done.

### Two findings from reading the layout

**a. Height arithmetic is fragile — 2px of headroom. Robustness cleanup, NOT a
candidate root cause.**

`BookGridItem`'s row variant and `BooksHorizontal`'s container each hardcode
`220`, but the two numbers do not mean the same thing:

| Contributor | Value |
| --- | --- |
| `pressableContainer` `paddingTop` | 4 |
| `imageContainer` height (row) | 140 |
| `bookInfoContainer` height | 68 |
| **Visible content ends at** | **212** |
| `containerBase` height (row) | 220 — 12px of it empty |
| Pressable border box | 224 |
| `pressableContainer` `marginBottom` | 8 |
| **Layout advance** | **232** |

Against `listContainer`'s `height: 220` minus `contentContainerStyle`'s
`paddingBottom: 6`, the usable content height is **214**. So ~10px of the
Pressable is clipped — but all of it is the empty slack inside `containerBase`.
**Nothing visible is lost today; visible content ends at 212 against a 214 clip
line, leaving 2px of headroom.**

Two pixels is one font-scale bump away from cutting the duration row. Fix:
derive both heights from a single shared constant so the container height
follows the item height instead of coincidentally almost matching it.

This cannot explain a ~25% height loss and is **not** treated as a candidate
cause of the bug — it is fixed because it is fragile.

**b. `null` returned from a measured cell — the strong candidate.**
`BookGridItem.tsx:255` returns `null` when the store has not yet resolved the
book. A null child inside a cell FlashList is about to measure is a measurement
hazard, and it matches the symptoms: inconsistent across rows on one screen, and
visible on a freshly created series while the store re-emits.

Fix: render a fixed-size placeholder `View` with identical dimensions instead of
`null`, so a cell measures the same whether or not its data has landed.

### Blast radius: these are shared components

`BooksHorizontal` is imported by `BooksHome` and `SeriesHome`; `BookGridItem` by
those two plus `BooksGrid`. Both fixes therefore land on **all three library
views at once** — there is no separate follow-up needed for `BooksHome`.

The corollary is that this is a change to the shipped main library view, not a
series-only change. `BooksHome`'s horizontal rows must be checked during the A/B
alongside the Series view.

### Acceptance

Collapsed rows render at full height on first paint, on every series, with no
scrolling — verified on a freshly created series and after a cold start.

---

## 2. Create Series → floating action button

New component `src/components/CreateSeriesFab.tsx`.

- 56px circle, `themeColors.primary` fill, lucide `Plus` icon in
  `themeColors.background`.
- `PressableScale` from `pressto`, matching `BookGridItem`'s press feel.
- `accessibilityLabel="Create series"`.
- Positioned `right: 16`, `bottom: insets.bottom + 64` — clearing
  `FloatingPlayer`, whose top edge sits at `insets.bottom + 48` (it renders at
  `bottom: 10` with `marginBottom: insets.bottom - 12` and `height: 50`). The
  exact offset is tuned on-device.
- The offset is **static**: it does not track whether a mini player is loaded, so
  the button never moves under the user's thumb. Trade-off accepted — a slightly
  larger bottom gap when no track is loaded.

**Hide-on-scroll.** The FAB subscribes to the same `isVisible`
`SharedValue<number>` from `useScrollDirection` that already drives `SearchBar`,
animating opacity and translation via `useAnimatedStyle`. Both chrome elements
move as one, entirely on the UI thread, with no extra re-renders.

**Placement in the tree.** Rendered in `index.tsx` as a sibling of
`<FloatingPlayer />` at the screen root, *not* inside the
`overflow: 'hidden'` container that wraps the lists — that container would clip
the FAB's Android elevation shadow. Guarded by `toggleView === 1`.

`SeriesHome`'s `ListHeader` create button is removed; `ListHeaderSpacer` stays.

The FAB renders whenever `toggleView === 1`, **including when the series list is
empty** — the empty-state copy in §4 tells the user to tap it, so it must be
present with zero series.

---

## 3. Edit series → header icon

The `editBar` item type is deleted from `SeriesFlatItem`, `renderItem`,
`keyExtractor` and `getItemType`.

The section header becomes a row of two **sibling** pressables — a pencil button
and the existing header pressable at `flex: 1`. The icon is deliberately *not*
nested inside the header pressable, so the two touch targets never overlap.

The icon is visible in **both** collapsed and expanded states. This avoids the
title shifting horizontally when a section expands, and makes editing reachable
in one tap rather than two.

```
collapsed:   ✎  Dune Saga                 ›
expanded:    ✎  Dune Saga                 ⌄
```

Pencil is `themeColors.primary` at 18px with `hitSlop` for a comfortable target.

---

## 4. Empty-state messages

`SeriesHome` currently receives only `tabFilteredSeries`, so it cannot tell "you
have no series" from "this tab is empty". Today a single played series makes both
the Unplayed and Finished tabs claim no series have been set up.

The message is computed in `index.tsx` — which already holds `allSeries`,
`seriesSearchFiltered` and `selectedTab` — and passed down as one `emptyMessage`
string prop, keeping `SeriesHome` presentational.

Extracted as a pure `seriesEmptyMessage()` helper with Jest coverage. Evaluated
in order:

| Condition | Message |
| --- | --- |
| No series exist at all | `No series have been set up. Tap + to build a new one.` |
| Search active, nothing matches | `No series match your search.` |
| Unplayed tab | `No unplayed series.` |
| Started tab | `No series in progress.` |
| Finished tab | `No finished series.` |

The first message is reworded because the current copy says "Tap 'Create
Series'", which stops being true once that button becomes a FAB.

The All tab has no row of its own: with series present and no active search it
can never be empty, so one of the earlier conditions always catches it. The
helper still falls back to the "no series have been set up" message if it is
somehow reached, rather than rendering a blank list.

---

## 5. Scroll reset on tab change

Applies to all three library toggle views. The tab bar is one shared control, so
it behaving differently per view would be inconsistent.

Each view gains a `listRef` and an effect on `selectedTab` calling
`scrollToOffset({ offset: 0, animated: false })`, skipping the initial mount.
`BooksHome` already declares an unused `listRef`; `SeriesHome` and `BooksGrid`
need one added.

Scroll position is **not** reset when switching between Books / Series / Grid —
only on tab change.

**Risk:** `maintainVisibleContentPosition` is on by default in FlashList 2.3.2
and has caused anchor drift on this list before (see memory
`flashlist-2.3.2-mvcp-header-anchor`). The reset may need to be deferred a frame
after the data commit. Device-verify item.

---

## 6. Wizard row spacing

`books.tsx`'s `listContent` has no `gap`, so consecutive selected rows press
their 2px highlight borders together. `order.tsx` uses `Sortable.Grid
rowGap={8}`; `authors.tsx` uses `gap: 8`.

Add `gap: 8` to `books.tsx`'s `listContent` and rebalance the interleaved author
headings so the container gap does not stack on top of their own margins:

| Style | Before | After |
| --- | --- | --- |
| `listContent.gap` | — | `8` |
| `authorHeading.marginTop` | `14` | `6` |
| `authorHeading.marginBottom` | `6` | `0` |

Nets 8px between selection rows and ~14px above each author heading. All three
wizard screens end up consistent.

---

## 7. Buttons explain themselves

Greyed-out buttons that do nothing on press are replaced everywhere in the
feature. The inactive **styling** is unchanged — `themeColors.divider` background
with muted text — but `disabled` is dropped, and pressing an invalid button
raises an `Alert.alert` listing every unmet requirement, one per line.

`Alert.alert` is used rather than a custom popup because the codebase already
uses it in 16 places, including `series/edit/[id].tsx:150`.

| Screen | Button | Alert title | Rules |
| --- | --- | --- | --- |
| `authors.tsx` | Next | Can't continue | ≥1 author selected |
| `books.tsx` (create) | Next | Can't continue | name non-blank, name not duplicate, ≥1 book |
| `books.tsx` (edit) | Done | Can't continue | ≥1 book |
| `edit/[id].tsx` | Save | Can't save | name non-blank, name not duplicate (excluding self) |

Messages:

- `Select at least one author.`
- `Enter a series name.`
- `Select at least one book.`
- `A series named "<name>" already exists. Choose a different name.`

`submitting` remains a genuine `disabled` on the edit and order screens — that is
a real no-press state, not a validation failure.

---

## 8. Duplicate series names

### Matching rule

Case-insensitive and whitespace-trimmed — that is, `sortName` equality.
"Dune Saga", "dune saga" and " Dune Saga " all collide.

`normalizeSortName` already exists (`seriesQueries.ts:12`) and is persisted to
the `sort_name` column on both create and update, so the UI check and the stored
data cannot disagree. No new column and no new normalization rule.

### New pure helper

`src/helpers/seriesName.ts`:

- `normalizeSortName(name)` — **moved** here from `db/seriesQueries.ts`, which
  imports `database`; a pure validation helper importing that would drag
  WatermelonDB into Jest. `seriesQueries` re-exports it so no other call site
  changes.
- `isDuplicateSeriesName(name, series, excludeId?)`.

Jest coverage: exact match, case differences, surrounding whitespace, blank name,
and self-exclusion on rename.

### Enforcement

Live per keystroke — `name` is draft-store state, so the button goes inactive the
moment a collision is typed, with no extra wiring.

- `books.tsx` create mode — folded into the Next button's rules (§7).
- `edit/[id].tsx` — folded into the Save button's rules (§7), excluding the
  series being renamed.
- `books.tsx` edit mode shows no name input, so no check applies.

### Query-layer guard

`createSeries` and `updateSeries` reject a colliding `sortName` by throwing a
typed `SeriesNameConflictError`.

The wizard collects the name on the books screen but does not write until
"Create Series" two screens later, so the UI check alone sits far upstream of the
write. `order.tsx` catches the typed error and surfaces the same alert, replacing
the current `console.error` plus silently re-enabled button — otherwise a
rejected write looks like a dead button.

---

## Testing

**Jest** — pure logic only:

- `seriesEmptyMessage()` — each branch in §4's table.
- `isDuplicateSeriesName()` — cases listed in §8.
- Existing 172 tests must stay green.

**Device verification** — everything visual:

- Collapsed rows full height on first paint, freshly created series and cold start.
- `BooksHome` and `BooksGrid` horizontal rows unchanged in appearance after the
  shared-constant refactor (§1a touches components all three views use).
- FAB clears the mini player, hides and shows with the search bar, opens the wizard.
- Edit icon opens the right series; header and icon taps never cross-fire.
- Each empty-state message appears in its own condition.
- Tab change resets scroll in all three views with no MVCP flash.
- Selection rows visibly separated on the books screen.
- Each invalid button press raises the correct alert.
- Duplicate name blocks Next and Save; renaming a series to its own name still saves.

**A/B** — compare against `feature/series` on-device before merging either.

## Out of scope

- Merging to `main` — both branches stay open until the A/B decision.
- Single-open section behavior (see `flashlist-2.3.2-mvcp-header-anchor`).
- Any change to how series membership or progress is derived.
