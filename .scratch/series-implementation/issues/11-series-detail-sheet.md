# 11 — The series detail sheet

**Blocked by:** [01](01-schema-v33.md), [10](10-browse-row.md).

**Status:** resolved — device-verified 2026-08-10, including the re-check of §C5's re-ruling
(a flat flag check that also flips the book back to `Started`). Only §C8 is unverifiable, and
it is blocked on ticket 15.

⚠ **A follow-up defect was found and fixed the same day, after this ticket was committed
(`6c3dbbd`): on a series long enough to overflow the sheet, scrolling back UP dismissed the
sheet instead of scrolling.** The layout changed to pay for it — the hero is now pinned. See
`## Follow-up defect` at the bottom. Driver hand-checks are still outstanding.

**Spec:** [§C](../../series-ux-redesign/spec.md), §J, §K5, §K11, §Out of Scope.

## What to build

Tapping a series row's text opens the series as a **bottom sheet** — a detail view of the
row you tapped, not a departure from the library. It lists every book in order; **tapping a
cover plays it, tapping the text opens that book's details.**

Closes user stories 31–39, and pays a carried commitment (see below).

## Presentation

- **C1 — a `formSheet`**, matching the book details screen — the app's existing
  detail-screen-for-an-object — with the same overflow-top-inset and corner radius. The
  wizard's opaque-push ruling explicitly does **not** transfer: the wizard is a task flow,
  this is a container.
- **C2 — a root-sibling route, not a member of the series group.** This is **forced, not
  chosen**: a screen inside the group cannot be a root-level sheet. It also makes the
  editor's `Save`/`Cancel` exits correct by construction.
- **C3 — the header is a grab handle only.** No nav row, no back chevron, no ⋮. A back
  chevron on a bottom sheet is a mixed metaphor — the sheet dismisses downward, the arrow
  points left. The handle is itself pressable and dismisses.

## The rows split, and that is what the prototype bought

**C4 — the cover plays, the text opens the book's details.** The play target is the whole
leading half (number plus the full height of the artwork), so the glyph **advertises the
target without being it**. This restores the app-wide rule that a book card is tappable to
its details — this screen was the only place that broke it — and it is the arrangement the
library grid already uses.

**Sheet-over-sheet is measured clean in both directions**, twice, from each end. That
measurement is what licenses this split.

## Acceptance criteria

- [x] The sheet presents from the browse row's text, as a root-sibling `formSheet` with a
      grab-handle-only header.
- [x] Rows split: cover plays, text opens book details.
- [x] **Presenting the book details sheet from a series row requires setting the app's
      existing navigation intent flag**, or that screen dismisses itself on mount.
- [x] **C5 — a finished row restarts from zero.** Landing thirty seconds from the end of a
      finished book is a poor outcome whether or not there is an escape hatch, and the
      finished check mark is already the "you've read this" signal, so the tap has nothing
      to disambiguate.
- [x] **Fix it in the shared play helper, not at this call site.** The helper has **no
      `Finished` case**, so a finished book resumes at its last few seconds *everywhere
      else in the app*. This was recorded as an accepted inconsistency and that is
      **reversed** — the argument is no longer "this screen is special", it is "this is the
      better behaviour", which applies everywhere. Fixing the helper pays the library grid
      for free.
- [x] **C6 — the active book reuses the grid's treatment**: animated bars while playing,
      the same title colour. Reused, not reinvented.
- [x] **C7 — the hero is the browse backdrop and honours `Series Backgrounds`.** Both states
      were already designed (ON = the browse treatment, OFF = a flat hero), so this is a
      conditional, not a design. **It needs a bottom fade** — without one, the backdrop's
      lower edge is a hard seam across the middle of the sheet.
- [x] **C8 — pinned art rides the fan's front card**, replacing card 0 rather than
      prepending, so the cluster's width and peek stay constant. The backdrop follows it.
- [x] **C9 carried from the browse work unchanged:** the fanned cluster · the name, capped
      with tap-to-expand and no label, with overflow **measured** rather than inferred
      (K14) · the meta line with the canonical range · the completion bar · a
      `Start`/`Continue`/`Restart` button that **keeps its word here**, because a
      full-width hero button does not have the browse row's width constraint · one row per
      book showing `#canonical` or a blank.
- [x] **C10 — one route to the editor: a wrench row reading `Edit series`**, under the play
      button. No ⋮ — a menu holding a single item that duplicates a visible row two inches
      below it is not worth its pixels.
- [x] **H6 — the finished check mark travels with the title.** It is an *indicator*, not a
      target, so the row's text shrinks rather than filling — closing a measured **416dp**
      gulf between a title and its tick.
- [x] **H2 — the 600dp content cap is NOT applied here.** It was built on this page and
      reverted on sight.
- [x] **K5 — the route gets a themed background.** Routes copying the book-details screen's
      options inherit **no background colour**, so any state where the route renders nothing
      is a **full-screen white sheet** on a dark-theme app. This is not hypothetical — it
      was reproduced.
- [x] **K11 — a book cell can only render a book that is in the library store.** An
      unresolvable id renders a size-accurate **blank**. Resolve from the store, or render
      from the book objects the assembled series already carries.
- [x] Device-verified in both themes, both backdrop states, at font scale 2.0.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Answer

**Built on `feature/series-styling`, no worktree.** `tsc` 0 errors · eslint **0 errors**, 35
warnings (baseline; **none in any file this ticket added or touched**) · jest **47 suites /
563 tests** green, up from 46/542.

### Files

**New:** `src/components/SeriesDetailSheet.tsx` (the screen), `src/helpers/seriesDetailFacts.ts`
(rows · pinned-art cluster · the hero button's word — pure), `src/components/SeriesCompletionBar.tsx`
(extracted from the browse row so §C9's "reused, not reinvented" is literal), plus tests for
the two pure modules.

**Changed:** `src/app/seriesDetail.tsx` (was ticket 13's throwaway route, now the real one),
`src/app/_layout.tsx` (K5's `contentStyle`), `src/helpers/handleBookPlay.ts`,
`src/components/SeriesBrowseRow.tsx` (its local rewind deleted),
`src/helpers/seriesRowGeometry.ts` (`heroClusterSize`, `fitInBox`),
`src/helpers/seriesAssembly.ts` + `src/db/seriesQueries.ts` (`series.artwork` read path),
`src/components/SeriesCoverCluster.tsx` (`onPlay` optional), `src/prototypes/README.md`.

### The §C5 ruling — DRIVER, 2026-08-10, after the device run

**Shipped: a flat flag check that ALSO flips the book back to `Started`.** `spec.md` §C5 is
amended in place with the full reasoning; the short version is that **the flip is what makes
the flat rule safe**. Nothing else in the app ever moves a book off `Finished`, so a rule
that reads the flag without consuming it fires again on every later press — restart, listen
ten minutes, pause, press play from any card, ten minutes gone, and from the library grid and
Android Auto as well as here. Flipping the flag makes the restart a once-per-listen event by
construction.

Three accepted consequences: the ✓ (and the series' completion count, `Series complete` line
and `finished` tab state) clears the moment you press play; `finished_at` is nulled; and a
lie that predates this effort is fixed, since `computeBookProgress` short-circuits `Finished`
to 100% / `0m` and so rendered a full capsule for a whole re-listen.

**A positional variant was built first, PASSED on device, and was withdrawn.** It restarted
only when resuming would land in the last 30 seconds, leaving the flag alone. Once the flag
is consumed that test has exactly one job left — stopping a **hand-marked** book from
restarting — and that is the wrong answer. `restartFromZero.ts` and its 13 tests are deleted;
the rule is one line in `handleBookPlay`. **jest is therefore 47 suites / 563 tests, down from
48/576 — that drop is the withdrawal, not a regression.**

✅ **RE-VERIFIED ON DEVICE, same session, all four:** the restart starts at 0:00; the book
leaves the `Finished` tab for `Playing`; the ✓ goes, `1 finished` drops from the meta line and
the bar falls `1/5` → `0/5`; the duration row switches from a full capsule to `X left`; and
**pausing then pressing play from a card RESUMES** rather than restarting — the case a flat
rule without the flag flip gets wrong.

⚠ **The flip only happens through `handleBookPlay`.** Resuming from the player screen, the
floating player, the notification or Android Auto's transport controls never routes through
it — those talk to TrackPlayer directly. That is correct (they resume the loaded book) but it
is the one place the behaviours differ.

### Traps paid for here

- ⚠ **`src/app/seriesDetail.tsx` IS NO LONGER THROWAWAY.** Ticket 18's deletion command
  would have deleted the shipping detail sheet. `src/prototypes/README.md` is corrected: the
  route and its `<Stack.Screen>` **stay**, and its only harness footprint is the same
  `useDerivedSeries()` → `useSeriesSource()` substitution the library screen carries. Keeping
  that substitution is deliberate — **a synthetic series now opens the REAL sheet**, which is
  the fastest way to put the 95-character name, the 22-book list and the Dresden gaps in
  front of this screen at font scale 2.0.
- **`ProtoSeriesDetailSheet.tsx` is now dead code** (nothing imports it) and two harness knobs
  are inert: `Rows` (the split is the only arrangement now) and `Pinned` (`series.artwork` is
  a real column, and the knob lived in `protoStore`).
- **`series.artwork` had no read path at all.** The column exists on the model from v33 but
  `SeriesRow`/`DerivedSeries` never carried it and `observeSeriesData` never observed it — so
  §C8 was unreachable, and a pin from ticket 15's editor would not have re-emitted. Both fixed.
- **`heroClusterSize` had to move into production geometry**, not be re-typed as a literal:
  mutation-tested, a literal `104` fails at 800dp because the browse fan reaches 147dp and
  the *overview's* artwork ends up larger than the *detail's* (§H4's named inversion).
- ⚠ **`src/db/seriesQueries.ts` reads as BINARY to `grep`** — it needs `grep -a` or it is
  silently skipped with exit 0. Cost a wrong "the function does not exist" conclusion here.
- **The pure modules are mutation-proven**: a prepended pinned cover fails 1 test, a literal
  hero cluster fails 1. (The restart rule's 3 mutation tests died with the positional variant
  — see `## The §C5 ruling`.)

### The device run — 2026-08-10, all five open criteria closed in one session

Physical Pixel 7 Pro, real library. Record: `.scratch/series-implementation/DEVICE-CHECK-11.md`;
11 screenshots + the raw log in `device-check/tk11-*`. Nine criteria were closed by the agent
over adb (presentation, the split, the nav-intent flag, the sheet-over-sheet round trip, §C6's
active treatment, the button's word, the wrench row, and the font-scale-2.0 layout); the driver
closed the remaining five, **all PASS** — including §C5 restarting at 00:00 after a real
end-of-book finish, and §H6's tick parking behind the second line of a two-line title.

⚠ **The baseline moved: `354 units → 24 series, 202 books`**, not the 351/23/200 reproduced
four times in 04/06/07/09. The library grew by 3 files. **Do not read the old figure as an
expectation.** Cold scan 194,121ms / 3,464 files; detect 274ms.

The dev build was not installed on the device, so it was reinstalled from
`android/app/build/outputs/apk/debug/app-debug.apk`; ticket 11 is all JS, so Metro was enough.

### Not done

**§C8 cannot be device-verified until ticket 15.** Its read path is built and mutation-proven,
but nothing writes `series.artwork` yet, so there is no way to pin a cover on device.

**§C5 is under review** — see the status line at the top of this ticket.

## Follow-up defect — the sheet closed instead of scrolling back up

**Raised by the driver 2026-08-10, after `6c3dbbd` was committed.** On `Discworld` (41 books,
the list overflows), scrolling DOWN worked; swiping back UP **dismissed the sheet**. Driver's
lead — *"this was an issue on the titleDetails page that was fixed"* — was correct and is what
cracked it.

### Root cause

Android's `formSheet` is a Material **`BottomSheetDialog`** — react-native-screens'
`ScreenModalFragment` is a `BottomSheetDialogFragment`, and the screen is re-parented into that
dialog's **own Window** under a `BottomSheetDialogRootView`. rnscreens does **no** scroll
coordination of its own (grep its Android sources: nothing touches nested scrolling), so
`BottomSheetBehavior` arbitrates the drag off the `CoordinatorLayout`. With React Native's
plain scroll view it won the downward drag and dismissed the sheet.

**The differentiator was the scroll container, and nothing else.** The two routes' `Stack.Screen`
options are identical apart from `contentStyle`'s background — verified line by line. The app's
ONLY gesture-handler scroll container was `titleDetails` (`8201d3f`), the app's ONLY formSheet
that scrolled correctly.

### The rule that decides the layout

⚠ **A gesture-handler scroll view swallows EVERY vertical drag whenever it has ANY scrollable
content — direction is not consulted.** Proven both ways on device:

- `titleDetails` with content that FITS → swipe-down dismissed the sheet (handler never
  activates).
- `titleDetails` with content that OVERFLOWS (Bobiverse 01) → swipe-down scrolled back up,
  sheet survived. Same as this screen once fixed.

**So drag-to-dismiss and a full-bleed scrolling list cannot coexist.** Fixing the scroll alone
cost drag-to-dismiss everywhere the list covered — measured, not assumed: at scroll offset 0 a
downward drag moved nothing.

### What shipped — BOTH halves are required

1. **`renderScrollComponent={GestureScrollView}`** on the `FlashList`. FlashList's supported
   seam; `useSecondaryProps` wraps whatever it is given in `Animated.createAnimatedComponent`.
   This is the fix.
2. **The hero is PINNED, out of `ListHeaderComponent`, and the list carries side gutters.** These
   are the drag targets that buy back dismissal. Driver's call, and it is `titleDetails`' shape —
   *"that is how we do it in titleDetails… titleDetails has the gutters as well"*.

⚠ **`row` lost its `paddingHorizontal`; `listGutter` gained the same 12dp `marginHorizontal`.**
Net zero visual change — rows render on the same x — but the strip is now outside the scroll
view, so it drags the sheet. **Putting the padding back on `row` silently re-closes the gutters
and costs drag-to-dismiss.**

**§C7 survives.** The concession to break it was offered and NOT needed: pinning the hero puts
it *outside* the inset, so its backdrop still bleeds the full width. Only the rows are inset.

### Verified on device — Pixel 7 Pro, Discworld, 2026-08-10

Scripted over adb, each an A/B against the same swipe coordinates:

| | Result |
| --- | --- |
| Scroll down | ✅ list scrolls, **hero stays pinned** |
| **Scroll back up** | ✅ **scrolls — the defect, fixed** (was: dismissed) |
| Drag on the pinned hero | ✅ dismisses |
| Drag in the LEFT gutter | ✅ dismisses |
| Drag in the RIGHT gutter | ✅ dismisses |
| Drag on the grab handle | ✅ dismisses |
| Tap a row's text | ✅ opens book details, nav-intent flag holds |

`tsc` 0 errors · eslint 0 errors on the changed file · jest **47 suites / 563 tests**, unchanged.

⚠ **Not covered by a jest test, deliberately and unavoidably**: the whole defect lives in native
gesture arbitration between a Material behaviour and a gesture-handler view, in a separate
Window. There is no seam jest can reach — the reproduction IS the adb script above. Treat the
device table as the regression suite.

### Font scale 2.0 — DRIVER, PASS

The pinned hero is a fixed vertical cost, so 2.0 was the one layout that could regress. Driver,
verbatim: *"both gutters and the header work as expected at 2.0 so does the list scrolling"* —
i.e. the two 12dp strips stay hittable and the list still scrolls with the hero eating far more
of the sheet. **No detent or `maxHeight` tuning needed.**

### Still to hand-check

The cover-tap play path was left to the driver rather than mutate a real library mid-session.
It is unchanged **by construction** — the 12dp that moved was dead padding *inside* `row`, so
`rowLeading` occupies identical pixels — and the text half of the same split was verified, but
it has not been pressed.

## Dropped, not deferred

**C11 — the series description does not ship.** It was the only item that added a *feature*
rather than deciding a presentation, and it dragged a column, a provenance companion and an
editor field behind it.
