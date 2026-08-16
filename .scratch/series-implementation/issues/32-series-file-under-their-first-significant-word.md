# 32 — Series file under their first significant word

**Status:** resolved — 2026-08-16, jest 791 -> 801.

**Blocked by:** 31 — the identity key must be nameably separate from display order before an
ordering rule can be added without re-coupling them.

**Raised by:** the driver, 2026-08-16. Verbatim: _"I want us to add library rules to the sorting
so 'The' etc are not considered in the sort. eg: 'The Dresden Files' is sorted under D and not
T."_

## What to build

The Series browse list orders series by name **ignoring a leading article**, so
`The Dresden Files` files under D — after `Drenai`, since `dre-s` > `dre-n` — rather than under T.
The displayed name is untouched; only the order changes.

**26% of the driver's series are article-prefixed** (12 of 47 in the detection corpus: Dresden
Files, Kingkiller Chronicle, Murderbot Diaries, Dark Tower, First Law, Age of Madness, Devils,
Books of Babel, Hexologists, Hitchhiker's Guide, Long Earth, Science of Discworld). This is a
filing problem, not a nitpick.

## The rule

**Reuse `compareBookTitles`, fed case-folded names.** The app already has exactly one article
rule — `stripLeadingArticle` (`The|A|An`, case-insensitive, requiring a following space) plus a
natural compare that files `#2` before `#10` — and it is used for every book title across eight
modules.

```ts
export const compareSeriesNames = (a: string, b: string) =>
  compareBookTitles(a.trim().toLowerCase(), b.trim().toLowerCase());
```

⚠ **The case-folding is load-bearing, not decoration.** Today's sort compares the persisted
identity key, which is already lowercased — so folding is not a new behaviour, it is the
behaviour that exists. Passing raw names to `compareBookTitles` would silently drop it, and
whether that matters depends on Hermes' ICU collation: with full ICU, case is a *tertiary*
difference and `apple` still precedes `Banana`; without it, `localeCompare` can degrade toward
code-unit order and `Zoo` jumps ahead of `apple`. Folding makes the answer not depend on which
one the runtime gave us.

**Do not write a bespoke article list for series.** A second article rule is precisely the drift
ADR 0001 spends a section warning about. **Driver's ruling: if the article list is ever worth
extending, it is extended app-wide so books get it too** — that is a separate question, not part
of this ticket.

## Why this touches one line

`assembleDerivedSeries` is a pure function with a **single caller** (`seriesStore.ts`), and every
Series surface — browse, detail sheet, editor, picker — reads through it. There is no second copy
of the ordering rule to keep in step, and **§E10 closed the A–Z rail "do not re-offer"**, so
there is no alphabet index or section header that would also need the strip.

The spec never states the browse list's ordering rule, so **no spec amendment is needed**.

Consequence worth knowing: with folding inside the comparator, the function can compare `name`
directly and the `identityKeyById` map it currently builds becomes dead. Leave
`SeriesRow.identityKey` in the type — that map was its only reader, and every test fixture sets
it.

⚠ **Ticket 31 renamed the column to `identity_key` and the field to `identityKey`** (its original
plan to keep `sort_name` was reversed once it turned out the series tables had never shipped).
So the line this ticket changes currently reads as sorting by `identityKey` — **that
wrong-looking expression is the defect, made visible on purpose.** Fix it by moving the sort off
that value, never by changing what `seriesIdentityKey` returns.

## What must NOT change

**Identity stays article-sensitive.** `The Dresden Files` and `Dresden Files` remain two
different series, and creating the second must still succeed. Ticket 31's characterization test
is the guard; it must still pass.

> ⚠ The split is free now and expensive later. Sonicbooks has been in **closed testing since
> 2026-07-26**, so real testers have real series on real devices. Folding articles into the
> identity key today costs nothing; doing it after the fact means reconciling `The X` and `X`
> rows that already exist on other people's installs.

## Also in this ticket — write the ruling down

**`docs/adr/0002-series-identity-key-is-article-sensitive.md` ALREADY EXISTS** — ticket 31 wrote
it, because three of its comments and a tripwire test point at it. **Amend it in place, never
reissue it** (this repo's convention). What this ticket has to change: its `⚠ Landing order`
note, which currently records that the browse list still orders by the identity key, and its
"Where the rule lives" section, which describes `compareSeriesNames` as pending.

**`CONTEXT.md`** — does not exist yet; seed it with a `## Keys and identity` cluster. The Series
area carries four identity-ish concepts and three of them have already been misread:

| concept                                            | answers                     |
| -------------------------------------------------- | --------------------------- |
| `book.id`                                          | which DB row                |
| `bookStructuralKey` → `series_books.book_key`      | which book (ADR 0001)       |
| the series identity key → `identity_key`           | are these the same series   |
| the series display order                           | what order series appear in |

Glossary only — no implementation detail, no file paths.

## Acceptance criteria

- [x] The browse list orders series ignoring a leading `The`/`A`/`An`; `The Dresden Files` files
      under D, sorting before `Silo` and `Threshold` and after `Drenai`.
- [x] The ordering rule reuses `compareBookTitles` and is case-folded. No new article list.
- [x] The displayed series name is unchanged — the article is stripped for comparison only.
- [x] Identity is untouched: ticket 31's `Dresden Files` / `The Dresden Files` coexistence test
      still passes.
- [x] Tests pin both the comparator in isolation and the ordering that comes out of
      `assembleDerivedSeries` — including that ordering follows the DISPLAYED NAME, not the
      persisted key, which is what stops the sort depending on a DB column again.
- [x] `docs/adr/0002-…` AMENDED IN PLACE, with the corrected worked example.
- [x] `CONTEXT.md` exists at the repo root with the `Keys and identity` cluster.
- [x] `tsc` 0 errors · eslint 0 errors · jest **63 suites / 801 tests** (was 791).
- [x] **No device verification gate.** Driver's ruling: jest-only.

## Where the code is

- `src/helpers/seriesName.ts` — where `compareSeriesNames` belongs, beside the identity key it
  is deliberately not.
- `src/helpers/miscellaneous.ts` — `compareBookTitles` / `stripLeadingArticle` / `naturalCompare`,
  reused as-is.
- `src/helpers/seriesAssembly.ts` — the one ordering site, at the tail of
  `assembleDerivedSeries`, plus the `identityKeyById` map that becomes dead.
- `src/helpers/__tests__/seriesAssembly.test.ts` — already asserts "A–Z by identityKey"; that
  assertion is what this ticket redefines.

## Out of scope — deliberately

- **The author's name on series cards and the detail page.** Raised alongside this and
  **parked**: the data model does not support it. `Book.author` is one flat string per book
  (`detectionUnits.ts`: _"The DB stores ONE author, so artist and album_artist collapse onto
  it"_), and member books disagree on **21% of the corpus's series** — dominated not by genuine
  co-authorship but by narrators and publishers leaking into the author field (Murderbot →
  `Graphic Audio LLC.`, The Dark Tower → `LEGENDS - Stories by The Masters of Fantasy`, The Long
  Earth → the narrator, who *outnumbers* the author 3:2). "A series has an author" is a derived,
  lossy value that needs its own ruling. Candidate rules already weighed: most-common author with
  a deterministic tiebreak (right or defensible on 8 of the 10 hard cases); blank unless
  unanimous; `Various Authors`; book 1's author. Note also that the browse row's text column
  already stacks four elements and **§B8** is on record that it cannot carry more at full width.
- **Extending the article list** beyond `The`/`A`/`An` — app-wide or not at all.
- **Renaming the identity column** — done in ticket 31 (`sort_name` → `identity_key`).

## Comments

### 2026-08-16 — implemented TDD, RED at both seams first

Built test-first at the two seams agreed in grilling: `compareSeriesNames` in isolation, then the
ordering that falls out of `assembleDerivedSeries`. Both went RED before any implementation.

⚠ **THE WORKED EXAMPLE IN THIS TICKET, IN TICKET 31 AND IN ADR 0002 WAS WRONG, AND ONLY RUNNING
IT FOUND OUT.** All three said `The Dresden Files` sorts *"between `Discworld` and `Drenai`"*. It
does not — `dre-s` > `dre-n`, so it sorts **after** `Drenai`. The claim had been written, reviewed
and repeated three times without anyone noticing. **A worked example in prose is an assertion with
no test behind it.** The example is now pinned in `seriesName.test.ts` with its real neighbour,
and all three documents are corrected.

**Two properties worth knowing, both now tested:**

1. **The sort reads `name`, not the persisted key.** A test gives two series a deliberately stale
   `identityKey` and asserts they still file by their displayed name. That is the assertion that
   stops the ordering quietly re-acquiring a database dependency.
2. **`The Dresden Files` and `Dresden Files` TIE, and that is correct** — two different series
   that belong adjacent. `Array.prototype.sort` is stable, so their order is the input's and does
   not flicker. ⚠ **Do not add the identity key as a tiebreak** — that reintroduces exactly the
   coupling ADR 0002 removed.

**`SeriesRow.identityKey` now has no reader** in `seriesAssembly.ts`. Kept (the store already
projects it, every fixture sets it) and commented as unread, so it is not mistaken for
load-bearing and not re-adopted as a sort input.

`compareSeriesNames` sits **beside** `seriesIdentityKey` in `seriesName.ts` on purpose: the two
keys are visible together at the exact point where someone would be tempted to merge them.
`miscellaneous.ts` was checked first and has **zero imports**, so `seriesName.ts` keeps its
dependency-free guarantee.

### 2026-08-16 — code review, and one real inconsistency this ticket created

No correctness defect in the comparator or the swap. Six findings, all actioned:

⚠ **THE ONE THAT MATTERED — `Removed Series` was left filing under T.**
`groupRemovedSeries` (`seriesSuppression.ts`) builds its list from suppressed rows, NOT from
`DerivedSeries`, so it never passed through `assembleDerivedSeries` and kept sorting on the
identity key. **Result: `The Dresden Files` under D on the browse list and under T on the Removed
list** — an inconsistency this ticket introduced, since before it both were article-sensitive and
agreed. Fixed by ordering on `compareSeriesNames`. ⚠ **Grouping still uses the identity key and
must** — the two article-twins are different series and may not collapse into one entry. So that
one function now uses **both keys, for their two different questions**, which is the clearest
illustration in the codebase of why they are separate.

**"This is the ONE ordering site" was an overstatement** and is now narrowed to "for derived
series". Two other series-name orderings exist: `groupRemovedSeries` (fixed above) and
`seriesDetectionRun`'s `listingOrder` — the latter **deliberately left raw**, because it orders
LOG output where a stable diff matters more than shelf order.

**The stability claim was too strong.** `Array.prototype.sort` keeps tied twins in input order
*within a session*, but the input comes from an unordered WatermelonDB query, so SQLite row order
decides and can change across restarts. Cosmetic; corrected in the docblock rather than coded
around. ⚠ **Do not fix it with an identity-key tiebreak.**

**"Fails loudly on the missing column" was half true** (ticket 31's migration comment). Writes
throw, but reads are quiet — `SELECT *` omits the column, `identityKey` reads `undefined`, and
now that nothing sorts by it the library renders fine. **A stale dev device can look healthy and
only hit the wall on the first edit.** Comment corrected.

**Stale example, again.** The corrected `Drenai` ordering had been fixed in the tickets and the
ADR but not in `compareSeriesNames`' own docblock — the first thing a reader sees. Also found
independently: ticket 31's "STATE OF PLAY" block in `seriesIdentityKey` still described the sort
as pending. **Both are the same failure mode as the original bug: prose that outlived its
truth.**
