# Series Styling Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Series feature's visuals and interactions — floating create button, header edit icon, per-tab empty states, scroll reset, wizard spacing, self-explaining buttons, duplicate-name blocking — and close out the clipped collapsed-row bug.

**Architecture:** Pure logic (name validation, empty-state copy) goes into DB-free helpers under `src/helpers/` with Jest coverage. Presentational components stay dumb: `SeriesHome` receives a computed `emptyMessage` string rather than deriving it. The FAB subscribes to the existing `useScrollDirection` shared value so it animates on the UI thread alongside the SearchBar. Row-height constants are consolidated so `BooksHorizontal` and `BookGridItem` stop disagreeing.

**Tech Stack:** React Native 0.83.2, Expo 55, React 19 + React Compiler, Hermes, New Architecture. FlashList 2.3.2, Reanimated 4.2.1 / worklets 0.7.2, WatermelonDB 0.28, Zustand 5, expo-router, lucide-react-native, pressto, react-native-sortables 1.10.

**Spec:** `docs/superpowers/specs/2026-07-25-series-styling-pass-design.md`

**Branch:** `feature/series-styling` (already created, off `feature/series`)

## Global Constraints

- **Never run `prettier --write`.** There is no `.prettierrc`; it rewrites the repo to double quotes. Match surrounding style by hand (single quotes, 2-space indent).
- **Never run `expo prebuild --clean`.** `android/` is committed and holds a custom turbomodule.
- **React Compiler is enabled.** Do not add `'use no memo'`. Read/write Reanimated shared values with `.get()` / `.set()` outside worklets; `.value` reads inside `useAnimatedStyle` worklets are the existing convention (see `src/components/SearchBar.tsx:38`).
- **Verification commands:** `npx jest` (must stay green, 172 passing before this plan), `npx tsc --noEmit` (0 errors), `npx eslint .` (0 errors). All three are green on `feature/series` and must stay green.
- **expo-router typed routes:** series routes need `as any` on the path, e.g. `router.navigate('/series/create/authors' as any)`. Follow the existing call sites.
- **Fonts:** `fontFamily: 'Rubik'` with `fontWeight: '400' | '500' | '600'`. Never invent family names like `Rubik-SemiBold`.
- **Design tokens:** import `fontSize`, `screenPadding` from `@/constants/tokens`; colors come from `useTheme()`, never hardcoded hex.
- **Exact copy strings** (must match character for character):
  - `No series have been set up. Tap + to build a new one.`
  - `No series match your search.`
  - `No unplayed series.`
  - `No series in progress.`
  - `No finished series.`
  - `Select at least one author.`
  - `Enter a series name.`
  - `Select at least one book.`
  - `A series named "<name>" already exists. Choose a different name.`
  - Alert titles: `Can't continue` (wizard) / `Can't save` (edit screen)
- **Commit style:** conventional commits, and end every commit message with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Device verification is required** for every UI task; Jest only covers the pure helpers. Do not claim a UI task verified without running it on the device.

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `src/helpers/seriesName.ts` | DB-free name normalization, duplicate detection, `SeriesNameConflictError` |
| `src/helpers/__tests__/seriesName.test.ts` | Jest coverage for the above |
| `src/helpers/seriesEmptyMessage.ts` | Picks the Series-view empty-list message |
| `src/helpers/__tests__/seriesEmptyMessage.test.ts` | Jest coverage for the above |
| `src/helpers/seriesValidation.ts` | Builds the list of unmet requirements for wizard/edit buttons |
| `src/helpers/__tests__/seriesValidation.test.ts` | Jest coverage for the above |
| `src/components/CreateSeriesFab.tsx` | Floating action button, hides with the search bar |

**Modified:**

| File | Change |
| --- | --- |
| `src/db/seriesQueries.ts` | Re-export `normalizeSortName`; duplicate guard in `createSeries` / `updateSeries` |
| `src/components/BookGridItem.tsx` | Shared row-height constant; placeholder instead of `null` |
| `src/components/BooksHorizontal.tsx` | Shared row-height constant; drop cross-axis padding; `__DEV__` probe |
| `src/components/SeriesHome.tsx` | Drop `editBar` + create button; header pencil icon; `emptyMessage` prop; `listRef`; `__DEV__` probe |
| `src/components/BooksHome.tsx` | Scroll reset on tab change |
| `src/components/BooksGrid.tsx` | `listRef` + scroll reset on tab change |
| `src/app/(drawer)/(library)/index.tsx` | Render FAB; compute + pass `emptyMessage`; pass `selectedTab` down |
| `src/app/series/create/authors.tsx` | Self-explaining Next button |
| `src/app/series/create/books.tsx` | Row spacing; self-explaining Next button; duplicate-name rule |
| `src/app/series/create/order.tsx` | Handle `SeriesNameConflictError` |
| `src/app/series/edit/[id].tsx` | Self-explaining Save button; duplicate-name rule excluding self |

---

## Task 1: Series name helper (pure)

**Files:**
- Create: `src/helpers/seriesName.ts`
- Create: `src/helpers/__tests__/seriesName.test.ts`
- Modify: `src/db/seriesQueries.ts:12`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `normalizeSortName(name: string): string`
  - `isDuplicateSeriesName(name: string, series: { id: string; name: string }[], excludeId?: string): boolean`
  - `duplicateNameIssue(name: string): string` — the single definition of the duplicate-name sentence, used for both the Error's message and the UI alert copy.
  - `class SeriesNameConflictError extends Error` with `readonly name = 'SeriesNameConflictError'` and a `conflictingName: string` property.

**Why this file exists:** `normalizeSortName` currently lives in `src/db/seriesQueries.ts`, which imports `@/db` (WatermelonDB). Any pure helper importing it would drag the database into Jest. Moving it to a DB-free module keeps validation unit-testable, matching how `seriesAssembly.ts` and `seriesProgress.ts` are already structured.

- [ ] **Step 1: Write the failing test**

Create `src/helpers/__tests__/seriesName.test.ts`:

```ts
import {
  normalizeSortName,
  isDuplicateSeriesName,
  SeriesNameConflictError,
} from '@/helpers/seriesName';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

test('normalizeSortName trims and lowercases', () => {
  expect(normalizeSortName('  Dune Saga ')).toBe('dune saga');
});

test('exact name is a duplicate', () => {
  expect(isDuplicateSeriesName('Dune Saga', series)).toBe(true);
});

test('case difference is a duplicate', () => {
  expect(isDuplicateSeriesName('dune saga', series)).toBe(true);
});

test('surrounding whitespace is a duplicate', () => {
  expect(isDuplicateSeriesName('  Dune Saga  ', series)).toBe(true);
});

test('unused name is not a duplicate', () => {
  expect(isDuplicateSeriesName('Wheel of Time', series)).toBe(false);
});

test('blank name is never a duplicate', () => {
  expect(isDuplicateSeriesName('   ', series)).toBe(false);
});

test('renaming a series to its own name is not a duplicate', () => {
  expect(isDuplicateSeriesName('Dune Saga', series, 's1')).toBe(false);
});

test('renaming a series to another series name IS a duplicate', () => {
  expect(isDuplicateSeriesName('Foundation', series, 's1')).toBe(true);
});

test('empty series list is never a duplicate', () => {
  expect(isDuplicateSeriesName('Anything', [])).toBe(false);
});

test('duplicateNameIssue builds the exact sentence', () => {
  expect(duplicateNameIssue('Dune Saga')).toBe(
    'A series named "Dune Saga" already exists. Choose a different name.',
  );
});

test('SeriesNameConflictError carries the conflicting name', () => {
  const err = new SeriesNameConflictError('Dune Saga');
  expect(err.conflictingName).toBe('Dune Saga');
  expect(err.name).toBe('SeriesNameConflictError');
  expect(err instanceof Error).toBe(true);
});

test('SeriesNameConflictError message reuses duplicateNameIssue', () => {
  expect(new SeriesNameConflictError('Dune Saga').message).toBe(
    duplicateNameIssue('Dune Saga'),
  );
});
```

Add `duplicateNameIssue` to the import at the top of the test file.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx jest src/helpers/__tests__/seriesName.test.ts`
Expected: FAIL — `Cannot find module '@/helpers/seriesName'`

- [ ] **Step 3: Write the implementation**

Create `src/helpers/seriesName.ts`:

```ts
/**
 * DB-free series-name utilities. Deliberately imports nothing from `@/db` so
 * validation stays unit-testable without pulling WatermelonDB into Jest;
 * `db/seriesQueries.ts` re-exports normalizeSortName for its own use.
 */

/** Comparison key for a series name: trimmed and case-folded. */
export const normalizeSortName = (name: string) => name.trim().toLowerCase();

/**
 * True when `name` collides with an existing series. Comparison is
 * case-insensitive and whitespace-trimmed (i.e. sortName equality), matching
 * the `sort_name` column persisted on create and update.
 *
 * `excludeId` omits one series from the check so renaming a series to its own
 * name is never reported as a conflict.
 */
export function isDuplicateSeriesName(
  name: string,
  series: { id: string; name: string }[],
  excludeId?: string,
): boolean {
  const key = normalizeSortName(name);
  if (!key) return false;
  return series.some(
    (s) => s.id !== excludeId && normalizeSortName(s.name) === key,
  );
}

/**
 * The one definition of the duplicate-name sentence. Both the Error's message
 * and the UI alert copy come from here so the two can never drift apart.
 */
export const duplicateNameIssue = (name: string) =>
  `A series named "${name}" already exists. Choose a different name.`;

/** Thrown by the query layer when a write would create a duplicate name. */
export class SeriesNameConflictError extends Error {
  readonly conflictingName: string;

  constructor(conflictingName: string) {
    super(duplicateNameIssue(conflictingName));
    this.name = 'SeriesNameConflictError';
    this.conflictingName = conflictingName;
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx jest src/helpers/__tests__/seriesName.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Re-export from the query layer**

In `src/db/seriesQueries.ts`, replace line 12:

```ts
export const normalizeSortName = (name: string) => name.trim().toLowerCase();
```

with an import at the top of the file (next to the other imports) and a re-export:

```ts
import {
  normalizeSortName,
  SeriesNameConflictError,
} from '@/helpers/seriesName';
```

```ts
export { normalizeSortName, SeriesNameConflictError };
```

Keep the existing `export { computeMembershipDiff } from '@/db/seriesMembershipDiff';` line as-is. Every current call site of `normalizeSortName` keeps working unchanged.

- [ ] **Step 6: Verify nothing regressed**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: Jest 182 passing (172 + 10 new), tsc 0 errors, eslint 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/helpers/seriesName.ts src/helpers/__tests__/seriesName.test.ts src/db/seriesQueries.ts
git commit -m "$(cat <<'EOF'
feat: DB-free series name helper with duplicate detection

Moves normalizeSortName out of seriesQueries (which imports the database)
so name validation is unit-testable, and adds isDuplicateSeriesName plus a
typed SeriesNameConflictError.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Empty-state message helper (pure)

**Files:**
- Create: `src/helpers/seriesEmptyMessage.ts`
- Create: `src/helpers/__tests__/seriesEmptyMessage.test.ts`

**Interfaces:**
- Consumes: `CustomTabs` enum from `@/components/TabScreen` (`Unplayed = 0, Started = 1, Finished = 2, All = 3`).
- Produces: `seriesEmptyMessage(args: { totalSeriesCount: number; searchMatchCount: number; hasSearchQuery: boolean; selectedTab: CustomTabs }): string`

**Why:** `SeriesHome` only ever receives `tabFilteredSeries`, so it cannot tell "no series exist" from "this tab is empty". Today one played series makes both the Unplayed and Finished tabs claim no series have been set up. The decision needs `allSeries`, the search-filtered list and the tab — all of which live in `index.tsx` — so it is computed there and passed down as a string.

- [ ] **Step 1: Write the failing test**

Create `src/helpers/__tests__/seriesEmptyMessage.test.ts`:

```ts
import { seriesEmptyMessage } from '@/helpers/seriesEmptyMessage';
import { CustomTabs } from '@/components/TabScreen';

const base = {
  totalSeriesCount: 3,
  searchMatchCount: 3,
  hasSearchQuery: false,
  selectedTab: CustomTabs.All,
};

test('no series at all wins over every other case', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      totalSeriesCount: 0,
      searchMatchCount: 0,
      hasSearchQuery: true,
      selectedTab: CustomTabs.Unplayed,
    }),
  ).toBe('No series have been set up. Tap + to build a new one.');
});

test('active search with no matches', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      hasSearchQuery: true,
      searchMatchCount: 0,
      selectedTab: CustomTabs.Unplayed,
    }),
  ).toBe('No series match your search.');
});

test('search matches exist but the tab is empty → tab message', () => {
  expect(
    seriesEmptyMessage({
      ...base,
      hasSearchQuery: true,
      searchMatchCount: 2,
      selectedTab: CustomTabs.Finished,
    }),
  ).toBe('No finished series.');
});

test('unplayed tab', () => {
  expect(
    seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Unplayed }),
  ).toBe('No unplayed series.');
});

test('started tab', () => {
  expect(seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Started })).toBe(
    'No series in progress.',
  );
});

test('finished tab', () => {
  expect(
    seriesEmptyMessage({ ...base, selectedTab: CustomTabs.Finished }),
  ).toBe('No finished series.');
});

test('All tab falls back to the no-series message', () => {
  expect(seriesEmptyMessage({ ...base, selectedTab: CustomTabs.All })).toBe(
    'No series have been set up. Tap + to build a new one.',
  );
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx jest src/helpers/__tests__/seriesEmptyMessage.test.ts`
Expected: FAIL — `Cannot find module '@/helpers/seriesEmptyMessage'`

- [ ] **Step 3: Write the implementation**

Create `src/helpers/seriesEmptyMessage.ts`:

```ts
import { CustomTabs } from '@/components/TabScreen';

export const NO_SERIES_MESSAGE =
  'No series have been set up. Tap + to build a new one.';

type Args = {
  /** Every series that exists, before search or tab filtering. */
  totalSeriesCount: number;
  /** Series remaining after the search filter, before tab filtering. */
  searchMatchCount: number;
  hasSearchQuery: boolean;
  selectedTab: CustomTabs;
};

/**
 * Message for the Series list when it renders empty. Evaluated in order, so
 * "you have no series" always beats "this tab is empty" — otherwise a single
 * played series makes the Unplayed and Finished tabs both claim nothing has
 * been set up.
 *
 * The All tab has no case of its own: with series present and no active search
 * it can never be empty. It falls through to NO_SERIES_MESSAGE rather than
 * rendering a blank list.
 */
export function seriesEmptyMessage({
  totalSeriesCount,
  searchMatchCount,
  hasSearchQuery,
  selectedTab,
}: Args): string {
  if (totalSeriesCount === 0) return NO_SERIES_MESSAGE;
  if (hasSearchQuery && searchMatchCount === 0)
    return 'No series match your search.';
  switch (selectedTab) {
    case CustomTabs.Unplayed:
      return 'No unplayed series.';
    case CustomTabs.Started:
      return 'No series in progress.';
    case CustomTabs.Finished:
      return 'No finished series.';
    default:
      return NO_SERIES_MESSAGE;
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx jest src/helpers/__tests__/seriesEmptyMessage.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/helpers/seriesEmptyMessage.ts src/helpers/__tests__/seriesEmptyMessage.test.ts
git commit -m "$(cat <<'EOF'
feat: per-tab empty-state message helper for the Series view

Distinguishes "no series exist" from "none on this tab" and from "no
search matches", so a single played series no longer makes the Unplayed
and Finished tabs claim nothing has been set up.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Button validation helper (pure)

**Files:**
- Create: `src/helpers/seriesValidation.ts`
- Create: `src/helpers/__tests__/seriesValidation.test.ts`

**Interfaces:**
- Consumes: `isDuplicateSeriesName` from Task 1.
- Produces:
  - `seriesAuthorStepIssues(selectedAuthorNames: string[]): string[]`
  - `seriesBookStepIssues(args: { name: string; selectedBookKeys: string[]; series: { id: string; name: string }[]; isEdit: boolean }): string[]`
  - `duplicateNameIssue(name: string): string`
  - `seriesEditIssues(args: { name: string; series: { id: string; name: string }[]; excludeId?: string }): string[]`

Each returns a list of human-readable problems; an empty array means the button is valid. Screens use `issues.length === 0` for the active/inactive styling and show `issues.join('\n')` in the alert.

- [ ] **Step 1: Write the failing test**

Create `src/helpers/__tests__/seriesValidation.test.ts`:

```ts
import {
  seriesAuthorStepIssues,
  seriesBookStepIssues,
  seriesEditIssues,
} from '@/helpers/seriesValidation';

const series = [
  { id: 's1', name: 'Dune Saga' },
  { id: 's2', name: 'Foundation' },
];

describe('author step', () => {
  test('no authors selected', () => {
    expect(seriesAuthorStepIssues([])).toEqual(['Select at least one author.']);
  });

  test('one author selected is valid', () => {
    expect(seriesAuthorStepIssues(['Frank Herbert'])).toEqual([]);
  });
});

describe('book step (create)', () => {
  const base = {
    name: 'Wheel of Time',
    selectedBookKeys: ['/a/1.m4b'],
    series,
    isEdit: false,
  };

  test('valid create', () => {
    expect(seriesBookStepIssues(base)).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesBookStepIssues({ ...base, name: '  ' })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('no books', () => {
    expect(seriesBookStepIssues({ ...base, selectedBookKeys: [] })).toEqual([
      'Select at least one book.',
    ]);
  });

  test('duplicate name', () => {
    expect(seriesBookStepIssues({ ...base, name: 'dune saga' })).toEqual([
      'A series named "dune saga" already exists. Choose a different name.',
    ]);
  });

  test('multiple problems are all reported, name first', () => {
    expect(
      seriesBookStepIssues({
        ...base,
        name: 'Foundation',
        selectedBookKeys: [],
      }),
    ).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
      'Select at least one book.',
    ]);
  });

  test('edit mode ignores the name entirely', () => {
    expect(
      seriesBookStepIssues({ ...base, isEdit: true, name: 'Dune Saga' }),
    ).toEqual([]);
  });

  test('edit mode still requires a book', () => {
    expect(
      seriesBookStepIssues({ ...base, isEdit: true, selectedBookKeys: [] }),
    ).toEqual(['Select at least one book.']);
  });
});

describe('edit screen', () => {
  test('valid rename', () => {
    expect(seriesEditIssues({ name: 'Dune Chronicles', series })).toEqual([]);
  });

  test('blank name', () => {
    expect(seriesEditIssues({ name: '', series })).toEqual([
      'Enter a series name.',
    ]);
  });

  test('renaming to its own name is valid', () => {
    expect(
      seriesEditIssues({ name: 'Dune Saga', series, excludeId: 's1' }),
    ).toEqual([]);
  });

  test('renaming onto another series is a duplicate', () => {
    expect(
      seriesEditIssues({ name: 'Foundation', series, excludeId: 's1' }),
    ).toEqual([
      'A series named "Foundation" already exists. Choose a different name.',
    ]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx jest src/helpers/__tests__/seriesValidation.test.ts`
Expected: FAIL — `Cannot find module '@/helpers/seriesValidation'`

- [ ] **Step 3: Write the implementation**

Create `src/helpers/seriesValidation.ts`:

```ts
import {
  duplicateNameIssue,
  isDuplicateSeriesName,
} from '@/helpers/seriesName';

type SeriesLike = { id: string; name: string };

// Re-exported so the wizard/edit screens have one import site for validation
// copy. The sentence itself is defined once, in seriesName.ts.
export { duplicateNameIssue };

/** Wizard step 1. */
export function seriesAuthorStepIssues(
  selectedAuthorNames: string[],
): string[] {
  return selectedAuthorNames.length > 0
    ? []
    : ['Select at least one author.'];
}

/**
 * Wizard step 2. In edit mode this screen is the "Add books" sub-flow: it shows
 * no name input, so only the book requirement applies.
 */
export function seriesBookStepIssues({
  name,
  selectedBookKeys,
  series,
  isEdit,
}: {
  name: string;
  selectedBookKeys: string[];
  series: SeriesLike[];
  isEdit: boolean;
}): string[] {
  const issues: string[] = [];
  // No excludeId: this screen only checks the name in CREATE mode, where no
  // series exists yet to exclude.
  if (!isEdit) {
    if (name.trim().length === 0) issues.push('Enter a series name.');
    else if (isDuplicateSeriesName(name, series))
      issues.push(duplicateNameIssue(name));
  }
  if (selectedBookKeys.length === 0)
    issues.push('Select at least one book.');
  return issues;
}

/** Edit screen Save button. Book count is not checked here: removing the last
 *  book is an intentional path that deletes the series (see updateSeries). */
export function seriesEditIssues({
  name,
  series,
  excludeId,
}: {
  name: string;
  series: SeriesLike[];
  excludeId?: string;
}): string[] {
  if (name.trim().length === 0) return ['Enter a series name.'];
  if (isDuplicateSeriesName(name, series, excludeId))
    return [duplicateNameIssue(name)];
  return [];
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx jest src/helpers/__tests__/seriesValidation.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Verify the whole suite**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: Jest 202 passing (172 + 10 + 7 + 13), tsc 0 errors, eslint 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/helpers/seriesValidation.ts src/helpers/__tests__/seriesValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: series wizard validation issue lists

Returns human-readable unmet requirements per screen so buttons can both
style themselves inactive and explain why on press, instead of being dead.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Query-layer duplicate guard

**Files:**
- Modify: `src/db/seriesQueries.ts` (`createSeries` ~lines 18-44, `updateSeries` ~lines 50-103)

**Interfaces:**
- Consumes: `SeriesNameConflictError`, `normalizeSortName` from Task 1.
- Produces: `createSeries` and `updateSeries` reject duplicates by throwing `SeriesNameConflictError`.

**Why:** the wizard collects the name on the books screen but does not write until "Create Series" two screens later, so the UI check alone sits far upstream of the write. This is not unit-tested — it needs the database — so it is verified on device in Task 12.

- [ ] **Step 1: Add a shared lookup helper**

Add to `src/db/seriesQueries.ts`, below `createSeries`'s imports and above `createSeries`:

```ts
/**
 * Throw if `name` collides with an existing series' sort_name. `excludeId`
 * omits the series being renamed so saving an unchanged name still works.
 * Queries sort_name directly rather than reusing isDuplicateSeriesName so the
 * check runs against the database, not a possibly-stale store snapshot.
 */
async function assertSeriesNameAvailable(
  name: string,
  excludeId?: string,
): Promise<void> {
  const key = normalizeSortName(name);
  if (!key) return;
  const clashes = await database
    .get<Series>('series')
    .query(Q.where('sort_name', key))
    .fetch();
  const conflict = clashes.some(
    (s) => s.id !== excludeId && s._raw._status !== 'deleted',
  );
  if (conflict) throw new SeriesNameConflictError(name.trim());
}
```

- [ ] **Step 2: Guard `createSeries`**

In `createSeries`, insert the check as the first statement of the function body, **before** `await database.write(...)` (a throw inside a writer would abort the transaction mid-flight):

```ts
export async function createSeries(
  name: string,
  bookKeysInOrder: string[],
): Promise<string> {
  await assertSeriesNameAvailable(name);
  let newId = '';
  await database.write(async () => {
```

Leave the rest of the function untouched.

- [ ] **Step 3: Guard `updateSeries`**

In `updateSeries`, insert the check after the empty-membership early return and before `await database.write(...)`:

```ts
  if (bookKeysInOrder.length === 0) {
    await deleteSeries(id);
    return;
  }
  await assertSeriesNameAvailable(name, id);
  await database.write(async () => {
```

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 5: Commit**

```bash
git add src/db/seriesQueries.ts
git commit -m "$(cat <<'EOF'
feat: reject duplicate series names at the query layer

createSeries/updateSeries throw SeriesNameConflictError on a sort_name
collision. The wizard collects the name two screens before it writes, so
the UI check alone sits too far upstream of the write to be the only guard.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Self-explaining buttons — authors screen

**Files:**
- Modify: `src/app/series/create/authors.tsx:24` (`canProceed`), `:110-130` (Next button)

**Interfaces:**
- Consumes: `seriesAuthorStepIssues` from Task 3.
- Produces: the alert pattern the next two tasks copy.

- [ ] **Step 1: Import the helper and Alert**

At the top of `src/app/series/create/authors.tsx`, add `Alert` to the existing `react-native` import (it currently imports `FlatList, Pressable, StyleSheet, Text, View`), and add:

```ts
import { seriesAuthorStepIssues } from '@/helpers/seriesValidation';
```

- [ ] **Step 2: Replace the `canProceed` boolean with an issue list**

Replace line 24:

```ts
  const canProceed = selected.length > 0;
```

with:

```ts
  const issues = useMemo(() => seriesAuthorStepIssues(selected), [selected]);
  const canProceed = issues.length === 0;
```

Add `useMemo` to the existing `react` import (`import React, { useCallback, useMemo } from 'react';`).

- [ ] **Step 3: Add the press handler**

Below `handleExit`, add:

```ts
  // The button stays visually inactive but remains pressable: a greyed-out
  // button that does nothing gives the user no way to find out what's missing.
  const handleNext = useCallback(() => {
    if (issues.length > 0) {
      Alert.alert("Can't continue", issues.join('\n'));
      return;
    }
    router.navigate('/series/create/books' as any);
  }, [issues, router]);
```

- [ ] **Step 4: Rewire the Next button**

Replace the `onPress` and `disabled` props on the Next `Pressable` (currently lines 111-112):

```tsx
          onPress={() => router.navigate('/series/create/books' as any)}
          disabled={!canProceed}
```

with:

```tsx
          onPress={handleNext}
```

Leave the `style` and `Text` blocks exactly as they are — `canProceed` still drives the inactive colors.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint .`
Expected: 0 errors from both

- [ ] **Step 6: Commit**

```bash
git add src/app/series/create/authors.tsx
git commit -m "$(cat <<'EOF'
feat: authors step Next button explains what's missing

Keeps the inactive styling but drops `disabled`, alerting on press instead
of silently ignoring the tap.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Books screen — row spacing, validation, duplicate names

**Files:**
- Modify: `src/app/series/create/books.tsx:70-72` (`canProceed`), `:74-98` (`handleNext`), `:178-202` (Next button), `:233-243` (styles)

**Interfaces:**
- Consumes: `seriesBookStepIssues` from Task 3, `useDerivedSeries` from `@/store/seriesStore`.
- Produces: nothing new.

- [ ] **Step 1: Fix the row spacing**

In the `styles` block, change `listContent` and `authorHeading`:

```ts
  listContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingVertical: 8,
    gap: 8,
  },
  authorHeading: {
    fontFamily: 'Rubik',
    fontWeight: '600',
    fontSize: fontSize.sm,
    marginTop: 6,
    marginBottom: 0,
  },
```

The heading margins drop because the new container `gap` applies between *every* pair of items, headings included — leaving them at 14/6 would stack on top of the gap and push headings adrift. Net result: 8px between selection rows (matching `order.tsx`'s `Sortable.Grid rowGap={8}`) and ~14px above each author heading.

- [ ] **Step 2: Import the helper, the store and Alert**

Add `Alert` to the existing `react-native` import, and add:

```ts
import { useDerivedSeries } from '@/store/seriesStore';
import { seriesBookStepIssues } from '@/helpers/seriesValidation';
```

- [ ] **Step 3: Replace `canProceed` with the issue list**

Replace lines 70-72:

```ts
  const canProceed = isEdit
    ? selectedBookKeys.length > 0
    : name.trim().length > 0 && selectedBookKeys.length > 0;
```

with:

```ts
  const allSeries = useDerivedSeries();
  // Recomputes per keystroke (name is draft-store state), so the button goes
  // inactive the moment a duplicate name is typed.
  const issues = useMemo(
    () =>
      seriesBookStepIssues({
        name,
        selectedBookKeys,
        series: allSeries,
        isEdit,
      }),
    [name, selectedBookKeys, allSeries, isEdit],
  );
  const canProceed = issues.length === 0;
```

- [ ] **Step 4: Guard `handleNext`**

Add the issue check as the first statement inside `handleNext` (before the `if (isEdit)` branch):

```ts
  const handleNext = useCallback(() => {
    if (issues.length > 0) {
      Alert.alert("Can't continue", issues.join('\n'));
      return;
    }
    if (isEdit) {
```

and add `issues` to the `useCallback` dependency array.

- [ ] **Step 5: Drop `disabled` from the Next button**

Remove line 180 (`disabled={!canProceed}`) from the Next `Pressable`. Leave everything else, including the `canProceed`-driven colors.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint .`
Expected: 0 errors from both

- [ ] **Step 7: Commit**

```bash
git add src/app/series/create/books.tsx
git commit -m "$(cat <<'EOF'
feat: books step spacing, validation alerts, duplicate-name blocking

Adds gap: 8 so consecutive selected rows no longer press their highlight
borders together (matching order.tsx), and the Next button now reports
every unmet requirement on press including a duplicate series name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Order screen — surface name conflicts

**Files:**
- Modify: `src/app/series/create/order.tsx:66-79` (`handleCreate`)

**Interfaces:**
- Consumes: `SeriesNameConflictError` from Task 1, `duplicateNameIssue` from Task 3.

**Why:** Task 4 makes `createSeries` throw. The current `catch` logs and re-enables the button, which looks like a dead button to the user.

- [ ] **Step 1: Import the error type and message builder**

Add `Alert` to the existing `react-native` import, and add:

```ts
import { SeriesNameConflictError } from '@/helpers/seriesName';
import { duplicateNameIssue } from '@/helpers/seriesValidation';
```

- [ ] **Step 2: Handle the conflict in `handleCreate`**

Replace the `catch` block (lines 75-78):

```ts
    } catch (e) {
      console.error('createSeries failed', e);
      setSubmitting(false);
    }
```

with:

```ts
    } catch (e) {
      setSubmitting(false);
      // The name was validated two screens back; a conflict here means the
      // library changed under us. Send the user back to rename rather than
      // leaving a button that appears to do nothing.
      if (e instanceof SeriesNameConflictError) {
        Alert.alert("Can't continue", duplicateNameIssue(e.conflictingName), [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      console.error('createSeries failed', e);
    }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint .`
Expected: 0 errors from both

- [ ] **Step 4: Commit**

```bash
git add src/app/series/create/order.tsx
git commit -m "$(cat <<'EOF'
fix: surface series name conflicts on the order screen

A rejected createSeries write previously logged and re-enabled the button,
which reads as a dead button. Now it alerts and returns to the name field.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Edit screen — self-explaining Save, duplicate rename blocking

**Files:**
- Modify: `src/app/series/edit/[id].tsx:135-146` (`handleSave`), `:172` (`canSave`), `:249-274` (Save button)

**Interfaces:**
- Consumes: `seriesEditIssues` from Task 3, `SeriesNameConflictError` from Task 1, `duplicateNameIssue` from Task 3. `allSeries` and `id` are already in scope (lines 39-45).

- [ ] **Step 1: Import the helpers**

`Alert` is already imported. Add:

```ts
import { SeriesNameConflictError } from '@/helpers/seriesName';
import {
  duplicateNameIssue,
  seriesEditIssues,
} from '@/helpers/seriesValidation';
```

- [ ] **Step 2: Replace `canSave` with the issue list**

Replace line 172:

```ts
  const canSave = name.trim().length > 0;
```

with:

```ts
  // excludeId keeps a series' own name from reading as a conflict with itself.
  const issues = useMemo(
    () => seriesEditIssues({ name, series: allSeries, excludeId: id }),
    [name, allSeries, id],
  );
  const canSave = issues.length === 0;
```

- [ ] **Step 3: Guard `handleSave` and handle the conflict**

Replace `handleSave` (lines 135-146) with:

```ts
  const handleSave = useCallback(async () => {
    if (submitting || !id) return;
    if (issues.length > 0) {
      Alert.alert("Can't save", issues.join('\n'));
      return;
    }
    setSubmitting(true);
    try {
      await updateSeries(id, name, orderedBookKeys);
      useSeriesDraftStore.getState().resetForCreate();
      exitGroup();
    } catch (e) {
      setSubmitting(false);
      if (e instanceof SeriesNameConflictError) {
        Alert.alert("Can't save", duplicateNameIssue(e.conflictingName));
        return;
      }
      console.error('updateSeries failed', e);
    }
  }, [submitting, id, issues, name, orderedBookKeys, exitGroup]);
```

- [ ] **Step 4: Narrow the Save button's `disabled`**

Replace line 251:

```tsx
          disabled={!canSave || submitting}
```

with:

```tsx
          disabled={submitting}
```

`submitting` stays a genuine `disabled` — it is a real no-press state, not a validation failure. `canSave` still drives the inactive colors below it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint .`
Expected: 0 errors from both

- [ ] **Step 6: Commit**

```bash
git add "src/app/series/edit/[id].tsx"
git commit -m "$(cat <<'EOF'
feat: edit screen blocks duplicate renames and explains a blocked Save

Save keeps its inactive styling but alerts on press. The duplicate check
excludes the series being renamed so saving an unchanged name still works.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Empty-state wiring + header edit icon + drop the edit bar

**Files:**
- Modify: `src/components/SeriesHome.tsx` (props, `SeriesFlatItem`, `flatData`, `renderItem`, `keyExtractor`, `getItemType`, `ListHeader`, `SectionHeader`, styles)
- Modify: `src/app/(drawer)/(library)/index.tsx:291-301` (SeriesHome props)

**Interfaces:**
- Consumes: `seriesEmptyMessage` from Task 2.
- Produces: `SeriesHome` gains a required `emptyMessage: string` prop and loses `onCreatePress`.

- [ ] **Step 1: Delete the `editBar` item type**

In `src/components/SeriesHome.tsx`, remove `| { type: 'editBar'; seriesId: string }` from `SeriesFlatItem`, remove the `items.push({ type: 'editBar', ... })` line from `flatData`, remove the `case 'editBar':` block from `renderItem`, remove `case 'editBar':` from `keyExtractor`, and delete the `editBar` / `editBarText` style rules.

- [ ] **Step 2: Change the props**

Replace `onCreatePress: () => void;` in `SeriesHomeProps` with `emptyMessage: string;`, and update the destructured parameter list to match (drop `onCreatePress`, add `emptyMessage`).

- [ ] **Step 3: Reduce `ListHeader` to the spacer**

Replace the whole `ListHeader` `useMemo` (and the now-unused `Plus` import, `createButton` and `createButtonText` styles) with passing the spacer straight through:

```tsx
        ListHeaderComponent={ListHeaderSpacer}
```

Delete the `ListHeader` variable entirely.

- [ ] **Step 4: Use the passed-in empty message**

Replace the `ListEmptyComponent` literal text with `{emptyMessage}`:

```tsx
        ListEmptyComponent={
          <Text
            style={[
              utilsStyles.emptyComponent,
              { color: themeColors.textMuted },
            ]}
          >
            {emptyMessage}
          </Text>
        }
```

- [ ] **Step 5: Put the pencil in the section header**

Replace the `SectionHeader` component's returned JSX with a row of two **sibling** pressables. The pencil must not be nested inside the header pressable — nesting them makes the touch targets overlap.

```tsx
  return (
    <View style={styles.headerRow}>
      <Pressable
        style={styles.editIconButton}
        android_ripple={{
          color: withOpacity(themeColors.divider, 0.16),
          borderless: true,
          radius: 18,
        }}
        hitSlop={8}
        accessibilityLabel={`Edit ${title}`}
        onPress={handleEditPress}
      >
        <Pencil size={18} color={themeColors.primary} />
      </Pressable>
      <Pressable
        style={styles.sectionHeaderPressable}
        android_ripple={{ color: withOpacity(themeColors.divider, 0.16) }}
        onPress={handlePress}
      >
        <View style={styles.titleBar}>
          <Text
            numberOfLines={1}
            style={[styles.titleText, { color: themeColors.text }]}
          >
            {title}
          </Text>
          <View style={chevronWrapperStyle}>
            <ChevronRight size={24} color={themeColors.icon} />
          </View>
        </View>
      </Pressable>
    </View>
  );
```

The icon shows in **both** collapsed and expanded states — that keeps the title from shifting horizontally when a section expands, and makes editing a one-tap action.

- [ ] **Step 6: Extend `SectionHeader`'s props and callbacks**

Add `onEditPress: (seriesId: string) => void;` to `SectionHeader`'s prop type, add it to the destructuring, and add the handler beside the existing `handlePress`:

```tsx
  const handleEditPress = useCallback(
    () => onEditPress(seriesId),
    [seriesId, onEditPress],
  );
```

In `renderItem`'s `sectionHeader` case, pass `onEditPress={onEditPress}` to `<SectionHeader />`.

- [ ] **Step 7: Add the new styles**

`headerRow` and `editIconButton` are **new**. `sectionHeaderPressable` and `titleBar` already exist and are **modified** — `flex: 1` added to the former so it fills the row beside the icon, and `paddingLeft` dropped to `0` on the latter because `headerRow` now owns the leading padding:

```ts
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: screenPadding.horizontal,
  },
  editIconButton: {
    paddingVertical: 4,
    paddingRight: 10,
  },
  sectionHeaderPressable: {
    flex: 1,
    paddingVertical: 4,
    marginBottom: 4,
  },
  titleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 0,
  },
```

- [ ] **Step 8: Compute and pass `emptyMessage` from the library screen**

In `src/app/(drawer)/(library)/index.tsx`, add the import:

```ts
import { seriesEmptyMessage } from '@/helpers/seriesEmptyMessage';
```

Add below the `tabFilteredSeries` memo:

```ts
  const seriesEmptyText = useMemo(
    () =>
      seriesEmptyMessage({
        totalSeriesCount: allSeries.length,
        searchMatchCount: seriesSearchFiltered.length,
        hasSearchQuery: debouncedSearchQuery.trim().length > 0,
        selectedTab,
      }),
    [allSeries, seriesSearchFiltered, debouncedSearchQuery, selectedTab],
  );
```

Then in the `<SeriesHome />` JSX, replace `onCreatePress={handleCreateSeries}` with `emptyMessage={seriesEmptyText}`. Keep `handleCreateSeries` — Task 11 wires it to the FAB.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 10: Commit**

```bash
git add src/components/SeriesHome.tsx "src/app/(drawer)/(library)/index.tsx"
git commit -m "$(cat <<'EOF'
feat: series header pencil icon and per-tab empty messages

Replaces the full-width edit bar with an icon beside the series name,
shown in both collapsed and expanded states so the title never shifts.
The icon is a sibling of the header pressable, not nested, so the two
touch targets can't overlap. SeriesHome now takes a computed emptyMessage.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Scroll reset on tab change

**Files:**
- Modify: `src/components/SeriesHome.tsx` (add `listRef`, `selectedTab` prop, effect)
- Modify: `src/components/BooksHome.tsx:63-64` (existing unused `listRef`), add effect
- Modify: `src/components/BooksGrid.tsx:139` (add ref), add effect
- Modify: `src/app/(drawer)/(library)/index.tsx` (pass `selectedTab` to all three)

**Interfaces:**
- Consumes: `CustomTabs` from `@/components/TabScreen`.
- Produces: all three views take a `selectedTab: CustomTabs` prop.

**Note:** scroll position is reset on **tab** change only, never when flipping between Books / Series / Grid.

- [ ] **Step 1: Add the shared effect to `SeriesHome`**

Add `selectedTab: CustomTabs;` to `SeriesHomeProps`, destructure it, and add near the other hooks:

```ts
  const listRef =
    useRef<React.ComponentRef<typeof FlashList<SeriesFlatItem>>>(null);
  const isFirstTabRender = useRef(true);

  // Land at the top when the tab changes so the new set of series reads from
  // the beginning rather than resuming the previous tab's offset. Deferred one
  // frame: FlashList 2.3.2 has maintainVisibleContentPosition on by default and
  // re-anchors on the data commit, which would otherwise fight this call.
  useEffect(() => {
    if (isFirstTabRender.current) {
      isFirstTabRender.current = false;
      return;
    }
    const handle = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(handle);
  }, [selectedTab]);
```

Add `useEffect` and `useRef` to the `react` import, and pass `ref={listRef}` to the `FlashList`.

- [ ] **Step 2: Add the same effect to `BooksHome`**

`BooksHome` already declares `listRef` at line 63-64 and already passes `ref={listRef}`. Add `selectedTab: CustomTabs;` to `BookListProps`, destructure it, add `import { CustomTabs } from '@/components/TabScreen';`, and add the identical `isFirstTabRender` ref plus `useEffect` block from Step 1 (typed `FlashList<FlatListItem>`).

- [ ] **Step 3: Add the same effect to `BooksGrid`**

`BooksGrid`'s list renders `bookIds`, so the generic is `string`. Add near the top of the component:

```ts
  const listRef = useRef<React.ComponentRef<typeof FlashList<string>>>(null);
```

Pass `ref={listRef}` to the `FlashList` at line 139, add `selectedTab: CustomTabs;` to `BookGridProps`, destructure it, add `import { CustomTabs } from '@/components/TabScreen';`, and add the identical `isFirstTabRender` ref plus `useEffect` block from Step 1.

- [ ] **Step 4: Pass the tab from the library screen**

In `src/app/(drawer)/(library)/index.tsx`, add `selectedTab={selectedTab}` to `<BooksHome />`, `<SeriesHome />` and `<BooksGrid />`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 6: Commit**

```bash
git add src/components/SeriesHome.tsx src/components/BooksHome.tsx src/components/BooksGrid.tsx "src/app/(drawer)/(library)/index.tsx"
git commit -m "$(cat <<'EOF'
feat: reset list scroll to top on tab change in all library views

The tab bar is one shared control, so it now behaves the same in Books,
Series and Grid. Deferred a frame because FlashList 2.3.2 re-anchors via
maintainVisibleContentPosition on the data commit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create Series floating action button

**Files:**
- Create: `src/components/CreateSeriesFab.tsx`
- Modify: `src/app/(drawer)/(library)/index.tsx:322` (render beside `<FloatingPlayer />`)

**Interfaces:**
- Consumes: `isVisible: SharedValue<number>` from `useScrollDirection` (already destructured at `index.tsx:46`), `handleCreateSeries` (already defined at `index.tsx:226-231`).
- Produces: `<CreateSeriesFab isVisible={...} onPress={...} />`

- [ ] **Step 1: Create the component**

Create `src/components/CreateSeriesFab.tsx`:

```tsx
import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { PressableScale } from 'pressto';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';

const FAB_SIZE = 56;
/** Clears FloatingPlayer, whose top edge sits at insets.bottom + 48 (it renders
 *  at bottom: 10 with marginBottom: insets.bottom - 12 and height: 50). The
 *  offset is deliberately static rather than tracking whether a track is
 *  loaded, so the button never moves under the user's thumb. */
const FAB_BOTTOM_OFFSET = 64;

type Props = {
  /** Shared with SearchBar so both chrome elements move as one. */
  isVisible: SharedValue<number>;
  onPress: () => void;
};

const CreateSeriesFab = ({ isVisible, onPress }: Props) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      isVisible.value,
      [0, 1],
      [FAB_SIZE + FAB_BOTTOM_OFFSET, 0],
    );
    return { opacity: isVisible.value, transform: [{ translateY }] };
  });

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: insets.bottom + FAB_BOTTOM_OFFSET },
        animatedStyle,
      ]}
      pointerEvents='box-none'
    >
      <PressableScale
        rippleRadius={0}
        onPress={onPress}
        accessibilityLabel='Create series'
        accessibilityRole='button'
        style={[styles.button, { backgroundColor: themeColors.primary }]}
      >
        <Plus size={28} color={themeColors.background} strokeWidth={2.5} />
      </PressableScale>
    </Animated.View>
  );
};

export default memo(CreateSeriesFab);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16,
  },
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
```

- [ ] **Step 2: Render it in the library screen**

In `src/app/(drawer)/(library)/index.tsx`, add the import:

```ts
import CreateSeriesFab from '@/components/CreateSeriesFab';
```

and render it as a **sibling of `<FloatingPlayer />`** at the screen root — outside the `overflow: 'hidden'` container at line 280, which would clip the FAB's Android elevation shadow:

```tsx
      {toggleView === 1 && (
        <CreateSeriesFab isVisible={isVisible} onPress={handleCreateSeries} />
      )}
      <FloatingPlayer />
```

The FAB renders whenever the Series view is showing, **including with zero series** — the empty-state copy tells the user to tap it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 4: Commit**

```bash
git add src/components/CreateSeriesFab.tsx "src/app/(drawer)/(library)/index.tsx"
git commit -m "$(cat <<'EOF'
feat: Create Series floating action button

Replaces the sticky list-header button. Subscribes to the same
useScrollDirection shared value as SearchBar so both hide together on the
UI thread, and renders outside the overflow-hidden list container so its
elevation shadow isn't clipped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Row height constants — reclaim dead space

**Files:**
- Modify: `src/components/BookGridItem.tsx:224-251` (`itemDimensions`), `:328-342` (styles)
- Modify: `src/components/BooksHorizontal.tsx:66-97` (list + styles)

**Interfaces:**
- Produces: `ROW_ITEM_HEIGHT`, `ROW_COVER_HEIGHT`, `ROW_INFO_HEIGHT` exported from `BookGridItem.tsx`.

**Critical:** this must produce **zero visual change**. Covers stay 140, the info block stays 68, rows stay 220 tall. The 12px being reclaimed is dead space inside `containerBase` (children are top-aligned and total 208), and it is already the part being clipped. Growing the container to 232 instead is explicitly rejected — it would make every collapsed section 12px taller in all three library views.

**Blast radius:** `BooksHorizontal` is imported by `BooksHome` and `SeriesHome`; `BookGridItem` by those two plus `BooksGrid`. This lands on all three views at once.

- [ ] **Step 1: Export the constants from `BookGridItem.tsx`**

Add above `BookGridItemProps`:

```ts
/** Row-flow ("horizontal shelf") geometry. BooksHorizontal derives its own
 *  container height from ROW_ITEM_HEIGHT so the two files cannot drift apart —
 *  they previously both hardcoded 220, which did not mean the same thing in
 *  each place and left only 2px of headroom before visible content clipped. */
export const ROW_COVER_HEIGHT = 140;
export const ROW_INFO_HEIGHT = 68;
const ROW_PADDING_TOP = 4;
const ROW_MARGIN_BOTTOM = 8;
export const ROW_ITEM_HEIGHT =
  ROW_PADDING_TOP + ROW_COVER_HEIGHT + ROW_INFO_HEIGHT + ROW_MARGIN_BOTTOM; // 220
```

- [ ] **Step 2: Use them in `itemDimensions`**

In the `itemDimensions` memo, change the row branches so the container is exactly its children and the cover uses the constant:

```ts
      container: isRow
        ? {
            height: ROW_COVER_HEIGHT + ROW_INFO_HEIGHT,
            width: aspectRatio * 160,
          }
        : { width: itemWidth, height: (1 / aspectRatio) * itemWidth + 90 },
      imageContainer: isRow
        ? { height: ROW_COVER_HEIGHT, width: aspectRatio * ROW_COVER_HEIGHT }
        : {
            paddingTop: 10,
            width: itemWidth + 2,
            height: (1 / aspectRatio) * itemWidth + 12,
          },
      imageSize: isRow
        ? {
            width: Math.round(aspectRatio * ROW_COVER_HEIGHT),
            height: ROW_COVER_HEIGHT,
            borderRadius: 3,
          }
        : {
```

Leave the column branches and `bookInfoWidth` untouched.

- [ ] **Step 3: Tie `bookInfoContainer` to its constant**

In the styles block, change `bookInfoContainer`'s `height: 68` to `height: ROW_INFO_HEIGHT`. This style is shared by both row and column flows, and the value is identical (68) in each — so this is a naming change only, with no effect on the grid.

- [ ] **Step 4: Derive the container height in `BooksHorizontal.tsx`**

Add the import:

```ts
import { BookGridItem, ROW_ITEM_HEIGHT } from './BookGridItem';
```

(replacing the existing `import { BookGridItem } from './BookGridItem';`)

Remove the `contentContainerStyle` prop from the `FlashList` entirely — on a horizontal list that `paddingBottom: 6` is cross-axis padding whose only effect was shaving 6px off the height available to items.

Change the style block:

```ts
const styles = StyleSheet.create({
  listContainer: {
    height: ROW_ITEM_HEIGHT,
  },
});
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 6: Commit**

```bash
git add src/components/BookGridItem.tsx src/components/BooksHorizontal.tsx
git commit -m "$(cat <<'EOF'
refactor: single source of truth for horizontal row height

BookGridItem and BooksHorizontal each hardcoded 220 with different
meanings, leaving 2px of headroom before visible content clipped. Reclaims
12px of dead space inside containerBase and drops a pointless cross-axis
padding. Covers, text and row height are pixel-identical; headroom goes
from 2px to 8px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Placeholder instead of `null` in measured cells

**Files:**
- Modify: `src/components/BookGridItem.tsx:253-255` (the not-ready guard)

**Why:** returning `null` from a cell that FlashList is about to measure is a measurement hazard, and it matches the clipped-row symptoms — inconsistent across rows on one screen, and visible on a freshly created series while the store re-emits. This is the **strong candidate** for the bug.

- [ ] **Step 1: Replace the null return with a sized placeholder**

Replace:

```tsx
  // If data isn't ready or the book was deleted, render nothing.
  // Must stay below every hook so the hook order is render-stable.
  if (!bookId || !bookData || !fullBook) return null;
```

with:

```tsx
  // If data isn't ready or the book was deleted, render an empty cell of the
  // SAME size rather than null. FlashList measures cells; a null child makes a
  // cell measure short, and that measurement can stick — which is how rows end
  // up rendering at a fraction of their height while their neighbours are fine.
  // Must stay below every hook so the hook order is render-stable.
  if (!bookId || !bookData || !fullBook) {
    return (
      <View
        style={[styles.pressableContainer, itemDimensions.container]}
        pointerEvents='none'
      />
    );
  }
```

`View` and `styles` are already imported/defined in this file.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint . && npx jest`
Expected: 0 tsc errors, 0 eslint errors, Jest 202 passing

- [ ] **Step 3: Commit**

```bash
git add src/components/BookGridItem.tsx
git commit -m "$(cat <<'EOF'
fix: render a sized placeholder instead of null in measured cells

A null child makes a FlashList cell measure short and that measurement can
stick, which is the likely cause of collapsed series rows rendering at a
fraction of their height while their neighbours render fine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Device verification + clipped-row probe

**Files:**
- Temporarily modify: `src/components/BooksHorizontal.tsx`, `src/components/SeriesHome.tsx`
- Final: both reverted to their post-Task-13 state

**This task cannot be completed without a device.** Everything above is JS-only, so one build covers all of it and fix iteration runs over Metro reload.

- [ ] **Step 1: Add the `__DEV__` probes**

In `src/components/BooksHorizontal.tsx`, on the `listContainer` `View`:

```tsx
    <View
      style={styles.listContainer}
      onLayout={
        __DEV__
          ? (e) =>
              console.log(
                `[rowprobe] inner ${sectionId} h=${e.nativeEvent.layout.height}`,
              )
          : undefined
      }
    >
```

In `src/components/SeriesHome.tsx`, on the `horizontalRowContainer` `View` in `renderItem`:

```tsx
            <View
              style={styles.horizontalRowContainer}
              onLayout={
                __DEV__
                  ? (e) =>
                      console.log(
                        `[rowprobe] outer ${item.seriesId} h=${e.nativeEvent.layout.height}`,
                      )
                  : undefined
              }
            >
```

- [ ] **Step 2: Build and install**

Run: `npm run android` (i.e. `expo run:android`). Never run `expo prebuild --clean` — `android/` is committed and holds a custom turbomodule.

- [ ] **Step 3: Check the clipped-row bug**

With `adb logcat | grep rowprobe` running:

1. Open the Series view with several series, all collapsed.
2. Create a brand-new series and return to the list without scrolling.
3. Cold-start the app and open the Series view.

Expected: every row renders at full height with its cover uncropped, and every probe line reports `outer h≈224` / `inner h=220`.

If any row still clips, the probe separates the two causes:
- **outer short** → the masonry cell measured wrong; investigate FlashList's layout cache for the `horizontalRow` item type.
- **inner short** → a style/constraint problem inside the row; re-check the Task 12 constants against what actually rendered.

Do **not** proceed to Step 5 until rows render correctly. If the bug survives, stop and report the probe output rather than guessing at another fix.

- [ ] **Step 4: Verify the rest of the pass on-device**

- [ ] FAB clears the mini player, both with and without a track loaded
- [ ] FAB fades out on scroll down and back in on scroll up, in step with the search bar
- [ ] FAB opens the create wizard, and is present when zero series exist
- [ ] Pencil icon opens the correct series' edit screen
- [ ] Pencil and header taps never cross-fire; the title does not shift on expand
- [ ] Empty states: zero series; a search with no matches; Unplayed / Started / Finished tabs each with series that don't qualify
- [ ] Tab change resets scroll to the top in Books, Series and Grid, with no MVCP flash
- [ ] Switching Books ↔ Series ↔ Grid does **not** reset scroll
- [ ] Books screen selection rows are visibly separated; author headings sit correctly
- [ ] Next on authors with nothing selected alerts `Select at least one author.`
- [ ] Next on books with a blank name and no books alerts both problems
- [ ] Typing an existing series name greys out Next; pressing it names the conflict
- [ ] Edit screen: renaming to another series' name blocks Save and alerts
- [ ] Edit screen: saving with the name unchanged still works
- [ ] `BooksHome` and `BooksGrid` horizontal rows look unchanged (Task 12 touched shared components)

- [ ] **Step 5: Remove the probes**

Revert both `onLayout` props added in Step 1. Confirm with `git diff` that only the probe lines are gone.

- [ ] **Step 6: Final verification**

Run: `npx jest && npx tsc --noEmit && npx eslint .`
Expected: Jest 202 passing, 0 tsc errors, 0 eslint errors

- [ ] **Step 7: Commit**

```bash
git add src/components/BooksHorizontal.tsx src/components/SeriesHome.tsx
git commit -m "$(cat <<'EOF'
chore: remove temporary row-height layout probes

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: A/B comparison and handoff

- [ ] **Step 1: Compare against the current design**

Build and run `feature/series` and `feature/series-styling` back to back on the device. Judge specifically:

- FAB vs sticky header button
- Header pencil vs full-width edit bar
- Whether the always-visible pencil reads as clutter on a long list of series

- [ ] **Step 2: Record the outcome**

Note which branch wins per item. Neither branch merges to `main` until this decision is made — that is deliberately out of scope for this plan.

- [ ] **Step 3: Update the project memory**

Update `series-feature.md` and its `MEMORY.md` pointer with: the styling branch name, what shipped, the clipped-row root cause as actually found, and the A/B outcome.
