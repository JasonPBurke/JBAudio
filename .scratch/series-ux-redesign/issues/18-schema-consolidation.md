# 18 — Schema consolidation: one migration or several, and where does confidence land?

Type: grilling
Status: resolved — 2026-08-06. **Confidence does NOT ship; ONE appended migration
`toVersion: 33`; 7 columns across 3 tables + 1 new table; no indexes; every enum
column nullable and coalesced toward `'user'`.** See `## Answer`.
Blocked by: 14, 15 (both resolved)
Parent: [map.md](../map.md)

## Question

The destination promises "the data-model decisions it depends on". Nine tickets
each decided a column in isolation; nobody has looked at the set as a set. Two
things are genuinely undecided, and one is a coherence review.

### 1. Where does 02's confidence tier physically land?

[02](02-detection-cascade.md) settled its **shape** — a tier
(`certain` / `likely` / `possible` / `guess`) plus a **reason string**, never a
float. It never settled its **home**, and the choice is not obvious:

- Confidence is a property of a **grouping decision**, and grouping happens per
  book — which argues for `series_books`.
- But 02's cascade also produces a **series-level** verdict (this whole cluster
  is corroborated / this one came from an uncorroborated folder), which argues
  for `series`.
- Possibly both, at different granularities, which doubles the columns.
- And the reason string is a `why` trail — the map says "the `why` trail is what
  any explanatory UI reads", but **no ticket ever designed an explanatory UI**.
  [08](08-browse-presentation.md) put **no origin chip on browse**;
  [11](11-series-detail-contents.md) did not put one on the detail sheet either.
  So ask the hard version: **does anything read this column at all?** If nothing
  does, it is a debugging aid, and a debugging aid should say so or not ship.

### 2. One migration or several?

Six columns across two tables plus a new table, arriving from five tickets. The
app is at **schema v32** on this branch (`main` is v31). Options:

- **One migration, v32 → v33** — the whole Series data model lands at once, and
  a partial implementation is impossible.
- **Several** — each feature ships when it is built, and testers on closed
  testing get smaller steps.

This is not a style question. The map records that **a failed migration is
silent** and that `unsafeExecuteSql`'s assert is **dev-only**, and that any
device that ran series v31 must be **wiped** because it collides with main's
artwork migration. Migration risk here is demonstrated, not theoretical.

### 3. Coherence review of the whole set

Running total, as the map records it — **six columns across two tables plus one
new two-column table**:

| Table | Column | From |
|---|---|---|
| `series_books` | `canonical_number` (nullable NUMBER) | [07](07-sequence-numbering.md), **type changed by [10](10-correction-surface.md)** |
| `series_books` | `canonical_source` (`'user' \| 'detected'`) | [07](07-sequence-numbering.md) |
| `series_books` | `membership` (`'detected' \| 'user' \| 'excluded'`) | [09](09-auto-generate-series-setting.md) |
| `series` | `origin` (`'detected' \| 'user'`) | [06](06-series-identity-edition.md) |
| `series` | `name_source` | [09](09-auto-generate-series-setting.md) |
| `series` | `artwork` (nullable, **no `*_source`**) | [11](11-series-detail-contents.md) |
| **new** `suppressed_series` | `name`, `created_at` | [09](09-auto-generate-series-setting.md) |
| `settings` | `series_backgrounds_enabled` (boolean) | [12](12-series-display-setting.md) |

Questions the table raises:

- **Three `*_source`-shaped columns with two different names** (`canonical_source`,
  `name_source`, `membership`) all encoding per-aspect ownership. 09 chose
  per-aspect deliberately and that stands — but is the *naming* coherent enough
  that a reader infers the pattern? `membership` is the odd one out and carries a
  third value.
- **`settings` columns are schema too.** 12 corrected 08 and itself on this; the
  map warns any further display toggle carries the same migration cost. Does
  `series_backgrounds_enabled` ride the same migration as the series columns, or
  the settings table's own cadence? And the trap: the getter must **invert the
  house `=== true` idiom to `!== false`**, because this is the table's first
  default-ON boolean and a migration leaves every existing tester `null`.
- **Does anything need an index?** Nothing has asked. `suppressed_series` is
  looked up by `name` on every detection run.

## Constraints

- **Do not reopen any settled column.** Editions cost nothing
  ([06](06-series-identity-edition.md)); the description and its `*_source` are
  **dropped** and out of scope; `series.artwork` has **no** source companion and
  the reasoning (a source column would be a pure function of its neighbour's
  nullity) is settled.
- Blocked on 14 and 15 only because either could still surface a column; if both
  land clean, this is unblocked immediately.

## Definition of done

The confidence tier has a home or an explicit "does not ship"; the migration is
sequenced; the full column list is written once, in one place, ready for
[19](19-write-the-spec.md).

## Answer

Resolved by grilling, 2026-08-06. Five decisions, no new tickets, no fog
graduated, nothing ruled out of scope. **This section is the canonical column
list — 19 copies it, nothing re-derives it.**

### THE COLUMN LIST — one `toVersion: 33` block

```
addColumns  series_books
  canonical_number            number   isOptional  -- 07, type changed by 10
  canonical_source            string   isOptional  -- 07  'user' | 'detected'
  membership                  string   isOptional  -- 09  'detected' | 'user' | 'excluded'

addColumns  series
  origin                      string   isOptional  -- 06  'detected' | 'user'
  name_source                 string   isOptional  -- 09  'detected' | 'user'
  artwork                     string   isOptional  -- 11, NO *_source companion

createTable suppressed_series                      -- 09
  name                        string
  created_at                  number

addColumns  settings
  series_backgrounds_enabled  boolean  isOptional  -- 12, default ON
```

**7 columns across 3 tables + 1 new table. Zero indexes.** `schema.ts` bumps
**32 → 33** and carries the identical shape.

Note the running total the map carried — *"6 columns across 2 tables + 1 new
table"* — was always short by one: it never counted 12's `settings` boolean,
which 12 itself corrected 08 about. **Seven, three tables.**

### 1. The confidence tier DOES NOT SHIP

**No column, on either table.** [02](02-detection-cascade.md)'s shape decision
(a tier `certain`/`likely`/`possible`/`guess` plus a reason string, never a
float) stands as a description of **the algorithm**, not of the schema. The tier
and its `why` trail are computed during a detection run and **emitted to the scan
log**; nothing is persisted.

The ticket asked the hard version — *does anything read this column at all?* —
and the answer is nothing does, by four independent rulings:
[08](08-browse-presentation.md) put **no origin chip on browse** (it truncated
the canonical range on 5 of 15 series); [11](11-series-detail-contents.md) put
none on the detail sheet; [10](10-correction-surface.md) grew the editor by
artwork + canonical number + `Sort by number` and nothing provenance-shaped;
[14](14-titledetails-integration.md) is a static subheading.
`grep -rn "confidence" src/` returns **nothing outside the ticket files**.

**The decisive fact is that its only consumer was deleted.** A confidence tier
exists to rank a review queue, and [09](09-auto-generate-series-setting.md)
replaced the review queue with a settings toggle on the strength of 02's 98.3%
purity. The column outlived its reader before either was built.

**The one live counter-argument was checked and dies on 09's own rule.** If
turning `Also group by folder name` OFF had to *un-create* the 9 folder-derived
series, something would have to identify them after the fact. But 09 ruled
**bulk actions create, per-item actions destroy** — there is no bulk destroy
anywhere in `src/` — and that the master toggle OFF "stops future detection and
leaves existing series untouched", matching `autoChapterInterval = null`. The
sub-toggle inherits that. **No surface ever needs to ask which series came from
a folder.**

Cost of being wrong, stated so it is not re-litigated: an explanatory UI would
need a migration **and** a rescan to backfill. Judged cheap against 98.3%
purity — the case for explaining a grouping is weakest exactly when groupings
are almost always right.

### 2. ONE migration, APPENDED as v33 — not a rewrite of v32

**Driver clarification that reframed the question: no real device has ever run
v32. It has only ever been on local emulators.** That made a fourth option live
— rewriting the existing `toVersion: 32` block so real devices take a single
31 → 32 step to the complete model, since **a migration version is only
immutable once a device you cannot wipe has run it**.

**Rewrite was offered and REJECTED in favour of append-only.** Append-only is
the discipline that survives being *wrong* about who has what: a device sitting
at `user_version 32` never re-runs 32, so a single missed install would silently
end up with the old tables and none of the new columns — precisely the failure
`migrations.ts:14-18` documents, and the map records that **a failed migration
is silent**.

Consequences of the choice, all verified:

- Real devices (**every one at v31**) go **31 → 32 → 33**. v32 creates `series`
  and `series_books` **empty**, so v33's `addColumns` runs against **zero rows**
  on every real device.
- **Emulators need NO wipe** — they sit at 32 and take the 33 step cleanly. This
  is the concrete payoff of append-only, and it is why decision 5 matters in
  practice: the driver's existing emulator series rows survive into v33 carrying
  `null` in every new column.
- **v33 is free and uncontested.** Checked every local branch: `main` 31, this
  branch 32, `feature/series` a stale 31 (colliding with main, as recorded),
  nothing at 33+.

**Everything rides the one block, including 12's `settings` boolean.** The
ticket asked whether the display toggle follows the settings table's own cadence;
it does not, and multi-table migrations are already house style — **v21 spans
`books` + `chapters` + `settings`**, v25 and v12 likewise.

**The framing the ticket offered is rejected as a false alternative.** It posed
"the whole model at once" against "each feature ships when it is built". A
migration lands **columns**, not UI, and every column here is optional — a
landed-but-unused column is invisible to a tester. Features still ship
incrementally on top of one migration. The real axis was only ever *how many
version numbers this branch claims from a namespace it shares with `main`*, and
the answer is **one**.

### 3. NOTHING IS RENAMED — the incoherence was apparent, not real

The ticket flagged three `*_source`-shaped columns with two naming forms. **There
are actually FOUR** — `origin` belongs to the same species and the ticket's table
listed it separately. The split between the forms is exact, and it is a rule:

> **`<x>_source` names the provenance of the column `<x>` sitting beside it.
> A bare noun names a column whose value IS its own provenance.**

`name_source` sits beside `series.name`; `canonical_source` sits beside
`series_books.canonical_number`. `origin` and `membership` have **no neighbour**
— the value they describe is *the existence of the row itself*. A series exists
because someone created it; a join row exists because someone put that book
there. Under the rule all four are correctly named.

**This rule goes in `schema.ts` as a comment** and rides into 19's spec, because
that is the whole fix: a reader who hits the rule infers the pattern instead of
reverse-engineering it.

The one genuine wart, recorded so it is not rediscovered as a bug:
**`membership = 'excluded'` reads as a contradiction at the call site** — 09's
display filter is literally `WHERE membership != 'excluded'`. Three alternatives
were offered and all are worse. `membership_source` **would lie** (`'excluded'`
is a state, not a source). Renaming the value to `'removed'` collides with 09's
`Removed Series` list, which is about suppressed *series*, not excluded books.
Splitting into `membership_source` + an `excluded` boolean is **the sixth column
09 explicitly rejected**, and creates a state where `excluded = true` makes
`membership_source` meaningless. 09 chose `membership` *because* it encodes more
than provenance; that stands.

### 4. NO NEW INDEXES

The schema has exactly **six** indexed columns and they share a shape:
`books.author_id`, `chapters.book_id`, `footprints.book_id`,
`series_books.series_id`, `series_books.book_key` are all **foreign keys on
tables that grow with the library**, plus `series.sort_name` as the
duplicate-name lookup key. **None is an index on a small table or a
low-cardinality enum**, and none of the new columns earns one:

- **`suppressed_series.name`** — the ticket's premise was "looked up by `name` on
  every detection run", but detection is a **batch**: one pass emits ~28
  candidate series. The implementation reads the whole table **once into a
  `Set<string>`** and tests in memory — 1 query, 0 index, regardless of size.
  The table is bounded by *series the user deliberately deleted*: realistically
  0–20 rows.
- **`series_books.membership`** — always filtered inside one series, so already
  narrowed by the indexed `series_id`. SQLite would usually ignore such an index.
- **`series.origin`** — regeneration touches only `'detected'`, a scan of ~28 rows.
- **`canonical_number` / `canonical_source` / `name_source` / `artwork`** — read,
  never filtered on.

Every index is a write cost paid during scans to speed up reads that are already
fast.

**Carried constraint, because there is no DB mechanism for it:
`suppressed_series.name` must be de-duplicated in JS on write.** WatermelonDB's
`isIndexed` emits a plain `CREATE INDEX` — **there is no unique-constraint
support anywhere in the library**. A double-delete otherwise writes two rows and
09's `Removed Series (N)` counts wrong.

### 5. EVERY ENUM COLUMN IS NULLABLE, AND NULL COALESCES TOWARD `'user'`

Nobody had specified nullability, and looking it up produced **the most
transferable finding in this ticket.**

> **`addColumns` silently drops `defaultValue`.** Its signature destructures only
> `{ table, columns, unsafeSql }`
> (`node_modules/@nozbe/watermelondb/Schema/migrations/index.js:108-112`).
> **There is no way to make `addColumns` backfill a column with a chosen value.**

What actually backfills existing rows is `nullValue()`
(`RawRecord/index.js:121-133`): `isOptional` → `null`; non-optional `string` →
`''`; `number` → `0`; `boolean` → `false`.

**So a non-optional `origin` would backfill every existing series row to `''`** —
a value that is neither `'detected'` nor `'user'`, which the TypeScript union
claims cannot exist. **A non-optional enum column is a lie the type system cannot
see.** Nullable is honest: `null` means *this row predates the column*, and
TypeScript forces every read site to handle it rather than letting `''` pass as a
plausible string.

**The coalesce direction is the ruling, and it is abstention bias applied to the
schema.** A row wrongly read as `'user'` is merely never auto-updated — harmless.
A row wrongly read as `'detected'` is **eligible for regeneration to clobber**,
destroying a hand-made playlist and breaking the guarantee 06 made structural.
So:

```
origin      ?? 'user'
name_source ?? 'user'
membership  ?? 'user'
canonical_source  -- NO coalesce; null means "no number is set",
                  -- since canonical_number is itself nullable
```

An `unsafeExecuteSql` backfill step was offered and **rejected**: it is a
**no-op on every real device** (zero rows at v33) and buys only tidier emulator
data, at the cost of SQL on a surface the map records as failing silently.

**This matters in practice precisely because of decision 2.** Append-only means
the emulators are *not* wiped, so the driver's existing series rows will carry
`null` in all six new columns from the moment v33 lands. The coalesce is live
code from day one, not a theoretical migration path.

### Carried, deliberately NOT reopened

- **`seriesBackgroundsEnabled`'s getter is `!== false`; every other boolean
  getter stays `=== true`.** 12 ruled this and it survives — **it is more right
  than 12 knew.** A migration backfill was considered (we now have a migration
  to ride, which 12 did not) and dies on a fact: `ensureSettingsRecord()`
  (`settingsQueries.ts:11-24`) seeds only `bookFolder`, `numColumns`,
  `timerActive`, so **every optional setting is `null` on a FRESH install too**.
  The null is not a migration artifact, it is the app's universal state for
  optional settings. A backfill fixes only existing installs; fixing fresh ones
  needs the default added at **two** more creation sites, one of which
  (`updateSetting`'s create branch, `:41`) is commented *"Required non-nullable
  defaults for the singleton"* — an invariant an optional column would break.
  **The inverted getter handles both paths in one expression at one site.**
- The three shipped boolean getters that a build engineer will copy from are
  `settingsQueries.ts:393` (`bedtimeModeEnabled`), `:505` (`autoAccentEnabled`),
  `:523` (`shakeToResetEnabled`) — **all default-OFF, all `=== true`**. Series
  backgrounds is the table's first default-ON boolean and the one exception.
- **`canonical_number` costs no type-change migration.** `series_books` on this
  branch holds only `series_id`, `book_key`, `position`, `created_at`
  (`schema.ts:264-274`), so 07's string form **never existed in a shipped
  schema**. 10's change to a nullable NUMBER is free — the column simply lands
  as `number` on first appearance. There is no `ALTER` to write.
- No settled column was reopened. Editions cost nothing (06); the description and
  its `*_source` stay dropped; `series.artwork` keeps no source companion (11).

### A correction to the repo, for the build effort

**`migrations.ts:588` and `:600` carry a false comment.**
`// @ts-ignore: WatermelonDB expects defaultValue here for non-optional columns`
— it does not. `addColumns` drops it (see decision 5). Those v3 columns were
backfilled to `0` by `nullValue()`, which **coincidentally agrees** with the
`defaultValue: 0` written beside it, which is exactly why this has gone unnoticed
since v3. **Correct the comment when v33 is written**, so nobody trusts
`defaultValue` to do anything.

### Also verified while resolving

- **The migration test suite is already version-agnostic, deliberately.**
  `seriesSchema.test.ts:3-8` records that it used to pin `schema.version === 31`
  and broke when series renumbered to 32; it now asserts **shape, not version**.
  So v33 costs **no test churn** — only additions for the new columns.
  Coherence between `schema.version` and the newest migration is guarded
  generically in `schemaMigrations.test.ts`.
- **Fresh installs never run migrations at all** — WatermelonDB builds from
  `schema.ts` directly. Every nullability decision above concerns upgrade paths
  only.

---

## Amendment — 2026-08-06 (driver-approved, during `/to-tickets`)

**This ticket's column list is short by two. It is nine columns, not seven.** The
canonical list now lives in the spec at **[§G1 + §G1a](../spec.md)**; read it
there, not here.

The `Series Detection` card's own two toggles were never given columns by any
ticket — 09 decided the card's *behaviour*, this ticket decided the *column
list*, and the pair fell between them ("09's two" here meant `name_source` and
`membership`). Added to the same `toVersion: 33` block:

```
addColumns  settings
  series_detection_enabled        boolean  isOptional  -- 09/A9, default ON
  series_folder_grouping_enabled  boolean  isOptional  -- A3,    default OFF
```

They are not optional. **K1 is binding: settings in this app ARE schema**, one
column per preference, and A9 anchors OFF-behaviour on the
`autoChapterInterval = null` precedent — itself a column. Nothing existing could
carry either toggle.

Caught **before** the migration was written, which is the only time it was cheap:
decision 2 above lets this branch claim exactly one version number, so finding
this at the settings ticket would have forced a v34.

**Knock-on:** `series_detection_enabled` is a **second** default-ON boolean, so
K1's inverted getter (`!== false`, fallback `true`) is now needed at **two**
sites, not one.
