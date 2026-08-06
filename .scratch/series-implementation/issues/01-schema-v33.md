# 01 — Schema v33: the whole data model, one migration

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

**Spec:** [§G](../../series-ux-redesign/spec.md) (G1 is the canonical column list, as
amended by G1a and G1b). Read §K10 and §K4 before writing a line of this.

## What to build

An existing tester upgrades the app and **nothing happens** — no prompt, no wait, no data
loss, no visible change. Underneath, the database has grown every column the Series
redesign needs, and every row that predates them reads as **user-owned**, so a later
rescan can never clobber something the user made by hand.

This is the expand half of an expand/contract: it lands **optional columns, not
behaviour**. Nothing reads these columns when this ticket is done — that is correct, and it
is why the whole model can land in one version number without shipping a half-built
feature.

## Why it is one migration and not five

This branch claims **exactly one** version number from a namespace it shares with `main`
(§G3). `main` is at v31, this branch at v32, and v33 is uncontested. Splitting the model
across v33–v37 would claim five, and every one of them is a silent failure risk (§K4: a
failed migration has no runtime signal, and the raw-SQL escape hatch's assertion is
dev-only).

It is **appended, never a rewrite of v32** (§G2). Rewriting was live — no real device has
ever run v32 — and was offered and rejected, because append-only is the discipline that
survives being *wrong* about who has what.

## The trap that shapes every column

`addColumns` **silently drops `defaultValue`** — its signature never reads the field. What
actually fills existing rows is the library's null-value function: optional → `null`;
non-optional string → `''`, number → `0`, boolean → `false`.

> **So a non-optional enum column backfills to `''` — a value its TypeScript union says
> cannot exist. A non-optional enum is a lie the type system cannot see.**

Hence: **every new column here is `isOptional`**, and null coalesces toward `'user'` for
`origin` / `name_source` / `membership` (§G5). `canonical_source` gets **no** coalesce —
null there means "no number is set", because `canonical_number` is itself nullable.

The direction is abstention bias applied to the schema. A row wrongly read as `'user'` is
merely never auto-updated. A row wrongly read as `'detected'` is **eligible for
regeneration to clobber**, which destroys a hand-made playlist and breaks the promise the
whole feature rests on.

## Acceptance criteria

- [ ] One `toVersion: 33` block: 13 columns across 4 tables, 2 new tables, exactly one
      index (`book_tags.book_id`). Shape is §G1 verbatim — copy it, do not re-derive it.
- [ ] `schema.ts` bumps 32 → 33 and carries the **identical** shape. A mismatch between
      the two is the failure the coherence test exists to catch.
- [ ] Every added column is `isOptional`. No `defaultValue` is written anywhere in the new
      block.
- [ ] Model classes carry the new fields, including a new model for `suppressed_series` and
      one for `book_tags`.
- [ ] Reading `origin` / `name_source` / `membership` coalesces null → `'user'` at a single
      shared site, not scattered across call sites. `canonical_source` does not coalesce.
- [ ] §G4's provenance-naming rule ships **as a comment in the schema file**, so a reader
      who hits `origin` next to `name_source` infers the pattern instead of
      reverse-engineering it: *`<x>_source` names the provenance of the column `<x>` beside
      it; a bare noun names a column whose value IS its own provenance.*
- [ ] The two v3 `addColumns` comments claiming *"WatermelonDB expects defaultValue here for
      non-optional columns"* are **corrected** — it does not. Those columns were filled by
      the null-value function, which coincidentally agreed with the written default, which
      is why this went unnoticed since v3.
- [ ] Schema tests extended for the new columns and tables, and they stay
      **version-agnostic** — they assert shape, never a literal version number. This suite
      was burned once by pinning `schema.version === 31` and breaking when series
      renumbered to 32.
- [ ] Migration/schema coherence is asserted generically, not against the number 33.
- [ ] An emulator sitting at **v32 with existing series rows** upgrades and launches; those
      rows read `null` in every new column and therefore resolve to `'user'`.
- [ ] A real device at **v31** takes 31 → 32 → 33; v33's `addColumns` on `series` /
      `series_books` runs against **zero rows**, because v32 creates those tables empty.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Known wart, kept — do not "fix" it

`membership = 'excluded'` reads as a contradiction at the call site. All three alternatives
are worse: a `_source` suffix would lie, `'removed'` collides with the `Removed Series`
list, and splitting it into a second column is the extra column 09 already rejected.

## Notes

- **No SQL backfill step.** It was offered and rejected: a no-op on every real device, and
  it buys only tidier emulator data at the cost of raw SQL on a surface that fails
  silently.
- **Fresh installs never run migrations at all** — WatermelonDB builds from `schema.ts`
  directly. Every nullability decision here concerns upgrade paths only.
- The `books` columns and `book_tags` in this block are written but **not populated** here.
  That is [02](02-capture-tags-at-scan.md).
