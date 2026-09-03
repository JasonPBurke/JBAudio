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

**Status:** ready-for-agent

- [ ] The three-position ordinal and its setter are named for the shelf, at every site: the
      library screen's state, the header component's props, the ladder view mapping's
      parameter, and the header stub in the library screen's rn suite.
- [ ] The header still cycles three stops, in the same order, with the same icons. No
      behaviour changes.
- [ ] `tsc` and eslint are clean, and the full suite is green — both lanes.
- [ ] This lands as its own commit, before any layout work begins.
- [ ] No `git commit --amend` at any point. This repo has had a commit silently swallowed
      by one.
