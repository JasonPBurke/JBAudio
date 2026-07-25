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

test('setOrderedKeys replaces order', () => {
  useSeriesDraftStore.getState().resetForEdit('s1', 'X', ['/a', '/b', '/c']);
  useSeriesDraftStore.getState().setOrderedKeys(['/c', '/a', '/b']);
  expect(useSeriesDraftStore.getState().orderedBookKeys).toEqual([
    '/c',
    '/a',
    '/b',
  ]);
});
