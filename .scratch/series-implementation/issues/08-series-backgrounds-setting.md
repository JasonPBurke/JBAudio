# 08 — `Series Backgrounds` in `Appearance`

**Blocked by:** [01](01-schema-v33.md).

**Status:** resolved

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

## Answer

Shipped as specified. Four files: the getter + setter in `src/db/settingsQueries.ts`, the
cached copy in `src/store/settingsStore.ts`, the row in `src/app/(settings)/general.tsx`,
and a new `src/db/__tests__/seriesBackgroundsSetting.test.ts`.

`tsc` 0 errors · eslint 0 errors (one pre-existing `exhaustive-deps` warning on the
untouched `autoAccent` effect, present at HEAD) · jest **413/413 green across 38 suites**.

### The null is real, and now measured rather than asserted

K1 claims every optional setting is `null` on a fresh install because the seeder writes
only three fields. That was taken on trust everywhere it appears. It is now **observed**: a
real WatermelonDB built on schema v33 (LokiJS adapter, in jest), with a settings record
created exactly the way `ensureSettingsRecord` creates it, reads
`seriesBackgroundsEnabled === null`. The ruling that killed the migration backfill rests on
a fact that has been executed, not just reasoned about.

### The store default is a SECOND instance of the same trap

Not in the ticket, found while wiring it. The DB getter is only half the default: anything
reading `useSettingsStore` **before `initializeSettings` resolves** sees the store's own
seed value. Seeding it `false` — the value every other boolean in that store uses — renders
the switch OFF and pops the backdrop in a frame later, for a user who never turned it off.
Identical silent failure, one layer up, and invisible to a test that only covers the query.

Both the DB path and the store seed are now tested. `settingsStore.test.ts` asserts on
`getInitialState()`, so the assertion is about the seed itself and cannot be fooled by test
ordering.

### The tests are proven to have teeth

The four getter cases pass, but passing is not evidence — an unconditional `return true`
passes three of them. Two independent checks:

1. **The `false` case** discriminates against `return true` (the setting must be
   turn-off-able).
2. **A mutation check**: the getter was temporarily rewritten to the house idiom
   (`=== true`, fallback `false`) — the exact K1 bug — and the null and no-record tests
   both failed, then passed again on restore. The test that exists to catch this bug has
   been shown to catch this bug.

### Device-pending

One acceptance criterion is not closeable from jest: *"the preference survives an app
restart and reads ON for a tester whose row predates the column."* The logic behind it is
covered (the pre-existing row **is** the null path), and the write rides the shipped
`updateSetting` idiom — but persistence-across-restart and the real upgraded row are device
claims. Per [[native-changes-need-native-rebuild]] the schema is JS, so a Metro reload runs
the real migration; no native rebuild needed to check it.

### For 07, which has the same trap

**G1a means the inverted getter is needed at TWO sites, not one.**
`series_detection_enabled` is the second default-ON boolean and is **not** touched here —
it belongs to 07's `Series Detection` card. Copying `getSeriesBackgroundsEnabled` verbatim
is the right move; copying the house `=== true` idiom next to it ships an empty Series tab
that reads as a broken feature. `series_folder_grouping_enabled` is default-OFF and takes
the ordinary idiom.

### Test infrastructure, for whoever picks up the next ticket

- **A fresh worktree has no `node_modules`.** Symlink the parent repo's or jest crawls for
  minutes per run instead of ~1s. This is not a jest misconfiguration.
- **Do not boot WatermelonDB's LokiJS adapter in a committed test.** It works and it is
  fast (0.53s, real decorators, real queries), but it leaves something alive that stops
  jest exiting — the suite hangs until killed, and `--detectOpenHandles` hangs with it. It
  was used as a throwaway probe to establish the null above, then removed. The committed
  test fakes the `@/db` boundary instead.
- `settingsQueries.ts` imports RNFS at module scope; it ships untransformed ESM, so any
  test importing that module must mock `@dr.pogodin/react-native-fs`.

### Not done, deliberately

- **No test for the setter.** It is a one-line `updateSetting` call on an idiom already
  exercised by every other setting; the spec singles out the getter, and testing the write
  through the fake would test the fake.
- **Nothing renders the preference yet** — 10 and 11 are its consumers, as the ticket says.
