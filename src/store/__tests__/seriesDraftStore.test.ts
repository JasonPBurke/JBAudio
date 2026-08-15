import { useSeriesDraftStore } from '@/store/seriesDraftStore';

test('resetForCreate clears a stale draft', () => {
  const s = useSeriesDraftStore.getState();
  s.setName('Stale');
  s.toggleBookKey('/x');
  s.toggleAuthor('Someone');
  s.resetForCreate();

  const after = useSeriesDraftStore.getState();
  expect(after.mode).toBe('create');
  expect(after.name).toBe('');
  expect(after.selectedBookKeys).toEqual([]);
  expect(after.selectedAuthorNames).toEqual([]);
  expect(after.orderedBookKeys).toEqual([]);
  expect(after.editingSeriesId).toBeUndefined();
});

test('toggleBookKey adds then removes', () => {
  useSeriesDraftStore.getState().resetForCreate();
  useSeriesDraftStore.getState().toggleBookKey('/a');
  expect(useSeriesDraftStore.getState().selectedBookKeys).toEqual(['/a']);
  useSeriesDraftStore.getState().toggleBookKey('/a');
  expect(useSeriesDraftStore.getState().selectedBookKeys).toEqual([]);
});

test('resetForEdit seeds name, ordered + selected keys, and mode', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'My Series', ['/a', '/b']);
  const s = useSeriesDraftStore.getState();
  expect(s.mode).toBe('edit');
  expect(s.editingSeriesId).toBe('s1');
  expect(s.name).toBe('My Series');
  expect(s.orderedBookKeys).toEqual(['/a', '/b']);
  expect(s.selectedBookKeys).toEqual(['/a', '/b']);
});

test('commitPickerSelection unions without duplicates', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a']);
  useSeriesDraftStore.getState().beginPicker(); // re-seeds ['/a']
  useSeriesDraftStore.getState().toggleBookKey('/b');
  useSeriesDraftStore.getState().toggleBookKey('/c');
  useSeriesDraftStore.getState().commitPickerSelection({});

  const s = useSeriesDraftStore.getState();
  expect(s.orderedBookKeys).toEqual(['/a', '/b', '/c']);
});

describe('beginPicker — `+ Add books` starts a fresh pass', () => {
  test('clears the author filter and re-seeds the staged books from the list', () => {
    useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a', '/b']);
    useSeriesDraftStore.getState().toggleAuthor('Someone');
    useSeriesDraftStore.getState().toggleBookKey('/a'); // unticks a member
    useSeriesDraftStore.getState().beginPicker();

    const s = useSeriesDraftStore.getState();
    expect(s.selectedAuthorNames).toEqual([]);
    expect(s.selectedBookKeys).toEqual(['/a', '/b']);
  });

  /*
   * The picker is ADDITIVE. Unticking a book there and committing must not
   * remove it — removal is the editor list's affordance, and a commit is a
   * union. If this fails, the panel has become a second way to delete.
   */
  test('a commit after unticking a member cannot remove it', () => {
    useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a', '/b']);
    useSeriesDraftStore.getState().beginPicker();
    useSeriesDraftStore.getState().toggleBookKey('/a');
    useSeriesDraftStore.getState().commitPickerSelection({});

    expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual(['/a', '/b']);
  });

  /*
   * A11's remembered numbers are for the books a pass ACTUALLY ADDS, and
   * `beginPicker` re-seeds the staging from the WHOLE list — so the staged set
   * is not the added set, and handing it to `restoreRememberedNumbers` treats
   * every existing member as if it had just arrived.
   *
   * ⚠ It takes TWO passes to see, which is why no single-action test found it:
   * on the first pass the book genuinely is new and filling it is CORRECT. The
   * tombstone map is loaded once per session and stays armed, so the second
   * pass re-fills a box the user has since deliberately cleared. Code review
   * finding 8 (2026-08-13).
   */
  test('a second pass does not refill a number the user cleared', () => {
    const remembered = { '/b': '3' }; // /b's tombstone remembers #3

    useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a'], { '/a': '1' });
    useSeriesDraftStore.getState().beginPicker();
    useSeriesDraftStore.getState().toggleBookKey('/b'); // put /b back
    useSeriesDraftStore.getState().commitPickerSelection(remembered);
    expect(useSeriesDraftStore.getState().numbersByKey['/b']).toBe('3');

    useSeriesDraftStore.getState().setNumber('/b', ''); // ...then clear it

    useSeriesDraftStore.getState().beginPicker(); // `+ Add books` again
    useSeriesDraftStore.getState().toggleBookKey('/c');
    useSeriesDraftStore.getState().commitPickerSelection(remembered);

    const s = useSeriesDraftStore.getState();
    expect(s.numbersByKey['/b']).toBe('');
    expect(s.orderedBookKeys).toEqual(['/a', '/b', '/c']);
  });

  test('a fresh create stages nothing', () => {
    useSeriesDraftStore.getState().resetForCreate();
    useSeriesDraftStore.getState().beginPicker();
    expect(useSeriesDraftStore.getState().selectedBookKeys).toEqual([]);
  });
});

/*
 * §E3's acceptance criterion — "selections are kept when the author filter
 * changes, so building across ten authors does not mean starting over ten
 * times". The two live in separate fields on purpose: the author filter is a
 * VOLUME REDUCER over the pool, not a selection, so nothing it does may reach
 * the staged books. The pool itself (`pickerRows`) is never even told what is
 * staged; this is the other half of that separation.
 */
describe('the author filter never touches the staged books', () => {
  test('ticking, unticking and re-ticking authors leaves the staging intact', () => {
    useSeriesDraftStore.getState().resetForCreate();
    useSeriesDraftStore.getState().toggleBookKey('/ann/one');
    useSeriesDraftStore.getState().toggleBookKey('/bob/two');

    useSeriesDraftStore.getState().toggleAuthor('Ann');
    useSeriesDraftStore.getState().toggleAuthor('Bob');
    useSeriesDraftStore.getState().toggleAuthor('Ann'); // Ann leaves the filter

    const s = useSeriesDraftStore.getState();
    expect(s.selectedAuthorNames).toEqual(['Bob']);
    expect(s.selectedBookKeys).toEqual(['/ann/one', '/bob/two']);
  });

  /*
   * The consequence that makes the criterion worth having: a book whose author
   * has left the filter is off the POOL but still staged, so committing the
   * step still adds it.
   */
  test('a staged book survives its author leaving the filter and still commits', () => {
    useSeriesDraftStore.getState().resetForCreate();
    useSeriesDraftStore.getState().toggleAuthor('Ann');
    useSeriesDraftStore.getState().toggleBookKey('/ann/one');
    useSeriesDraftStore.getState().toggleAuthor('Ann');

    useSeriesDraftStore.getState().commitPickerSelection({});

    expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual(['/ann/one']);
  });
});

/*
 * §D3 from the data side. Numbers are keyed by STRUCTURAL KEY, never by index,
 * which is what makes "editing a number does not resort" and "reordering does
 * not disturb numbers" the same fact. An index-keyed map would silently hand
 * each book its neighbour's number the first time anyone dragged a row.
 */
test('numbers follow their book through a reorder', () => {
  useSeriesDraftStore
    .getState()
    .resetForEdit('s1', 'X', ['/a', '/b', '/c'], { '/a': '1', '/c': '3' });
  useSeriesDraftStore.getState().setOrderedKeys(['/c', '/a', '/b']);

  const s = useSeriesDraftStore.getState();
  expect(s.numbersByKey['/a']).toBe('1');
  expect(s.numbersByKey['/c']).toBe('3');
  expect(s.numbersByKey['/b']).toBeUndefined();
});

test('a stale draft cannot leak its numbers into the next series', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a'], { '/a': '7' });
  useSeriesDraftStore.getState().resetForCreate();
  expect(useSeriesDraftStore.getState().numbersByKey).toEqual({});
});

test('setOrderedKeys replaces order', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a', '/b', '/c']);
  useSeriesDraftStore.getState().setOrderedKeys(['/c', '/a', '/b']);
  expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual([
    '/c',
    '/a',
    '/b',
  ]);
});
