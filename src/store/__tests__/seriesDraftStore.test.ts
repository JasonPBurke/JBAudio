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

test('appendBookKeys unions without duplicates', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a']);
  useSeriesDraftStore.getState().appendBookKeys(['/a', '/b', '/c']);
  const s = useSeriesDraftStore.getState();
  expect(s.orderedBookKeys).toEqual(['/a', '/b', '/c']);
  expect(s.selectedBookKeys).toEqual(['/a', '/b', '/c']);
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
    const staged = useSeriesDraftStore.getState().selectedBookKeys;
    useSeriesDraftStore.getState().appendBookKeys(staged);

    expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual(['/a', '/b']);
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

    const staged = useSeriesDraftStore.getState().selectedBookKeys;
    useSeriesDraftStore.getState().appendBookKeys(staged);

    expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual(['/ann/one']);
  });
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
