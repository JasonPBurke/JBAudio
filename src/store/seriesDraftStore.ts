import { create } from 'zustand';

/**
 * Working draft for the create wizard and edit screen. Kept OUTSIDE the wizard
 * screens because each pushed step unmounts as the next is pushed. Always reset
 * on entry (resetForCreate / resetForEdit) so an abandoned draft can't leak
 * into the next run. Book identity throughout is the structural key (first file
 * path), consistent with series_books.book_key.
 */
interface SeriesDraftState {
  mode: 'create' | 'edit';
  editingSeriesId?: string;
  name: string;
  selectedAuthorNames: string[]; // create step 1 filter
  selectedBookKeys: string[]; // create step 2 / add-books selection
  orderedBookKeys: string[]; // step 3 / edit ordering (source of truth on save)

  resetForCreate: () => void;
  resetForEdit: (id: string, name: string, orderedKeys: string[]) => void;
  setName: (name: string) => void;
  toggleAuthor: (name: string) => void;
  toggleBookKey: (key: string) => void;
  setOrderedKeys: (keys: string[]) => void;
  appendBookKeys: (keys: string[]) => void;
}

const toggle = (arr: string[], value: string) =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

const union = (arr: string[], additions: string[]) => {
  const seen = new Set(arr);
  const merged = [...arr];
  for (const a of additions) {
    if (!seen.has(a)) {
      seen.add(a);
      merged.push(a);
    }
  }
  return merged;
};

export const useSeriesDraftStore = create<SeriesDraftState>()((set) => ({
  mode: 'create',
  editingSeriesId: undefined,
  name: '',
  selectedAuthorNames: [],
  selectedBookKeys: [],
  orderedBookKeys: [],

  resetForCreate: () =>
    set({
      mode: 'create',
      editingSeriesId: undefined,
      name: '',
      selectedAuthorNames: [],
      selectedBookKeys: [],
      orderedBookKeys: [],
    }),

  resetForEdit: (id, name, orderedKeys) =>
    set({
      mode: 'edit',
      editingSeriesId: id,
      name,
      selectedAuthorNames: [],
      selectedBookKeys: [...orderedKeys],
      orderedBookKeys: [...orderedKeys],
    }),

  setName: (name) => set({ name }),

  toggleAuthor: (name) =>
    set((s) => ({ selectedAuthorNames: toggle(s.selectedAuthorNames, name) })),

  toggleBookKey: (key) =>
    set((s) => ({ selectedBookKeys: toggle(s.selectedBookKeys, key) })),

  setOrderedKeys: (keys) => set({ orderedBookKeys: keys }),

  appendBookKeys: (keys) =>
    set((s) => ({
      orderedBookKeys: union(s.orderedBookKeys, keys),
      selectedBookKeys: union(s.selectedBookKeys, keys),
    })),
}));
