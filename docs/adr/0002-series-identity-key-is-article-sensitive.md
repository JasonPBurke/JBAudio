# A series' identity key is article-sensitive; its display order is not

**Status:** accepted (driver, 2026-08-16)

`The Dresden Files` and `Dresden Files` are **two different series**, and both may exist at once.
The browse list nonetheless files them together under D, because **ordering and identity are
different questions and are answered by different code**. Identity is
`seriesIdentityKey(name)` — trimmed, case-folded, article intact, persisted as
`series.identity_key`. Display order is `compareSeriesNames`, which strips a leading
`The`/`A`/`An` before comparing.

This exists because the two were **one value doing both jobs**, under a name that advertised
only the second.

## What went wrong, and why it is worth a document

The column was called `sort_name` and the function `normalizeSortName`. Both held
`name.trim().toLowerCase()`. Every *SQL* use was an equality lookup — duplicate-name validation,
reconcile's name matching, the suppression table — while the browse list's A–Z sort borrowed the
same value in JS, because it was already lowercased and already there.

So a request to "ignore `The` when sorting" pointed straight at `normalizeSortName`. Editing it
would not have reordered anything. **It would have redefined series identity**: `The Dresden
Files` and `Dresden Files` would have become the same series, the second could never be created,
reconcile would have matched across them, and the suppression table would have conflated them.

This is the same shape as [ADR 0001](./0001-series-membership-is-keyed-by-file-path.md), where
`series_books.book_key` looks like a foreign key and is not. **In this area the hazard is
routinely one function away from the edit, sitting in a name.**

## The decision

1. **Identity keeps the article.** `seriesIdentityKey` is trim + lowercase and nothing else.
2. **Display order strips it**, via `compareSeriesNames`, which delegates to the app's one title
   comparator, `compareBookTitles` (`helpers/miscellaneous.ts`) — the same `The`/`A`/`An` rule
   and natural-number ordering every book title already uses.
3. **The names say which is which.** `normalizeSortName` → `seriesIdentityKey`;
   `sort_name` → `identity_key`.

### Why not overload one key for both

Because the split is **free now and expensive later**. Sonicbooks has been in closed testing
since 2026-07-26, so testers create real series on real devices. Folding articles into identity
today costs nothing; doing it after the fact means reconciling `The X` and `X` rows that already
exist on installs we do not control.

### Case by case

| the user does | what happens |
| --- | --- |
| owns `The Dresden Files` | it files under **D**, between `Discworld` and `Drenai` |
| creates `Dresden Files` as well | **allowed** — a second, distinct series; the two sort adjacently |
| creates `the dresden files` | **refused** as a duplicate — identity is case-folded, article and all |
| renames `The Dresden Files` → `Dresden Files` | allowed unless a series already holds that exact key |
| owns `A Song of Ice and Fire` | files under **S** |
| owns `Anathem` | files under **A** — the strip needs a following space, so `An` in `Anathem` is untouched |

## Where the rule lives

- **Identity**: `seriesIdentityKey` in `src/helpers/seriesName.ts`, with `isSameSeriesName` and
  `isDuplicateSeriesName` beside it. Persisted as `series.identity_key` (indexed). The tripwire
  is `src/helpers/__tests__/seriesName.test.ts` — it asserts the two keys **differ** — plus the
  gate-level characterization tests in `seriesValidation.test.ts`.
- **Order**: `compareSeriesNames`, beside the identity key it is deliberately not, consumed at
  the single ordering site in `assembleDerivedSeries` (`src/helpers/seriesAssembly.ts`). That
  function has one caller (`src/store/seriesStore.ts`) and every Series surface reads through it,
  so there is no second copy to drift. **§E10 closed the A–Z rail**, so no alphabet index needs
  the same rule.

⚠ **Landing order.** Ticket 31 delivered the split in *name* and the identity guarantee. Ticket
32 delivers `compareSeriesNames` and moves the sort onto it. Between the two, the browse list
still orders by the identity key, so `The Dresden Files` still files under T — that interim state
is documented at both sites and is the defect, not the design.

## Considered and rejected — do not re-raise

**A — fold the article strip into the identity key.** Rejected. It does not do what it appears
to: it changes what "the same series" means, not what order things appear in. Its costs are
concrete — `Dresden Files` becomes uncreatable while `The Dresden Files` exists, reconcile begins
matching across the two, and suppression conflates them. See the case table above for what is
preserved by not doing it.

**B — a series-specific article list.** Rejected. A second article rule is precisely the drift
ADR 0001 warns about. **Driver's ruling: if the list is ever worth extending beyond
`The`/`A`/`An`, it is extended app-wide so book titles get it too** — one rule or none.

**C — keep the column called `sort_name` and document the mismatch in a comment.** Rejected
*after initially being accepted*, and the reversal is the instructive part. It was rejected on
migration cost, and **that premise was false**: `main` has no `series` table and sits at schema
v31, so the tables had never shipped and the `toVersion: 32` `createTable` could be edited in
place. WatermelonDB has no `renameColumn`, so the alternative was an amendment step — permanent
cruft for a column no device holds. The cost paid instead was wiping dev devices, which this
branch's migration comment already required once when series was renumbered v31 → v32.

**D — rename via `unsafeExecuteSql('ALTER TABLE … RENAME COLUMN …')`.** Not needed. It only
earns its keep when installs exist that must survive the change, and none do.

## The general lesson, since this is the second time

Name a key after **the question it answers**, not the shape of the value or the one place it is
currently read. `sort_name` and `book_key` were both misread by a later reader, and in both cases
the misreading was about to cause a data-level change while looking like a display-level one.
`CONTEXT.md`'s `Keys and identity` section exists to hold that distinction in one place.
