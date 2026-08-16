# 31 — Separate the series identity key from display order

**Status:** resolved — 2026-08-16, jest 787 -> 791. Scope extended mid-flight to rename the
column as well; see `## Comments`.

**Blocked by:** None — can start immediately.

**Raised by:** the driver, 2026-08-16, during a grilling session on series card sorting.
**Blocks:** ticket 32, which cannot be stated correctly until the two keys are nameably
different.

## What to build

Nothing the user can see. This is a prefactor: it renames the thing that answers *"are these
the same series?"* so that it stops looking like the thing that answers *"what order do series
display in?"* — and pins the behaviour that ticket 32 must not break.

`normalizeSortName` is the app's **series identity key**. Its own docblock says so (A15:
_"two names denote the same series iff their comparison keys agree"_). It backs duplicate-name
validation, reconcile's name matching and the suppression table, and it is persisted as the
indexed `sort_name` column.

**No SQL query orders by it** — every SQL use of `sort_name` is an equality lookup. But the
column's VALUE is nonetheless the live sort key: the one place series are ordered is a JS
`localeCompare` in `assembleDerivedSeries`, which borrows the identity key because it happened
to be lying around and lowercased. ⚠ **Say it that way and not "it sorts nothing" — the loose
version is false, and the code review caught this ticket's first implementation asserting it in
a permanent comment.**

> ⚠ **This is the trap, and it is the whole reason for this ticket.** The next person who wants
> an ordering rule will reach for `normalizeSortName` by name and edit it — silently re-coupling
> identity to ordering, so that `The Dresden Files` and `Dresden Files` become the same series.
> That is not a hypothetical: it is the first thing this work was about to do.

So: rename the function to say what it is, rename the column to match (see the scope extension
below), and write down the contract in a test **before** anything depends on it.

## The rename

`normalizeSortName` → `seriesIdentityKey`. Its definition does not change
(`name.trim().toLowerCase()`), and neither does any behaviour. 25 references across 7 modules,
all inside the series area, all caught by `tsc`.

### ⚠ SCOPE EXTENDED 2026-08-16 — the COLUMN is renamed too

This ticket originally kept the column as `sort_name` and bridged the mismatch with a comment,
on the grounds that renaming an indexed persisted column buys a migration. **The driver asked
whether the series schema had actually shipped, and it has not — so that premise was false.**

- `main` has **no `series` table at all** and sits at schema **v31**; this branch is **v33**.
- `sort_name` is created by a **`createTable` at `toVersion: 32`**, which no install outside this
  branch has ever run — so it can be **edited in place** rather than amended.
- WatermelonDB has no `renameColumn`, so the alternative was a new migration step. An amendment
  for a column that exists on no device is permanent cruft.

So: **`sort_name` → `identity_key`**, and the model field `sortName` → `identityKey`.

⚠ **Any dev device that ran the old v32/v33 must be wiped.** Driver authorised this 2026-08-16.
The failure mode if it is skipped is loud (SQLite errors on a missing column), not silent. This
branch's own migration comment already required a wipe once, when series was renumbered v31 → v32.

⚠ **Three sites `tsc` cannot check**, because the column is addressed by string literal:
`Q.where('identity_key', …)`, `observeWithColumns([… 'identity_key' …])`, and the raw `INSERT`
in `schemaMigrationV33.behavior.test.ts`. The first is covered by an existing real-conflict test,
the third by a real sql.js migration run; **the `observeWithColumns` list is covered by nothing
and must be checked by eye.**

## The characterization test

Add to the existing duplicate-name suite: **a series named `Dresden Files` can be created while
`The Dresden Files` exists.**

This passes today. Pinning it now, before ticket 32, is what makes it a guard rather than an
assertion of new behaviour — it is the executable form of the split, and it is what fails loudly
if anyone ever folds articles into the identity key.

## Acceptance criteria

- [x] `normalizeSortName` is gone; `seriesIdentityKey` replaces it at every reference, with a
      docblock stating that it is the identity key and what it must never absorb.
- [x] The column is `identity_key`, renamed in `schema.ts` and in the `toVersion: 32`
      `createTable` alike, with the model field `identityKey` to match.
- [x] A test asserts that `Dresden Files` and `The Dresden Files` are two different series and
      that creating the second does not raise the duplicate-name error.
- [x] Zero behaviour change: the persisted VALUE is byte-identical, no data migrates, no
      duplicate/reconcile/suppression outcome differs.
- [x] `tsc` 0 errors · eslint 0 errors (36 pre-existing warnings, **0 in touched files**) ·
      jest **63 suites / 791 tests** green (was 787 — the 4 new guards).
- [x] The comments do not describe ticket 32's end state as present fact — the interim
      "identity key is still the sort key" defect is stated at all three sites.

## Where the code is

- `src/helpers/seriesName.ts` — the definition, plus `isSameSeriesName` and the duplicate-name
  sentence built on it.
- `src/db/seriesQueries.ts`, `src/db/seriesReconcile.ts`, `src/db/seriesSuppression.ts` — the
  production callers.
- `src/db/schema.ts` **and** the `toVersion: 32` `createTable` in `src/db/migrations.ts` — the
  `identity_key` column must be renamed in BOTH or the schema and the migration disagree.
- `src/db/models/Series.ts` — the `identityKey` field.
- `src/db/__tests__/support/fakeDatabase.ts` — the raw accessors, addressed by string.
- `src/helpers/__tests__/seriesValidation.test.ts` — already owns the duplicate-name tests; the
  new coexistence test belongs beside them.
- Test callers that construct rows directly: `src/db/__tests__/addBookToSeries.test.ts`,
  `src/db/__tests__/readsInsideTheWriter.test.ts`, `src/helpers/__tests__/seriesName.test.ts`.

## Considered and rejected

- **~~Rename the column too.~~ ACCEPTED 2026-08-16** — see the scope extension above. It was
  rejected on migration cost; the series tables had never shipped, so there was no migration
  cost. ⚠ **A rejection is only as good as its stated reason — check the reason still holds
  before citing the rejection.**
- **Rename the column via `unsafeExecuteSql('ALTER TABLE … RENAME COLUMN …')`.** Rejected: it
  only earns its keep when installs exist that must survive the rename, and none do.
- **Leave the name and add a docblock instead.** Keeps the diff smaller, but docblocks lose to
  autocomplete — the trap survives, and it is a trap this work already walked into once.

## Comments

### 2026-08-16 — implemented, code-reviewed, scope extended mid-flight

Built in one pass. The `/code-review` pass found **no defect in the executable diff** and six
issues in the **prose**, which is worth recording because of what it says about this ticket:

> ⚠ **The first implementation replaced a NAME that asserted a false fact with a COMMENT that
> asserted a false fact.** The new docblock said "nothing sorts by this column". That is false
> until ticket 32 lands — `assembleDerivedSeries` orders the whole browse list by this value in
> JS. Only the narrower claim was true: *no SQL query* orders by it. The comments also cited
> `compareSeriesNames` and ADR 0002 in the present tense before either existed.

Fixed by stating the interim defect explicitly at all three sites, and by writing ADR 0002 in
this ticket rather than deferring it to 32 (a tripwire test pointing at a missing document loses
most of its value at the moment it fires).

**The deeper correction:** ticket 31 separates the two *names*; only ticket 32 separates the two
*values*. Between them the honest description is **one value doing two jobs, now with two
names** — which is strictly better than one value doing two jobs under a name that advertised
only one of them, but it is not the end state.

**Formatting note:** this repo is **not Prettier-clean under default settings** — untouched files
(`SeriesBrowseRow.tsx`, `miscellaneous.ts`, `seriesReconcile.ts` before this change) all fail
`prettier --check`. Do not "fix" it; see [[edit-details-keyboard-double-shift-fix]].
