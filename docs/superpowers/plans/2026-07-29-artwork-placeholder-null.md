# Artwork Placeholder → NULL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop persisting the bundled placeholder image's URI into `books.artwork`, and null out the rows that already hold it, so the nullable column once again means "this book has no cover."

**Architecture:** Three independent changes. First, lock the read-side contract (`resolveTrackArtwork`) with tests, since it is the safety net for everything else. Second, change the four write sites in `usePopulateDatabase.tsx` to store `null`. Third, add a WatermelonDB v31 migration that nulls every existing `books.artwork` value that is not a `file://` URI. Existing rows cannot self-heal — `scanLibrary.ts:364` skips files already in the DB — so the migration is load-bearing, not cosmetic.

**Tech Stack:** TypeScript ~5.9.2, React Native 0.83.2, Expo ~55, React 19.2.0, WatermelonDB ^0.28.0, Jest (babel-jest, no RN preset).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-29-artwork-placeholder-null-design.md`. Read it before starting.
- **Branch:** `fix/artwork-placeholder-null`, already created off `main`. Do not work on `main`.
- **`docs/` is gitignored** (`.gitignore:57`). Never `git add -f` the spec or this plan.
- **No `test`/`lint`/`typecheck` npm scripts beyond `npm run lint`.** Use `npx jest` and `npx tsc --noEmit` directly.
- **Baseline is green:** `npx tsc --noEmit` → 0 errors; `npx jest` → 181 passed, 17 suites; `npm run lint` → **0 errors, 36 pre-existing warnings**. The 36 warnings are repo-wide noise (mostly `import/no-duplicates`) and are NOT yours to fix — leave them alone. Any *error*, or any warning in a file you touched, is something you introduced.
- **There is no `.prettierrc` in this repo. Never run `prettier --write`** — it will reformat unrelated files. Match surrounding style by hand.
- **The only legitimate stored artwork value is a `file://` URI or `null`.** Written at `scanLibrary.ts:752` and `replaceBookArtwork.ts:54`. Preserve this invariant in every change.
- **Migration SQL must end in a semicolon.** WatermelonDB concatenates all steps' SQL into one string (`@nozbe/watermelondb/adapters/sqlite/encodeSchema/index.js:88`); an unterminated statement corrupts the batch. The library asserts on this.
- **Commit after each task.** End commit messages with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer. Match the repo's `Fix:` / `Docs:` / `Test:` subject prefixes.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/helpers/__tests__/defaultArtwork.test.ts` | Create | Pins the read-side contract: what counts as a usable stored cover. |
| `src/helpers/defaultArtwork.ts` | Modify (comment only, ~lines 25-28) | Normalizes stored artwork for media consumers. Logic unchanged; its comment currently states a fact this plan makes false. |
| `src/hooks/usePopulateDatabase.tsx` | Modify (lines 8, 66, 113, 264, 311) | Writes scanned books into the DB. The four artwork writes and the now-unused import. |
| `src/db/__tests__/schemaMigrations.test.ts` | Create | Guards schema-version/migration lockstep and pins the v31 cleanup's intent. |
| `src/db/migrations.ts` | Modify (prepend at line ~9) | The v31 data-cleanup migration. |
| `src/db/schema.ts` | Modify (line 4) | Version bump 30 → 31. |

---

### Task 1: Pin the read-side artwork contract with tests

`resolveTrackArtwork` is the guard that keeps unloadable artwork values out of TrackPlayer, and it is the safety net if the migration in Task 3 somehow does not run. It has **zero tests today**. Write them first, before anything else moves, so Tasks 2 and 3 are landing on top of a characterized contract.

These are characterization tests: they document behavior that already exists and must not change. They will pass immediately. That is correct and expected here — the failing-test-first cycle applies to Task 3, where new behavior is actually being added.

**Files:**
- Create: `src/helpers/__tests__/defaultArtwork.test.ts`
- Read for context: `src/helpers/defaultArtwork.ts` (31 lines, single exported function, no imports)

**Interfaces:**
- Consumes: `resolveTrackArtwork(artwork: string | null | undefined): string | undefined` from `@/helpers/defaultArtwork`.
- Produces: nothing consumed by later tasks. This task is a standalone safety net.

- [ ] **Step 1: Write the test file**

Create `src/helpers/__tests__/defaultArtwork.test.ts`:

```ts
import { resolveTrackArtwork } from '@/helpers/defaultArtwork';

describe('resolveTrackArtwork', () => {
  it('reports no cover for every empty representation', () => {
    expect(resolveTrackArtwork(null)).toBeUndefined();
    expect(resolveTrackArtwork(undefined)).toBeUndefined();
    expect(resolveTrackArtwork('')).toBeUndefined();
  });

  it('rejects a schemeless Android resource identifier', () => {
    // What Image.resolveAssetSource() yields in a release build. RN's <Image>
    // resolves it natively, but Coil (which TrackPlayer hands it to) cannot.
    expect(
      resolveTrackArtwork('src_assets_images_unknown_track'),
    ).toBeUndefined();
  });

  it('passes a Metro asset URL through — the migration, not this guard, removes it', () => {
    // A debug build's Image.resolveAssetSource() yields this, and rows
    // predating the v31 migration may still hold it. It has a scheme, so this
    // guard deliberately lets it pass. That is the intended boundary: the
    // migration nulls it at rest and usePopulateDatabase no longer writes it,
    // whereas teaching this function about Metro hosts would put a dev-server
    // detail into production artwork resolution.
    //
    // This case is here precisely because it is the one someone would
    // "obviously" want to make return undefined. It should not.
    const uri =
      'http://10.0.2.2:8081/assets/src/assets/images/unknown_track.png';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });

  it('passes a file:// cover through unchanged', () => {
    const uri =
      'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });

  it('preserves the ?t= cache-buster written by replaceBookArtwork', () => {
    // replaceBookArtwork.ts:54 appends ?t=Date.now() so Coil's cache key
    // changes when the user picks a new cover. Stripping it would show the
    // old cover after a replacement.
    const uri =
      'file:///data/user/0/com.jbaudio/files/artwork/Pratchett_TheCarpetPeople_1a2b3c4d.webp?t=1753000000000';
    expect(resolveTrackArtwork(uri)).toBe(uri);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx jest src/helpers/__tests__/defaultArtwork.test.ts`

Expected: **PASS, 5 tests.** All five describe behavior the current implementation already has.

If the Metro-URL case fails, someone has already changed `resolveTrackArtwork` — stop and reconcile before continuing, because Task 3's migration assumes that function is unchanged.

- [ ] **Step 3: Run the full suite and typecheck**

Run: `npx jest && npx tsc --noEmit && npm run lint`

Expected: 186 passed (181 baseline + 5 new), 18 suites. `tsc` and `eslint` silent.

- [ ] **Step 4: Commit**

```bash
git add src/helpers/__tests__/defaultArtwork.test.ts
git commit -m "$(cat <<'EOF'
Test: characterize resolveTrackArtwork's stored-artwork contract

No coverage existed for the guard that keeps unloadable artwork out of
TrackPlayer. Pins the cases that matter: null/undefined/empty, the
schemeless resource id a release build stores, and file:// URIs with the
?t= cache-buster intact.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write `null` instead of the placeholder URI

**Files:**
- Modify: `src/hooks/usePopulateDatabase.tsx:8` (remove import), `:66`, `:113`, `:264`, `:311` (the four writes)
- Modify: `src/helpers/defaultArtwork.ts:25-28` (comment only)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the invariant Task 3's migration assumes — that no *new* row can acquire a non-`file://` artwork value.

**Context you need:** all four sites are identical, two in `populateBookInDatabase` (create at 66, update at 113) and two in the batched variant (create at 264, update at 311). `bookData.artwork` is already `string | null` by the time it arrives — `extractArtworkForBook` (`scanLibrary.ts:807`) returns either a `file://` URI or an explicit `null`.

- [ ] **Step 1: Change all four write sites**

In `src/hooks/usePopulateDatabase.tsx`, each of lines 66, 113, 264, 311 currently reads:

```ts
          book.artwork = bookData.artwork || unknownBookImageUri;
```

Replace each with (preserving each site's existing indentation — the two batched sites at 264/311 are indented deeper than the two at 66/113):

```ts
          book.artwork = bookData.artwork || null;
```

Use `||`, not `??`. It matches every surrounding assignment in these blocks (`bookData.artworkHeight || null`, `bookData.metadata.year || 0`) and it folds `''` as well as `null`.

- [ ] **Step 2: Remove the now-unused import**

Delete line 8 of `src/hooks/usePopulateDatabase.tsx`:

```ts
import { unknownBookImageUri } from '@/constants/images';
```

- [ ] **Step 3: Verify no references remain**

Run: `grep -n "unknownBookImageUri" src/hooks/usePopulateDatabase.tsx`

Expected: **no output** (exit code 1). If any line prints, a write site was missed.

Then confirm the remaining consumers are untouched:

Run: `grep -rln "unknownBookImageUri" src/`

Expected exactly these 8 files — seven read-side fallbacks plus one test double, all correct as-is:
`src/constants/images.ts`, `src/app/editTitleDetails.tsx`, `src/app/titleDetails.tsx`, `src/components/BookListItem.tsx`, `src/components/BookGridItem.tsx`, `src/components/player/PlayerArtwork.tsx`, `src/components/FloatingPlayer.tsx`, and `src/helpers/__tests__/chapterPlayback.test.ts` (a jest mock of `@/constants/images`, unrelated to the write path).

- [ ] **Step 4: Correct the stale comment in `defaultArtwork.ts`**

Lines 25-28 currently read:

```ts
  // No scheme → an Android resource identifier from resolveAssetSource.
  // usePopulateDatabase persists that value for coverless books, so the column
  // is truthy but unloadable; treat it as "no cover" so native substitutes.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(artwork)) return undefined;
```

Step 1 just made the second sentence false. Replace those three comment lines with:

```ts
  // No scheme → an Android resource identifier from resolveAssetSource.
  // usePopulateDatabase no longer writes that (stored artwork is now a
  // file:// URI or null, and the v31 migration cleaned up the rows that
  // predate the change), but the guard stays: it costs nothing, it fails
  // safe, and it covers any device whose migration has not yet run.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(artwork)) return undefined;
```

Leave the `if` and the rest of the function untouched. This is a comment-only edit.

- [ ] **Step 5: Verify the suite still passes**

Run: `npx jest && npx tsc --noEmit && npm run lint`

Expected: 186 passed, 18 suites, `tsc` 0 errors, `eslint` silent.

Note what this does and does not prove. There is no test harness for `usePopulateDatabase` — it needs a live WatermelonDB — so green here means "nothing else broke," not "the write is correct." The write's correctness is established by the grep in Step 3 and by device verification in Task 4. Do not fabricate a mock-heavy unit test to manufacture a green checkmark; it would test the mock, not the behavior.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePopulateDatabase.tsx src/helpers/defaultArtwork.ts
git commit -m "$(cat <<'EOF'
Fix: store null, not the placeholder URI, for books with no cover

All four usePopulateDatabase writes defaulted artwork to
unknownBookImageUri, so the nullable column was never null and every
reader's `artwork ?? fallback` was dead code. The stored value was also
build-dependent: a Metro http:// URL in debug, a schemeless resource id
in release.

Every reader already handles null, so this only removes a redundant and
incorrect write-side default.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate existing rows to `null` (schema v31)

**Files:**
- Create: `src/db/__tests__/schemaMigrations.test.ts`
- Modify: `src/db/migrations.ts` (prepend a new entry after `migrations: [` at line ~9)
- Modify: `src/db/schema.ts:4` (`version: 30` → `31`)

**Interfaces:**
- Consumes: the write-side invariant from Task 2.
- Produces: schema version 31. Any later branch adding a migration must use 32.

**Why this task exists at all:** `scanLibrary.ts:364` skips files already in the DB via the `existingUrls` set, so `usePopulateDatabase`'s update branches only fire for *newly discovered* files. Task 2 alone would leave every already-scanned coverless book holding a placeholder string forever.

**Why an allowlist:** every real cover is a `file://` URI (`scanLibrary.ts:752`, `replaceBookArtwork.ts:54`). `NOT LIKE 'file://%'` catches both the release-build resource id and the debug-build Metro URL. A denylist phrased "not `file://` and not `http(s)://`" would preserve the Metro rows.

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/schemaMigrations.test.ts`:

```ts
import migrations from '@/db/migrations';
import schema from '@/db/schema';

/**
 * Extracts the raw SQL from a migration that is expected to be a single
 * unsafeExecuteSql step. Throws (failing the test) rather than returning a
 * placeholder, so a shape change surfaces as an explicit error.
 */
function soleSqlStep(toVersion: number): string {
  const migration = migrations.sortedMigrations.find(
    m => m.toVersion === toVersion,
  );
  if (!migration) {
    throw new Error(`no migration to version ${toVersion}`);
  }
  if (migration.steps.length !== 1) {
    throw new Error(
      `migration ${toVersion} has ${migration.steps.length} steps, expected 1`,
    );
  }
  const [step] = migration.steps;
  if (step.type !== 'sql') {
    throw new Error(`migration ${toVersion} step is '${step.type}', expected 'sql'`);
  }
  return step.sql;
}

describe('schema and migrations stay in lockstep', () => {
  it('the schema version matches the newest migration', () => {
    // WatermelonDB validates that migrations have no gaps or duplicates, but
    // it does NOT check them against the schema version. Bumping one without
    // the other strands devices mid-upgrade — which has already happened here
    // once (see the v30 entry's comment about devices stuck on 29).
    expect(migrations.maxVersion).toBe(schema.version);
  });
});

describe('v31 — placeholder artwork cleanup', () => {
  it('nulls books.artwork', () => {
    expect(soleSqlStep(31)).toMatch(
      /UPDATE\s+books\s+SET\s+artwork\s*=\s*NULL/i,
    );
  });

  it('keeps only file:// values, as an allowlist', () => {
    expect(soleSqlStep(31)).toContain("NOT LIKE 'file://%'");
  });

  it('is not phrased as a denylist', () => {
    // A denylist ("not file:// and not http(s)://") looks equivalent but
    // preserves the http://10.0.2.2:8081/... Metro URL a debug build stores,
    // which is a placeholder too. Any mention of http here means someone
    // regressed the predicate.
    expect(soleSqlStep(31).toLowerCase()).not.toContain('http');
  });

  it('terminates its statement', () => {
    // The adapter concatenates every step's SQL into one string, so a missing
    // semicolon corrupts the whole batch rather than just this step.
    expect(soleSqlStep(31).trimEnd().endsWith(';')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to watch the right things fail**

Run: `npx jest src/db/__tests__/schemaMigrations.test.ts`

Expected: **1 PASS, 4 FAIL.**
- "the schema version matches the newest migration" **passes** — both are 30 right now.
- All four v31 tests **fail** with `no migration to version 31`.

- [ ] **Step 3: Add the migration only — do not touch the schema yet**

This intermediate state is deliberate: it proves the lockstep guard actually works.

In `src/db/migrations.ts`, add `unsafeExecuteSql` to the existing import at the top:

```ts
import {
  createTable,
  schemaMigrations,
  addColumns,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';
```

Then insert this as the **first** entry in the `migrations: [` array (the file lists migrations newest-first), immediately above the `toVersion: 30` entry:

```ts
    {
      // Data-only. usePopulateDatabase used to default a coverless book's
      // artwork to the bundled placeholder's URI, so the nullable column was
      // never null and "which books have no cover?" was unanswerable. A
      // rescan cannot heal these rows — scanLibrary skips files already in
      // the DB — so they have to be cleaned here.
      //
      // Allowlist, not denylist: every real cover is written as a file:// URI
      // (scanLibrary saveArtworkToFile, replaceBookArtwork). Anything else is
      // a placeholder — a schemeless resource id in a release build, a
      // http://10.0.2.2:8081/... Metro URL in a debug build.
      toVersion: 31,
      steps: [
        unsafeExecuteSql(
          "UPDATE books SET artwork = NULL WHERE artwork IS NOT NULL AND artwork NOT LIKE 'file://%';",
        ),
      ],
    },
```

- [ ] **Step 4: Run the tests and confirm the guard fires**

Run: `npx jest src/db/__tests__/schemaMigrations.test.ts`

Expected: **4 PASS, 1 FAIL.** The four v31 tests now pass; "the schema version matches the newest migration" now **fails** with `Expected: 30, Received: 31`.

That inversion is the point of the guard — it just caught a half-finished version bump. Proceed to Step 5.

- [ ] **Step 5: Bump the schema version**

In `src/db/schema.ts`, line 4:

```ts
  version: 30,
```

becomes:

```ts
  version: 31,
```

Change nothing else in that file. `artwork` is already `isOptional: true` (line 15) — no column definition changes are needed, because this migration only touches data.

- [ ] **Step 6: Run the tests and verify all pass**

Run: `npx jest src/db/__tests__/schemaMigrations.test.ts`

Expected: **PASS, 5 tests.**

- [ ] **Step 7: Full verification**

Run: `npx jest && npx tsc --noEmit && npm run lint`

Expected: 191 passed (181 baseline + 5 from Task 1 + 5 here), 19 suites, `tsc` 0 errors, `eslint` silent.

- [ ] **Step 8: Commit**

```bash
git add src/db/migrations.ts src/db/schema.ts src/db/__tests__/schemaMigrations.test.ts
git commit -m "$(cat <<'EOF'
Fix: migrate persisted placeholder artwork to null (schema v31)

Rows written before the previous commit still hold the placeholder URI,
and a rescan cannot heal them — scanLibrary skips files already in the
DB, so usePopulateDatabase's update path never fires for them.

Nulls any books.artwork that is not a file:// URI. Allowlist rather than
denylist so it also catches the http://10.0.2.2:8081/... Metro URL a
debug build stores.

Adds a test asserting schema.version tracks the newest migration —
WatermelonDB checks migrations for gaps but never compares them to the
schema, and this repo has already stranded devices that way once.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Device verification

Nothing above proves the migration runs correctly on a real database — the test suite has no RN preset and cannot open SQLite. This task is where the change is actually validated. **Do not report this work as complete before finishing it.**

**Files:** none modified. This is verification only.

**Interfaces:**
- Consumes: the branch as of Task 3.
- Produces: a verified result, and an updated memory note.

- [ ] **Step 1: Build onto a device that already has a v30 database**

The upgrade path is the one that matters — a fresh install exercises neither the migration nor the old rows.

Use a device or emulator with an existing library scanned by a v30 build. Do **not** uninstall first; that would destroy the v30 data you are testing against.

**First, capture the pre-upgrade baseline.** Without it, Step 2 cannot tell a correct migration apart from one that nulled every row including real covers:

```bash
adb shell run-as com.jbaudio ls databases/
adb shell run-as com.jbaudio sqlite3 databases/<dbname> \
  "SELECT COUNT(*) FROM books WHERE artwork LIKE 'file://%';"
```

Write that number down. It is the single strongest check in this task.

Then run: `npm run android`

**How to tell the migration failed.** A thrown migration does **not** reset the library — that is a different failure mode (no migration path exists). `src/db/index.ts:23-25` defines `onSetUpError` as an empty stub, so a migration that throws is **completely silent**: the app launches, the library looks intact, and `books.artwork` is simply unchanged. Do not use "did the library survive?" as your signal. Use these instead:

```bash
adb logcat -d | grep -i 'SQLite.*[Mm]igration'   # expect "Migration successful"
adb shell run-as com.jbaudio sqlite3 databases/<dbname> "PRAGMA user_version;"   # must be 31
```

If `user_version` is still 30, the migration did not run or threw. Stop and capture logcat.

- [ ] **Step 2: Confirm the column is actually NULL**

```bash
adb shell run-as com.jbaudio ls databases/
adb shell run-as com.jbaudio sqlite3 databases/<dbname> \
  "SELECT COUNT(*) AS total, SUM(artwork IS NULL) AS nulls, SUM(artwork IS NOT NULL AND artwork NOT LIKE 'file://%') AS leftovers FROM books;"
```

Expected: `leftovers` is **0**. `nulls` should equal the number of books you know have no embedded cover.

**Then the check that actually matters** — re-run the baseline query from Step 1:

```bash
adb shell run-as com.jbaudio sqlite3 databases/<dbname> \
  "SELECT COUNT(*) FROM books WHERE artwork LIKE 'file://%';"
```

This must be **identical** to the number you wrote down before upgrading. `leftovers = 0` on its own is satisfied both by a correct migration *and* by a broken predicate that nulled everything; only the unchanged `file://` count distinguishes them.

(If `sqlite3` is unavailable in the shell, `adb exec-out run-as com.jbaudio cat databases/<dbname> > /tmp/db.sqlite` and query it locally.)

- [ ] **Step 3: Verify the placeholder still renders everywhere**

Every one of these reads the column independently, and a `null` regression looks different in each. Check all five for a book with no cover:

1. **Library list** (`BookListItem`) — placeholder, not a blank or broken-image box.
2. **Library grid** (`BookGridItem`) — same.
3. **Player screen** (`PlayerArtwork`) plus the mini player (`FloatingPlayer`).
4. **Notification player** — start playback and pull down the shade. This one is served by the native `applyDefaultArtwork` in the RNTP patch, not by JS, so it is the case most likely to differ.

   **Known pre-existing bug, do NOT blame this branch.** On a *coverless single-file book*, the cover will disappear from the notification at the first chapter boundary. `src/setup/service.js:185` passes the raw `book.artwork` to `updateMetadataForTrack`, and the RNTP patch calls `applyDefaultArtwork` only in `add()`, not in `updateMetadataForTrack` — so the placeholder gets overwritten. This behaved the same way before this branch (it previously wrote the equally-unloadable schemeless resource id). It needs a separate patch fix; log it, don't fix it here.
5. **Android Auto** — browse to the book. Expect AA's own generic tile; the browse tree deliberately sets no artwork URI for coverless books.

- [ ] **Step 4: Verify a book that HAS a cover is untouched**

Confirm a book with embedded art still shows it, and that a manually-picked cover (via edit → cover search) still shows after the migration. The `?t=` cache-buster means a manually-picked cover's URI contains a query string — a mis-written `LIKE` pattern could have nulled exactly these.

- [ ] **Step 5: Verify a fresh scan writes null**

Add a coverless audiobook to the library, rescan, then re-run the query from Step 2. `leftovers` must still be 0 and `nulls` must have increased by one. This is what proves Task 2 landed.

**Scope limit, state it in your report:** this exercises only the *create* path (`usePopulateDatabase.tsx:65`). The two update branches at `:112` and `:310` are effectively unreachable — `scanLibrary.ts:364` skips files already in the DB, so a rescan never revisits an existing book. They were changed as defence against that skip logic changing, and nothing verifies them. Do not claim all four sites were validated.

- [ ] **Step 6: Update the memory note**

`/home/jason/.claude/projects/-home-jason-Development-JBAudio/memory/artwork-placeholder-persisted-in-db.md` currently describes this as an OPEN follow-up. Rewrite it to record the resolution: the four writes now store `null`, schema v31 cleaned existing rows with a `file://` allowlist, `resolveTrackArtwork` was kept as defence in depth, and the note's original denylist prescription was wrong because it would have preserved debug-build Metro URLs.

Also update `MEMORY.md`'s one-line pointer, and the `series-feature.md` note — `feature/series` must now move from v31 to v32.

- [ ] **Step 7: Report honestly**

State plainly which of Steps 1-5 passed and which did not. If Android Auto or the notification could not be checked (no car head unit, no second device), say so explicitly rather than implying coverage. Partial verification reported as partial is fine; partial verification reported as complete is not.

---

## Rollout Notes

**Downgrade trap.** Once a device reaches v31, installing any v30-based build resets its database and forces a full rescan — WatermelonDB cannot migrate downwards. Uninstall before sideloading an older build. This is the same hazard already documented for `feature/series`.

**Schema collision.** `feature/series` (unmerged) also claims v31. Once this lands on `main`, that branch must move its schema and migration entry to v32. Do not edit that branch as part of this work.

**Closed testing.** Testers are on real builds. The migration is a single `UPDATE` with no schema change, which is about as low-risk as a migration gets, but it is still the first `unsafeExecuteSql` in this repo — Task 4 Step 1's upgrade-path check is the gate that matters before shipping.

## Out of Scope

- `PLACEHOLDER_ARTWORK_SIZE = 500` (`scanLibrary.ts:774`) still writes 500×500 dimensions for coverless books. Same smell, but benign — it yields the 1:1 ratio the placeholder wants, and readers guard on null before using the dimensions.
- Tightening `resolveTrackArtwork` to a `file://`-only test. The new invariant would permit it; the looser check costs nothing and fails safe.
- Any bulk "find books missing covers" screen. No such feature exists or is planned; it is cited in the spec only to make the cost of the broken column concrete.
