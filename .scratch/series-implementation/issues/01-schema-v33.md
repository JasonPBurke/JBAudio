# 01 — Schema v33: the whole data model, one migration

**Blocked by:** None — can start immediately.

**Status:** DONE — implemented on `worktree-tk-01-schema-v33`. Every acceptance criterion is
met and verified, including **both** upgrade paths: v32 → v33 on the emulator (with existing
series rows, checked at row level) and **v30 → 31 → 32 → 33 on a physical Pixel 7 Pro
carrying a 352-book library** (release build, checked at the UI level). Not merged.

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

- [x] One `toVersion: 33` block: 13 columns across 4 tables, 2 new tables, exactly one
      index (`book_tags.book_id`). Shape is §G1 verbatim — copy it, do not re-derive it.
- [x] `schema.ts` bumps 32 → 33 and carries the **identical** shape. A mismatch between
      the two is the failure the coherence test exists to catch.
- [x] Every added column is `isOptional`. No `defaultValue` is written anywhere in the new
      block.
- [x] Model classes carry the new fields, including a new model for `suppressed_series` and
      one for `book_tags`.
- [x] Reading `origin` / `name_source` / `membership` coalesces null → `'user'` at a single
      shared site, not scattered across call sites. `canonical_source` does not coalesce.
- [x] §G4's provenance-naming rule ships **as a comment in the schema file**, so a reader
      who hits `origin` next to `name_source` infers the pattern instead of
      reverse-engineering it: *`<x>_source` names the provenance of the column `<x>` beside
      it; a bare noun names a column whose value IS its own provenance.*
- [x] The two v3 `addColumns` comments claiming *"WatermelonDB expects defaultValue here for
      non-optional columns"* are **corrected** — it does not. Those columns were filled by
      the null-value function, which coincidentally agreed with the written default, which
      is why this went unnoticed since v3.
- [x] Schema tests extended for the new columns and tables, and they stay
      **version-agnostic** — they assert shape, never a literal version number. This suite
      was burned once by pinning `schema.version === 31` and breaking when series
      renumbered to 32.
- [x] Migration/schema coherence is asserted generically, not against the number 33.
- [x] An emulator sitting at **v32 with existing series rows** upgrades and launches; those
      rows read `null` in every new column and therefore resolve to `'user'`.
      **VERIFIED on Pixel_7_Pro (Android 15), 2026-08-06** — see the comment below.
- [x] A real device at **v31** takes 31 → 32 → 33; v33's `addColumns` on `series` /
      `series_books` runs against **zero rows**, because v32 creates those tables empty.
      **VERIFIED on a physical Pixel 7 Pro, 2026-08-06 — and the real path was longer than
      this line assumed: the device was at v30, so it took 30 → 31 → 32 → 33.** See the
      comment below.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

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

## Comments

### 2026-08-06 — implemented

Branch `worktree-tk-01-schema-v33`, off `feature/series-styling`.

**Files.** `migrations.ts` (v33 block + the two v3 comment corrections), `schema.ts` (32 → 33,
the same shape, and §G4's naming rule as the file's header comment), `models/Series.ts`,
`models/SeriesBook.ts`, `models/Book.ts`, `models/Settings.ts`, new `models/SuppressedSeries.ts`
and `models/BookTag.ts`, `db/index.ts` (registration), new `db/seriesProvenance.ts`, and a
`src/types/` declaration for one untyped WatermelonDB internal used by a test.

**Three decisions the ticket left open.**

1. **How the single coalesce site is reached.** `seriesProvenance.ts` holds the three readers;
   the models expose them as accessor pairs over a suffixed raw field —
   `@text('origin') originRaw` plus `get origin()` / `set origin()`. The safe read is the
   ergonomic name, so reaching past it has to be spelled `originRaw` and looks deliberate.
   The setter matters as much as the getter: without it every write site would have to know
   about the suffix, which is how the coalesce leaks back out into call sites.
2. **The readers reject more than null.** Anything that is not literally `'detected'` reads as
   `'user'`. Free today (every column is optional, so only null occurs), and it means the
   reader stays correct if one of these columns is ever made non-optional — §K10's `''`
   backfill would otherwise sail straight through a bare `?? 'user'`.
3. **`book.series` keeps the column's name.** It is the raw tag off the file and is NOT series
   membership; renaming the property away from the column was considered and rejected as
   worse for grepping. The model carries a comment saying so.

**Model registration got its own test.** `database.get()` returns **null** for an unregistered
table rather than throwing, so a forgotten `modelClasses` entry surfaces as
`Cannot read properties of null` inside a scan, far from the cause. The test asserts every
schema table resolves to a collection whose `modelClass.table` matches.

**Verification.** `tsc` 0 errors · `eslint .` 0 errors (38 warnings, all pre-existing and in
files this ticket did not touch) · jest **33 suites / 287 tests green**.

Each new guard was checked for vacuity rather than assumed:

- desynchronising `schema.ts` from the migration (dropping a column; changing one to
  non-optional) fails the coherence test — verified both ways, then restored;
- reversing the coalesce direction in `seriesProvenance.ts` fails 3 suites / 6 tests,
  including the SQL-level one — verified, then restored.

**One note on the ticket's stated baseline.** It records `jest 58 suites / 484 tests`. The
committed tip of `feature/series-styling` has **29** test files, and a clean checkout of it
runs 29 suites / 279 tests green — so 33/287 here is 29 pre-existing plus the 4 added. The
58/484 figure appears to have been measured somewhere with uncommitted work in it (the shared
checkout carries at least one uncommitted test file, `helpers/__tests__/seriesDetection.test.ts`).
Nothing is missing from this branch; the baseline line is just not reproducible from git.

**What is left.** Only the two device/emulator upgrade checks, marked above. Everything they
would prove about the SQL is proved in jest; what remains unproven is that the app launches
after the upgrade.

### 2026-08-06 — emulator upgrade VERIFIED (Pixel_7_Pro, Android 15)

**No native build was needed, and that is worth recording.** Schema and migrations are
declared in JS and handed to the adapter, so pointing the installed dev client at Metro
running from this worktree is enough to make the real migration run against the real
database. `npx expo start --dev-client` in the worktree, then
`adb shell am start -a android.intent.action.VIEW -d "sonicbooks://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"`.

**The starting state was genuinely the acceptance case**, not a fixture: `user_version = 32`
with **4 hand-made series, 11 membership rows, 8 books, 267 chapters**, and neither new table
present.

**The app's own log:**

```
[🍉] [SQLite] Database needs migrations
[🍉] [SQLite] Migrating from version 32 to 33...
[🍉] [SQLite] Migration successful
```

**Verified by diffing the database pulled before and after** (`PRAGMA user_version`, row
counts, row values, every new column, indexes):

- `user_version` 32 → 33
- row counts unchanged on all seven pre-existing tables; the `series` and `series_books`
  rows are **value-identical**, not merely equal in number
- all 13 new columns exist and are **NULL on every pre-existing row** — 4 series, 11
  membership rows, 8 books, 1 settings row. Nothing was backfilled, as designed
- `suppressed_series` and `book_tags` created, both empty
- exactly one new index on a real column, `book_tags_book_id`; no index on any Series
  column. (The two new tables also get WatermelonDB's automatic `__status` index, which is
  not an index on a Series column and is not what §G6 governs.)

**And it launches.** No `FATAL EXCEPTION`, process alive, `MainActivity` resumed, library
renders with real data (8 books, matching the table). With the Series screen switched to the
real database it lists **all 4 series with the right names and the right book counts**
(1 + 2 + 4 + 4 = 11) — so the migrated tables are read back through the models correctly,
which is the part the SQL-level test could not show.

The `'user'` resolution itself has no UI to observe — nothing reads these columns yet, by
design — so it stays covered by `seriesProvenance.test.ts` and `seriesModels.test.ts`. What
the emulator adds is that the columns really are NULL on real rows, which is the input those
readers were written for.

**HAZARD, now live on that emulator.** Its database is at v33. If an older build (main at
v31, or v32) is run against it, WatermelonDB finds no migration path *down*, logs
`Migrations not available for this version range, resetting database instead` and **wipes the
library** — silently, from the user's point of view. Same shape as the old series-v31
renumbering wipe. Anyone switching that emulator between branches should expect it.

**Still not run:** the v31 → 32 → 33 path on a real device. No device at v31 was available.

### 2026-08-06 — physical device upgrade VERIFIED (Pixel 7 Pro, Android 16)

A **release** build (`preview` profile, not debuggable) installed over the tester build on a
real phone holding a **352-book library** with two books part-listened.

**The device was at v30, not v31.** Its build (`versionCode 109`) predates the artwork
migration; `main`'s HEAD really is at v31, so nothing in §G3 is wrong — but the build on the
phone was older than the branch it came from. **The path actually exercised was therefore
30 → 31 → 32 → 33: four versions, one launch**, including main's v31 `unsafeExecuteSql`
artwork cleanup running against a real library.

```
[🍉] [SQLite] Database needs migrations
[🍉] [SQLite] Migrating from version 30 to 33...
[🍉] [SQLite] Migration successful
```

That is one migration line for the whole span, not one per version — worth knowing when
reading a device log, because "Migrating from version 30 to 33" is the *only* line that
names the range.

**Result: byte-for-byte the same screen before and after.** All (352), Unplayed (350),
Playing (2), Finished (0); `Rivers of London` at **6h 12m left** and `Addie LaRue` at
**17h 10m left**, both unchanged; covers intact; the floating player restored its position.
No `FATAL EXCEPTION`, no ANR, process alive. The upgrade is invisible, which is exactly what
this ticket promised.

**What this run adds over the emulator run.** A release build rather than a dev client; a
352-book library rather than 8; the multi-version path rather than a single step; and
confirmation that **a non-debuggable release build still emits the WatermelonDB log lines to
logcat** — the library's logger is never silenced, so `adb logcat -s ReactNativeJS` is a
usable check on a tester's phone.

**What it cannot show.** The build is not debuggable, so `run-as` is refused and the database
could not be pulled: there is no row-level before/after diff for this device, and no backup
was possible. Data preservation here is evidenced by the UI (counts and both remaining
times), not by SQL. The emulator run covers the row-level detail.

**Method note for repeating this.** `adb install -r` on a streamed install can drop the USB
transport at the end; `adb` then reports `failed to install ... Performing Streamed Install`
followed by `no devices/emulators found` **even though the install succeeded**. Check
`dumpsys package <pkg> | grep versionCode` before concluding anything — the install is
atomic, so a genuine failure leaves the old build in place.

**Hazard, now live on this phone too:** its database is at v33. Installing any older build
(the Play/closed-testing build, or anything from `main`) makes WatermelonDB find no downward
path — it logs `Migrations not available for this version range, resetting database instead`
and **wipes the 352-book library and both listening positions.**
