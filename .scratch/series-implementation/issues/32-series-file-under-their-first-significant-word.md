# 32 — Series file under their first significant word

**Status:** ready-for-agent

**Blocked by:** 31 — the identity key must be nameably separate from display order before an
ordering rule can be added without re-coupling them.

**Raised by:** the driver, 2026-08-16. Verbatim: _"I want us to add library rules to the sorting
so 'The' etc are not considered in the sort. eg: 'The Dresden Files' is sorted under D and not
T."_

## What to build

The Series browse list orders series by name **ignoring a leading article**, so
`The Dresden Files` files under D — between `Discworld` and `Drenai` — rather than under T.
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

- [ ] The browse list orders series ignoring a leading `The`/`A`/`An`; `The Dresden Files` sorts
      between `Discworld` and `Drenai`.
- [ ] The ordering rule reuses `compareBookTitles` and is case-folded. No new article list.
- [ ] The displayed series name is unchanged — the article is stripped for comparison only.
- [ ] Identity is untouched: ticket 31's `Dresden Files` / `The Dresden Files` coexistence test
      still passes.
- [ ] Tests pin both the comparator in isolation and the ordering that comes out of
      `assembleDerivedSeries`.
- [ ] `docs/adr/0002-…` is AMENDED IN PLACE — its "Landing order" note and "Where the rule
      lives" section no longer describe `compareSeriesNames` as pending.
- [ ] `CONTEXT.md` exists at the repo root with the `Keys and identity` cluster.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.
- [ ] **No device verification gate.** No schema, no migration, no native code, no asset path —
      none of the three scars that make a device check mandatory in this repo apply. Driver's
      ruling: jest-only.

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
