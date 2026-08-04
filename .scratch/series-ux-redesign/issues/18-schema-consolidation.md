# 18 — Schema consolidation: one migration or several, and where does confidence land?

Type: grilling
Status: open
Blocked by: 14, 15
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
