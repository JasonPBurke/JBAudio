# Series Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user manually create named, ordered "series" of books (which double as playlists), browsable on a new Series toggle view modeled on `BooksHome`, with create/edit/delete flows.

**Architecture:** Two new WatermelonDB tables (`series`, `series_books`) at schema v31. Membership in `series_books` is anchored on a **structural key = the book's first-file path** (`book.chapters[0].url`), never `book.id`, so it survives tag edits + rescans. A `seriesStore` (Zustand, mirroring `src/store/library.tsx`) observes the tables and combines them with the live library `books` map to produce render-ready `DerivedSeries[]`. Wizard/edit screens live in a dedicated `src/app/series/` route group with its own Stack `_layout`.

**Tech Stack:** React Native 0.79 / Expo 53, New Arch + Hermes, React Compiler, WatermelonDB, Zustand, FlashList, `react-native-sortables` (new dep, built on Reanimated 4 + gesture-handler 2), Jest 30 + ts-jest.

**Spec:** `docs/superpowers/specs/2026-07-24-series-feature-design.md` (approved).

## Global Constraints

- **Schema version:** bump `30 → 31`. WatermelonDB never re-runs an applied migration step; add a new `toVersion: 31` entry, never edit existing ones.
- **Membership key:** `series_books.book_key` stores `book.chapters[0]?.url` (first-file path). No foreign key to `books`. Resolution to a live `Book` is always in-memory via a `Map<structuralKey, Book>` built from `useLibraryStore.getState().books`.
- **Series progress (Completion model):** all books NotStarted → `unplayed`; all Finished → `finished`; anything else → `playing`. Progress values: `0` NotStarted, `1` Started, `2` Finished (`BookProgressState` in `src/helpers/handleBookPlay.ts`).
- **Never** run `expo prebuild --clean` (custom turbomodule in committed `android/`). `react-native-sortables` is pure JS (Reanimated/gesture-handler worklets) — no native rebuild required.
- **No `.prettierrc`** beyond the repo's — never `prettier --write` broadly (double-quote churn). Match surrounding style (single quotes, `fontFamily: 'Rubik'`).
- **Toggle stays 3-way** (`% 3`): 0 BooksHome, 1 Series (new), 2 BooksGrid. `BooksList.tsx` is unwired but kept.
- Tests live in `src/**/__tests__/*.test.ts`; run with `npm test` (jest). Prefer pure-function extraction for testable logic; DB writers verified on-device.

---

## File Structure

**New**
- `src/db/models/Series.ts` — `series` model (`has_many series_books`).
- `src/db/models/SeriesBook.ts` — join model (`belongs_to series`), fields `book_key`, `position`.
- `src/db/seriesQueries.ts` — create/update/delete/observe + prune writers; membership-diff helper.
- `src/helpers/bookStructuralKey.ts` — `bookStructuralKey(book)` pure helper.
- `src/helpers/seriesProgress.ts` — `deriveSeriesProgressState(books)` + `SeriesProgressState` type.
- `src/helpers/seriesAssembly.ts` — `assembleDerivedSeries(...)`, `filterSeriesBySearch(...)`, `countSeriesByState(...)` pure helpers.
- `src/store/seriesStore.ts` — observed → derived series Zustand store.
- `src/store/seriesDraftStore.ts` — wizard/edit working draft.
- `src/components/SeriesBookRow.tsx` — presentational row (selection | sortable contexts).
- `src/components/SeriesHome.tsx` — listing FlashList (toggle view 1).
- `src/app/series/_layout.tsx` — Stack navigator for the flow.
- `src/app/series/create/authors.tsx`, `books.tsx`, `order.tsx` — wizard steps.
- `src/app/series/edit/[id].tsx` — consolidated edit screen.
- Tests: `src/helpers/__tests__/bookStructuralKey.test.ts`, `seriesProgress.test.ts`, `seriesAssembly.test.ts`, `src/db/__tests__/seriesMembershipDiff.test.ts`, `src/store/__tests__/seriesDraftStore.test.ts`, `src/db/__tests__/schemaV31.test.ts`.

**Modified**
- `src/db/schema.ts` (v31 + two tables), `src/db/migrations.ts` (toVersion 31), `src/db/index.ts` (register models).
- `src/components/Header.tsx` (Series `Layers` icon at toggle 1).
- `src/app/(drawer)/(library)/index.tsx` (render `SeriesHome` at toggle 1; series-level counts + tab/search filtering when in series view).
- `src/helpers/scanLibrary.ts` (prune orphaned `series_books` in cleanup) + `src/db/settingsQueries.ts` (prune on path removal).

**Unwired (kept):** `src/components/BooksList.tsx`.

---

## Task 0: Install `react-native-sortables`

**Files:** `package.json` (dep), `package-lock.json`.

- [ ] **Step 1:** Install the library (pure-JS; no native step).
```bash
npm install react-native-sortables
```
- [ ] **Step 2:** Verify it resolves and pulls no native module.
```bash
node -e "require.resolve('react-native-sortables'); console.log('ok')"
```
Expected: `ok`. Confirm `react-native-gesture-handler` (~2.30) and `react-native-reanimated` (4.2.1) already present (they are).
- [ ] **Step 3:** Sanity-check the app root already wraps `GestureHandlerRootView` — confirmed at `src/app/_layout.tsx:199`. No change needed.
- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json && git commit -m "chore: add react-native-sortables dependency"
```

---

## Task 1: Schema v31 + migration + models

**Files:**
- Modify: `src/db/schema.ts:3` (version), tables array
- Modify: `src/db/migrations.ts:8` (prepend toVersion 31)
- Create: `src/db/models/Series.ts`, `src/db/models/SeriesBook.ts`
- Modify: `src/db/index.ts:6-10,31` (import + register)
- Test: `src/db/__tests__/schemaV31.test.ts`

**Interfaces:**
- Produces: table `series` {`name:string`, `sort_name:string`, `created_at:number`, `updated_at:number`}; table `series_books` {`series_id:string` indexed, `book_key:string` indexed, `position:number`, `created_at:number`}. Models `Series` (`@children('series_books')`), `SeriesBook` (`@relation('series','series_id')`, `@text('book_key')`, `@field('position')`).

- [ ] **Step 1: Write the failing test** (`schemaV31.test.ts`) — schema is pure JS, importable in jest.
```ts
import schema from '@/db/schema';

test('schema is v31 with series + series_books tables', () => {
  expect(schema.version).toBe(31);
  const series = schema.tables['series'];
  const join = schema.tables['series_books'];
  expect(series).toBeDefined();
  expect(join).toBeDefined();
  expect(series.columns['sort_name']).toBeDefined();
  expect(join.columns['book_key'].isIndexed).toBe(true);
  expect(join.columns['series_id'].isIndexed).toBe(true);
  expect(join.columns['position']).toBeDefined();
});
```
- [ ] **Step 2: Run — expect FAIL** (`version` is 30, tables undefined).
```bash
npm test -- schemaV31
```
- [ ] **Step 3: Edit `schema.ts`** — set `version: 31` and append two `tableSchema` blocks:
```ts
tableSchema({
  name: 'series',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'sort_name', type: 'string', isIndexed: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
}),
tableSchema({
  name: 'series_books',
  columns: [
    { name: 'series_id', type: 'string', isIndexed: true },
    { name: 'book_key', type: 'string', isIndexed: true },
    { name: 'position', type: 'number' },
    { name: 'created_at', type: 'number' },
  ],
}),
```
- [ ] **Step 4: Prepend migration** in `migrations.ts` `migrations: [` array (before `toVersion: 30`):
```ts
{
  toVersion: 31,
  steps: [
    createTable({
      name: 'series',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'sort_name', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    createTable({
      name: 'series_books',
      columns: [
        { name: 'series_id', type: 'string', isIndexed: true },
        { name: 'book_key', type: 'string', isIndexed: true },
        { name: 'position', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
},
```
(`createTable` is already imported in `migrations.ts:2`.)
- [ ] **Step 5: Create `models/Series.ts`**
```ts
import { Model } from '@nozbe/watermelondb';
import { text, field, date, children } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import SeriesBook from './SeriesBook';

export default class Series extends Model {
  static table = 'series';
  static associations: Associations = {
    series_books: { type: 'has_many', foreignKey: 'series_id' },
  };

  @text('name') name!: string;
  @text('sort_name') sortName!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @children('series_books') seriesBooks!: SeriesBook[];
}
```
- [ ] **Step 6: Create `models/SeriesBook.ts`**
```ts
import { Model } from '@nozbe/watermelondb';
import { text, field, date, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Series from './Series';

export default class SeriesBook extends Model {
  static table = 'series_books';
  static associations: Associations = {
    series: { type: 'belongs_to', key: 'series_id' },
  };

  @text('book_key') bookKey!: string;
  @field('position') position!: number;
  @date('created_at') createdAt!: Date;
  @relation('series', 'series_id') series!: Series;
}
```
- [ ] **Step 7: Register models** in `db/index.ts` — import both and add to `modelClasses: [Author, Book, Chapter, Settings, Footprint, Series, SeriesBook]`.
- [ ] **Step 8: Run test — expect PASS.** `npm test -- schemaV31`
- [ ] **Step 9: Commit**
```bash
git add src/db && git commit -m "feat(db): schema v31 with series + series_books tables and models"
```

---

## Task 2: `bookStructuralKey` helper

**Files:** Create `src/helpers/bookStructuralKey.ts`; Test `src/helpers/__tests__/bookStructuralKey.test.ts`.

**Interfaces:** Produces `bookStructuralKey(book: Pick<Book,'chapters'>): string | null` → first chapter url or null.

- [ ] **Step 1: Failing test**
```ts
import { bookStructuralKey } from '@/helpers/bookStructuralKey';

test('returns first chapter url', () => {
  expect(bookStructuralKey({ chapters: [{ url: '/a/1.mp3' } as any, { url: '/a/2.mp3' } as any] })).toBe('/a/1.mp3');
});
test('null when no chapters', () => {
  expect(bookStructuralKey({ chapters: [] })).toBeNull();
});
```
- [ ] **Step 2: Run — FAIL.** `npm test -- bookStructuralKey`
- [ ] **Step 3: Implement**
```ts
import { Book } from '@/types/Book';

/**
 * Stable structural identity for a book = its first file's path (chapter url).
 * Survives in-app tag edits and rescans (which can churn book.id). Mirrors the
 * "structural key = first file path" convention in artworkIdentity.ts.
 */
export function bookStructuralKey(
  book: Pick<Book, 'chapters'>,
): string | null {
  return book.chapters?.[0]?.url ?? null;
}
```
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git add src/helpers/bookStructuralKey.ts src/helpers/__tests__/bookStructuralKey.test.ts && git commit -m "feat: bookStructuralKey helper"`

---

## Task 3: `seriesProgress` derivation (Completion model)

**Files:** Create `src/helpers/seriesProgress.ts`; Test `src/helpers/__tests__/seriesProgress.test.ts`.

**Interfaces:** Produces `type SeriesProgressState = 'unplayed'|'playing'|'finished'` and `deriveSeriesProgressState(books: Pick<Book,'bookProgressValue'>[]): SeriesProgressState`. Empty array → `'unplayed'`.

- [ ] **Step 1: Failing test** (mirror the spec table)
```ts
import { deriveSeriesProgressState } from '@/helpers/seriesProgress';
const b = (v: number) => ({ bookProgressValue: v });

test('all not-started → unplayed', () => expect(deriveSeriesProgressState([b(0),b(0)])).toBe('unplayed'));
test('finished + not-started → playing', () => expect(deriveSeriesProgressState([b(2),b(0),b(0)])).toBe('playing'));
test('one started → playing', () => expect(deriveSeriesProgressState([b(1),b(0)])).toBe('playing'));
test('all finished → finished', () => expect(deriveSeriesProgressState([b(2),b(2)])).toBe('finished'));
test('empty → unplayed', () => expect(deriveSeriesProgressState([])).toBe('unplayed'));
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
```ts
import { Book } from '@/types/Book';

export type SeriesProgressState = 'unplayed' | 'playing' | 'finished';

// 0 NotStarted, 1 Started, 2 Finished (BookProgressState in handleBookPlay.ts)
export function deriveSeriesProgressState(
  books: Pick<Book, 'bookProgressValue'>[],
): SeriesProgressState {
  if (books.length === 0) return 'unplayed';
  const allNotStarted = books.every((b) => b.bookProgressValue === 0);
  if (allNotStarted) return 'unplayed';
  const allFinished = books.every((b) => b.bookProgressValue === 2);
  if (allFinished) return 'finished';
  return 'playing';
}
```
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -m "feat: series Completion-model progress derivation"`

---

## Task 4: `seriesAssembly` pure helpers (resolve + count + search)

**Files:** Create `src/helpers/seriesAssembly.ts`; Test `src/helpers/__tests__/seriesAssembly.test.ts`.

**Interfaces:**
- Consumes: `bookStructuralKey` (Task 2), `deriveSeriesProgressState`/`SeriesProgressState` (Task 3), `Book` type.
- Produces:
  - `type DerivedSeries = { id: string; name: string; books: Book[]; progressState: SeriesProgressState }`
  - `type SeriesRow = { id: string; name: string; sortName: string }`
  - `type MembershipRow = { seriesId: string; bookKey: string; position: number }`
  - `assembleDerivedSeries(series: SeriesRow[], memberships: MembershipRow[], bookMap: Record<string, Book>): DerivedSeries[]` — resolves keys via a `Map<structuralKey, Book>`, drops unresolved keys (graceful skip), sorts members by `position`, sorts series A–Z by `sortName`.
  - `countSeriesByState(list: DerivedSeries[]): { all: number; unplayed: number; playing: number; finished: number }`
  - `filterSeriesBySearch(list: DerivedSeries[], query: string): DerivedSeries[]` — match by series name OR any member book title; matched series keep all books.

- [ ] **Step 1: Failing test**
```ts
import { assembleDerivedSeries, countSeriesByState, filterSeriesBySearch } from '@/helpers/seriesAssembly';
const mkBook = (id: string, url: string, title: string, prog = 0) =>
  ({ bookId: id, bookTitle: title, bookProgressValue: prog, chapters: [{ url } as any] } as any);

test('assemble resolves by structural key, drops missing, orders by position, A-Z series', () => {
  const bookMap = { b1: mkBook('b1','/x/1.mp3','Zeta'), b2: mkBook('b2','/y/1.mp3','Alpha',2) };
  const series = [{ id: 's2', name: 'Bravo', sortName: 'bravo' }, { id: 's1', name: 'Alpha', sortName: 'alpha' }];
  const memberships = [
    { seriesId: 's1', bookKey: '/y/1.mp3', position: 1 },
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0 },
    { seriesId: 's1', bookKey: '/gone.mp3', position: 2 }, // unresolved → skipped
    { seriesId: 's2', bookKey: '/x/1.mp3', position: 0 },
  ];
  const out = assembleDerivedSeries(series, memberships, bookMap);
  expect(out.map((s) => s.id)).toEqual(['s1','s2']);        // A-Z
  expect(out[0].books.map((b) => b.bookId)).toEqual(['b1','b2']); // by position, missing dropped
  expect(out[0].progressState).toBe('playing');             // [Zeta=0, Alpha=2]
});

test('countSeriesByState', () => {
  const list = [{ progressState: 'unplayed' }, { progressState: 'playing' }, { progressState: 'finished' }, { progressState: 'playing' }] as any;
  expect(countSeriesByState(list)).toEqual({ all: 4, unplayed: 1, playing: 2, finished: 1 });
});

test('filterSeriesBySearch matches name or member title', () => {
  const list = [
    { id: 's1', name: 'Discworld', books: [{ bookTitle: 'Guards! Guards!' }] },
    { id: 's2', name: 'Stormlight', books: [{ bookTitle: 'The Way of Kings' }] },
  ] as any;
  expect(filterSeriesBySearch(list, 'disc').map((s: any) => s.id)).toEqual(['s1']);
  expect(filterSeriesBySearch(list, 'kings').map((s: any) => s.id)).toEqual(['s2']);
});
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** (`seriesAssembly.ts`)
```ts
import { Book } from '@/types/Book';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { deriveSeriesProgressState, SeriesProgressState } from '@/helpers/seriesProgress';

export type SeriesRow = { id: string; name: string; sortName: string };
export type MembershipRow = { seriesId: string; bookKey: string; position: number };
export type DerivedSeries = { id: string; name: string; books: Book[]; progressState: SeriesProgressState };

function buildKeyMap(bookMap: Record<string, Book>): Map<string, Book> {
  const m = new Map<string, Book>();
  for (const book of Object.values(bookMap)) {
    const key = bookStructuralKey(book);
    if (key) m.set(key, book);
  }
  return m;
}

export function assembleDerivedSeries(
  series: SeriesRow[],
  memberships: MembershipRow[],
  bookMap: Record<string, Book>,
): DerivedSeries[] {
  const keyMap = buildKeyMap(bookMap);
  const bySeries = new Map<string, MembershipRow[]>();
  for (const m of memberships) {
    if (!bySeries.has(m.seriesId)) bySeries.set(m.seriesId, []);
    bySeries.get(m.seriesId)!.push(m);
  }
  const derived = series.map((s) => {
    const rows = (bySeries.get(s.id) ?? []).slice().sort((a, b) => a.position - b.position);
    const books: Book[] = [];
    for (const r of rows) {
      const book = keyMap.get(r.bookKey);
      if (book) books.push(book); // graceful skip
    }
    return { id: s.id, name: s.name, books, progressState: deriveSeriesProgressState(books) };
  });
  return derived.sort((a, b) => {
    const sa = series.find((x) => x.id === a.id)!.sortName;
    const sb = series.find((x) => x.id === b.id)!.sortName;
    return sa.localeCompare(sb);
  });
}

export function countSeriesByState(list: DerivedSeries[]) {
  const c = { all: list.length, unplayed: 0, playing: 0, finished: 0 };
  for (const s of list) c[s.progressState]++;
  return c;
}

export function filterSeriesBySearch(list: DerivedSeries[], query: string): DerivedSeries[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (s) => s.name.toLowerCase().includes(q) || s.books.some((b) => b.bookTitle.toLowerCase().includes(q)),
  );
}
```
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -m "feat: seriesAssembly resolve/count/search helpers"`

---

## Task 5: `seriesQueries` (DB writers + membership diff)

**Files:** Create `src/db/seriesQueries.ts`; Test `src/db/__tests__/seriesMembershipDiff.test.ts`.

**Interfaces:**
- Consumes: `database` (`@/db`), models `Series`/`SeriesBook`, `MembershipRow` shape.
- Produces:
  - `computeMembershipDiff(existing: {bookKey:string;position:number}[], desiredKeysInOrder: string[]): { toCreate: {bookKey:string;position:number}[]; toDelete: string[]; toReposition: {bookKey:string;position:number}[] }` (pure, tested).
  - `createSeries(name: string, bookKeysInOrder: string[]): Promise<string>` (returns new id).
  - `updateSeries(id: string, name: string, bookKeysInOrder: string[]): Promise<void>` (diff-applies; deletes series if `bookKeysInOrder` empty).
  - `deleteSeries(id: string): Promise<void>`.
  - `observeSeriesData(): Observable<{ series: SeriesRow[]; memberships: MembershipRow[] }>` — combines `series` + `series_books` observations.
  - `pruneOrphanedSeriesBooks(liveKeys: Set<string>): Promise<void>`.
  - `normalizeSortName(name: string): string` → `name.trim().toLowerCase()`.

- [ ] **Step 1: Failing test** (`seriesMembershipDiff.test.ts` — only the pure diff is unit-tested; writers verified on-device)
```ts
import { computeMembershipDiff } from '@/db/seriesQueries';

test('adds new, deletes removed, repositions moved', () => {
  const existing = [{ bookKey: 'a', position: 0 }, { bookKey: 'b', position: 1 }, { bookKey: 'c', position: 2 }];
  const desired = ['c', 'a', 'd']; // b removed, d added, order changed
  const diff = computeMembershipDiff(existing, desired);
  expect(diff.toDelete.sort()).toEqual(['b']);
  expect(diff.toCreate).toEqual([{ bookKey: 'd', position: 2 }]);
  expect(diff.toReposition).toEqual([{ bookKey: 'c', position: 0 }, { bookKey: 'a', position: 1 }]);
});
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `seriesQueries.ts`. Full code:
```ts
import { Q } from '@nozbe/watermelondb';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import database from '@/db';
import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';
import { SeriesRow, MembershipRow } from '@/helpers/seriesAssembly';

export const normalizeSortName = (name: string) => name.trim().toLowerCase();

export function computeMembershipDiff(
  existing: { bookKey: string; position: number }[],
  desiredKeysInOrder: string[],
) {
  const existingKeys = new Set(existing.map((e) => e.bookKey));
  const desiredSet = new Set(desiredKeysInOrder);
  const posByKey = new Map(existing.map((e) => [e.bookKey, e.position]));
  const toDelete = existing.filter((e) => !desiredSet.has(e.bookKey)).map((e) => e.bookKey);
  const toCreate: { bookKey: string; position: number }[] = [];
  const toReposition: { bookKey: string; position: number }[] = [];
  desiredKeysInOrder.forEach((bookKey, position) => {
    if (!existingKeys.has(bookKey)) toCreate.push({ bookKey, position });
    else if (posByKey.get(bookKey) !== position) toReposition.push({ bookKey, position });
  });
  return { toCreate, toDelete, toReposition };
}

export async function createSeries(name: string, bookKeysInOrder: string[]): Promise<string> {
  let newId = '';
  await database.write(async () => {
    const now = Date.now();
    const series = await database.get<Series>('series').create((s) => {
      s.name = name.trim();
      s.sortName = normalizeSortName(name);
      (s as any).createdAt = new Date(now);
      (s as any).updatedAt = new Date(now);
    });
    newId = series.id;
    const rows = bookKeysInOrder.map((bookKey, position) =>
      database.get<SeriesBook>('series_books').prepareCreate((sb) => {
        (sb as any).series_id = series.id;
        sb.bookKey = bookKey;
        sb.position = position;
        (sb as any).createdAt = new Date(now);
      }),
    );
    await database.batch(...rows);
  });
  return newId;
}

export async function updateSeries(id: string, name: string, bookKeysInOrder: string[]): Promise<void> {
  if (bookKeysInOrder.length === 0) return deleteSeries(id); // guarded auto-delete (explicit)
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    const existingRows = await database
      .get<SeriesBook>('series_books')
      .query(Q.where('series_id', id))
      .fetch();
    const existing = existingRows.map((r) => ({ bookKey: r.bookKey, position: r.position }));
    const { toCreate, toDelete, toReposition } = computeMembershipDiff(existing, bookKeysInOrder);
    const now = Date.now();
    const ops: any[] = [];
    ops.push(series.prepareUpdate((s) => { s.name = name.trim(); s.sortName = normalizeSortName(name); (s as any).updatedAt = new Date(now); }));
    for (const key of toDelete) {
      const row = existingRows.find((r) => r.bookKey === key);
      if (row) ops.push(row.prepareDestroyPermanently());
    }
    for (const { bookKey, position } of toReposition) {
      const row = existingRows.find((r) => r.bookKey === bookKey);
      if (row) ops.push(row.prepareUpdate((r) => { r.position = position; }));
    }
    for (const { bookKey, position } of toCreate) {
      ops.push(database.get<SeriesBook>('series_books').prepareCreate((sb) => {
        (sb as any).series_id = id; sb.bookKey = bookKey; sb.position = position; (sb as any).createdAt = new Date(now);
      }));
    }
    await database.batch(...ops);
  });
}

export async function deleteSeries(id: string): Promise<void> {
  await database.write(async () => {
    const series = await database.get<Series>('series').find(id);
    const rows = await database.get<SeriesBook>('series_books').query(Q.where('series_id', id)).fetch();
    await database.batch(
      ...rows.map((r) => r.prepareDestroyPermanently()),
      series.prepareDestroyPermanently(),
    );
  });
}

export function observeSeriesData(): Observable<{ series: SeriesRow[]; memberships: MembershipRow[] }> {
  const series$ = database.get<Series>('series').query().observe();
  const members$ = database.get<SeriesBook>('series_books').query().observe();
  return combineLatest([series$, members$]).pipe(
    map(([seriesModels, memberModels]) => ({
      series: seriesModels
        .filter((s) => s._raw._status !== 'deleted')
        .map((s) => ({ id: s.id, name: s.name, sortName: s.sortName })),
      memberships: memberModels
        .filter((m) => m._raw._status !== 'deleted')
        .map((m) => ({ seriesId: (m as any).series_id ?? (m.series as any).id, bookKey: m.bookKey, position: m.position })),
    })),
  );
}

export async function pruneOrphanedSeriesBooks(liveKeys: Set<string>): Promise<void> {
  const all = await database.get<SeriesBook>('series_books').query().fetch();
  const orphans = all.filter((m) => !liveKeys.has(m.bookKey));
  if (orphans.length === 0) return;
  await database.write(async () => {
    await database.batch(...orphans.map((m) => m.prepareDestroyPermanently()));
  });
}
```
- [ ] **Step 4: Run — PASS** (diff test). `npm test -- seriesMembershipDiff`
- [ ] **Step 5: Commit** `git commit -m "feat(db): seriesQueries CRUD, observe, prune, membership diff"`

---

## Task 6: `seriesStore` (observed → derived)

**Files:** Create `src/store/seriesStore.ts`. (Wiring mirrors `src/store/library.tsx:213-337`; verified on-device — no unit test.)

**Interfaces:**
- Consumes: `observeSeriesData` (Task 5), `assembleDerivedSeries` (Task 4), `useLibraryStore` (`state.books`).
- Produces: `useSeriesStore` with `{ series: DerivedSeries[]; init(): () => void; _cleanup? }`; selector `useDerivedSeries()`.

- [ ] **Step 1: Implement** — subscribe to `observeSeriesData()` AND to library `books` changes; recompute `assembleDerivedSeries` on either. Guard duplicate init like `library.tsx:215-221`.
```ts
import { create } from 'zustand';
import { Subscription } from 'rxjs';
import { observeSeriesData } from '@/db/seriesQueries';
import { assembleDerivedSeries, DerivedSeries, SeriesRow, MembershipRow } from '@/helpers/seriesAssembly';
import { useLibraryStore } from '@/store/library';

interface SeriesState {
  series: DerivedSeries[];
  init: () => () => void;
  _cleanup?: () => void;
}

export const useSeriesStore = create<SeriesState>()((set, get) => ({
  series: [],
  init: () => {
    if (get()._cleanup) return get()._cleanup!;
    let latest: { series: SeriesRow[]; memberships: MembershipRow[] } = { series: [], memberships: [] };
    const recompute = () =>
      set({ series: assembleDerivedSeries(latest.series, latest.memberships, useLibraryStore.getState().books) });

    const subs: Subscription[] = [];
    subs.push(observeSeriesData().subscribe((data) => { latest = data; recompute(); }));
    const unsubLibrary = useLibraryStore.subscribe((s, prev) => { if (s.books !== prev.books) recompute(); });

    const cleanup = () => { subs.forEach((x) => x.unsubscribe()); unsubLibrary(); set({ _cleanup: undefined }); };
    set({ _cleanup: cleanup });
    return cleanup;
  },
}));

export const useDerivedSeries = () => useSeriesStore((s) => s.series);
```
- [ ] **Step 2: Wire init** in `src/app/_layout.tsx` next to the library init (`:104-108`): `const initSeries = useSeriesStore((s) => s.init); useEffect(() => initSeries(), [initSeries]);`
- [ ] **Step 3: Type-check.** `npx tsc --noEmit` → 0 new errors.
- [ ] **Step 4: Commit** `git commit -m "feat(store): seriesStore observing series + library"`

---

## Task 7: `seriesDraftStore`

**Files:** Create `src/store/seriesDraftStore.ts`; Test `src/store/__tests__/seriesDraftStore.test.ts`.

**Interfaces:** Produces `useSeriesDraftStore` with `SeriesDraft` fields (`mode`, `editingSeriesId?`, `name`, `selectedAuthorNames`, `selectedBookKeys`, `orderedBookKeys`) + actions `resetForCreate()`, `resetForEdit(id, name, orderedKeys)`, `setName`, `toggleAuthor`, `toggleBookKey`, `setOrderedKeys`, `appendBookKeys`.

- [ ] **Step 1: Failing test**
```ts
import { useSeriesDraftStore } from '@/store/seriesDraftStore';

test('resetForCreate clears a stale draft', () => {
  const s = useSeriesDraftStore.getState();
  s.setName('Stale'); s.toggleBookKey('/x'); s.resetForCreate();
  const after = useSeriesDraftStore.getState();
  expect(after.mode).toBe('create'); expect(after.name).toBe(''); expect(after.selectedBookKeys).toEqual([]);
});
test('toggleBookKey adds then removes', () => {
  const s = useSeriesDraftStore.getState(); s.resetForCreate();
  s.toggleBookKey('/a'); expect(useSeriesDraftStore.getState().selectedBookKeys).toEqual(['/a']);
  s.toggleBookKey('/a'); expect(useSeriesDraftStore.getState().selectedBookKeys).toEqual([]);
});
```
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** a standard Zustand store with those actions (`resetForCreate` sets all to empty/`'create'`; `resetForEdit` seeds `name`/`orderedBookKeys`/`selectedBookKeys` from args and `mode:'edit'`; toggles are immutable array add/remove; `appendBookKeys` unions).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -m "feat(store): seriesDraftStore with reset discipline"`

---

## Task 8: `SeriesBookRow` presentational component

**Files:** Create `src/components/SeriesBookRow.tsx`. (Visual component; verified on-device.)

**Interfaces:** Produces `SeriesBookRow` props: `{ bookId?: string; book?: Book; context: 'selection' | 'sortable'; selected?: boolean; onPress?: () => void; onRemove?: () => void; dragHandle?: React.ReactNode }`. Styled after `BookListItem.tsx:92-171` (cover 60×80 via `FastImage`, title + author) but **no playback hooks**. Right slot: selection → bubble/outline reflecting `selected`; sortable → renders `dragHandle` + a remove (`Minus`) pressable calling `onRemove`.

- [ ] **Step 1:** Build the row (reuse `styles` shape from `BookListItem`; import `unknownBookImageUri`, `FastImage`, `useTheme`). Resolve display data from `useBookDisplayData(bookId)` when `book` not passed.
- [ ] **Step 2:** Selection context: wrap in `Pressable onPress`, draw an outline (`borderColor: themeColors.primary` when `selected`) + a check bubble.
- [ ] **Step 3:** Sortable context: render `dragHandle` (a `CustomHandle` grip passed in) on the left/right and a `Minus` icon pressable (`onRemove`).
- [ ] **Step 4:** Type-check `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `git commit -m "feat: SeriesBookRow presentational row"`

---

## Task 9: `SeriesHome` listing component

**Files:** Create `src/components/SeriesHome.tsx`. Model on `BooksHome.tsx` (flat-array FlashList) minus the Recently-Added row.

**Interfaces:**
- Consumes: `DerivedSeries[]` (already search+tab filtered by parent), `activeGridSections`/`setActiveGridSections` (Set pattern), `onScroll`, `ListHeaderComponent`, `onCreatePress`, `onEditPress(seriesId)`.
- Produces: `FlatListItem` union `sectionHeader | seriesEditBar | horizontalRow | book`; renders `BooksHorizontal` (with `preserveOrder`) collapsed, `BookGridItem` expanded, and the `seriesEditBar` row when expanded.

- [ ] **Step 1:** Copy `BooksHome.tsx` structure; drop the `recentBooks`/`recentlyAdded` block. Build `flatData` from `series` (already A–Z). For each series push `sectionHeader`; if expanded push `seriesEditBar` then `book` items (in series/`position` order — books are already ordered in `DerivedSeries.books`, so **do not** re-sort by title); else push `horizontalRow` with `books={series.books}` and `preserveOrder`.
- [ ] **Step 2:** Add `seriesEditBar` to `getItemType`, `overrideItemLayout` (`span = maxColumns`), `keyExtractor` (`edit-${seriesId}`), and a `renderItem` case rendering a full-width labeled Pressable "✎ Edit series" → `onEditPress(sectionId)`.
- [ ] **Step 3:** Sticky `ListHeaderComponent` = "+ Create Series" button (`onCreatePress`) above content; `ListEmptyComponent` = the spec empty-state copy. (Parent passes the search-bar spacer; compose both.)
- [ ] **Step 4:** Reuse the unlimited-open `activeGridSections` toggle + `SectionHeader` (chevron) from `BooksHome` (no pencil — edit lives in the bar).
- [ ] **Step 5:** Type-check + commit `git commit -m "feat: SeriesHome listing view"`

---

## Task 10: Wire toggle view 1 + Header icon + series-level tabs/search

**Files:** Modify `src/components/Header.tsx` (import `Layers`; render at `toggleView === 1`), `src/app/(drawer)/(library)/index.tsx`.

- [ ] **Step 1: Header** — add `import { Layers } from 'lucide-react-native'` and a `toggleView === 1` branch rendering `<Layers size={24} color={themeColors.icon} strokeWidth={1.5} absoluteStrokeWidth />` (mirror the existing `List` block; keep the `rotateY` wrapper or not to taste). Shift the current `List`/`Grip` blocks so slot 2 stays `Grip`.
- [ ] **Step 2: index.tsx** — consume `useDerivedSeries()`. Compute `seriesSearchFiltered = filterSeriesBySearch(series, debouncedSearchQuery)`; `seriesCounts = countSeriesByState(seriesSearchFiltered)`; `tabFilteredSeries` = filter by `selectedTab` mapped to `SeriesProgressState` (All → all; Unplayed→unplayed; Started→playing; Finished→finished).
- [ ] **Step 3:** When `toggleView === 1`, pass `seriesCounts` to `<Header bookCounts=...>` (same `{all,unplayed,playing,finished}` shape) instead of the book `bookCounts`; render `<SeriesHome series={tabFilteredSeries} ... onCreatePress={() => router.navigate('/series/create/authors')} onEditPress={(id) => router.navigate(\`/series/edit/${id}\`)} />` in place of the old `BooksList` block.
- [ ] **Step 4:** `resetForCreate()` is called on Create press (before navigate) so the wizard starts clean.
- [ ] **Step 5:** Type-check; commit `git commit -m "feat: Series toggle view + series-level tabs/search wiring"`

---

## Task 11: Create wizard (`series/_layout` + 3 steps)

**Files:** Create `src/app/series/_layout.tsx`, `create/authors.tsx`, `create/books.tsx`, `create/order.tsx`.

- [ ] **Step 1: `_layout.tsx`** — an Expo Router `<Stack>` (headerless or minimal), matching how root flow screens are presented. All screens read/write `useSeriesDraftStore`.
- [ ] **Step 2: `authors.tsx`** — list `useLibraryStore(state => state.authors)`; multi-select bubbles → `toggleAuthor`; instructional header; **Next** (`router.navigate('/series/create/books')`) disabled until `selectedAuthorNames.length > 0`; **Exit** → `resetForCreate()` + `router.back()`.
- [ ] **Step 3: `books.tsx`** — required name `TextInput` (bound to draft `name`) pinned top; below, union of selected authors' books grouped by author (author subheading), each row `SeriesBookRow context="selection"` keyed by `bookStructuralKey(book)` → `toggleBookKey`; **Next** (`/series/create/order`) disabled until `name.trim()` non-empty AND `selectedBookKeys.length > 0`. On advance, seed `orderedBookKeys` = `selectedBookKeys` (preserve current selection order).
- [ ] **Step 4: `order.tsx`** — render `Sortable.Grid columns={1}` over `orderedBookKeys`, `renderItem` = `SeriesBookRow context="sortable"` with a `Sortable.Handle`/`CustomHandle` grip; `onDragEnd` → `setOrderedKeys(newOrder)`. Resolve each key → book via a `Map<key,Book>` from the library store for display. Bottom **"Create Series"** → `await createSeries(draft.name, draft.orderedBookKeys)` then `resetForCreate()` + `router.dismissAll()`/navigate back to library.
- [ ] **Step 5:** Verify the sortable list is wrapped per lib guidance (`Sortable.Layer`/`PortalProvider` if needed for drag-over-scroll). Type-check.
- [ ] **Step 6: Commit** `git commit -m "feat: series create wizard (authors/books/order)"`

---

## Task 12: Edit screen (`series/edit/[id]`) + Add-books append

**Files:** Create `src/app/series/edit/[id].tsx`. Reuse `create/authors.tsx` + `create/books.tsx` in append mode (draft `mode === 'edit'`).

- [ ] **Step 1:** On mount, read `id` param, find the `DerivedSeries` from `useSeriesStore`, `resetForEdit(id, name, orderedKeysFromBooks)` where ordered keys = `series.books.map(bookStructuralKey)`.
- [ ] **Step 2:** Name `TextInput` (draft `name`); `Sortable.Grid columns={1}` over `orderedBookKeys` with `SeriesBookRow context="sortable"` + remove (`onRemove` → `setOrderedKeys(without key)`); reorder via `onDragEnd`.
- [ ] **Step 3: "+ Add books"** → navigate to `/series/create/authors` (append mode); the books step, when `mode==='edit'`, shows member books pre-selected and `appendBookKeys` on confirm returns to edit (via `router.back()` to `[id]`, or a dedicated append route). Simplest: the wizard's `order` step is skipped in edit-append; `books` "Done" appends and returns.
- [ ] **Step 4: "Delete Series"** at bottom → confirm dialog (`Alert.alert`) → `deleteSeries(id)` + `router.back()`.
- [ ] **Step 5: Save** → `await updateSeries(id, draft.name, draft.orderedBookKeys)` (empty list triggers guarded delete) + `router.back()`.
- [ ] **Step 6:** Type-check; commit `git commit -m "feat: series edit screen with add/reorder/remove/delete"`

---

## Task 13: Resilience hooks (prune + guarded auto-delete)

**Files:** Modify `src/helpers/scanLibrary.ts` (~L903-942 cleanup), `src/db/settingsQueries.ts` (~L273-286 path-removal book deletion).

**Interfaces:** Consumes `pruneOrphanedSeriesBooks` + `bookStructuralKey` (or the surviving chapter urls directly).

- [ ] **Step 1: scanLibrary cleanup** — after the orphaned-books batch commits, compute the set of **surviving structural keys** (first chapter url of each surviving book) and call `await pruneOrphanedSeriesBooks(liveKeys)`. Then, for **guarded auto-delete**, after prune, delete any `series` whose remaining `series_books` count is 0 (stable post-scan state).
- [ ] **Step 2: settingsQueries path removal** — in the same transaction that deletes books for a removed path, collect those books' structural keys and prune matching `series_books`; then delete now-empty series.
- [ ] **Step 3:** Add a small `deleteEmptySeries()` writer to `seriesQueries.ts` (query series, left-join count memberships, destroy those with 0). Call it from both hooks.
- [ ] **Step 4:** Type-check; commit `git commit -m "feat: prune orphaned series_books + guarded empty-series auto-delete on scan/path-removal"`

---

## Task 14: Full-suite verification

- [ ] **Step 1:** `npm test` — all suites green (existing + new: schemaV31, bookStructuralKey, seriesProgress, seriesAssembly, seriesMembershipDiff, seriesDraftStore).
- [ ] **Step 2:** `npx tsc --noEmit` — 0 errors. `npx eslint .` — 0 new errors.
- [ ] **Step 3:** Device build. Manual E2E: create a multi-author series → appears A–Z on Series view → expand shows books in user order → "✎ Edit series" reorders/removes/renames → delete confirms. Verify tab counts are **series** counts and switch buckets as books are played/finished. Verify search matches series name and member title.
- [ ] **Step 4:** **Membership durability check** — add a book to a series, edit its title in-app, trigger a rescan, confirm it stays in the series (structural key re-resolves).
- [ ] **Step 5:** Remove a book's files, rescan, confirm graceful skip and that a fully-emptied series auto-deletes (and does not flicker-delete mid-scan).

---

## Verification Summary

- **Unit:** `npm test` (pure helpers + diff + draft store + schema shape).
- **Static:** `npx tsc --noEmit`, `npx eslint .`.
- **On-device E2E:** create/browse/edit/delete; series-level tab counts; search; the two resilience scenarios (tag-edit durability, file-removal prune + auto-delete).

## Post-plan bookkeeping
- Copy this plan to `docs/superpowers/plans/2026-07-24-series-feature.md` and `git add -f` it (repo `.gitignore`s `docs/`), matching the spec's committed location, on branch `feature/series`.
