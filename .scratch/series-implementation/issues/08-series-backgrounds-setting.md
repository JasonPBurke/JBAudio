# 08 — `Series Backgrounds` in `Appearance`

**Blocked by:** [01](01-schema-v33.md).

**Status:** ready-for-agent

**Spec:** [§B9, B10](../../series-ux-redesign/spec.md), §K1, §K2.

## What to build

A user who finds cover backdrops busy can turn them off, and a user who has never seen the
richer version gets it by default. One global preference, living in
`Appearance → Display Settings` beside `Number of Columns`.

Nothing renders it yet — [10](10-browse-row.md) and [11](11-series-detail-sheet.md) are its
consumers. It ships separately because the getter underneath it is, in the spec's own
words, **the highest-value single test in this effort**, and it deserves to fail on its
own rather than inside a 14-variant row component.

Closes user stories 29–30.

## The trap this ticket exists to survive

**K1 — settings in this app ARE schema.** Each preference is a column on a **single-row**
table, and the Zustand store is only a cache in front of the DB queries. **Every existing
boolean getter reads `=== true` with a `false` fallback**, which hard-codes default-OFF into
*both* the null case and the no-record case.

`Series Backgrounds` is the table's **first default-ON boolean**, so copy-pasting that
idiom ships every existing tester the opposite of the chosen default, **silently**.

**It must read `!== false`, with `true` as the fallback.**

A migration backfill was considered — with a migration available to ride — and **dies on a
fact**: the settings-record seeder only seeds three fields, so **every optional setting is
`null` on a FRESH install too.** The null is not a migration artifact, it is the app's
universal state for optional settings. A backfill fixes only existing installs; fixing
fresh ones needs the default at two more creation sites, one of which guards a "required
non-nullable defaults" invariant an optional column would break. **The inverted getter
handles both paths in one expression at one site.**

## Acceptance criteria

- [ ] The toggle lives in `Appearance → Display Settings`, beside `Number of Columns`.
- [ ] Label, description and info copy ship **exactly** as ticket 12 wrote them.
- [ ] **Default ON, global, not Pro-gated.**
- [ ] The getter reads `!== false` with `true` as the fallback, and **is unit-tested on both
      the null path and the no-record path**. This is the test the spec singles out, because
      getting it wrong is silent.
- [ ] The preference survives an app restart and reads ON for a tester whose row predates
      the column.
- [ ] Uses the shipped `description` + `onInfoPress` props (K2) rather than a new row shape.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Rulings that close obvious alternatives

- **Default-ON is decided on which dissatisfied user can rescue themselves.** A user
  irritated by the backdrop goes hunting in settings; a user seeing the quiet row never
  learns the richer one exists.
- **Global and not-gated are entailments, not choices.** The settings table is a single
  row, so per-library is inexpressible; and gating a default-ON setting charges users to
  turn something *off*.
- **Naming constraint worth keeping:** the cover cluster shows in **both** states, so any
  label reading "show cover art" names something the toggle does not control.
- **A control on the browse screen itself was rejected as unprecedented** —
  `Number of Columns` has no on-screen control anywhere in the app.

## The commitment this creates

**Every future change to the Series row must work in both states.** Any later variant that
only reads well over a backdrop is ruled out by this decision.
