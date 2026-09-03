# 01 — Rename the shelf ordinal

**What to build:** Nothing a reader can see. This is the prefactor from the spec's D12:
the library screen's three-position ordinal is currently named after the control that
changes it rather than after the thing it selects. The next ticket introduces a second
value — the Books shelf's layout — and an ordinal named after a toggle sitting beside a
value named after a layout is exactly the confusion this repo's glossary opens by warning
about: a key is named after the question it answers.

After this ticket the library screen, its header, the ladder's view mapping and the test
helpers all speak of the **shelf**. The app behaves identically in every respect.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The three-position ordinal and its setter are named for the shelf, at every site: the
      library screen's state, the header component's props, the ladder view mapping's
      parameter, and the header stub in the library screen's rn suite.
- [x] The header still cycles three stops, in the same order, with the same icons. No
      behaviour changes.
- [x] `tsc` and eslint are clean, and the full suite is green — both lanes.
- [x] This lands as its own commit, before any layout work begins.
- [x] No `git commit --amend` at any point. This repo has had a commit silently swallowed
      by one.

## Comments

Resolved by the rename commit on `add-bookList-toggle`.

`toggleView` / `setToggleView` became `shelf` / `setShelf` at every site, and the
header's press handler `handleToggleView` became `cycleShelf` -- it names what a press
does rather than inheriting a name built from the value it changes. Six files: the
library screen, `Header.tsx`, `helpers/ladderView.ts`, `hooks/useScrollDirection.ts` and
the two rn suites whose comments and header stub name the prop.

`ladderView.ts`'s docblock opening line was reworded from "the view toggle's ORDINAL" to
"the SHELF's ordinal". That is the one edit in the change that is not a mechanical
substitution; it was verified as such by replaying the rename over `HEAD` and diffing,
which reports that line and nothing else. The ⚠ about the fourth ordinal is untouched and
still binding, as ADR 0006 requires.

Not renamed, deliberately: the historical design docs under `docs/superpowers/` and the
other `.scratch/` efforts that quote `toggleView`. They are records of what was true when
they were written.

Verification, cold cache per trap 10 in `docs/testing/jest-projects-and-rn-tests.md`:
`tsc --noEmit` 0 errors; `eslint .` 0 errors (36 pre-existing warnings, none in the
touched files); `jest --clearCache && jest` 102 suites / 1269 tests green across both
lanes, with `librarySearchAndSearchBar.rn.test.tsx` and `useScrollDirection.rn.test.tsx`
confirmed present in the `rn` lane's output rather than silently skipped.
